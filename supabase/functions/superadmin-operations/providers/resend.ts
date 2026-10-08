// supabase/functions/superadmin-operations/providers/resend.ts
// Resend Email Pipeline Operational Telemetry & Quota Adapter (Phase 3)

import {
  NormalizedMetricSnapshot,
  HealthProbeResult,
  ProviderCollectionResult,
} from "./types.ts";
import { withTimeout } from "../timeout.ts";

export async function collectResendTelemetry(): Promise<ProviderCollectionResult> {
  const metrics: NormalizedMetricSnapshot[] = [];
  const probes: HealthProbeResult[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const isConfigured = Boolean(apiKey);

  if (!isConfigured) {
    probes.push({
      serviceId: "resend",
      probeKey: "resend_api_reachability",
      success: false,
      status: "NOT_CONFIGURED",
      latencyMs: 0,
      errorMessage: "RESEND_API_KEY is not configured on the server.",
      checkedAt: now,
    });

    return {
      provider: "resend",
      metrics,
      probes,
      errors,
      isConfigured: false,
    };
  }

  // 1. Non-destructive API Health Probe
  const probeStartTime = performance.now();
  let apiReachable = false;

  try {
    const probeResp = await withTimeout(
      async (signal) =>
        await fetch("https://api.resend.com/api-keys", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          signal,
        }),
      5000,
      "resend_api_keys_probe"
    );

    const latencyMs = Math.round((performance.now() - probeStartTime) * 100) / 100;

    if (probeResp.ok) {
      apiReachable = true;
      probes.push({
        serviceId: "resend",
        probeKey: "resend_api_reachability",
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
        serviceId: "resend",
        probeKey: "resend_api_reachability",
        success: false,
        status,
        latencyMs,
        statusCode: probeResp.status,
        errorMessage: `Resend API returned HTTP ${probeResp.status}`,
        checkedAt: now,
      });
      errors.push(`Resend probe failed: HTTP ${probeResp.status}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    probes.push({
      serviceId: "resend",
      probeKey: "resend_api_reachability",
      success: false,
      status: "UNAVAILABLE",
      latencyMs: Math.round((performance.now() - probeStartTime) * 100) / 100,
      errorMessage: msg,
      checkedAt: now,
    });
    errors.push(`Resend probe exception: ${msg}`);
  }

  // 2. Resend Usage & Plan Quota API
  if (apiReachable) {
    const usageStartTime = performance.now();
    try {
      const usageResp = await withTimeout(
        async (signal) =>
          await fetch("https://api.resend.com/usage", {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/json",
            },
            signal,
          }),
        5000,
        "resend_usage_query"
      );

      if (usageResp.ok) {
        const usageData = await usageResp.json();

        // Resend Usage API format: daily & monthly count/limit
        const countToday = typeof usageData.count === "number" ? usageData.count : usageData.daily_count ?? null;
        const limitToday = typeof usageData.limit === "number" ? usageData.limit : usageData.daily_limit ?? null;
        const monthlyCount = usageData.monthly_count ?? null;
        const monthlyLimit = usageData.monthly_limit ?? null;

        if (countToday !== null) {
          metrics.push({
            serviceId: "resend",
            metricKey: "resend.emails_today",
            metricValue: countToday,
            metricLimit: limitToday,
            unit: "count",
            status: "HEALTHY",
            source: "resend_usage_api",
            capturedAt: now,
          });
        }

        if (monthlyCount !== null) {
          metrics.push({
            serviceId: "resend",
            metricKey: "resend.monthly_usage",
            metricValue: monthlyCount,
            metricLimit: monthlyLimit,
            unit: "count",
            status: "HEALTHY",
            source: "resend_usage_api",
            capturedAt: now,
          });
        }
      } else {
        // Usage endpoint may be unsupported on free tiers or return 404/403
        errors.push(`Resend usage endpoint returned HTTP ${usageResp.status}`);
      }
    } catch (err: unknown) {
      errors.push(`Resend usage query failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    provider: "resend",
    metrics,
    probes,
    errors,
    isConfigured,
  };
}
