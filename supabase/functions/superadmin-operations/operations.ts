// supabase/functions/superadmin-operations/operations.ts
// Capability-Based Operations Router (Phase 3 Telemetry, Phase 4 Maintenance Jobs, Phase 5 Alert & Incident Engine)

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { getServiceRegistry } from "./services.ts";
import { getProviderRegistry } from "./providers/types.ts";
import { runDatabaseDiagnostics, runEdgeDiagnostics } from "./diagnostics.ts";
import { executeTelemetryCollection } from "./collector.ts";
import { evaluateOperationalAlertRules } from "./alerts/evaluator.ts";
import {
  getMetricHistoryWithAnalytics,
  projectThresholdTrajectory,
  getIncidentAnalytics,
  getAlertAnalytics,
  getJobAnalytics,
  getCrossServiceAnalyticsOverview,
  AnalyticsWindow,
} from "./analytics/engine.ts";
import { isValidMetricKey, getMetricDefinition, CONTROLLED_METRIC_CATALOG } from "./analytics/catalog.ts";
import { executeHistoricalMetricsRollup } from "./analytics/rollup.ts";
import {
  evaluateIncidentNotifications,
  evaluateEscalations,
  cancelPendingIncidentNotifications,
  processNotificationOutbox,
  renderNotificationTemplate,
} from "./notifications/index.ts";
import {
  CANONICAL_RUNBOOKS,
  CANONICAL_ACTIONS,
  recommendRunbooksForIncident,
  evaluateDryRun,
  proposeRemediation,
  approveRemediation,
  rejectRemediation,
  executeRemediation,
  cancelRemediation,
  rollbackRemediation,
  cancelPendingRemediationsForIncident,
} from "./remediation/index.ts";
import {
  CANONICAL_SCENARIOS,
  executeResilienceScenario,
  getResilienceOverview,
} from "./resilience/index.ts";
import {
  CANONICAL_SLIS,
  CANONICAL_SLOS,
  CANONICAL_CAPACITY,
  calculateSliValue,
  evaluateSloRecord,
  evaluateCapacityResource,
  evaluateProductionReadiness,
  evaluateAllSlos,
  evaluateAllCapacity,
  getGovernanceOverview,
  getSloByKey,
  getCapacityResourceByKey,
} from "./governance/index.ts";

export type OperationAction =
  | 'overview'
  | 'services'
  | 'capabilities'
  | 'database'
  | 'providers'
  | 'metrics'
  | 'health'
  | 'collect'
  | 'jobs'
  | 'job-runs'
  | 'maintenance'
  | 'alerts'
  | 'alert'
  | 'incidents'
  | 'incident'
  | 'incident-events'
  | 'evaluate-alerts'
  | 'acknowledge-incident'
  | 'resolve-incident'
  | 'analytics-overview'
  | 'operations.analytics.overview'
  | 'analytics-metric'
  | 'operations.analytics.metric'
  | 'analytics-trend'
  | 'operations.analytics.trend'
  | 'analytics-forecast'
  | 'operations.analytics.forecast'
  | 'analytics-incidents'
  | 'operations.analytics.incidents'
  | 'analytics-alerts'
  | 'operations.analytics.alerts'
  | 'analytics-jobs'
  | 'operations.analytics.jobs'
  | 'analytics-services'
  | 'operations.analytics.services'
  | 'analytics-rollup'
  | 'operations.analytics.rollup'
  | 'notifications-overview'
  | 'notifications-policies'
  | 'notifications-policy-update'
  | 'notifications-recipients'
  | 'notifications-recipient-create'
  | 'notifications-recipient-update'
  | 'notifications-recipient-delete'
  | 'notifications-groups'
  | 'notifications-outbox'
  | 'notifications-attempts'
  | 'notifications-retry'
  | 'notifications-cancel'
  | 'notifications-process'
  | 'notifications-preview'
  | 'notifications-prune'
  | 'remediation-runbooks'
  | 'operations.remediation.runbooks'
  | 'remediation-actions'
  | 'operations.remediation.actions'
  | 'remediation-recommend'
  | 'operations.remediation.recommend'
  | 'remediation-dry-run'
  | 'operations.remediation.dry_run'
  | 'remediation-propose'
  | 'operations.remediation.request_approval'
  | 'remediation-approve'
  | 'operations.remediation.approve'
  | 'remediation-reject'
  | 'operations.remediation.reject'
  | 'remediation-execute'
  | 'operations.remediation.execute'
  | 'remediation-cancel'
  | 'operations.remediation.cancel'
  | 'remediation-rollback'
  | 'operations.remediation.rollback'
  | 'remediation-history'
  | 'operations.remediation.history'
  | 'remediation-prune'
  | 'resilience-scenarios'
  | 'operations.resilience.scenarios'
  | 'resilience-run'
  | 'operations.resilience.run'
  | 'resilience-history'
  | 'operations.resilience.history'
  | 'resilience-overview'
  | 'operations.resilience.overview'
  | 'resilience-prune'
  | 'slo-overview'
  | 'operations.slo.overview'
  | 'slo-details'
  | 'operations.slo.details'
  | 'slo-history'
  | 'operations.slo.history'
  | 'slo-evaluate'
  | 'operations.slo.evaluate'
  | 'capacity-overview'
  | 'operations.capacity.overview'
  | 'capacity-details'
  | 'operations.capacity.details'
  | 'readiness-evaluate'
  | 'operations.readiness.evaluate'
  | 'readiness-history'
  | 'operations.readiness.history'
  | 'governance-prune';

interface EnrichedJobSummary {
  id: string;
  job_key: string;
  display_name: string;
  description: string;
  job_type: string;
  schedule_description: string;
  expected_interval_minutes: number | null;
  enabled: boolean;
  criticality: string;
  owner: string;
  source: string;
  metadata: Record<string, unknown>;
  health: 'HEALTHY' | 'RUNNING' | 'PARTIAL' | 'FAILED' | 'STALE' | 'DISABLED' | 'UNKNOWN';
  is_running: boolean;
  is_stale: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_duration_ms: number | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error_summary: string | null;
  latest_run?: Record<string, unknown> | null;
}

/**
 * Queries the canonical jobs registry (ops_jobs) and evaluates dynamic health,
 * execution history, and cadence-aware freshness/stale states.
 */
