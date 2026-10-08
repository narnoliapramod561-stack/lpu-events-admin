// supabase/functions/superadmin-operations/alerts/evaluator.ts
// LPU Events — Authoritative Server-Side Alert & Incident Evaluation Engine (Phase 5)
// Evaluates rules deterministically against real telemetry, probes, and job states.
// Performs deduplication, incident correlation, flapping protection, and automatic recovery.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { OperationsError } from "../errors.ts";

export interface EvaluationResult {
  evaluated_at: string;
  duration_ms: number;
  rules_evaluated: number;
  rules_matched: number;
  alerts_created: number;
  alerts_updated: number;
  alerts_resolved: number;
  incidents_created: number;
  incidents_updated: number;
  incidents_resolved: number;
  errors: string[];
}

const SEVERITY_RANKS: Record<string, number> = {
  INFO: 1,
  WARNING: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function getHighestSeverity(severities: string[]): string {
  let highest = 'INFO';
  let maxRank = 0;
  for (const s of severities) {
    const rank = SEVERITY_RANKS[s] || 1;
    if (rank > maxRank) {
      maxRank = rank;
      highest = s;
    }
  }
  return highest;
}

function evaluateNumericCondition(
  val: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case 'GT':
      return val > threshold;
    case 'GTE':
      return val >= threshold;
    case 'LT':
      return val < threshold;
    case 'LTE':
      return val <= threshold;
    case 'EQ':
      return val === threshold;
    case 'NEQ':
      return val !== threshold;
    default:
      return false;
  }
}

/**
 * Generates human-readable, deterministic incident key (e.g., INC-2026-A1B2)
 */
function generateIncidentKey(): string {
  const year = new Date().getUTCFullYear();
  const hex = crypto.randomUUID().replace(/-/g, '').substring(0, 4).toUpperCase();
  return `INC-${year}-${hex}`;
}

/**
 * Authoritative Server-Side Rule Evaluation Sweep
 */
