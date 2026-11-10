// lpu-events-admin/supabase/functions/superadmin-monitoring/index.ts
// LPU Events — Super Admin Monitoring Proxy Edge Function (MON-001 - MON-008 / Stage 7)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { MonitoringSecurityError } from "./types.ts";
import type {
  MonitoringAction,
  MonitoringRequestContext,
  MonitoringOverviewPayload,
} from "./types.ts";
import { authorizeSuperAdminRequest } from "./auth.ts";
import {
  fetchPostHogIssues,
  fetchPostHogIssueDetail,
  updatePostHogIssue,
  pingPostHog,
} from "./providers/posthog.ts";
import { fetchUptimeRobotMonitors, pingUptimeRobot } from "./providers/uptimerobot.ts";
import { querySupabaseLogs, pingSupabaseLogs } from "./providers/supabase-logs.ts";
import { fetchGscOverview, pingGsc } from "./providers/gsc.ts";
import { captureEdgeException } from "../_shared/telemetry.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

const ALLOWED_ORIGINS = new Set([
  "https://admin.lpuevents.live",
  "https://lpueventsadmin.live",
  "https://www.lpueventsadmin.live",
  "https://lpuevents.live",
  "https://www.lpuevents.live",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

function resolveCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allowedOrigin = "https://admin.lpuevents.live";
  if (origin) {
    if (
      ALLOWED_ORIGINS.has(origin) ||
      origin.endsWith(".lpueventsadmin.live") ||
      origin.endsWith(".lpuevents.live") ||
      origin.endsWith(".pages.dev") ||
      origin.endsWith(".workers.dev") ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) {
      allowedOrigin = origin;
    }
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-correlation-id, accept",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function createMonitoringRequestContext(req: Request): MonitoringRequestContext {
  const requestId = `mon_req_${crypto.randomUUID()}`;
  const rawCorrelation =
    req.headers.get("x-correlation-id") || req.headers.get("X-Correlation-Id");
  const incomingCorrelation = rawCorrelation ? rawCorrelation.trim() : null;
  let correlationId = requestId;
  if (incomingCorrelation && /^[A-Za-z0-9_.-]{1,64}$/.test(incomingCorrelation)) {
    correlationId = incomingCorrelation;
  }

  return {
    requestId,
    correlationId,
    startedAt: new Date().toISOString(),
    startTimeMs: performance.now(),
    origin: req.headers.get("origin") || undefined,
  };
}

serve(async (req: Request) => {
  const cors = resolveCorsHeaders(req);

  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const ctx = createMonitoringRequestContext(req);

  try {
    const supabaseUrl = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "";
    const serviceRoleKey = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new MonitoringSecurityError(
        "INTERNAL_ERROR",
        "Monitoring proxy is misconfigured: missing server credentials.",
        500
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2. Authorize Super Admin request
    const authResult = await authorizeSuperAdminRequest(req, supabaseAdmin);
    ctx.adminUserId = authResult.adminUserId;

    // 3. Determine action
    const url = new URL(req.url);
    let action = (url.searchParams.get("action") || "") as MonitoringAction;
    let bodyData: any = {};

    if (req.method === "POST" || req.method === "PATCH") {
      try {
        bodyData = await req.json();
        if (!action && bodyData.action) {
          action = bodyData.action as MonitoringAction;
        }
      } catch {
        // Body was empty or not JSON
      }
    }

    if (!action) {
      action = "monitoring_overview";
    }
    ctx.action = action;

    let responsePayload: any;

    switch (action) {
      case "monitoring_overview": {
        const [issuesRes, monitorsRes, phPing, urPing, logsPing, gscPing, incidentsRes] =
          await Promise.allSettled([
            fetchPostHogIssues({ limit: 50, status: "active" }),
            fetchUptimeRobotMonitors(),
            pingPostHog(),
            pingUptimeRobot(),
            pingSupabaseLogs(),
            pingGsc(),
            supabaseAdmin
              .from("ops_incidents")
              .select("id, title, severity, status, created_at")
              .order("created_at", { ascending: false })
              .limit(5),
          ]);

        const issues = issuesRes.status === "fulfilled" ? issuesRes.value.issues : [];
        const activeIssuesCount =
          issuesRes.status === "fulfilled" ? issuesRes.value.total : 0;
        const criticalIssuesCount = issues.filter((i) => i.severity === "P0").length;
        const exceptions24hCount = issues.reduce((acc, curr) => acc + curr.occurrences, 0);

        const monitors = monitorsRes.status === "fulfilled" ? monitorsRes.value : [];
        const hasDownMonitor = monitors.some(
          (m) => m.status === "down" || m.status === "seems_down"
        );

        let platformStatus: MonitoringOverviewPayload["platformStatus"] = "OPERATIONAL";
        if (hasDownMonitor || criticalIssuesCount > 0) {
          platformStatus = "DEGRADED";
        }
        if (monitorsRes.status === "rejected" && issuesRes.status === "rejected") {
          platformStatus = "UNKNOWN";
        }

        const nowIso = new Date().toISOString();
        const checkedFallback = {
          connected: false,
          error: "Probe execution failed",
          checkedAt: nowIso,
        };

        const recentIncidents =
          incidentsRes.status === "fulfilled" && incidentsRes.value.data
            ? incidentsRes.value.data
            : [];

        const overview: MonitoringOverviewPayload = {
          platformStatus,
          dataFreshness: nowIso,
          activeIssuesCount,
          criticalIssuesCount,
          exceptions24hCount,
          monitors,
          providerConnectivity: {
            posthogIngestion:
              phPing.status === "fulfilled" ? phPing.value : checkedFallback,
            posthogApi: phPing.status === "fulfilled" ? phPing.value : checkedFallback,
            uptimeRobot:
              urPing.status === "fulfilled" ? urPing.value : checkedFallback,
            supabaseLogs:
              logsPing.status === "fulfilled" ? logsPing.value : checkedFallback,
            googleSearchConsole:
              gscPing.status === "fulfilled" ? gscPing.value : checkedFallback,
          },
          recentIncidents,
        };

        responsePayload = overview;
        break;
      }

      case "posthog_issues": {
        const status = url.searchParams.get("status") || bodyData.status || "active";
        const limit = parseInt(url.searchParams.get("limit") || bodyData.limit || "50", 10);
        const offset = parseInt(url.searchParams.get("offset") || bodyData.offset || "0", 10);
        responsePayload = await fetchPostHogIssues({ status, limit, offset });
        break;
      }

      case "posthog_issue_detail": {
        const issueId = url.searchParams.get("issue_id") || bodyData.issue_id;
        if (!issueId) {
          throw new MonitoringSecurityError("BAD_REQUEST", "Missing issue_id parameter.", 400);
        }
        responsePayload = await fetchPostHogIssueDetail(issueId);
        break;
      }

      case "posthog_issue_update": {
        const issueId = bodyData.issue_id || url.searchParams.get("issue_id");
        const status = bodyData.status;
        if (!issueId || !status) {
          throw new MonitoringSecurityError(
            "BAD_REQUEST",
            "Missing issue_id or status parameter.",
            400
          );
        }
        responsePayload = await updatePostHogIssue(issueId, status);
        break;
      }

      case "uptimerobot_monitors": {
        responsePayload = await fetchUptimeRobotMonitors();
        break;
      }

      case "supabase_logs": {
        const source = bodyData.source || url.searchParams.get("source") || "function_logs";
        const isoTimestampStart =
          bodyData.iso_timestamp_start || url.searchParams.get("iso_timestamp_start");
        const isoTimestampEnd =
          bodyData.iso_timestamp_end || url.searchParams.get("iso_timestamp_end");
        const correlationId =
          bodyData.correlation_id || url.searchParams.get("correlation_id");
        const sql = bodyData.sql;
        const limit = bodyData.limit ? parseInt(String(bodyData.limit), 10) : 100;

        responsePayload = await querySupabaseLogs({
          source,
          isoTimestampStart,
          isoTimestampEnd,
          correlationId,
          sql,
          limit,
        });
        break;
      }

      case "gsc_overview": {
        const days = parseInt(url.searchParams.get("days") || bodyData.days || "28", 10);
        responsePayload = await fetchGscOverview({ days });
        break;
      }

      case "provider_health": {
        const [ph, ur, logs, gsc] = await Promise.all([
          pingPostHog(),
          pingUptimeRobot(),
          pingSupabaseLogs(),
          pingGsc(),
        ]);
        responsePayload = {
          posthog: ph,
          uptimeRobot: ur,
          supabaseLogs: logs,
          googleSearchConsole: gsc,
        };
        break;
      }

      default:
        throw new MonitoringSecurityError(
          "INVALID_ACTION",
          `Unsupported monitoring action: '${action}'.`,
          400
        );
    }

    return new Response(JSON.stringify({ data: responsePayload, correlation_id: ctx.correlationId }), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "x-correlation-id": ctx.correlationId,
      },
    });
  } catch (err: any) {
    const isSecurityError = err instanceof MonitoringSecurityError;
    const statusCode = isSecurityError ? err.statusCode : 500;
    const errorCode = isSecurityError ? err.code : "INTERNAL_ERROR";
    const errorMessage = err?.message || "An unexpected internal error occurred.";

    // Non-blocking telemetry capture for unexpected server errors (5xx)
    if (statusCode >= 500) {
      captureEdgeException(err, req, {
        function_name: "superadmin-monitoring",
        correlation_id: ctx.correlationId,
        admin_user_id: ctx.adminUserId,
        status_code: statusCode,
      });
    }

    return new Response(
      JSON.stringify({
        error: {
          code: errorCode,
          message: errorMessage,
        },
        correlation_id: ctx.correlationId,
      }),
      {
        status: statusCode,
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "x-correlation-id": ctx.correlationId,
        },
      }
    );
  }
});