async function getJobRegistryWithTelemetry(
  supabase: SupabaseClient
): Promise<EnrichedJobSummary[]> {
  const { data: jobs, error: jobsErr } = await supabase
    .from("ops_jobs")
    .select("id, job_key, display_name, description, job_type, schedule_description, expected_interval_minutes, enabled, criticality, owner, source, metadata")
    .order("job_type", { ascending: true });

  if (jobsErr) {
    throw new OperationsError(
      "INTERNAL_ERROR",
      `Failed to query job registry: ${jobsErr.message}`,
      500
    );
  }

  const now = Date.now();

  const enrichedJobs = await Promise.all(
    (jobs || []).map(async (job) => {
      // 1. Query latest run
      const { data: latestRun } = await supabase
        .from("ops_job_runs")
        .select("id, status, started_at, completed_at, duration_ms, trigger_source, records_scanned, records_processed, records_deleted, records_failed, error_code, error_summary")
        .eq("job_id", job.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Query latest successful execution
      const { data: latestSuccess } = await supabase
        .from("ops_job_runs")
        .select("completed_at, started_at")
        .eq("job_id", job.id)
        .eq("status", "COMPLETED")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Query latest failure
      const { data: latestFailure } = await supabase
        .from("ops_job_runs")
        .select("completed_at, started_at, error_code, error_summary")
        .eq("job_id", job.id)
        .eq("status", "FAILED")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastRunAt = latestRun?.started_at || null;
      const lastSuccessAt = latestSuccess?.completed_at || latestSuccess?.started_at || null;
      const lastFailureAt = latestFailure?.completed_at || latestFailure?.started_at || null;
      const isRunning = latestRun?.status === "RUNNING";

      // 4. Stale / Overdue Evaluation:
      // Requires known expected cadence and last successful run (Rule 6).
      let isStale = false;
      let ageMinutes: number | null = null;
      if (job.expected_interval_minutes && lastSuccessAt) {
        ageMinutes = Math.round((now - new Date(lastSuccessAt).getTime()) / 60000);
        // Stale if duration since last success exceeds 2x expected cadence
        isStale = ageMinutes > (job.expected_interval_minutes * 2);
      } else if (job.expected_interval_minutes && !lastSuccessAt && lastRunAt) {
        ageMinutes = Math.round((now - new Date(lastRunAt).getTime()) / 60000);
        isStale = ageMinutes > (job.expected_interval_minutes * 2);
      }

      // 5. Derived Operational Health State
      let health: EnrichedJobSummary['health'] = 'UNKNOWN';
      if (!job.enabled) {
        health = 'DISABLED';
      } else if (isRunning) {
        health = 'RUNNING';
      } else if (isStale) {
        health = 'STALE';
      } else if (latestRun?.status === 'FAILED') {
        health = 'FAILED';
      } else if (latestRun?.status === 'PARTIAL') {
        health = 'PARTIAL';
      } else if (latestRun?.status === 'COMPLETED') {
        health = 'HEALTHY';
      }

      return {
        id: job.id,
        job_key: job.job_key,
        display_name: job.display_name,
        description: job.description,
        job_type: job.job_type,
        schedule_description: job.schedule_description,
        expected_interval_minutes: job.expected_interval_minutes,
        enabled: job.enabled,
        criticality: job.criticality,
        owner: job.owner,
        source: job.source,
        metadata: (job.metadata as Record<string, unknown>) || {},
        health,
        is_running: isRunning,
        is_stale: isStale,
        last_run_at: lastRunAt,
        last_run_status: latestRun?.status || null,
        last_duration_ms: latestRun?.duration_ms || null,
        last_success_at: lastSuccessAt,
        last_failure_at: lastFailureAt,
        last_error_summary: latestFailure?.error_summary || latestRun?.error_summary || null,
        latest_run: latestRun || null,
      };
    })
  );

  return enrichedJobs;
}

/**
 * Checks GitHub Actions workflow runs for database maintenance reconciliation.
 */
async function getGitHubWorkflowStatus(): Promise<Record<string, unknown>> {
  const ghToken = Deno.env.get("GITHUB_TOKEN") || Deno.env.get("GH_TOKEN");
  const ghRepo = Deno.env.get("GITHUB_REPOSITORY") || "subhamKumar/lpu-events";

  if (!ghToken) {
    return {
      isConfigured: false,
      status: "NOT_CONFIGURED",
      message: "GitHub Actions token not configured in server environment. Workflow run history unavailable.",
    };
  }

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${ghRepo}/actions/workflows/database_cleanup.yml/runs?per_page=5`,
      {
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "LPU-Events-Operations-Gateway",
        },
      }
    );

    if (!resp.ok) {
      return {
        isConfigured: true,
        status: resp.status === 401 || resp.status === 403 ? "AUTHENTICATION_FAILED" : "UNAVAILABLE",
        statusCode: resp.status,
        message: `GitHub API HTTP ${resp.status}`,
      };
    }

    const data = await resp.json();
    const runs = (data.workflow_runs || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
      created_at: r.created_at,
      updated_at: r.updated_at,
      run_number: r.run_number,
      event: r.event,
    }));

    return {
      isConfigured: true,
      status: "HEALTHY",
      repository: ghRepo,
      recent_runs: runs,
    };
  } catch (err: unknown) {
    return {
      isConfigured: true,
      status: "UNAVAILABLE",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function executeOperation(
  action: string,
  supabase: SupabaseClient,
  requestId = "ops_req_internal",
  params: Record<string, unknown> = {}
): Promise<unknown> {
  switch (action) {
    case 'overview': {
      const providers = getProviderRegistry();
      const edge = runEdgeDiagnostics();

      // Query latest health probes from database
      const { data: latestProbes } = await supabase
        .from("ops_health_probes")
        .select("service_id, probe_key, success, status, latency_ms, checked_at, error_message")
        .order("checked_at", { ascending: false })
        .limit(20);

      // Query latest collection run
      const { data: latestRun } = await supabase
        .from("ops_collection_runs")
        .select("id, status, started_at, completed_at, metrics_collected, errors_count")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const services = getServiceRegistry(latestProbes || undefined);

      let dbHealth = 'UNKNOWN';
      try {
        const dbResult = await runDatabaseDiagnostics(supabase);
        dbHealth = dbResult.healthy ? 'HEALTHY' : 'DEGRADED';
      } catch {
        dbHealth = 'UNAVAILABLE';
      }

      // Query maintenance jobs summary
      let jobsSummary = {
        total_jobs: 0,
        healthy_jobs: 0,
        running_jobs: 0,
        stale_jobs: 0,
        failed_jobs: 0,
      };
      try {
        const jobs = await getJobRegistryWithTelemetry(supabase);
        jobsSummary = {
          total_jobs: jobs.length,
          healthy_jobs: jobs.filter((j) => j.health === "HEALTHY").length,
          running_jobs: jobs.filter((j) => j.is_running).length,
          stale_jobs: jobs.filter((j) => j.is_stale).length,
          failed_jobs: jobs.filter((j) => j.health === "FAILED").length,
        };
      } catch {
        // Fallback if jobs table query fails
      }

      // Query Incidents & Alerts summary for Phase 5
      let incidentsSummary = {
        open: 0,
        acknowledged: 0,
        critical: 0,
        high: 0,
      };
      let alertsSummary = {
        open_critical: 0,
        open_high: 0,
        open_warning: 0,
        total_open: 0,
      };

      try {
        const { data: activeIncidents } = await supabase
          .from("ops_incidents")
          .select("severity, status")
          .in("status", ["OPEN", "ACKNOWLEDGED"]);

        if (activeIncidents) {
          incidentsSummary = {
            open: activeIncidents.filter((i) => i.status === "OPEN").length,
            acknowledged: activeIncidents.filter((i) => i.status === "ACKNOWLEDGED").length,
            critical: activeIncidents.filter((i) => i.severity === "CRITICAL").length,
            high: activeIncidents.filter((i) => i.severity === "HIGH").length,
          };
        }

        const { data: activeAlerts } = await supabase
          .from("ops_alerts")
          .select("severity, status")
          .in("status", ["OPEN", "ACKNOWLEDGED"]);

        if (activeAlerts) {
          alertsSummary = {
            open_critical: activeAlerts.filter((a) => a.severity === "CRITICAL").length,
            open_high: activeAlerts.filter((a) => a.severity === "HIGH").length,
            open_warning: activeAlerts.filter((a) => a.severity === "WARNING").length,
            total_open: activeAlerts.filter((a) => a.status === "OPEN").length,
          };
        }
      } catch {
        // Fallback if incident/alert tables query fails
      }

      let notificationsSummary = {
        pending: 0,
        failed: 0,
        provider_configured: Boolean(Deno.env.get("RESEND_API_KEY")),
      };
      try {
        const { data: outboxRows } = await supabase
          .from("ops_notification_outbox")
          .select("status")
          .in("status", ["PENDING", "FAILED"]);
        if (outboxRows) {
          notificationsSummary.pending = outboxRows.filter((r) => r.status === "PENDING").length;
          notificationsSummary.failed = outboxRows.filter((r) => r.status === "FAILED").length;
        }
      } catch {
        // Fallback
      }

      let remediationSummary = {
        total_runbooks: CANONICAL_RUNBOOKS.length,
        pending_approvals: 0,
        completed_today: 0,
        failed_today: 0,
      };
      try {
        const { data: pendingRem } = await supabase
          .from("ops_remediation_executions")
          .select("id")
          .eq("status", "PENDING_APPROVAL");
        if (pendingRem) remediationSummary.pending_approvals = pendingRem.length;

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const { data: todayExecs } = await supabase
          .from("ops_remediation_executions")
          .select("status")
          .gte("created_at", today.toISOString());
        if (todayExecs) {
          remediationSummary.completed_today = todayExecs.filter((e) => e.status === "COMPLETED").length;
          remediationSummary.failed_today = todayExecs.filter((e) => e.status === "FAILED").length;
        }
      } catch {
        // Fallback
      }

      let resilienceSummary = {
        total_scenarios: CANONICAL_SCENARIOS.length,
        runs_today: 0,
        pass_rate: 100,
      };
      try {
        const resOverview = await getResilienceOverview(supabase);
        resilienceSummary = {
          total_scenarios: resOverview.total_scenarios,
          runs_today: resOverview.runs_today,
          pass_rate: resOverview.pass_rate,
        };
      } catch {
        // Fallback
      }

      let governanceSummary = {
        slo_compliance_rate: 100,
        error_budgets_exhausted: 0,
        capacity_critical_count: 0,
        production_readiness: 'READY',
      };
      try {
        const gov = await getGovernanceOverview(supabase);
        governanceSummary = {
          slo_compliance_rate: gov.slo_summary.compliance_rate,
          error_budgets_exhausted: gov.slo_summary.error_budgets_exhausted,
          capacity_critical_count: gov.capacity_summary.critical + gov.capacity_summary.exhausted,
          production_readiness: gov.readiness_summary.overall_status,
        };
      } catch {
        // Fallback
      }

      return {
        overall_status: incidentsSummary.critical > 0 ? 'CRITICAL' : (incidentsSummary.high > 0 ? 'DEGRADED' : (dbHealth === 'HEALTHY' ? 'OPERATIONAL' : 'DEGRADED')),
        gateway: {
          status: 'HEALTHY',
          runtime: edge.runtime,
        },
        services_summary: {
          total_registered: services.length,
          healthy_services: services.filter(s => s.monitoringStatus === 'HEALTHY').length,
          unmonitored: services.filter(s => s.monitoringStatus === 'NOT_MONITORED').length,
          unconfigured: services.filter(s => s.monitoringStatus === 'NOT_CONFIGURED').length,
        },
        providers_summary: {
          total: providers.length,
          configured_server_credentials: providers.filter(p => p.isConfigured).length,
        },
        jobs_summary: jobsSummary,
        incidents_summary: incidentsSummary,
        alerts_summary: alertsSummary,
        notifications_summary: notificationsSummary,
        remediation_summary: remediationSummary,
        resilience_summary: resilienceSummary,
        governance_summary: governanceSummary,
        latest_collection_run: latestRun || null,
        database_health: dbHealth,
        phase: 'PHASE_14_FINAL_GO_LIVE_OPERATIONAL_HANDOFF_AND_SYSTEM_FREEZE',
        previous_certified_phase: 'PHASE_13_FINAL_SECURITY_PERFORMANCE_AND_RELIABILITY_AUDIT',
        // Certified phases lineage:
        // phase: 'PHASE_5_ALERT_AND_INCIDENT_ENGINE'
        // phase: 'PHASE_6_HISTORICAL_ANALYTICS_AND_FORECASTING'
        // phase: 'PHASE_7_SUPER_ADMIN_OPERATIONS_CONTROL_CENTER'
        // phase: 'PHASE_8_OPERATIONAL_NOTIFICATIONS_AND_ESCALATION'
        // phase: 'PHASE_9_SAFE_OPERATIONAL_REMEDIATION_AND_RUNBOOKS'
        // phase: 'PHASE_10_OPERATIONAL_RESILIENCE_AND_DISASTER_RECOVERY'
        // phase: 'PHASE_11_SLO_CAPACITY_AND_PRODUCTION_READINESS_GOVERNANCE'
        // phase: 'PHASE_12_PRODUCTION_INTEGRATION_AND_REAL_ENVIRONMENT_VALIDATION'
        // previous_certified_phase: 'PHASE_11_SLO_CAPACITY_AND_PRODUCTION_READINESS_GOVERNANCE'
        // phase: 'PHASE_13_FINAL_SECURITY_PERFORMANCE_AND_RELIABILITY_AUDIT'
        // previous_certified_phase: 'PHASE_12_PRODUCTION_INTEGRATION_AND_REAL_ENVIRONMENT_VALIDATION'
      };
    }

    case 'services': {
      const { data: latestProbes } = await supabase
        .from("ops_health_probes")
        .select("service_id, probe_key, success, status, latency_ms, checked_at, error_message")
        .order("checked_at", { ascending: false })
        .limit(20);

      const services = getServiceRegistry(latestProbes || undefined);
      return {
        services,
        count: services.length,
      };
    }

    case 'capabilities': {
      const services = getServiceRegistry();
      const matrix = services.map((s) => ({
        service: s.key,
        displayName: s.displayName,
        provider: s.provider,
        capabilities: s.capabilities,
      }));
      return {
        matrix,
        supported_actions: [
          'overview', 'services', 'capabilities', 'database', 'providers',
          'metrics', 'health', 'collect', 'jobs', 'job-runs', 'maintenance',
          'alerts', 'alert', 'incidents', 'incident', 'incident-events',
          'evaluate-alerts', 'acknowledge-incident', 'resolve-incident',
          'analytics-overview', 'operations.analytics.overview',
          'analytics-metric', 'operations.analytics.metric',
          'analytics-trend', 'operations.analytics.trend',
          'analytics-forecast', 'operations.analytics.forecast',
          'analytics-incidents', 'operations.analytics.incidents',
          'analytics-alerts', 'operations.analytics.alerts',
          'analytics-jobs', 'operations.analytics.jobs',
          'analytics-services', 'operations.analytics.services',
          'analytics-rollup', 'operations.analytics.rollup',
          'notifications-overview', 'notifications-policies', 'notifications-policy-update',
          'notifications-recipients', 'notifications-recipient-create', 'notifications-recipient-update',
          'notifications-recipient-delete', 'notifications-groups', 'notifications-outbox',
          'notifications-attempts', 'notifications-retry', 'notifications-cancel',
          'notifications-process', 'notifications-preview', 'notifications-prune',
          'remediation-runbooks', 'operations.remediation.runbooks',
          'remediation-actions', 'operations.remediation.actions',
          'remediation-recommend', 'operations.remediation.recommend',
          'remediation-dry-run', 'operations.remediation.dry_run',
          'remediation-propose', 'operations.remediation.request_approval',
          'remediation-approve', 'operations.remediation.approve',
          'remediation-reject', 'operations.remediation.reject',
          'remediation-execute', 'operations.remediation.execute',
          'remediation-cancel', 'operations.remediation.cancel',
          'remediation-rollback', 'operations.remediation.rollback',
          'remediation-history', 'operations.remediation.history',
          'remediation-prune',
          'resilience-scenarios', 'operations.resilience.scenarios',
          'resilience-run', 'operations.resilience.run',
          'resilience-history', 'operations.resilience.history',
          'resilience-overview', 'operations.resilience.overview',
          'resilience-prune',
          'slo-overview', 'operations.slo.overview',
          'slo-details', 'operations.slo.details',
          'slo-history', 'operations.slo.history',
          'slo-evaluate', 'operations.slo.evaluate',
          'capacity-overview', 'operations.capacity.overview',
          'capacity-details', 'operations.capacity.details',
          'readiness-evaluate', 'operations.readiness.evaluate',
          'readiness-history', 'operations.readiness.history',
          'governance-prune',
        ],
      };
    }

    case 'database': {
      const diagnostics = await runDatabaseDiagnostics(supabase);
      return {
        diagnostics,
      };
    }

    case 'providers': {
      const providers = getProviderRegistry();
      return {
        providers,
        count: providers.length,
      };
    }

    case 'metrics': {
      const { data: metricRows, error: metricErr } = await supabase
        .from("ops_metric_snapshots")
        .select(`
          id,
          service_id,
          metric_key,
          value,
          unit,
          status,
          source,
          captured_at,
          request_id,
          correlation_id,
          metadata
        `)
        .order("captured_at", { ascending: false })
        .limit(100);

      if (metricErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to query metric snapshots: ${metricErr.message}`,
          500
        );
      }

      const now = Date.now();
      const enrichedMetrics = (metricRows || []).map((m) => {
        const capturedTime = new Date(m.captured_at).getTime();
        const ageSeconds = Math.round((now - capturedTime) / 1000);
        return {
          ...m,
          age_seconds: ageSeconds,
          is_stale: ageSeconds > 3600,
        };
      });

      return {
        metrics: enrichedMetrics,
        count: enrichedMetrics.length,
      };
    }

    case 'health': {
      const { data: probeRows, error: probeErr } = await supabase
        .from("ops_health_probes")
        .select(`
          id,
          probe_target,
          probe_type,
          status,
          latency_ms,
          error_code,
          error_message,
          probed_at,
          request_id,
          correlation_id,
          metadata
        `)
        .order("probed_at", { ascending: false })
        .limit(50);

      if (probeErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to query health probes: ${probeErr.message}`,
          500
        );
      }

      return {
        probes: probeRows || [],
        count: (probeRows || []).length,
      };
    }

    case 'collect': {
      const collectionResult = await executeTelemetryCollection(supabase, "all", requestId);
      return collectionResult;
    }

    // Phase 4: Jobs Registry & Execution Health Capability
    case 'jobs': {
      const jobs = await getJobRegistryWithTelemetry(supabase);
      return {
        jobs,
        count: jobs.length,
      };
    }

    // Phase 4: Job Execution History Capability
    case 'job-runs': {
      const { data: runRows, error: runsErr } = await supabase
        .from("ops_job_runs")
        .select(`
          id,
          job_id,
          status,
          started_at,
          completed_at,
          duration_ms,
          trigger_source,
          records_scanned,
          records_processed,
          records_deleted,
          records_failed,
          error_code,
          error_summary,
          request_id,
          correlation_id,
          metadata,
          ops_jobs(job_key, display_name, job_type)
        `)
        .order("started_at", { ascending: false })
        .limit(50);

      if (runsErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to query job execution runs: ${runsErr.message}`,
          500
        );
      }

      return {
        runs: runRows || [],
        count: (runRows || []).length,
      };
    }

    // Phase 4: Maintenance Overview & GitHub Actions Reconciliation
    case 'maintenance': {
      const jobs = await getJobRegistryWithTelemetry(supabase);
      const ghStatus = await getGitHubWorkflowStatus();

      const summary = {
        total_jobs: jobs.length,
        healthy_jobs: jobs.filter((j) => j.health === "HEALTHY").length,
        running_jobs: jobs.filter((j) => j.is_running).length,
        stale_jobs: jobs.filter((j) => j.is_stale).length,
        failed_jobs: jobs.filter((j) => j.health === "FAILED").length,
        partial_jobs: jobs.filter((j) => j.health === "PARTIAL").length,
        disabled_jobs: jobs.filter((j) => j.health === "DISABLED").length,
      };

      return {
        summary,
        jobs,
        github_actions_reconciliation: ghStatus,
      };
    }

    // =========================================================================
    // Phase 5: Alert & Incident Engine Capabilities
    // =========================================================================

    case 'alerts': {
      let query = supabase
        .from("ops_alerts")
        .select(`
          id,
          rule_id,
          service_id,
          incident_id,
          severity,
          status,
          title,
          message,
          first_detected_at,
          last_detected_at,
          resolved_at,
          occurrence_count,
          last_value,
          threshold_value,
          evidence,
          consecutive_failures,
          consecutive_successes,
          ops_alert_rules(rule_key, name, condition_type, operator)
        `)
        .order("last_detected_at", { ascending: false });

      if (typeof params.status === 'string') {
        query = query.eq("status", params.status.toUpperCase());
      }
      if (typeof params.severity === 'string') {
        query = query.eq("severity", params.severity.toUpperCase());
      }
      if (typeof params.service_id === 'string') {
        query = query.eq("service_id", params.service_id);
      }

      const limit = typeof params.limit === 'number' ? Math.min(params.limit, 100) : 50;
      query = query.limit(limit);

      const { data: alerts, error: alertsErr } = await query;
      if (alertsErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to query operational alerts: ${alertsErr.message}`,
          500
        );
      }

      // Compute aggregate summary counts
      const { data: allActive } = await supabase
        .from("ops_alerts")
        .select("severity, status")
        .in("status", ["OPEN", "ACKNOWLEDGED"]);

      const summary = {
        open_critical: (allActive || []).filter((a) => a.severity === 'CRITICAL').length,
        open_high: (allActive || []).filter((a) => a.severity === 'HIGH').length,
        open_warning: (allActive || []).filter((a) => a.severity === 'WARNING').length,
        total_open: (allActive || []).filter((a) => a.status === 'OPEN').length,
        total_acknowledged: (allActive || []).filter((a) => a.status === 'ACKNOWLEDGED').length,
      };

      return {
        alerts: alerts || [],
        count: (alerts || []).length,
        summary,
      };
    }

    case 'alert': {
      const alertId = params.id || params.alert_id;
      if (!alertId || typeof alertId !== 'string') {
        throw new OperationsError(
          "INVALID_REQUEST",
          "Parameter 'id' or 'alert_id' (uuid) is required for alert details.",
          400
        );
      }

      const { data: alert, error: alertErr } = await supabase
        .from("ops_alerts")
        .select(`
          id,
          rule_id,
          service_id,
          incident_id,
          severity,
          status,
          title,
          message,
          first_detected_at,
          last_detected_at,
          resolved_at,
          occurrence_count,
          last_value,
          threshold_value,
          evidence,
          consecutive_failures,
          consecutive_successes,
          ops_alert_rules(id, rule_key, name, description, condition_type, operator, threshold_value),
          ops_incidents(id, incident_key, title, severity, status)
        `)
        .eq("id", alertId)
        .maybeSingle();

      if (alertErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to fetch alert details: ${alertErr.message}`,
          500
        );
      }

      if (!alert) {
        throw new OperationsError(
          "RESOURCE_NOT_FOUND",
          `Operational alert with ID "${alertId}" not found.`,
          404
        );
      }

      return { alert };
    }

    case 'incidents': {
      let query = supabase
        .from("ops_incidents")
        .select(`
          id,
          incident_key,
          title,
          description,
          severity,
          status,
          resolution_type,
          service_id,
          group_key,
          opened_at,
          acknowledged_at,
          acknowledged_by,
          resolved_at,
          resolved_by,
          resolution_reason,
          last_activity_at,
          primary_alert_id,
          correlation_id
        `)
        .order("last_activity_at", { ascending: false });

      if (typeof params.status === 'string') {
        query = query.eq("status", params.status.toUpperCase());
      }
      if (typeof params.severity === 'string') {
        query = query.eq("severity", params.severity.toUpperCase());
      }
      if (typeof params.service_id === 'string') {
        query = query.eq("service_id", params.service_id);
      }

      const limit = typeof params.limit === 'number' ? Math.min(params.limit, 100) : 50;
      query = query.limit(limit);

      const { data: incidents, error: incErr } = await query;
      if (incErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to query operational incidents: ${incErr.message}`,
          500
        );
      }

      // Compute aggregate summary counts
      const { data: activeInc } = await supabase
        .from("ops_incidents")
        .select("severity, status")
        .in("status", ["OPEN", "ACKNOWLEDGED"]);

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { data: resolvedToday } = await supabase
        .from("ops_incidents")
        .select("id")
        .eq("status", "RESOLVED")
        .gte("resolved_at", todayStart.toISOString());

      const summary = {
        open_incidents: (activeInc || []).filter((i) => i.status === 'OPEN').length,
        acknowledged_incidents: (activeInc || []).filter((i) => i.status === 'ACKNOWLEDGED').length,
        critical_incidents: (activeInc || []).filter((i) => i.severity === 'CRITICAL').length,
        high_incidents: (activeInc || []).filter((i) => i.severity === 'HIGH').length,
        warning_incidents: (activeInc || []).filter((i) => i.severity === 'WARNING').length,
        resolved_today: (resolvedToday || []).length,
      };

      return {
        incidents: incidents || [],
        count: (incidents || []).length,
        summary,
      };
    }

    case 'incident': {
      const incidentId = params.id || params.incident_id;
      if (!incidentId || typeof incidentId !== 'string') {
        throw new OperationsError(
          "INVALID_REQUEST",
          "Parameter 'id' or 'incident_id' (uuid) is required for incident details.",
          400
        );
      }

      const { data: incident, error: incErr } = await supabase
        .from("ops_incidents")
        .select("*")
        .eq("id", incidentId)
        .maybeSingle();

      if (incErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to fetch incident details: ${incErr.message}`,
          500
        );
      }

      if (!incident) {
        throw new OperationsError(
          "RESOURCE_NOT_FOUND",
          `Operational incident with ID "${incidentId}" not found.`,
          404
        );
      }

      // Contributing active alerts
      const { data: activeAlerts } = await supabase
        .from("ops_alerts")
        .select("id, rule_id, severity, status, title, occurrence_count, last_value, threshold_value, last_detected_at, evidence")
        .eq("incident_id", incidentId)
        .in("status", ["OPEN", "ACKNOWLEDGED"])
        .order("last_detected_at", { ascending: false });

      // Resolved contributing alerts
      const { data: resolvedAlerts } = await supabase
        .from("ops_alerts")
        .select("id, rule_id, severity, status, title, occurrence_count, last_value, threshold_value, first_detected_at, resolved_at")
        .eq("incident_id", incidentId)
        .eq("status", "RESOLVED")
        .order("resolved_at", { ascending: false });

      // Incident events timeline
      const { data: events } = await supabase
        .from("ops_incident_events")
        .select("id, event_type, actor_type, actor_id, occurred_at, alert_id, metadata")
        .eq("incident_id", incidentId)
        .order("occurred_at", { ascending: true });

      return {
        incident,
        active_alerts: activeAlerts || [],
        resolved_alerts: resolvedAlerts || [],
        timeline: events || [],
        recommended_runbooks: recommendRunbooksForIncident(incident),
      };
    }

    case 'incident-events': {
      const incidentId = params.id || params.incident_id;
      if (!incidentId || typeof incidentId !== 'string') {
        throw new OperationsError(
          "INVALID_REQUEST",
          "Parameter 'incident_id' (uuid) is required.",
          400
        );
      }

      const { data: events, error: evErr } = await supabase
        .from("ops_incident_events")
        .select("*")
        .eq("incident_id", incidentId)
        .order("occurred_at", { ascending: true });

      if (evErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to fetch incident events: ${evErr.message}`,
          500
        );
      }

      return {
        events: events || [],
        count: (events || []).length,
      };
    }

    case 'evaluate-alerts': {
      const evalResult = await evaluateOperationalAlertRules(
        supabase,
        requestId,
        (params.correlationId as string) || `eval_${crypto.randomUUID()}`
      );

      // Phase 8: Notification Policy Evaluation & Escalation Dispatch
      const notificationStats = {
        enqueued: 0,
        suppressed: 0,
        escalated: 0,
        processed: 0,
      };

      try {
        // 1. Evaluate INCIDENT_CREATED for open incidents
        const { data: openIncidents } = await supabase
          .from("ops_incidents")
          .select("*")
          .in("status", ["OPEN", "ACKNOWLEDGED"]);

        if (openIncidents && openIncidents.length > 0) {
          for (const inc of openIncidents) {
            const res = await evaluateIncidentNotifications(supabase, inc, 'INCIDENT_CREATED');
            notificationStats.enqueued += res.enqueued_count;
            notificationStats.suppressed += res.suppressed_count;
          }
        }

        // 2. Evaluate Auto-Recovered incidents
        if (evalResult.incidents_resolved > 0) {
          const { data: autoRecovered } = await supabase
            .from("ops_incidents")
            .select("*")
            .eq("status", "RESOLVED")
            .eq("resolution_type", "AUTO_RECOVERY")
            .order("resolved_at", { ascending: false })
            .limit(evalResult.incidents_resolved);

          if (autoRecovered) {
            for (const inc of autoRecovered) {
              const res = await evaluateIncidentNotifications(supabase, inc, 'INCIDENT_RESOLVED');
              notificationStats.enqueued += res.enqueued_count;
              notificationStats.suppressed += res.suppressed_count;
            }
          }
        }

        // 3. Evaluate Escalations
        const escRes = await evaluateEscalations(supabase);
        notificationStats.escalated += escRes.escalated_count;

        // 4. Process outbox delivery queue
        const procRes = await processNotificationOutbox(supabase, 25);
        notificationStats.processed += procRes.processed;
      } catch (_notifErr) {
        // Notification evaluation failure must NEVER crash or block alert evaluation
      }

      return {
        ...evalResult,
        notifications: notificationStats,
      };
    }

    case 'acknowledge-incident': {
      const incidentId = (params.id || params.incident_id) as string;
      if (!incidentId) {
        throw new OperationsError(
          "INVALID_REQUEST",
          "Parameter 'incident_id' (uuid) is required to acknowledge an incident.",
          400
        );
      }

      const actorId = (params.adminUserId as string) || "super_admin";

      const { data: ackData, error: ackErr } = await supabase.rpc(
        "acknowledge_operations_incident",
        {
          p_incident_id: incidentId,
          p_actor_id: actorId,
        }
      );

      if (ackErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to acknowledge incident: ${ackErr.message}`,
          ackErr.code === '42501' ? 403 : 500
        );
      }

      return ackData;
    }

    case 'resolve-incident': {
      const incidentId = (params.id || params.incident_id) as string;
      const reason = (params.reason || params.resolution_reason) as string;

      if (!incidentId) {
        throw new OperationsError(
          "INVALID_REQUEST",
          "Parameter 'incident_id' (uuid) is required to resolve an incident.",
          400
        );
      }

      if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new OperationsError(
          "INVALID_REQUEST",
          "A valid resolution reason (minimum 3 characters) is required to manually resolve an incident.",
          400
        );
      }

      const actorId = (params.adminUserId as string) || "super_admin";

      const { data: resData, error: resErr } = await supabase.rpc(
        "resolve_operations_incident",
        {
          p_incident_id: incidentId,
          p_actor_id: actorId,
          p_reason: reason.trim(),
        }
      );

      if (resErr) {
        throw new OperationsError(
          "INTERNAL_ERROR",
          `Failed to resolve incident: ${resErr.message}`,
          resErr.code === '42501' ? 403 : 500
        );
      }

      // Phase 8: Cancel pending notifications and dispatch manual resolution notification
      try {
        await cancelPendingIncidentNotifications(supabase, incidentId);
        const { data: resolvedInc } = await supabase
          .from("ops_incidents")
          .select("*")
          .eq("id", incidentId)
          .maybeSingle();

        if (resolvedInc) {
          await evaluateIncidentNotifications(supabase, resolvedInc, 'INCIDENT_MANUALLY_RESOLVED');
          await processNotificationOutbox(supabase, 5);
        }
      } catch (_notifErr) {
        // Notification dispatch failure must never break manual incident resolution
      }

      // Phase 9: Cancel any pending/proposed remediations for this resolved incident
      try {
        await cancelPendingRemediationsForIncident(supabase, incidentId);
      } catch (_remErr) {
        // Remediation cancellation failure must never break manual incident resolution
      }

      return resData;
    }

    case 'analytics-overview':
    case 'operations.analytics.overview': {
      const windowStr = (params.window as AnalyticsWindow) || '24h';
      const overview = await getCrossServiceAnalyticsOverview(supabase, windowStr);
      return overview;
    }

    case 'analytics-metric':
    case 'operations.analytics.metric': {
      const serviceId = (params.service_id || params.serviceId) as string;
      const metricKey = (params.metric_key || params.metricKey) as string;
      const windowStr = (params.window as AnalyticsWindow) || '24h';

      if (!serviceId || !metricKey) {
        throw new OperationsError(
          "INVALID_REQUEST",
          "Parameters 'service_id' and 'metric_key' are required for historical metric query.",
          400
        );
      }

      if (!isValidMetricKey(metricKey)) {
        throw new OperationsError(
          "INVALID_REQUEST",
          `Metric key "${metricKey}" is not registered in the controlled metric catalog.`,
          400
        );
      }

      const result = await getMetricHistoryWithAnalytics(supabase, serviceId, metricKey, windowStr);
      return result;
    }

    case 'analytics-trend':
    case 'operations.analytics.trend': {
      const serviceId = (params.service_id || params.serviceId) as string;
      const metricKey = (params.metric_key || params.metricKey) as string;
      const windowStr = (params.window as AnalyticsWindow) || '24h';

      if (!serviceId || !metricKey) {
        throw new OperationsError(
          "INVALID_REQUEST",
          "Parameters 'service_id' and 'metric_key' are required for trend analysis.",
          400
        );
      }

      if (!isValidMetricKey(metricKey)) {
        throw new OperationsError(
          "INVALID_REQUEST",
          `Metric key "${metricKey}" is not registered in the controlled metric catalog.`,
          400
        );
      }

      const result = await getMetricHistoryWithAnalytics(supabase, serviceId, metricKey, windowStr);
      return {
        metricKey: result.metricKey,
        serviceId: result.serviceId,
        window: result.window,
        trend: result.trend,
        aggregations: result.aggregations,
        dataQuality: result.dataQuality,
      };
    }

    case 'analytics-forecast':
    case 'operations.analytics.forecast': {
      const serviceId = (params.service_id || params.serviceId) as string;
      const metricKey = (params.metric_key || params.metricKey) as string;
      const threshold = params.threshold !== undefined ? Number(params.threshold) : undefined;
      const windowStr = (params.window as AnalyticsWindow) || '24h';

      if (!serviceId || !metricKey) {
        throw new OperationsError(
          "INVALID_REQUEST",
          "Parameters 'service_id' and 'metric_key' are required for threshold forecasting.",
          400
        );
      }

      if (!isValidMetricKey(metricKey)) {
        throw new OperationsError(
          "INVALID_REQUEST",
          `Metric key "${metricKey}" is not registered in the controlled metric catalog.`,
          400
        );
      }

      const projection = await projectThresholdTrajectory(supabase, serviceId, metricKey, threshold, windowStr);
      return projection;
    }

    case 'analytics-incidents':
    case 'operations.analytics.incidents': {
      const windowStr = (params.window as AnalyticsWindow) || '30d';
      const stats = await getIncidentAnalytics(supabase, windowStr);
      return stats;
    }

    case 'analytics-alerts':
    case 'operations.analytics.alerts': {
      const windowStr = (params.window as AnalyticsWindow) || '30d';
      const stats = await getAlertAnalytics(supabase, windowStr);
      return stats;
    }

    case 'analytics-jobs':
    case 'operations.analytics.jobs': {
      const jobKey = (params.job_key || params.jobKey) as string | undefined;
      const windowStr = (params.window as AnalyticsWindow) || '30d';
      const stats = await getJobAnalytics(supabase, jobKey, windowStr);
      return stats;
    }

    case 'analytics-services':
    case 'operations.analytics.services': {
      const windowStr = (params.window as AnalyticsWindow) || '24h';
      const overview = await getCrossServiceAnalyticsOverview(supabase, windowStr);
      const serviceId = (params.service_id || params.serviceId) as string | undefined;
      if (serviceId) {
        const s = overview.services[serviceId];
        if (!s) {
          return { serviceId, status: "NOT_AVAILABLE", message: `Service ${serviceId} has no operational history.` };
        }
        return s;
      }
      return overview.services;
    }

    case 'analytics-rollup':
    case 'operations.analytics.rollup': {
      const targetHour = (params.target_hour || params.targetHour) as string | undefined;
      const rollupResult = await executeHistoricalMetricsRollup(supabase, requestId, targetHour);
      return rollupResult;
    }

    case 'notifications-overview': {
      const { data: outboxRows } = await supabase
        .from('ops_notification_outbox')
        .select('status');

      const counts = {
        pending: 0,
        processing: 0,
        request_accepted: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
      };
      if (outboxRows) {
        counts.total = outboxRows.length;
        for (const row of outboxRows) {
          if (row.status === 'PENDING') counts.pending++;
          else if (row.status === 'PROCESSING') counts.processing++;
          else if (row.status === 'REQUEST_ACCEPTED') counts.request_accepted++;
          else if (row.status === 'FAILED') counts.failed++;
          else if (row.status === 'CANCELLED') counts.cancelled++;
        }
      }

      const { count: policyCount } = await supabase
        .from('ops_notification_policies')
        .select('*', { count: 'exact', head: true });

      const { count: recipientCount } = await supabase
        .from('ops_notification_recipients')
        .select('*', { count: 'exact', head: true });

      const { count: groupCount } = await supabase
        .from('ops_notification_groups')
        .select('*', { count: 'exact', head: true });

      const hasResendKey = Boolean(Deno.env.get('RESEND_API_KEY'));
      const providerStatus = hasResendKey ? 'CONFIGURED' : 'NOT_CONFIGURED';

      const { data: recentAttempts } = await supabase
        .from('ops_notification_delivery_attempts')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      const { data: recentOutbox } = await supabase
        .from('ops_notification_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        summary: counts,
        policy_count: policyCount || 0,
        recipient_count: recipientCount || 0,
        group_count: groupCount || 0,
        provider: {
          channel: 'EMAIL',
          adapter: 'ResendAdapter',
          status: providerStatus,
          is_configured: hasResendKey,
          from_address: Deno.env.get('OPS_EMAIL_FROM') || 'ops-alerts@resend.dev',
        },
        recent_outbox: recentOutbox || [],
        recent_attempts: recentAttempts || [],
      };
    }

    case 'notifications-policies': {
      const { data: policies, error } = await supabase
        .from('ops_notification_policies')
        .select('*, group:group_id(*), escalation_group:escalation_group_id(*)')
        .order('created_at', { ascending: true });

      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to query policies: ${error.message}`, 500);
      }
      return { policies: policies || [], count: (policies || []).length };
    }

    case 'notifications-policy-update': {
      const id = (params.id || params.policy_id) as string;
      if (!id) {
        throw new OperationsError('INVALID_REQUEST', 'Parameter "id" is required to update policy.', 400);
      }
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (params.enabled !== undefined) updates.enabled = Boolean(params.enabled);
      if (params.min_severity !== undefined) updates.min_severity = params.min_severity;
      if (params.cooldown_minutes !== undefined) updates.cooldown_minutes = Number(params.cooldown_minutes);
      if (params.escalation_delay_minutes !== undefined) {
        updates.escalation_delay_minutes = params.escalation_delay_minutes === null ? null : Number(params.escalation_delay_minutes);
      }
      if (params.group_id !== undefined) updates.group_id = params.group_id;
      if (params.escalation_group_id !== undefined) updates.escalation_group_id = params.escalation_group_id;

      const { data: updated, error } = await supabase
        .from('ops_notification_policies')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to update policy: ${error.message}`, 500);
      }
      return updated;
    }

    case 'notifications-recipients': {
      const { data: recipients, error } = await supabase
        .from('ops_notification_recipients')
        .select('*, group_memberships:ops_notification_group_members(group_id, ops_notification_groups(group_key, name))')
        .order('display_name', { ascending: true });

      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to query recipients: ${error.message}`, 500);
      }
      return { recipients: recipients || [], count: (recipients || []).length };
    }

    case 'notifications-recipient-create': {
      const email = (params.email as string)?.trim()?.toLowerCase();
      const displayName = (params.display_name as string)?.trim();
      const roleName = (params.role_name as string)?.trim() || 'OPERATIONS_ADMIN';
      const groupIds = (params.group_ids as string[]) || [];

      if (!email || !displayName) {
        throw new OperationsError('INVALID_REQUEST', 'Parameters "email" and "display_name" are required.', 400);
      }

      const { data: inserted, error } = await supabase
        .from('ops_notification_recipients')
        .insert({
          email,
          display_name: displayName,
          role_name: roleName,
          enabled: params.enabled !== undefined ? Boolean(params.enabled) : true,
        })
        .select()
        .single();

      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to create recipient: ${error.message}`, error.code === '23505' ? 409 : 500);
      }

      if (groupIds.length > 0) {
        const memberships = groupIds.map(gid => ({ group_id: gid, recipient_id: inserted.id }));
        await supabase.from('ops_notification_group_members').insert(memberships);
      }

      return inserted;
    }

    case 'notifications-recipient-update': {
      const id = (params.id || params.recipient_id) as string;
      if (!id) {
        throw new OperationsError('INVALID_REQUEST', 'Parameter "id" is required to update recipient.', 400);
      }
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (params.display_name !== undefined) updates.display_name = String(params.display_name).trim();
      if (params.email !== undefined) updates.email = String(params.email).trim().toLowerCase();
      if (params.role_name !== undefined) updates.role_name = String(params.role_name).trim();
      if (params.enabled !== undefined) updates.enabled = Boolean(params.enabled);

      const { data: updated, error } = await supabase
        .from('ops_notification_recipients')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to update recipient: ${error.message}`, 500);
      }

      if (Array.isArray(params.group_ids)) {
        await supabase.from('ops_notification_group_members').delete().eq('recipient_id', id);
        if (params.group_ids.length > 0) {
          const memberships = (params.group_ids as string[]).map(gid => ({ group_id: gid, recipient_id: id }));
          await supabase.from('ops_notification_group_members').insert(memberships);
        }
      }

      return updated;
    }

    case 'notifications-recipient-delete': {
      const id = (params.id || params.recipient_id) as string;
      if (!id) {
        throw new OperationsError('INVALID_REQUEST', 'Parameter "id" is required.', 400);
      }
      const { error } = await supabase
        .from('ops_notification_recipients')
        .delete()
        .eq('id', id);

      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to delete recipient: ${error.message}`, 500);
      }
      return { success: true, deleted_id: id };
    }

    case 'notifications-groups': {
      const { data: groups, error } = await supabase
        .from('ops_notification_groups')
        .select('*, members:ops_notification_group_members(recipient:recipient_id(*))')
        .order('group_key', { ascending: true });

      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to query groups: ${error.message}`, 500);
      }
      return { groups: groups || [], count: (groups || []).length };
    }

    case 'notifications-outbox': {
      let query = supabase
        .from('ops_notification_outbox')
        .select('*');

      if (params.status && typeof params.status === 'string') {
        query = query.eq('status', params.status.toUpperCase());
      }
      if (params.incident_id && typeof params.incident_id === 'string') {
        query = query.eq('incident_id', params.incident_id);
      }
      if (params.recipient_id && typeof params.recipient_id === 'string') {
        query = query.eq('recipient_id', params.recipient_id);
      }

      const limit = typeof params.limit === 'number' ? Math.min(params.limit, 100) : 50;
      query = query.order('created_at', { ascending: false }).limit(limit);

      const { data: rows, error } = await query;
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to query outbox: ${error.message}`, 500);
      }
      return { outbox: rows || [], count: (rows || []).length };
    }

    case 'notifications-attempts': {
      let query = supabase
        .from('ops_notification_delivery_attempts')
        .select('*');

      if (params.notification_id && typeof params.notification_id === 'string') {
        query = query.eq('notification_id', params.notification_id);
      }
      if (params.status && typeof params.status === 'string') {
        query = query.eq('status', params.status.toUpperCase());
      }

      const limit = typeof params.limit === 'number' ? Math.min(params.limit, 100) : 50;
      query = query.order('started_at', { ascending: false }).limit(limit);

      const { data: attempts, error } = await query;
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to query attempts: ${error.message}`, 500);
      }
      return { attempts: attempts || [], count: (attempts || []).length };
    }

    case 'notifications-retry': {
      const notificationId = (params.id || params.notification_id) as string;
      if (!notificationId) {
        throw new OperationsError('INVALID_REQUEST', 'Parameter "notification_id" is required for manual retry.', 400);
      }

      const { data: item, error: fetchErr } = await supabase
        .from('ops_notification_outbox')
        .select('*')
        .eq('id', notificationId)
        .maybeSingle();

      if (fetchErr || !item) {
        throw new OperationsError('RESOURCE_NOT_FOUND', `Notification "${notificationId}" not found.`, 404);
      }

      if (item.status === 'REQUEST_ACCEPTED') {
        throw new OperationsError('INVALID_REQUEST', 'Notification has already been accepted for delivery.', 400);
      }

      const { data: updated, error: updateErr } = await supabase
        .from('ops_notification_outbox')
        .update({
          status: 'PENDING',
          safe_error_code: null,
          safe_error_message: null,
          scheduled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .select()
        .single();

      if (updateErr) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to reset notification: ${updateErr.message}`, 500);
      }

      await processNotificationOutbox(supabase, 5);

      return {
        success: true,
        notification: updated,
      };
    }

    case 'notifications-cancel': {
      const notificationId = (params.id || params.notification_id) as string;
      if (!notificationId) {
        throw new OperationsError('INVALID_REQUEST', 'Parameter "notification_id" is required to cancel.', 400);
      }

      const { data: item, error: fetchErr } = await supabase
        .from('ops_notification_outbox')
        .select('*')
        .eq('id', notificationId)
        .maybeSingle();

      if (fetchErr || !item) {
        throw new OperationsError('RESOURCE_NOT_FOUND', `Notification "${notificationId}" not found.`, 404);
      }

      if (item.status === 'REQUEST_ACCEPTED') {
        throw new OperationsError('INVALID_REQUEST', 'Cannot cancel a notification that was already accepted.', 400);
      }

      const { data: updated, error: updateErr } = await supabase
        .from('ops_notification_outbox')
        .update({
          status: 'CANCELLED',
          safe_error_code: 'SUPERADMIN_MANUAL_CANCEL',
          safe_error_message: 'Cancelled manually by Super Admin.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .select()
        .single();

      if (updateErr) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to cancel notification: ${updateErr.message}`, 500);
      }

      return { success: true, notification: updated };
    }

    case 'notifications-process': {
      const batchSize = typeof params.batch_size === 'number' ? Math.min(params.batch_size, 50) : 25;
      const result = await processNotificationOutbox(supabase, batchSize);
      return result;
    }

    case 'notifications-preview': {
      const eventType = (params.event_type as any) || 'INCIDENT_CREATED';
      const mockContext = {
        incidentId: 'preview-inc-uuid',
        incidentKey: 'inc_preview_mock_key',
        title: (params.title as string) || 'Database Probe Latency Degradation',
        description: (params.description as string) || 'Observed elevated latency (>2500ms) on postgres_core probe across 3 evaluations.',
        severity: (params.severity as any) || 'CRITICAL',
        serviceId: (params.service_id as string) || 'SUPABASE_POSTGRES',
        openedAt: new Date().toLocaleString(),
        durationString: '14m',
        escalationLevel: Number(params.escalation_level) || 0,
        resolutionType: (params.resolution_type as string) || 'MANUAL',
        resolutionReason: (params.resolution_reason as string) || 'Database connection pool reclaimed by Super Admin.',
        resolvedBy: 'super_admin_ops',
        resolvedAt: new Date().toLocaleString(),
      };

      const rendered = renderNotificationTemplate(eventType, mockContext);
      return {
        preview_mode: true,
        sent: false,
        event_type: eventType,
        subject: rendered.subject,
        content_text: rendered.text,
        content_html: rendered.html,
      };
    }

    case 'notifications-prune': {
      const retentionDays = typeof params.retention_days === 'number' ? params.retention_days : 30;
      const { data, error } = await supabase.rpc('prune_stale_operations_notifications', {
        p_retention_days: retentionDays,
      });
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to prune notifications: ${error.message}`, 500);
      }
      return data;
    }

    // Phase 9: Safe Operational Remediation & Runbooks
    case 'remediation-runbooks':
    case 'operations.remediation.runbooks': {
      const { data, error } = await supabase
        .from('ops_runbooks')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error || !data || data.length === 0) {
        return { runbooks: CANONICAL_RUNBOOKS };
      }
      return { runbooks: data };
    }

    case 'remediation-actions':
    case 'operations.remediation.actions': {
      const { data, error } = await supabase
        .from('ops_remediation_actions')
        .select('*')
        .order('action_key', { ascending: true });

      if (error || !data || data.length === 0) {
        return { actions: CANONICAL_ACTIONS };
      }
      return { actions: data };
    }

    case 'remediation-recommend':
    case 'operations.remediation.recommend': {
      const incidentId = (params.incident_id || params.incidentId) as string;
      if (!incidentId) {
        throw new OperationsError('INVALID_REQUEST', 'Missing required parameter: incident_id', 400);
      }

      const { data: incident, error } = await supabase
        .from('ops_incidents')
        .select('*')
        .eq('id', incidentId)
        .maybeSingle();

      if (error || !incident) {
        throw new OperationsError('RESOURCE_NOT_FOUND', `Incident "${incidentId}" not found.`, 404);
      }

      const recommendations = recommendRunbooksForIncident(incident);
      return {
        incident_id: incidentId,
        recommended_runbooks: recommendations,
      };
    }

    case 'remediation-dry-run':
    case 'operations.remediation.dry_run': {
      const actionKey = (params.action_key || params.actionKey) as string;
      if (!actionKey) {
        throw new OperationsError('INVALID_REQUEST', 'Missing required parameter: action_key', 400);
      }

      const incidentId = (params.incident_id || params.incidentId) as string | undefined;
      const remParams = (params.parameters as Record<string, unknown>) || {};
      const envOverride = params.environment as any;

      const dryRunResult = await evaluateDryRun(supabase, {
        actionKey,
        incidentId,
        parameters: remParams,
        environmentOverride: envOverride,
      });

      return dryRunResult;
    }

    case 'remediation-propose':
    case 'operations.remediation.request_approval': {
      const actionKey = (params.action_key || params.actionKey) as string;
      if (!actionKey) {
        throw new OperationsError('INVALID_REQUEST', 'Missing required parameter: action_key', 400);
      }

      const incidentId = (params.incident_id || params.incidentId) as string | undefined;
      const remParams = (params.parameters as Record<string, unknown>) || {};
      const envOverride = params.environment as any;
      const actor = (params.adminUserId as string) || 'super_admin_ops';

      try {
        const proposed = await proposeRemediation(supabase, {
          actionKey,
          incidentId,
          parameters: remParams,
          environmentOverride: envOverride,
          requestedBy: actor,
        });
        return { success: true, remediation: proposed };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new OperationsError('PRECONDITION_FAILED', msg, 400);
      }
    }

    case 'remediation-approve':
    case 'operations.remediation.approve': {
      const executionId = (params.execution_id || params.executionId) as string;
      if (!executionId) {
        throw new OperationsError('INVALID_REQUEST', 'Missing required parameter: execution_id', 400);
      }

      const actor = (params.adminUserId as string) || 'super_admin_ops';
      try {
        const approved = await approveRemediation(supabase, executionId, actor);
        return { success: true, remediation: approved };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new OperationsError('INVALID_REQUEST', msg, 400);
      }
    }

    case 'remediation-reject':
    case 'operations.remediation.reject': {
      const executionId = (params.execution_id || params.executionId) as string;
      if (!executionId) {
        throw new OperationsError('INVALID_REQUEST', 'Missing required parameter: execution_id', 400);
      }

      const actor = (params.adminUserId as string) || 'super_admin_ops';
      const reason = (params.reason as string) || 'Rejected by Super Admin.';
      try {
        const rejected = await rejectRemediation(supabase, executionId, actor, reason);
        return { success: true, remediation: rejected };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new OperationsError('INVALID_REQUEST', msg, 400);
      }
    }

    case 'remediation-execute':
    case 'operations.remediation.execute': {
      const executionId = (params.execution_id || params.executionId) as string | undefined;
      const actor = (params.adminUserId as string) || 'super_admin_ops';

      if (executionId) {
        try {
          const executed = await executeRemediation(supabase, executionId, actor);
          return { success: executed.status === 'COMPLETED', remediation: executed };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new OperationsError('INTERNAL_ERROR', msg, 500);
        }
      }

      const actionKey = (params.action_key || params.actionKey) as string;
      if (!actionKey) {
        throw new OperationsError('INVALID_REQUEST', 'Provide either execution_id or action_key to execute remediation.', 400);
      }

      const incidentId = (params.incident_id || params.incidentId) as string | undefined;
      const remParams = (params.parameters as Record<string, unknown>) || {};
      const envOverride = params.environment as any;

      try {
        const proposed = await proposeRemediation(supabase, {
          actionKey,
          incidentId,
          parameters: remParams,
          environmentOverride: envOverride,
          requestedBy: actor,
        });

        if (proposed.status === 'PENDING_APPROVAL') {
          return {
            success: false,
            status: 'PENDING_APPROVAL',
            remediation: proposed,
            message: 'This action has high risk level and requires explicit Super Admin approval before execution.',
          };
        }

        const executed = await executeRemediation(supabase, proposed.id, actor);
        return { success: executed.status === 'COMPLETED', remediation: executed };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new OperationsError('EXECUTION_FAILED', msg, 400);
      }
    }

    case 'remediation-cancel':
    case 'operations.remediation.cancel': {
      const executionId = (params.execution_id || params.executionId) as string;
      if (!executionId) {
        throw new OperationsError('INVALID_REQUEST', 'Missing required parameter: execution_id', 400);
      }

      const actor = (params.adminUserId as string) || 'super_admin_ops';
      const reason = params.reason as string | undefined;
      try {
        const cancelled = await cancelRemediation(supabase, executionId, actor, reason);
        return { success: true, remediation: cancelled };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new OperationsError('INVALID_REQUEST', msg, 400);
      }
    }

    case 'remediation-rollback':
    case 'operations.remediation.rollback': {
      const executionId = (params.execution_id || params.executionId) as string;
      if (!executionId) {
        throw new OperationsError('INVALID_REQUEST', 'Missing required parameter: execution_id', 400);
      }

      const actor = (params.adminUserId as string) || 'super_admin_ops';
      try {
        const rolledBack = await rollbackRemediation(supabase, executionId, actor);
        return { success: true, remediation: rolledBack };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new OperationsError('INVALID_REQUEST', msg, 400);
      }
    }

    case 'remediation-history':
    case 'operations.remediation.history': {
      const incidentId = (params.incident_id || params.incidentId) as string | undefined;
      const status = params.status as string | undefined;
      const actionKey = (params.action_key || params.actionKey) as string | undefined;
      const limit = typeof params.limit === 'number' ? Math.min(params.limit, 100) : 50;

      let query = supabase
        .from('ops_remediation_executions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (incidentId) {
        query = query.eq('incident_id', incidentId);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (actionKey) {
        query = query.eq('action_key', actionKey);
      }

      const { data, error } = await query;
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to query remediation history: ${error.message}`, 500);
      }

      return { executions: data || [] };
    }

    case 'remediation-prune': {
      const retentionDays = typeof params.retention_days === 'number' ? params.retention_days : 30;
      const { data, error } = await supabase.rpc('prune_stale_operations_remediations', {
        p_retention_days: retentionDays,
      });
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to prune remediations: ${error.message}`, 500);
      }
      return data;
    }

    // Phase 10: Operational Resilience, Failure Injection & Disaster Recovery
    case 'resilience-scenarios':
    case 'operations.resilience.scenarios': {
      const { data, error } = await supabase
        .from('ops_resilience_scenarios')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error || !data || data.length === 0) {
        return { scenarios: CANONICAL_SCENARIOS };
      }
      return { scenarios: data };
    }

    case 'resilience-run':
    case 'operations.resilience.run': {
      const scenarioKey = (params.scenario_key || params.scenarioKey) as string;
      if (!scenarioKey) {
        throw new OperationsError('INVALID_REQUEST', 'Missing required parameter: scenario_key', 400);
      }

      const envOverride = params.environment as any;
      const actor = (params.adminUserId as string) || 'super_admin_ops';
      const isSimulation = params.is_simulation !== false;

      try {
        const result = await executeResilienceScenario(
          supabase,
          scenarioKey,
          envOverride,
          actor,
          isSimulation
        );
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const code = msg.includes('ENVIRONMENT_UNSAFE') || msg.includes('PRODUCTION_DESTRUCTIVE_BLOCKED')
          ? 'ENVIRONMENT_UNSAFE'
          : 'PRECONDITION_FAILED';
        throw new OperationsError(code as any, msg, 400);
      }
    }

    case 'resilience-history':
    case 'operations.resilience.history': {
      const scenarioKey = (params.scenario_key || params.scenarioKey) as string | undefined;
      const status = params.status as string | undefined;
      const limit = typeof params.limit === 'number' ? Math.min(params.limit, 100) : 50;

      let query = supabase
        .from('ops_resilience_test_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (scenarioKey) {
        query = query.eq('scenario_key', scenarioKey);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to query resilience history: ${error.message}`, 500);
      }

      return { runs: data || [] };
    }

    case 'resilience-overview':
    case 'operations.resilience.overview': {
      const overview = await getResilienceOverview(supabase);
      return overview;
    }

    case 'resilience-prune': {
      const retentionDays = typeof params.retention_days === 'number' ? params.retention_days : 30;
      const { data, error } = await supabase.rpc('prune_stale_operations_resilience_runs', {
        p_retention_days: retentionDays,
      });
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to prune resilience test runs: ${error.message}`, 500);
      }
      return data;
    }

    case 'slo-overview':
    case 'operations.slo.overview': {
      const evaluations = await evaluateAllSlos(supabase);
      return { slos: CANONICAL_SLOS, evaluations };
    }

    case 'slo-details':
    case 'operations.slo.details': {
      const sloKey = (params.slo_key || params.sloKey) as string;
      const slo = getSloByKey(sloKey);
      if (!slo) {
        throw new OperationsError('NOT_FOUND', `SLO "${sloKey}" not found in catalog`, 404);
      }
      const evaluations = await evaluateAllSlos(supabase);
      const evaluation = evaluations.find((e) => e.slo_key === sloKey);
      return { slo, evaluation: evaluation || null };
    }

    case 'slo-history':
    case 'operations.slo.history': {
      const sloKey = (params.slo_key || params.sloKey) as string | undefined;
      const limit = typeof params.limit === 'number' ? Math.min(params.limit, 100) : 50;

      let query = supabase
        .from('ops_slo_evaluations')
        .select('*')
        .order('evaluated_at', { ascending: false })
        .limit(limit);

      if (sloKey) {
        query = query.eq('slo_key', sloKey);
      }

      const { data, error } = await query;
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to query SLO history: ${error.message}`, 500);
      }
      return { history: data || [] };
    }

    case 'slo-evaluate':
    case 'operations.slo.evaluate': {
      const evaluations = await evaluateAllSlos(supabase);
      return { evaluated_count: evaluations.length, evaluations };
    }

    case 'capacity-overview':
    case 'operations.capacity.overview': {
      const resources = await evaluateAllCapacity(supabase);
      return { resources };
    }

    case 'capacity-details':
    case 'operations.capacity.details': {
      const resourceKey = (params.resource_key || params.resourceKey) as string;
      const definition = getCapacityResourceByKey(resourceKey);
      if (!definition) {
        throw new OperationsError('NOT_FOUND', `Capacity resource "${resourceKey}" not found`, 404);
      }
      const resources = await evaluateAllCapacity(supabase);
      const resource = resources.find((r) => r.resource_key === resourceKey);
      return { definition, resource: resource || null };
    }

    case 'readiness-evaluate':
    case 'operations.readiness.evaluate': {
      const env = (params.environment || resolveEnvironment()) as any;
      const correlationId = (params.correlationId as string) || `corr_${requestId}`;
      const actor = (params.adminUserId as string) || 'superadmin';
      const result = await evaluateProductionReadiness(supabase, env, actor, correlationId);
      return result;
    }

    case 'readiness-history':
    case 'operations.readiness.history': {
      const env = params.environment as string | undefined;
      const limit = typeof params.limit === 'number' ? Math.min(params.limit, 100) : 50;

      let query = supabase
        .from('ops_readiness_evaluations')
        .select('*')
        .order('evaluated_at', { ascending: false })
        .limit(limit);

      if (env) {
        query = query.eq('environment', env);
      }

      const { data, error } = await query;
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to query readiness history: ${error.message}`, 500);
      }
      return { history: data || [] };
    }

    case 'governance-prune': {
      const retentionDays = typeof params.retention_days === 'number' ? params.retention_days : 90;
      const { data, error } = await supabase.rpc('prune_stale_operations_governance', {
        p_retention_days: retentionDays,
      });
      if (error) {
        throw new OperationsError('INTERNAL_ERROR', `Failed to prune governance records: ${error.message}`, 500);
      }
      return data;
    }

    default:
      throw new OperationsError(
        'INVALID_REQUEST',
        `Unknown operation action "${action}". Permitted actions: overview, services, capabilities, database, providers, metrics, health, collect, jobs, job-runs, maintenance, alerts, alert, incidents, incident, incident-events, evaluate-alerts, acknowledge-incident, resolve-incident, analytics-overview, analytics-metric, analytics-trend, analytics-forecast, analytics-incidents, analytics-alerts, analytics-jobs, analytics-services, analytics-rollup, notifications-overview, notifications-policies, notifications-policy-update, notifications-recipients, notifications-recipient-create, notifications-recipient-update, notifications-recipient-delete, notifications-groups, notifications-outbox, notifications-attempts, notifications-retry, notifications-cancel, notifications-process, notifications-preview, notifications-prune, remediation-runbooks, remediation-actions, remediation-recommend, remediation-dry-run, remediation-propose, remediation-approve, remediation-reject, remediation-execute, remediation-cancel, remediation-rollback, remediation-history, remediation-prune, resilience-scenarios, resilience-run, resilience-history, resilience-overview, resilience-prune, slo-overview, slo-details, slo-history, slo-evaluate, capacity-overview, capacity-details, readiness-evaluate, readiness-history, governance-prune.`,
        400
      );
  }
}
