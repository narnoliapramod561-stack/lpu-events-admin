// supabase/functions/superadmin-operations/providers/supabase.ts
// Supabase & PostgreSQL Operational Telemetry Adapter (Phase 3)

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import {
  NormalizedMetricSnapshot,
  HealthProbeResult,
  ProviderCollectionResult,
} from "./types.ts";
import { withTimeout } from "../timeout.ts";

export async function collectSupabaseTelemetry(
  supabaseAdmin: SupabaseClient
): Promise<ProviderCollectionResult> {
  const metrics: NormalizedMetricSnapshot[] = [];
  const probes: HealthProbeResult[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  // 1. PostgreSQL Local Diagnostic Probe & Metrics
  const dbStartTime = performance.now();
  try {
    const { data: dbDiag, error: dbError } = await withTimeout(
      async () => await supabaseAdmin.rpc("get_operations_database_diagnostics"),
      5000,
      "supabase_database_diagnostics"
    );

    const latencyMs = Math.round((performance.now() - dbStartTime) * 100) / 100;

    if (dbError || !dbDiag) {
      probes.push({
        serviceId: "supabase_database",
        probeKey: "supabase_database_connectivity",
        success: false,
        status: "DEGRADED",
        latencyMs,
        errorCode: dbError?.code || "DIAGNOSTIC_EMPTY",
        errorMessage: dbError?.message || "Database diagnostic RPC returned empty payload.",
        checkedAt: now,
      });
      errors.push(`Database probe failed: ${dbError?.message || "Empty response"}`);
    } else {
      probes.push({
        serviceId: "supabase_database",
        probeKey: "supabase_database_connectivity",
        success: true,
        status: dbDiag.status === "HEALTHY" ? "HEALTHY" : "DEGRADED",
        latencyMs: dbDiag.latency_ms || latencyMs,
        checkedAt: now,
        metadata: {
          is_in_recovery: dbDiag.is_in_recovery,
          connected: dbDiag.connected,
        },
      });

      // Record normalized metrics
      metrics.push({
        serviceId: "supabase_database",
        metricKey: "database.query_latency_ms",
        metricValue: dbDiag.latency_ms || latencyMs,
        unit: "milliseconds",
        status: "HEALTHY",
        source: "supabase_sql",
        capturedAt: now,
      });

      if (typeof dbDiag.active_connections === "number" && dbDiag.active_connections >= 0) {
        metrics.push({
          serviceId: "supabase_database",
          metricKey: "database.active_connections",
          metricValue: dbDiag.active_connections,
          unit: "count",
          status: "HEALTHY",
          source: "supabase_sql",
          capturedAt: now,
        });
      }

      if (dbDiag.record_counts) {
        metrics.push({
          serviceId: "supabase_database",
          metricKey: "database.events_count",
          metricValue: dbDiag.record_counts.total_events,
          unit: "count",
          status: "HEALTHY",
          source: "supabase_sql",
          capturedAt: now,
        });
        metrics.push({
          serviceId: "supabase_database",
          metricKey: "database.admin_users_count",
          metricValue: dbDiag.record_counts.active_admins,
          unit: "count",
          status: "HEALTHY",
          source: "supabase_sql",
          capturedAt: now,
        });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    probes.push({
      serviceId: "supabase_database",
      probeKey: "supabase_database_connectivity",
      success: false,
      status: "UNAVAILABLE",
      latencyMs: Math.round((performance.now() - dbStartTime) * 100) / 100,
      errorCode: "PROBE_EXCEPTION",
      errorMessage: msg,
      checkedAt: now,
    });
    errors.push(`Database exception: ${msg}`);
  }

  // 2. Supabase Auth Service Health Probe
  const authStartTime = performance.now();
  try {
    const { count, error: authCountError } = await supabaseAdmin
      .from("admin_users")
      .select("id", { count: "exact", head: true });

    const authLatency = Math.round((performance.now() - authStartTime) * 100) / 100;

    if (authCountError) {
      probes.push({
        serviceId: "supabase_auth",
        probeKey: "supabase_auth_reachability",
        success: false,
        status: "DEGRADED",
        latencyMs: authLatency,
        errorCode: authCountError.code,
        errorMessage: authCountError.message,
        checkedAt: now,
      });
    } else {
      probes.push({
        serviceId: "supabase_auth",
        probeKey: "supabase_auth_reachability",
        success: true,
        status: "HEALTHY",
        latencyMs: authLatency,
        checkedAt: now,
      });
      metrics.push({
        serviceId: "supabase_auth",
        metricKey: "auth.admin_users_count",
        metricValue: count ?? 0,
        unit: "count",
        status: "HEALTHY",
        source: "supabase_sql",
        capturedAt: now,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    probes.push({
      serviceId: "supabase_auth",
      probeKey: "supabase_auth_reachability",
      success: false,
      status: "UNAVAILABLE",
      latencyMs: Math.round((performance.now() - authStartTime) * 100) / 100,
      errorCode: "AUTH_PROBE_EXCEPTION",
      errorMessage: msg,
      checkedAt: now,
    });
  }

  // 3. Supabase Management API Usage (Optional Scoped PAT)
  const mgmtToken = Deno.env.get("SUPABASE_MANAGEMENT_TOKEN");
  const projectRef = Deno.env.get("SUPABASE_PROJECT_REF");

  if (!mgmtToken || !projectRef) {
    probes.push({
      serviceId: "supabase_database",
      probeKey: "supabase_management_api_reachability",
      success: false,
      status: "NOT_CONFIGURED",
      latencyMs: 0,
      errorMessage: "SUPABASE_MANAGEMENT_TOKEN or SUPABASE_PROJECT_REF not configured.",
      checkedAt: now,
    });
  } else {
    const mgmtStartTime = performance.now();
    try {
      const resp = await withTimeout(
        async (signal) =>
          await fetch(`https://api.supabase.com/v1/projects/${projectRef}/usage`, {
            headers: {
              Authorization: `Bearer ${mgmtToken}`,
              Accept: "application/json",
            },
            signal,
          }),
        5000,
        "supabase_management_api"
      );

      const mgmtLatency = Math.round((performance.now() - mgmtStartTime) * 100) / 100;

      if (!resp.ok) {
        probes.push({
          serviceId: "supabase_database",
          probeKey: "supabase_management_api_reachability",
          success: false,
          status: resp.status === 401 || resp.status === 403 ? "AUTHENTICATION_FAILED" : "DEGRADED",
          latencyMs: mgmtLatency,
          statusCode: resp.status,
          errorMessage: `Management API HTTP ${resp.status}`,
          checkedAt: now,
        });
      } else {
        const usageData = await resp.json();
        probes.push({
          serviceId: "supabase_database",
          probeKey: "supabase_management_api_reachability",
          success: true,
          status: "HEALTHY",
          latencyMs: mgmtLatency,
          statusCode: 200,
          checkedAt: now,
        });

        if (usageData?.db_size?.usage) {
          metrics.push({
            serviceId: "supabase_database",
            metricKey: "database.storage_bytes",
            metricValue: usageData.db_size.usage,
            metricLimit: usageData.db_size.limit || null,
            unit: "bytes",
            status: "HEALTHY",
            source: "supabase_management_api",
            capturedAt: now,
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      probes.push({
        serviceId: "supabase_database",
        probeKey: "supabase_management_api_reachability",
        success: false,
        status: "UNAVAILABLE",
        latencyMs: Math.round((performance.now() - mgmtStartTime) * 100) / 100,
        errorMessage: msg,
        checkedAt: now,
      });
    }
  }

  return {
    provider: "supabase",
    metrics,
    probes,
    errors,
    isConfigured: true,
  };
}
