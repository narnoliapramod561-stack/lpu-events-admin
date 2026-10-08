// supabase/functions/superadmin-operations/collector.ts
// Single-Flight Telemetry Orchestrator & Snapshot Collector (Phase 3)

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { collectSupabaseTelemetry } from "./providers/supabase.ts";
import { collectCloudflareTelemetry } from "./providers/cloudflare.ts";
import { collectResendTelemetry } from "./providers/resend.ts";
import { collectSentryTelemetry } from "./providers/sentry.ts";
import {
  NormalizedMetricSnapshot,
  HealthProbeResult,
  ProviderCollectionResult,
} from "./providers/types.ts";

export interface TelemetryCollectionResponse {
  runId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'LOCKED';
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  metricsCollected: number;
  errorsCount: number;
  providerSummaries: Record<string, {
    isConfigured: boolean;
    metricsCount: number;
    probesCount: number;
    errors: string[];
  }>;
  latestProbes: HealthProbeResult[];
}

export async function executeTelemetryCollection(
  supabaseAdmin: SupabaseClient,
  collectionType = "all",
  requestId: string
): Promise<TelemetryCollectionResponse> {
  const startTime = performance.now();

  // 1. Single-Flight Lock Acquisition
  const { data: lockResult, error: lockErr } = await supabaseAdmin.rpc(
    "start_operations_collection_run",
    {
      p_collection_type: collectionType,
      p_provider: "all",
      p_request_id: requestId,
      p_timeout_minutes: 5,
    }
  );

  if (lockErr || !lockResult) {
    throw new Error(`Failed to acquire collection lock: ${lockErr?.message || "Unknown error"}`);
  }

  if (lockResult.acquired === false) {
    return {
      runId: lockResult.active_run_id || "active_run",
      status: "LOCKED",
      startedAt: lockResult.started_at,
      durationMs: Math.round((performance.now() - startTime) * 100) / 100,
      metricsCollected: 0,
      errorsCount: 0,
      providerSummaries: {},
      latestProbes: [],
    };
  }

  const runId = lockResult.run_id;

  // Initialize Canonical Phase 4 Job Execution Record (ops_job_runs)
  let jobRunId: string | null = null;
  try {
    const { data: jobRunResult } = await supabaseAdmin.rpc("start_operations_job_run", {
      p_job_key: "provider_telemetry_collection",
      p_trigger_source: "SCHEDULE",
      p_request_id: requestId,
      p_correlation_id: runId,
      p_metadata: { collection_run_id: runId, collection_type: collectionType },
      p_timeout_minutes: 5,
    });
    if (jobRunResult?.run_id) {
      jobRunId = jobRunResult.run_id;
    }
  } catch {
    // Failure isolation: telemetry failure does not block collection execution
  }

  const allMetrics: NormalizedMetricSnapshot[] = [];
  const allProbes: HealthProbeResult[] = [];
  const allErrors: string[] = [];
  const providerSummaries: Record<string, any> = {};

  // 2. Parallel Adapter Invocations (Fault-Isolated)
  const results = await Promise.allSettled([
    collectSupabaseTelemetry(supabaseAdmin),
    collectCloudflareTelemetry(supabaseAdmin),
    collectResendTelemetry(),
    collectSentryTelemetry(),
  ]);

  for (const res of results) {
    if (res.status === "fulfilled") {
      const pRes: ProviderCollectionResult = res.value;
      allMetrics.push(...pRes.metrics);
      allProbes.push(...pRes.probes);
      allErrors.push(...pRes.errors);
      providerSummaries[pRes.provider] = {
        isConfigured: pRes.isConfigured,
        metricsCount: pRes.metrics.length,
        probesCount: pRes.probes.length,
        errors: pRes.errors,
      };
    } else {
      allErrors.push(`Provider execution rejected: ${res.reason}`);
    }
  }

  // 3. Persist Metrics Snapshots
  if (allMetrics.length > 0) {
    const metricRows = allMetrics.map((m) => ({
      service_id: m.serviceId,
      metric_key: m.metricKey,
      metric_value: m.metricValue,
      metric_limit: m.metricLimit ?? null,
      unit: m.unit,
      status: m.status,
      source: m.source,
      captured_at: m.capturedAt,
      observed_from: m.observedFrom ?? null,
      observed_to: m.observedTo ?? null,
      collection_run_id: runId,
      metadata: m.metadata ?? {},
    }));

    const { error: insertMetricErr } = await supabaseAdmin
      .from("ops_metric_snapshots")
      .insert(metricRows);

    if (insertMetricErr) {
      allErrors.push(`Failed to persist metric snapshots: ${insertMetricErr.message}`);
    }
  }

  // 4. Persist Health Probes
  if (allProbes.length > 0) {
    const probeRows = allProbes.map((p) => ({
      service_id: p.serviceId,
      probe_key: p.probeKey,
      success: p.success,
      status: p.status,
      latency_ms: p.latencyMs,
      status_code: p.statusCode ?? null,
      error_code: p.errorCode ?? null,
      error_message: p.errorMessage ?? null,
      checked_at: p.checkedAt,
      collection_run_id: runId,
      metadata: p.metadata ?? {},
    }));

    const { error: insertProbeErr } = await supabaseAdmin
      .from("ops_health_probes")
      .insert(probeRows);

    if (insertProbeErr) {
      allErrors.push(`Failed to persist health probes: ${insertProbeErr.message}`);
    }
  }

  // 5. Finalize Collection Run Record
  const runStatus = allErrors.length === 0 ? "COMPLETED" : allMetrics.length > 0 ? "PARTIAL" : "FAILED";
  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

  await supabaseAdmin.rpc("finish_operations_collection_run", {
    p_run_id: runId,
    p_status: runStatus,
    p_metrics_count: allMetrics.length,
    p_errors_count: allErrors.length,
    p_error_code: allErrors.length > 0 ? "PROVIDER_COLLECTION_WARNINGS" : null,
    p_error_summary: allErrors.length > 0 ? allErrors.slice(0, 5).join("; ") : null,
    p_metadata: { duration_ms: durationMs, providers: Object.keys(providerSummaries) },
  });

  // Finalize Canonical Phase 4 Job Execution Record
  if (jobRunId) {
    try {
      await supabaseAdmin.rpc("finish_operations_job_run", {
        p_run_id: jobRunId,
        p_status: runStatus,
        p_records_scanned: Object.keys(providerSummaries).length,
        p_records_processed: allMetrics.length,
        p_records_deleted: 0,
        p_records_failed: allErrors.length,
        p_error_code: allErrors.length > 0 ? "PROVIDER_COLLECTION_WARNINGS" : null,
        p_error_summary: allErrors.length > 0 ? allErrors.slice(0, 5).join("; ") : null,
        p_metadata: {
          collection_run_id: runId,
          duration_ms: durationMs,
          providers_attempted: Object.keys(providerSummaries).length,
          providers_succeeded: Object.values(providerSummaries).filter((p: any) => p.errors.length === 0).length,
          providers_failed: Object.values(providerSummaries).filter((p: any) => p.errors.length > 0).length,
        },
      });
    } catch {
      // Non-fatal
    }
  }

  return {
    runId,
    status: runStatus,
    startedAt: lockResult.started_at,
    completedAt: new Date().toISOString(),
    durationMs,
    metricsCollected: allMetrics.length,
    errorsCount: allErrors.length,
    providerSummaries,
    latestProbes: allProbes,
  };
}
