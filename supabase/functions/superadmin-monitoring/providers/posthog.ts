// lpu-events-admin/supabase/functions/superadmin-monitoring/providers/posthog.ts
// PostHog Error Tracking REST API Adapter (MON-002 / MON-004 / MON-008 Stage 7)

import type { NormalizedPostHogIssue, ProviderConnectivityStatus } from "../types.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

const POSTHOG_API_BASE = "https://us.posthog.com";
const DEFAULT_PROJECT_ID = "531855";

function getCredentials(providedKey?: string, providedProjectId?: string) {
  const apiKey = providedKey || (typeof Deno !== "undefined" ? Deno.env.get("POSTHOG_PERSONAL_API_KEY") : "") || "";
  const projectId = providedProjectId || (typeof Deno !== "undefined" ? Deno.env.get("POSTHOG_PROJECT_ID") : "") || DEFAULT_PROJECT_ID;
  return { apiKey, projectId };
}

export function buildDeepLink(projectId: string, issueId: string): string {
  return `${POSTHOG_API_BASE}/project/${projectId}/error_tracking/${issueId}`;
}

export async function fetchPostHogIssues(options?: {
  status?: string;
  limit?: number;
  offset?: number;
  apiKey?: string;
  projectId?: string;
}): Promise<{ issues: NormalizedPostHogIssue[]; total: number }> {
  const { apiKey, projectId } = getCredentials(options?.apiKey, options?.projectId);
  if (!apiKey) {
    throw new Error("POSTHOG_PERSONAL_API_KEY is not configured.");
  }

  const status = options?.status || "active";
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const url = `${POSTHOG_API_BASE}/api/projects/${projectId}/error_tracking/issues/?status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`PostHog Error Tracking API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawResults: any[] = data.results || (Array.isArray(data) ? data : []);
  const total = typeof data.count === "number" ? data.count : rawResults.length;

  const issues: NormalizedPostHogIssue[] = rawResults.map((raw: any) => {
    const isBackend = raw.app === "backend" || raw.name?.includes("backend") || raw.description?.includes("backend");
    
    // Backend service distinct identity renders N/A for users
    const users = isBackend
      ? "N/A"
      : typeof raw.users === "number"
      ? raw.users
      : typeof raw.distinct_users === "number"
      ? raw.distinct_users
      : 1;

    let app: NormalizedPostHogIssue["app"] = "student";
    if (raw.app === "admin") app = "admin";
    else if (raw.app === "backend" || isBackend) app = "backend";
    else if (raw.app === "multi") app = "multi";

    let severity: NormalizedPostHogIssue["severity"] = "P2";
    if (raw.severity) {
      severity = raw.severity;
    } else if (raw.occurrences > 100 || raw.name?.includes("Database") || raw.name?.includes("Fatal")) {
      severity = "P0";
    } else if (raw.occurrences > 20) {
      severity = "P1";
    }

    const issueId = String(raw.id);

    return {
      id: issueId,
      name: raw.name || raw.title || "Unnamed Exception",
      status: (raw.status as NormalizedPostHogIssue["status"]) || "active",
      severity,
      app,
      environment: raw.environment || "production",
      component: raw.component || raw.first_seen_component || "UnknownComponent",
      occurrences: typeof raw.occurrences === "number" ? raw.occurrences : 1,
      users,
      firstSeen: raw.first_seen || raw.created_at || new Date().toISOString(),
      lastSeen: raw.last_seen || raw.updated_at || new Date().toISOString(),
      release: raw.release || raw.$release || "unknown",
      deepLink: buildDeepLink(projectId, issueId),
    };
  });

  return { issues, total };
}

export async function fetchPostHogIssueDetail(
  issueId: string,
  options?: { apiKey?: string; projectId?: string }
): Promise<any> {
  const { apiKey, projectId } = getCredentials(options?.apiKey, options?.projectId);
  if (!apiKey) {
    throw new Error("POSTHOG_PERSONAL_API_KEY is not configured.");
  }

  // Validate issueId format (alphanumeric, hyphen, underscore)
  if (!issueId || !/^[A-Za-z0-9_.-]{1,64}$/.test(issueId)) {
    throw new Error("Invalid issue_id format.");
  }

  const url = `${POSTHOG_API_BASE}/api/projects/${projectId}/error_tracking/issues/${encodeURIComponent(issueId)}/`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`PostHog Issue Detail error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  data.deepLink = buildDeepLink(projectId, issueId);
  return data;
}

export async function updatePostHogIssue(
  issueId: string,
  status: "resolved" | "suppressed" | "active",
  options?: { apiKey?: string; projectId?: string }
): Promise<any> {
  const { apiKey, projectId } = getCredentials(options?.apiKey, options?.projectId);
  if (!apiKey) {
    throw new Error("POSTHOG_PERSONAL_API_KEY is not configured.");
  }

  if (!issueId || !/^[A-Za-z0-9_.-]{1,64}$/.test(issueId)) {
    throw new Error("Invalid issue_id format.");
  }

  if (!["resolved", "suppressed", "active"].includes(status)) {
    throw new Error("Invalid status. Permitted: 'resolved' | 'suppressed' | 'active'.");
  }

  const url = `${POSTHOG_API_BASE}/api/projects/${projectId}/error_tracking/issues/${encodeURIComponent(issueId)}/`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ status }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`PostHog Issue Update error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function pingPostHog(options?: {
  apiKey?: string;
  projectId?: string;
}): Promise<ProviderConnectivityStatus> {
  const start = performance.now();
  const checkedAt = new Date().toISOString();
  try {
    const { apiKey, projectId } = getCredentials(options?.apiKey, options?.projectId);
    if (!apiKey) {
      return { connected: false, error: "POSTHOG_PERSONAL_API_KEY not configured", checkedAt };
    }
    const res = await fetch(
      `${POSTHOG_API_BASE}/api/projects/${projectId}/error_tracking/issues/?limit=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
    return { connected: false, latencyMs, error: err.message || "Failed to reach PostHog API", checkedAt };
  }
}
