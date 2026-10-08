// supabase/functions/superadmin-operations/providers/sentry.ts
// Sentry Organization Error Telemetry Adapter (Phase 3)

import {
  NormalizedMetricSnapshot,
  HealthProbeResult,
  ProviderCollectionResult,
} from "./types.ts";
import { withTimeout } from "../timeout.ts";

export async function collectSentryTelemetry(): Promise<ProviderCollectionResult> {
  const metrics: NormalizedMetricSnapshot[] = [];
  const probes: HealthProbeResult[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  const authToken = Deno.env.get("SENTRY_AUTH_TOKEN");
  const orgSlug = Deno.env.get("SENTRY_ORG");
  const isConfigured = Boolean(authToken && orgSlug);

  if (!isConfigured) {
    probes.push({
      serviceId: "sentry",
      probeKey: "sentry_api_reachability",
      success: false,
      status: "NOT_CONFIGURED",
      latencyMs: 0,
      errorMessage: "SENTRY_AUTH_TOKEN or SENTRY_ORG is not configured on the server.",
      checkedAt: now,
    });

    return {
      provider: "sentry",
      metrics,
      probes,
      errors,
      isConfigured: false,
    };
  }

  // 1. Sentry Organization API Health Probe
  const probeStartTime = performance.now();
  let apiReachable = false;

  try {
    const probeResp = await withTimeout(
      async (signal) =>
        await fetch(`https://sentry.io/api/0/organizations/${orgSlug}/`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: "application/json",
          },
          signal,
        }),
      5000,
      "sentry_org_probe"
    );

    const latencyMs = Math.round((performance.now() - probeStartTime) * 100) / 100;

    if (probeResp.ok) {
      apiReachable = true;
      probes.push({
        serviceId: "sentry",
        probeKey: "sentry_api_reachability",
        success: true,
        status: "HEALTHY",
        latencyMs,
        statusCode: 200,
        checkedAt: now,
      });
    } else {
      const status = probeResp.status === 401 || probeResp.status === 403
        ? "AUTHENTICATION_FAILED"
        : probeResp.status === 429
        ? "RATE_LIMITED"
        : "DEGRADED";

      probes.push({
        serviceId: "sentry",
        probeKey: "sentry_api_reachability",
        success: false,
        status,
        latencyMs,
        statusCode: probeResp.status,
        errorMessage: `Sentry API returned HTTP ${probeResp.status}`,
        checkedAt: now,
      });
      errors.push(`Sentry probe failed: HTTP ${probeResp.status}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    probes.push({
      serviceId: "sentry",
      probeKey: "sentry_api_reachability",
      success: false,
      status: "UNAVAILABLE",
      latencyMs: Math.round((performance.now() - probeStartTime) * 100) / 100,
      errorMessage: msg,
      checkedAt: now,
    });
    errors.push(`Sentry probe exception: ${msg}`);
  }

  // 2. Query Sentry Stats API (stats_v2 for 24h error and transaction aggregates)
  if (apiReachable && orgSlug) {
    try {
      const statsResp = await withTimeout(
        async (signal) =>
          await fetch(
            `https://sentry.io/api/0/organizations/${orgSlug}/stats_v2/?category=error&statsPeriod=24h&interval=1d`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "application/json",
              },
              signal,
            }
          ),
        6000,
        "sentry_stats_v2"
      );

      if (statsResp.ok) {
        const statsData = await statsResp.json();
        // stats_v2 returns intervals with groups
        const totalErrors = statsData?.intervals?.reduce(
          (acc: number, curr: { count?: number }) => acc + (curr.count || 0),
          0
        ) ?? 0;

        metrics.push({
          serviceId: "sentry",
          metricKey: "sentry.errors_24h",
          metricValue: totalErrors,
          unit: "count",
          status: totalErrors > 100 ? "WARNING" : "HEALTHY",
          source: "sentry_stats_api",
          capturedAt: now,
          metadata: {
            note: "Aggregated error count from Sentry stats_v2. No raw payloads or PII stored.",
          },
        });
      } else {
        errors.push(`Sentry stats_v2 returned HTTP ${statsResp.status}`);
      }
    } catch (err: unknown) {
      errors.push(`Sentry stats query error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    provider: "sentry",
    metrics,
    probes,
    errors,
    isConfigured,
  };
}
