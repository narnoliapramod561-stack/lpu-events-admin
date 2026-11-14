// lpu-events-admin/supabase/functions/superadmin-monitoring/providers/supabase-logs.ts
// Supabase ClickHouse Logs Management API Adapter (MON-004 / MON-006 / MON-008 Stage 7)

import type { ProviderConnectivityStatus, SupabaseLogRecord } from "../types.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

function getProjectRef(): string {
  if (typeof Deno !== "undefined") {
    const explicit = Deno.env.get("SUPABASE_PROJECT_REF");
    if (explicit) return explicit;
    const url = Deno.env.get("SUPABASE_URL") || "";
    const match = url.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
    if (match && match[1]) return match[1];
  }
  return "";
}

function getManagementToken(providedToken?: string): string {
  if (providedToken) return providedToken;
  if (typeof Deno !== "undefined") {
    return Deno.env.get("MANAGEMENT_API_TOKEN") || Deno.env.get("SUPABASE_MANAGEMENT_API_TOKEN") || "";
  }
  return "";
}

export interface SupabaseLogsQueryOptions {
  token?: string;
  projectRef?: string;
  sql?: string;
  source?: "function_logs" | "function_edge_logs" | "edge_logs" | "postgres_logs" | "auth_logs";
  isoTimestampStart?: string;
  isoTimestampEnd?: string;
  correlationId?: string;
  limit?: number;
}

export async function querySupabaseLogs(options: SupabaseLogsQueryOptions): Promise<SupabaseLogRecord[]> {
  const token = getManagementToken(options.token);
  const ref = options.projectRef || getProjectRef();

  if (!token) {
    throw new Error("SUPABASE_MANAGEMENT_API_TOKEN is not configured.");
  }
  if (!ref) {
    throw new Error("Supabase project reference could not be determined.");
  }

  // Enforce 24-hour maximum query window
  const now = new Date();
  const startTime = options.isoTimestampStart
    ? new Date(options.isoTimestampStart)
    : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const endTime = options.isoTimestampEnd ? new Date(options.isoTimestampEnd) : now;

  const windowDurationMs = endTime.getTime() - startTime.getTime();
  const MAX_WINDOW_MS = 24 * 60 * 60 * 1000 + 60 * 1000; // 24h + 1min tolerance
  if (windowDurationMs > MAX_WINDOW_MS) {
    throw new Error("Supabase Free Tier log queries are restricted to a maximum window of 24 hours.");
  }

  const ALLOWED_SOURCES = new Set([
    "function_logs",
    "function_edge_logs",
    "edge_logs",
    "postgres_logs",
    "auth_logs",
  ]);

  const rawSource = options.source || "function_logs";
  const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : "function_logs";
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 500);

  // Safely sanitize search query against SQL injection while preserving words, slashes, hyphens
  const safeSearch = (options.correlationId || "").replace(/[';\\]/g, "").slice(0, 100).trim();
  const correlationFilter = safeSearch
    ? `AND event_message LIKE '%${safeSearch}%'`
    : "";

  const finalSql = `SELECT timestamp, event_message FROM logs WHERE source = '${source}' ${correlationFilter} ORDER BY timestamp DESC LIMIT ${limit}`;

  const queryParams = new URLSearchParams({
    sql: finalSql,
    iso_timestamp_start: startTime.toISOString(),
    iso_timestamp_end: endTime.toISOString(),
  });

  const endpoint = `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs?${queryParams.toString()}`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000), // 10s bounded timeout
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Supabase Management Logs API error: ${res.status} ${res.statusText} ${errorBody}`.trim());
  }

  const data = await res.json();

  if (data.error) {
    const errMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    throw new Error(`ClickHouse logs query failed: ${errMsg}`);
  }

  const rawRows: any[] = data.result || data.data || (Array.isArray(data) ? data : []);

  return rawRows.map((r: any): SupabaseLogRecord => {
    let normalizedTs = r.timestamp;
    if (typeof r.timestamp === "number" && r.timestamp > 1e14) {
      normalizedTs = new Date(Math.round(r.timestamp / 1000)).toISOString();
    } else if (typeof r.timestamp === "string" && /^\d{15,18}$/.test(r.timestamp)) {
      normalizedTs = new Date(Math.round(Number(r.timestamp) / 1000)).toISOString();
    } else if (typeof r.timestamp === "number") {
      normalizedTs = new Date(r.timestamp).toISOString();
    } else if (!r.timestamp) {
      normalizedTs = new Date().toISOString();
    }

    // Attempt to decode structured JSON from event_message if present
    let parsedMeta: Record<string, unknown> = {};
    if (typeof r.event_message === "string" && r.event_message.trim().startsWith("{")) {
      try {
        parsedMeta = JSON.parse(r.event_message);
      } catch {
        parsedMeta = {};
      }
    }

    const logAttrs = typeof r.log_attributes === "object" && r.log_attributes ? r.log_attributes : parsedMeta;
    const meta = typeof r.metadata === "object" && r.metadata ? r.metadata : parsedMeta;

    const statusCode =
      typeof r.status_code === "number"
        ? r.status_code
        : typeof logAttrs?.status_code === "number"
        ? logAttrs.status_code
        : typeof logAttrs?.statusCode === "number"
        ? logAttrs.statusCode
        : typeof meta?.[0]?.response?.[0]?.status_code === "number"
        ? meta[0].response[0].status_code
        : typeof meta?.status_code === "number"
        ? meta.status_code
        : undefined;

    return {
      id: String(r.id || r.uuid || crypto.randomUUID()),
      timestamp: String(normalizedTs),
      event_message: r.event_message,
      source: r.source || options.source || "function_logs",
      status_code: statusCode,
      log_attributes: logAttrs,
      metadata: meta,
    };
  });
}

export async function pingSupabaseLogs(options?: {
  token?: string;
  projectRef?: string;
}): Promise<ProviderConnectivityStatus> {
  const start = performance.now();
  const checkedAt = new Date().toISOString();
  try {
    const token = getManagementToken(options?.token);
    const ref = options?.projectRef || getProjectRef();
    if (!token || !ref) {
      return { connected: false, error: "SUPABASE_MANAGEMENT_API_TOKEN or project ref missing", checkedAt };
    }
    const pingSql = `SELECT 1 FROM logs LIMIT 1`;
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs?sql=${encodeURIComponent(pingSql)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    const latencyMs = Math.round(performance.now() - start);
    return {
      connected: res.ok,
      latencyMs,
      error: res.ok ? undefined : `HTTP ${res.status}: ${res.statusText}`,
      checkedAt,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { connected: false, latencyMs, error: err.message || "Failed to reach Supabase Logs API", checkedAt };
  }
}