export async function evaluateOperationalAlertRules(
  supabase: SupabaseClient,
  requestId: string,
  correlationId?: string
): Promise<EvaluationResult> {
  const startTime = performance.now();
  const now = new Date();
  const nowIso = now.toISOString();

  let rulesEvaluated = 0;
  let rulesMatched = 0;
  let alertsCreated = 0;
  let alertsUpdated = 0;
  let alertsResolved = 0;
  let incidentsCreated = 0;
  let incidentsUpdated = 0;
  let incidentsResolved = 0;
  const errors: string[] = [];

  // 1. Single-Flight Lease Acquisition via ops_job_runs (Phase 4 integration)
  let runId: string | null = null;
  const { data: startRunData, error: startRunErr } = await supabase.rpc(
    "start_operations_job_run",
    {
      p_job_key: "alert_rule_evaluation",
      p_trigger_source: "scheduled",
      p_request_id: requestId,
      p_correlation_id: correlationId || `eval_${crypto.randomUUID()}`,
      p_metadata: { triggered_at: nowIso, engine: "phase5_alert_engine" },
    }
  );

  if (startRunErr) {
    // If job run start fails due to active execution, exit gracefully
    if (startRunErr.message?.includes("active execution is already running")) {
      return {
        evaluated_at: nowIso,
        duration_ms: Math.round(performance.now() - startTime),
        rules_evaluated: 0,
        rules_matched: 0,
        alerts_created: 0,
        alerts_updated: 0,
        alerts_resolved: 0,
        incidents_created: 0,
        incidents_updated: 0,
        incidents_resolved: 0,
        errors: ["Evaluation skipped: another evaluation execution is currently running."],
      };
    }
    errors.push(`Failed to register alert_rule_evaluation job run: ${startRunErr.message}`);
  } else if (startRunData?.run_id) {
    runId = startRunData.run_id;
  }

  try {
    // 2. Fetch all enabled alert rules
    const { data: rules, error: rulesErr } = await supabase
      .from("ops_alert_rules")
      .select("*")
      .eq("enabled", true);

    if (rulesErr) {
      throw new OperationsError(
        "INTERNAL_ERROR",
        `Failed to fetch alert rules: ${rulesErr.message}`,
        500
      );
    }

    if (!rules || rules.length === 0) {
      if (runId) {
        await supabase.rpc("finish_operations_job_run", {
          p_run_id: runId,
          p_status: "COMPLETED",
          p_records_scanned: 0,
          p_records_processed: 0,
          p_records_deleted: 0,
          p_records_failed: 0,
          p_metadata: { rules_count: 0 },
        });
      }
      return {
        evaluated_at: nowIso,
        duration_ms: Math.round(performance.now() - startTime),
        rules_evaluated: 0,
        rules_matched: 0,
        alerts_created: 0,
        alerts_updated: 0,
        alerts_resolved: 0,
        incidents_created: 0,
        incidents_updated: 0,
        incidents_resolved: 0,
        errors: [],
      };
    }

    rulesEvaluated = rules.length;

    // 3. Evaluate each rule deterministically
    for (const rule of rules) {
      try {
        let conditionMatched = false;
        let triggeringValue: number | null = null;
        let evidence: Record<string, unknown> = {};
        let metricSnapshotId: string | null = null;
        let jobRunId: string | null = null;

        const windowCutoff = new Date(now.getTime() - rule.window_minutes * 60 * 1000).toISOString();

        // 3.1 Threshold / Rate Evaluation
        if (rule.condition_type === 'THRESHOLD' || rule.condition_type === 'RATE') {
          if (!rule.metric_key || rule.threshold_value === null) {
            continue; // Cannot evaluate without metric key or threshold
          }

          const { data: snapshot } = await supabase
            .from("ops_metric_snapshots")
            .select("id, metric_key, value, unit, status, captured_at")
            .eq("service_id", rule.service_id)
            .eq("metric_key", rule.metric_key)
            .gte("captured_at", windowCutoff)
            .order("captured_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (snapshot && typeof snapshot.value === 'number') {
            triggeringValue = snapshot.value;
            metricSnapshotId = snapshot.id;
            conditionMatched = evaluateNumericCondition(
              snapshot.value,
              rule.operator,
              Number(rule.threshold_value)
            );

            evidence = {
              metric_key: rule.metric_key,
              service_id: rule.service_id,
              value: snapshot.value,
              operator: rule.operator,
              threshold: Number(rule.threshold_value),
              unit: snapshot.unit,
              captured_at: snapshot.captured_at,
              snapshot_id: snapshot.id,
            };
          }
        }

        // 3.2 Provider Reachability / Health Probe Evaluation
        else if (rule.condition_type === 'PROVIDER_UNAVAILABLE' || rule.condition_type === 'HEALTH_FAILURE') {
          const { data: probe } = await supabase
            .from("ops_health_probes")
            .select("id, probe_target, status, error_code, latency_ms, probed_at")
            .eq("probe_target", rule.service_id)
            .gte("probed_at", windowCutoff)
            .order("probed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (probe) {
            // Note: NOT_CONFIGURED is an intentional configuration state, NOT an outage incident!
            if (probe.status === 'UNAVAILABLE' || probe.status === 'AUTHENTICATION_FAILED') {
              conditionMatched = true;
              evidence = {
                probe_id: probe.id,
                probe_target: probe.probe_target,
                status: probe.status,
                error_code: probe.error_code,
                latency_ms: probe.latency_ms,
                probed_at: probe.probed_at,
              };
            } else if (probe.status === 'HEALTHY' || probe.status === 'DEGRADED') {
              conditionMatched = false;
            }
          }
        }

        // 3.3 Maintenance Job Failure Evaluation
        else if (rule.condition_type === 'JOB_FAILURE') {
          const targetJobKey = rule.metric_key || rule.metadata?.job_key;
          if (targetJobKey) {
            const { data: jobDef } = await supabase
              .from("ops_jobs")
              .select("id")
              .eq("job_key", targetJobKey)
              .maybeSingle();

            if (jobDef) {
              const { data: latestRun } = await supabase
                .from("ops_job_runs")
                .select("id, status, error_code, error_summary, started_at, completed_at, duration_ms, records_processed, records_failed")
                .eq("job_id", jobDef.id)
                .gte("started_at", windowCutoff)
                .order("started_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (latestRun) {
                jobRunId = latestRun.id;
                if (latestRun.status === 'FAILED') {
                  conditionMatched = true;
                  evidence = {
                    job_key: targetJobKey,
                    job_run_id: latestRun.id,
                    status: latestRun.status,
                    error_code: latestRun.error_code,
                    error_summary: latestRun.error_summary,
                    duration_ms: latestRun.duration_ms,
                    records_processed: latestRun.records_processed,
                    records_failed: latestRun.records_failed,
                    completed_at: latestRun.completed_at,
                  };
                } else if (latestRun.status === 'COMPLETED') {
                  conditionMatched = false;
                }
              }
            }
          }
        }

        // 3.4 Maintenance Job Staleness Evaluation
        else if (rule.condition_type === 'JOB_STALE') {
          const targetJobKey = rule.metric_key || rule.metadata?.job_key;
          if (targetJobKey) {
            const { data: jobDef } = await supabase
              .from("ops_jobs")
              .select("id, expected_interval_minutes")
              .eq("job_key", targetJobKey)
              .maybeSingle();

            if (jobDef && jobDef.expected_interval_minutes) {
              const { data: lastSuccess } = await supabase
                .from("ops_job_runs")
                .select("completed_at, started_at")
                .eq("job_id", jobDef.id)
                .eq("status", "COMPLETED")
                .order("started_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              const lastSuccessTime = lastSuccess?.completed_at || lastSuccess?.started_at;
              if (lastSuccessTime) {
                const ageMinutes = Math.round((now.getTime() - new Date(lastSuccessTime).getTime()) / 60000);
                const staleThreshold = jobDef.expected_interval_minutes * 2;
                if (ageMinutes > staleThreshold) {
                  conditionMatched = true;
                  evidence = {
                    job_key: targetJobKey,
                    expected_interval_minutes: jobDef.expected_interval_minutes,
                    age_minutes: ageMinutes,
                    stale_threshold_minutes: staleThreshold,
                    last_success_at: lastSuccessTime,
                  };
                } else {
                  conditionMatched = false;
                }
              }
            }
          }
        }

        // 3.5 Operational Telemetry Freshness Evaluation
        else if (rule.condition_type === 'TELEMETRY_STALE') {
          const { data: latestSnapshot } = await supabase
            .from("ops_metric_snapshots")
            .select("captured_at")
            .order("captured_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestSnapshot?.captured_at) {
            const ageMinutes = Math.round((now.getTime() - new Date(latestSnapshot.captured_at).getTime()) / 60000);
            if (ageMinutes > rule.window_minutes) {
              conditionMatched = true;
              evidence = {
                subsystem: "observability_engine",
                last_snapshot_at: latestSnapshot.captured_at,
                age_minutes: ageMinutes,
                window_minutes: rule.window_minutes,
              };
            } else {
              conditionMatched = false;
            }
          }
        }

        // 4. State Management: Deduplication, Correlation & Recovery
        const { data: activeAlert } = await supabase
          .from("ops_alerts")
          .select("id, incident_id, occurrence_count, consecutive_failures, consecutive_successes, status, severity")
          .eq("rule_id", rule.id)
          .eq("service_id", rule.service_id)
          .in("status", ["OPEN", "ACKNOWLEDGED"])
          .maybeSingle();

        // 4.1 Condition Matched (Active Operational Breach)
        if (conditionMatched) {
          rulesMatched++;

          const consecutiveFailures = activeAlert
            ? (activeAlert.consecutive_failures || 0) + 1
            : (Number(rule.metadata?.consecutive_failures) || 0) + 1;
          const meetsConsecutiveThreshold = consecutiveFailures >= rule.consecutive_count_threshold;

          if (!meetsConsecutiveThreshold) {
            // Flapping protection: do not trigger yet
            if (activeAlert) {
              await supabase
                .from("ops_alerts")
                .update({
                  consecutive_failures: consecutiveFailures,
                  consecutive_successes: 0,
                  updated_at: nowIso,
                })
                .eq("id", activeAlert.id);
            } else {
              await supabase
                .from("ops_alert_rules")
                .update({
                  metadata: { ...(rule.metadata || {}), consecutive_failures: consecutiveFailures },
                  updated_at: nowIso,
                })
                .eq("id", rule.id);
            }
            continue;
          }

          // Reset pre-alert failure count in rule metadata upon opening alert
          if (!activeAlert && rule.metadata?.consecutive_failures) {
            await supabase
              .from("ops_alert_rules")
              .update({
                metadata: { ...(rule.metadata || {}), consecutive_failures: 0 },
                updated_at: nowIso,
              })
              .eq("id", rule.id);
          }

          if (activeAlert) {
            // Deduplication: Update existing active alert
            await supabase
              .from("ops_alerts")
              .update({
                occurrence_count: activeAlert.occurrence_count + 1,
                last_detected_at: nowIso,
                last_value: triggeringValue,
                threshold_value: rule.threshold_value,
                evidence: evidence,
                metric_snapshot_id: metricSnapshotId,
                job_run_id: jobRunId,
                consecutive_failures: consecutiveFailures,
                consecutive_successes: 0,
                updated_at: nowIso,
              })
              .eq("id", activeAlert.id);

            alertsUpdated++;

            // Update incident last_activity_at
            if (activeAlert.incident_id) {
              await supabase
                .from("ops_incidents")
                .update({
                  last_activity_at: nowIso,
                  updated_at: nowIso,
                })
                .eq("id", activeAlert.incident_id);

              await supabase.from("ops_incident_events").insert({
                incident_id: activeAlert.incident_id,
                event_type: "ALERT_OCCURRED_AGAIN",
                actor_type: "SYSTEM",
                actor_id: "alert_rule_evaluation",
                occurred_at: nowIso,
                alert_id: activeAlert.id,
                metadata: {
                  occurrence_count: activeAlert.occurrence_count + 1,
                  value: triggeringValue,
                },
              });
              incidentsUpdated++;
            }
          } else {
            // New Alert: Determine Incident Correlation
            // Find existing active incident for this incident_group_key
            const { data: existingIncident } = await supabase
              .from("ops_incidents")
              .select("id, incident_key, severity, status")
              .eq("group_key", rule.incident_group_key)
              .in("status", ["OPEN", "ACKNOWLEDGED"])
              .maybeSingle();

            let targetIncidentId = existingIncident?.id;

            if (!targetIncidentId) {
              // Create new correlated incident
              const incidentKey = generateIncidentKey();
              const { data: newIncident, error: incErr } = await supabase
                .from("ops_incidents")
                .insert({
                  incident_key: incidentKey,
                  title: rule.name,
                  description: `Operational condition detected by rule "${rule.name}" on service "${rule.service_id}".`,
                  severity: rule.severity,
                  status: "OPEN",
                  service_id: rule.service_id,
                  group_key: rule.incident_group_key,
                  opened_at: nowIso,
                  last_activity_at: nowIso,
                  correlation_id: correlationId,
                  metadata: { initial_rule_key: rule.rule_key },
                })
                .select("id")
                .single();

              if (incErr) {
                errors.push(`Failed to create incident for rule ${rule.rule_key}: ${incErr.message}`);
                continue;
              }

              targetIncidentId = newIncident.id;
              incidentsCreated++;

              // Record INCIDENT_OPENED event
              await supabase.from("ops_incident_events").insert({
                incident_id: targetIncidentId,
                event_type: "INCIDENT_OPENED",
                actor_type: "SYSTEM",
                actor_id: "alert_rule_evaluation",
                occurred_at: nowIso,
                metadata: { incident_key: incidentKey, severity: rule.severity },
              });
            } else {
              incidentsUpdated++;
              // Recalculate severity if new alert is higher
              const curRank = SEVERITY_RANKS[existingIncident.severity] || 1;
              const newRank = SEVERITY_RANKS[rule.severity] || 1;
              if (newRank > curRank) {
                await supabase
                  .from("ops_incidents")
                  .update({
                    severity: rule.severity,
                    last_activity_at: nowIso,
                    updated_at: nowIso,
                  })
                  .eq("id", targetIncidentId);

                await supabase.from("ops_incident_events").insert({
                  incident_id: targetIncidentId,
                  event_type: "SEVERITY_CHANGED",
                  actor_type: "SYSTEM",
                  actor_id: "alert_rule_evaluation",
                  occurred_at: nowIso,
                  metadata: {
                    old_severity: existingIncident.severity,
                    new_severity: rule.severity,
                  },
                });
              } else {
                await supabase
                  .from("ops_incidents")
                  .update({
                    last_activity_at: nowIso,
                    updated_at: nowIso,
                  })
                  .eq("id", targetIncidentId);
              }
            }

            // Create new Alert
            const { data: newAlert, error: alertErr } = await supabase
              .from("ops_alerts")
              .insert({
                rule_id: rule.id,
                service_id: rule.service_id,
                incident_id: targetIncidentId,
                severity: rule.severity,
                status: "OPEN",
                title: rule.name,
                message: rule.description,
                first_detected_at: nowIso,
                last_detected_at: nowIso,
                occurrence_count: 1,
                last_value: triggeringValue,
                threshold_value: rule.threshold_value,
                evidence: evidence,
                metric_snapshot_id: metricSnapshotId,
                job_run_id: jobRunId,
                consecutive_failures: consecutiveFailures,
                consecutive_successes: 0,
              })
              .select("id")
              .single();

            if (alertErr) {
              errors.push(`Failed to create alert for rule ${rule.rule_key}: ${alertErr.message}`);
              continue;
            }

            alertsCreated++;

            // Set primary_alert_id on incident if none set
            await supabase
              .from("ops_incidents")
              .update({ primary_alert_id: newAlert.id })
              .eq("id", targetIncidentId)
              .is("primary_alert_id", null);

            // Record ALERT_CREATED event
            await supabase.from("ops_incident_events").insert({
              incident_id: targetIncidentId,
              event_type: "ALERT_CREATED",
              actor_type: "SYSTEM",
              actor_id: "alert_rule_evaluation",
              occurred_at: nowIso,
              alert_id: newAlert.id,
              metadata: {
                rule_key: rule.rule_key,
                severity: rule.severity,
                value: triggeringValue,
              },
            });
          }
        }

        // 4.2 Condition Inactive (Automatic Recovery Evaluation)
        else if (activeAlert && rule.recovery_enabled) {
          const consecutiveSuccesses = (activeAlert.consecutive_successes || 0) + 1;
          const meetsRecoveryThreshold = consecutiveSuccesses >= rule.recovery_consecutive_threshold;

          if (!meetsRecoveryThreshold) {
            // Flapping protection: do not resolve yet
            await supabase
              .from("ops_alerts")
              .update({
                consecutive_successes: consecutiveSuccesses,
                updated_at: nowIso,
              })
              .eq("id", activeAlert.id);
            continue;
          }

          // Transition alert to RESOLVED
          await supabase
            .from("ops_alerts")
            .update({
              status: "RESOLVED",
              resolved_at: nowIso,
              consecutive_failures: 0,
              consecutive_successes: consecutiveSuccesses,
              updated_at: nowIso,
            })
            .eq("id", activeAlert.id);

          alertsResolved++;

          if (activeAlert.incident_id) {
            // Record ALERT_RESOLVED event
            await supabase.from("ops_incident_events").insert({
              incident_id: activeAlert.incident_id,
              event_type: "ALERT_RESOLVED",
              actor_type: "SYSTEM",
              actor_id: "alert_rule_evaluation",
              occurred_at: nowIso,
              alert_id: activeAlert.id,
              metadata: { rule_key: rule.rule_key },
            });

            // Check if any other active contributing alerts remain on this incident
            const { data: remainingActiveAlerts } = await supabase
              .from("ops_alerts")
              .select("id, severity")
              .eq("incident_id", activeAlert.incident_id)
              .in("status", ["OPEN", "ACKNOWLEDGED"]);

            if (!remainingActiveAlerts || remainingActiveAlerts.length === 0) {
              // ALL alerts resolved -> Automatically resolve incident
              await supabase
                .from("ops_incidents")
                .update({
                  status: "RESOLVED",
                  resolution_type: "AUTO_RECOVERY",
                  resolved_at: nowIso,
                  resolved_by: "alert_rule_evaluation",
                  resolution_reason: "All contributing operational alerts recovered automatically.",
                  last_activity_at: nowIso,
                  updated_at: nowIso,
                })
                .eq("id", activeAlert.incident_id);

              await supabase.from("ops_incident_events").insert({
                incident_id: activeAlert.incident_id,
                event_type: "INCIDENT_RESOLVED",
                actor_type: "SYSTEM",
                actor_id: "alert_rule_evaluation",
                occurred_at: nowIso,
                metadata: {
                  resolution_type: "AUTO_RECOVERY",
                  reason: "automatic_recovery",
                },
              });

              incidentsResolved++;
            } else {
              // Partial Recovery: Incident remains active; recalculate severity
              const remainingSeverities = remainingActiveAlerts.map((a) => a.severity);
              const highestRemaining = getHighestSeverity(remainingSeverities);

              const { data: currentInc } = await supabase
                .from("ops_incidents")
                .select("severity")
                .eq("id", activeAlert.incident_id)
                .single();

              if (currentInc && currentInc.severity !== highestRemaining) {
                await supabase
                  .from("ops_incidents")
                  .update({
                    severity: highestRemaining,
                    last_activity_at: nowIso,
                    updated_at: nowIso,
                  })
                  .eq("id", activeAlert.incident_id);

                await supabase.from("ops_incident_events").insert({
                  incident_id: activeAlert.incident_id,
                  event_type: "SEVERITY_CHANGED",
                  actor_type: "SYSTEM",
                  actor_id: "alert_rule_evaluation",
                  occurred_at: nowIso,
                  metadata: {
                    old_severity: currentInc.severity,
                    new_severity: highestRemaining,
                    reason: "partial_recovery",
                  },
                });
              }
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error evaluating rule ${rule.rule_key}: ${msg}`);
      }
    }

    // 5. Complete Job Run Execution
    const duration = Math.round(performance.now() - startTime);
    if (runId) {
      await supabase.rpc("finish_operations_job_run", {
        p_run_id: runId,
        p_status: errors.length > 0 ? "PARTIAL" : "COMPLETED",
        p_records_scanned: rulesEvaluated,
        p_records_processed: rulesMatched + alertsResolved,
        p_records_deleted: 0,
        p_records_failed: errors.length,
        p_metadata: {
          rules_evaluated: rulesEvaluated,
          rules_matched: rulesMatched,
          alerts_created: alertsCreated,
          alerts_updated: alertsUpdated,
          alerts_resolved: alertsResolved,
          incidents_created: incidentsCreated,
          incidents_updated: incidentsUpdated,
          incidents_resolved: incidentsResolved,
        },
      });
    }

    return {
      evaluated_at: nowIso,
      duration_ms: duration,
      rules_evaluated: rulesEvaluated,
      rules_matched: rulesMatched,
      alerts_created: alertsCreated,
      alerts_updated: alertsUpdated,
      alerts_resolved: alertsResolved,
      incidents_created: incidentsCreated,
      incidents_updated: incidentsUpdated,
      incidents_resolved: incidentsResolved,
      errors,
    };
  } catch (outerErr: unknown) {
    const duration = Math.round(performance.now() - startTime);
    const msg = outerErr instanceof Error ? outerErr.message : String(outerErr);
    if (runId) {
      await supabase.rpc("finish_operations_job_run", {
        p_run_id: runId,
        p_status: "FAILED",
        p_records_scanned: rulesEvaluated,
        p_records_processed: 0,
        p_records_deleted: 0,
        p_records_failed: 1,
        p_error_code: "EVALUATION_FAILED",
        p_error_summary: msg.substring(0, 500),
      });
    }
    throw outerErr;
  }
}
