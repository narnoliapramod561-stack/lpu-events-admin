// rollup.ts — Single-flight execution of historical metric rollups
// Orchestrates hourly and daily pre-computed metric aggregates within an ops_job_runs lease.

export async function executeHistoricalMetricsRollup(
  supabaseAdmin: any,
  requestId: string,
  targetHour?: string
): Promise<{
  success: boolean;
  runId: string | null;
  summary: any;
}> {
  let jobRunId: string | null = null;

  // 1. Acquire single-flight lease
  try {
    const { data: lease, error: leaseErr } = await supabaseAdmin.rpc("start_operations_job_run", {
      p_job_key: "historical_metrics_rollup",
      p_trigger_source: "SCHEDULE",
      p_request_id: requestId,
      p_correlation_id: `rollup-${Date.now()}`,
      p_metadata: { target_hour: targetHour || "previous_hour" },
      p_timeout_minutes: 10,
    });

    if (leaseErr) {
      return { success: false, runId: null, summary: { error: `Failed to acquire job lease: ${leaseErr.message}` } };
    }
    if (!lease?.started) {
      return { success: false, runId: null, summary: { error: lease?.error_summary || "Job run already active" } };
    }
    jobRunId = lease.run_id;
  } catch (err: any) {
    return { success: false, runId: null, summary: { error: `Single-flight acquisition failed: ${err.message}` } };
  }

  // 2. Execute Rollup RPC
  try {
    const { data: rollupResult, error: rollupErr } = await supabaseAdmin.rpc(
      "rollup_operations_metric_aggregates",
      { p_target_hour: targetHour ? new Date(targetHour).toISOString() : null }
    );

    if (rollupErr) {
      if (jobRunId) {
        await supabaseAdmin.rpc("finish_operations_job_run", {
          p_run_id: jobRunId,
          p_status: "FAILED",
          p_error_summary: `Rollup RPC error: ${rollupErr.message}`,
          p_items_failed: 1,
        });
      }
      return { success: false, runId: jobRunId, summary: { error: rollupErr.message } };
    }

    const itemsProcessed = (rollupResult?.hourly_buckets_upserted || 0) + (rollupResult?.daily_buckets_upserted || 0);

    // 3. Complete Job Run
    if (jobRunId) {
      await supabaseAdmin.rpc("finish_operations_job_run", {
        p_run_id: jobRunId,
        p_status: "COMPLETED",
        p_items_processed: itemsProcessed,
        p_items_failed: 0,
        p_metadata: rollupResult,
      });
    }

    return {
      success: true,
      runId: jobRunId,
      summary: rollupResult,
    };
  } catch (err: any) {
    if (jobRunId) {
      await supabaseAdmin.rpc("finish_operations_job_run", {
        p_run_id: jobRunId,
        p_status: "FAILED",
        p_error_summary: err.message,
        p_items_failed: 1,
      });
    }
    return { success: false, runId: jobRunId, summary: { error: err.message } };
  }
}
