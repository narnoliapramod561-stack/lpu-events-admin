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
    return Deno.env.get("SUPABASE_MANAGEMENT_API_TOKEN") || "";
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

  let finalSql = options.sql;
  if (!finalSql) {
    const source = options.source || "function_logs";
    const limit = options.limit || 100;
    const correlationFilter = options.correlationId
      ? `AND event_message LIKE '%${options.correlationId.replace(/'/g, "")}%'`
      : "";

    if (source === "function_logs") {
      finalSql = `SELECT id, timestamp, event_message, source FROM logs WHERE source = 'function_logs' AND timestamp >= '${startTime.toISOString()}' AND timestamp <= '${endTime.toISOString()}' ${correlationFilter} ORDER BY timestamp DESC LIMIT ${limit}`;
    } else {
      finalSql = `SELECT id, timestamp, log_attributes, source FROM logs WHERE source = '${source}' AND timestamp >= '${startTime.toISOString()}' AND timestamp <= '${endTime.toISOString()}' ORDER BY timestamp DESC LIMIT ${limit}`;
    }
  }

  const endpoint = `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs?sql=${encodeURIComponent(finalSql)}`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000), // 10s bounded timeout
  });

  if (!res.ok) {
    throw new Error(`Supabase Management Logs API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const rawRows: any[] = data.result || data.data || (Array.isArray(data) ? data : []);

  return rawRows.map((r: any): SupabaseLogRecord => ({
    id: String(r.id || crypto.randomUUID()),
    timestamp: r.timestamp || new Date().toISOString(),
    event_message: r.event_message,
    source: r.source || options.source || "function_logs",
    log_attributes: r.log_attributes,
    metadata: r.metadata,
  }));
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
