// supabase/functions/superadmin-operations/remediation/registry.ts
// LPU Events — Controlled Runbook & Allowlisted Remediation Action Registry

import {
  RunbookDefinition,
  RemediationActionDefinition,
} from './types.ts';

export const CANONICAL_RUNBOOKS: RunbookDefinition[] = [
  {
    runbook_key: 'RUNBOOK_TELEMETRY_REFRESH',
    name: 'Refresh Provider Infrastructure Telemetry',
    description: 'Re-executes provider telemetry collection when health probes or metric snapshots are stale or missing.',
    category: 'TELEMETRY',
    risk_level: 'LOW',
    execution_mode: 'AUTOMATIC',
    enabled: true,
    version: '1.0.0',
    preconditions_description: 'No active collection run in progress. Target provider credentials configured.',
    postconditions_description: 'Fresh metric snapshot created within past 2 minutes and valid health probe status.',
    instructions_markdown: '### Operational Runbook: Refresh Telemetry\n1. Automatically triggered if telemetry probe reports STALE.\n2. Re-runs server-side provider adapters (Supabase, Cloudflare, Resend, Sentry).\n3. Re-evaluates health probe states.',
    supports_rollback: false,
    requires_approval: false,
  },
  {
    runbook_key: 'RUNBOOK_MAINTENANCE_JOB_RETRY',
    name: 'Retry Failed Operations Maintenance Job',
    description: 'Re-executes a failed or stale idempotent background maintenance job execution.',
    category: 'MAINTENANCE',
    risk_level: 'LOW',
    execution_mode: 'AUTOMATIC',
    enabled: true,
    version: '1.0.0',
    preconditions_description: 'Job is currently enabled. No active execution currently marked RUNNING.',
    postconditions_description: 'Job execution completes with COMPLETED status and 0 error records.',
    instructions_markdown: '### Operational Runbook: Retry Maintenance Job\n1. Validates that previous execution failed due to transient network or lease conflict.\n2. Starts single-flight execution lease.\n3. Verifies post-execution job state.',
    supports_rollback: false,
    requires_approval: false,
  },
  {
    runbook_key: 'RUNBOOK_ANALYTICS_ROLLUP_REBUILD',
    name: 'Rebuild Historical Analytics Metric Rollup',
    description: 'Re-computes hourly and daily statistical rollups into ops_metric_aggregates for gap recovery.',
    category: 'ANALYTICS',
    risk_level: 'LOW',
    execution_mode: 'AUTOMATIC',
    enabled: true,
    version: '1.0.0',
    preconditions_description: 'Historical metric snapshots exist for target window. No concurrent rollup currently running.',
    postconditions_description: 'Rollup bucket populated in ops_metric_aggregates with valid min, max, avg, and count.',
    instructions_markdown: '### Operational Runbook: Rebuild Analytics Rollup\n1. Gathers unaggregated metric snapshots from target time window.\n2. Computes aggregations via server-side RPC.\n3. Updates ops_metric_aggregates idempotently.',
    supports_rollback: false,
    requires_approval: false,
  },
  {
    runbook_key: 'RUNBOOK_NOTIFICATION_OUTBOX_FLUSH',
    name: 'Flush Operational Notification Outbox Queue',
    description: 'Triggers immediate single-flight delivery for pending operational notifications.',
    category: 'NOTIFICATIONS',
    risk_level: 'LOW',
    execution_mode: 'AUTOMATIC',
    enabled: true,
    version: '1.0.0',
    preconditions_description: 'Pending outbox records exist with attempt_count < max_attempts. Resend provider configured.',
    postconditions_description: 'Pending notifications transition to REQUEST_ACCEPTED status with provider_message_id recorded.',
    instructions_markdown: '### Operational Runbook: Flush Notification Outbox\n1. Claims pending batch with status = PROCESSING.\n2. Dispatches emails via Resend server-side adapter.\n3. Records delivery attempt audit records.',
    supports_rollback: false,
    requires_approval: false,
  },
  {
    runbook_key: 'RUNBOOK_DATABASE_SIZE_GUARDRAIL',
    name: 'Database Size Guardrail Verification & Prune',
    description: 'Executes bounded cleanup of expired operational telemetry and temporary tables to reclaim storage.',
    category: 'DATABASE',
    risk_level: 'MEDIUM',
    execution_mode: 'APPROVAL_REQUIRED',
    enabled: true,
    version: '1.0.0',
    preconditions_description: 'Database total size exceeds warning threshold (>350MB). Super Admin approval granted.',
    postconditions_description: 'Stale telemetry pruned and database storage size stabilizes below warning ceiling.',
    instructions_markdown: '### Operational Runbook: Database Guardrail\n1. Requires explicit Super Admin approval.\n2. Prunes telemetry records older than retention period.\n3. Does NOT truncate or delete business tables.',
    supports_rollback: false,
    requires_approval: true,
  },
  {
    runbook_key: 'RUNBOOK_CACHE_DERIVED_REFRESH',
    name: 'Refresh Derived Operations Health Cache',
    description: 'Forces re-evaluation of service registry health statuses and active incident counts.',
    category: 'GENERAL',
    risk_level: 'LOW',
    execution_mode: 'AUTOMATIC',
    enabled: true,
    version: '1.0.0',
    preconditions_description: 'No preconditions required.',
    postconditions_description: 'Updated overview health state returned.',
    instructions_markdown: '### Operational Runbook: Refresh Cache\nRecomputes derived health flags across all registered services.',
    supports_rollback: false,
    requires_approval: false,
  },
  {
    runbook_key: 'RUNBOOK_EXTERNAL_PROVIDER_OUTAGE',
    name: 'External Upstream Provider Outage Response',
    description: 'Operator guidance for third-party upstream outages (Cloudflare, Supabase, Resend, Sentry). Automated remediation is unsafe.',
    category: 'GENERAL',
    risk_level: 'HIGH',
    execution_mode: 'OBSERVE_ONLY',
    enabled: true,
    version: '1.0.0',
    preconditions_description: 'Provider health probe UNAVAILABLE or error rate spike detected.',
    postconditions_description: 'External status dashboard confirms recovery and health probe returns to HEALTHY.',
    instructions_markdown: '### Operational Guidance (Observe Only)\n1. Check official provider status pages:\n   - Cloudflare: https://www.cloudflarestatus.com/\n   - Supabase: https://status.supabase.com/\n   - Resend: https://resend-status.com/\n2. Confirm whether outage is regional or global.\n3. Do NOT rotate production secrets or wipe caches during an external outage.\n4. Monitor automatic recovery once provider restores connectivity.',
    supports_rollback: false,
    requires_approval: false,
  },
  {
    runbook_key: 'RUNBOOK_DATABASE_CONNECTION_CONTENTION',
    name: 'Database Connection Pool Contention Triage',
    description: 'Operator guidance for database connection pool exhaustion or high lock contention.',
    category: 'DATABASE',
    risk_level: 'CRITICAL',
    execution_mode: 'OBSERVE_ONLY',
    enabled: true,
    version: '1.0.0',
    preconditions_description: 'Elevated database latency (>2000ms) or max connections alert active.',
    postconditions_description: 'Active pool connection count falls below 70% threshold and query latency normalizes.',
    instructions_markdown: '### Operational Guidance (Observe Only)\n1. Open Supabase Dashboard -> Database -> Connection Pooler.\n2. Inspect active client connections and idle transactions in transaction pool.\n3. Identify slow unindexed queries in pg_stat_statements.\n4. Avoid terminating random backend processes; allow graceful timeout.',
    supports_rollback: false,
    requires_approval: false,
  },
];

export const CANONICAL_ACTIONS: RemediationActionDefinition[] = [
  {
    action_key: 'telemetry.recollect',
    runbook_key: 'RUNBOOK_TELEMETRY_REFRESH',
    name: 'Recollect Provider Telemetry',
    description: 'Executes provider health probes and updates operational metric snapshots',
    handler_key: 'handler_telemetry_recollect',
    risk_level: 'LOW',
    supports_auto_execution: true,
    supports_rollback: false,
    requires_approval: false,
    timeout_ms: 30000,
    cooldown_minutes: 5,
    max_attempts: 3,
    allowed_environments: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'],
    enabled: true,
  },
  {
    action_key: 'job.retry_safe_run',
    runbook_key: 'RUNBOOK_MAINTENANCE_JOB_RETRY',
    name: 'Retry Maintenance Job Run',
    description: 'Retries an idempotent background maintenance job',
    handler_key: 'handler_job_retry',
    risk_level: 'LOW',
    supports_auto_execution: true,
    supports_rollback: false,
    requires_approval: false,
    timeout_ms: 45000,
    cooldown_minutes: 10,
    max_attempts: 3,
    allowed_environments: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'],
    enabled: true,
  },
  {
    action_key: 'analytics.rebuild_rollup',
    runbook_key: 'RUNBOOK_ANALYTICS_ROLLUP_REBUILD',
    name: 'Rebuild Historical Rollup',
    description: 'Rebuilds historical aggregations for the target time bucket',
    handler_key: 'handler_analytics_rebuild_rollup',
    risk_level: 'LOW',
    supports_auto_execution: true,
    supports_rollback: false,
    requires_approval: false,
    timeout_ms: 60000,
    cooldown_minutes: 15,
    max_attempts: 3,
    allowed_environments: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'],
    enabled: true,
  },
  {
    action_key: 'notification.retry_delivery',
    runbook_key: 'RUNBOOK_NOTIFICATION_OUTBOX_FLUSH',
    name: 'Flush Notification Queue',
    description: 'Dispatches pending operational notification outbox records',
    handler_key: 'handler_notification_flush',
    risk_level: 'LOW',
    supports_auto_execution: true,
    supports_rollback: false,
    requires_approval: false,
    timeout_ms: 30000,
    cooldown_minutes: 5,
    max_attempts: 3,
    allowed_environments: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'],
    enabled: true,
  },
  {
    action_key: 'database.run_size_guardrail',
    runbook_key: 'RUNBOOK_DATABASE_SIZE_GUARDRAIL',
    name: 'Execute Database Size Guardrail',
    description: 'Reclaims storage by pruning stale telemetry older than retention limits',
    handler_key: 'handler_database_size_guardrail',
    risk_level: 'MEDIUM',
    supports_auto_execution: false,
    supports_rollback: false,
    requires_approval: true,
    timeout_ms: 60000,
    cooldown_minutes: 30,
    max_attempts: 2,
    allowed_environments: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'],
    enabled: true,
  },
  {
    action_key: 'cache.refresh_derived_operations',
    runbook_key: 'RUNBOOK_CACHE_DERIVED_REFRESH',
    name: 'Refresh Operations State Cache',
    description: 'Forces re-evaluation of service registry and health summary cache',
    handler_key: 'handler_cache_refresh',
    risk_level: 'LOW',
    supports_auto_execution: true,
    supports_rollback: false,
    requires_approval: false,
    timeout_ms: 15000,
    cooldown_minutes: 5,
    max_attempts: 3,
    allowed_environments: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'],
    enabled: true,
  },
];

export function getRunbookByKey(runbookKey: string): RunbookDefinition | undefined {
  return CANONICAL_RUNBOOKS.find((r) => r.runbook_key === runbookKey);
}

export function getActionByKey(actionKey: string): RemediationActionDefinition | undefined {
  return CANONICAL_ACTIONS.find((a) => a.action_key === actionKey);
}

export function getRunbookForAction(actionKey: string): RunbookDefinition | undefined {
  const action = getActionByKey(actionKey);
  if (!action || !action.runbook_key) return undefined;
  return getRunbookByKey(action.runbook_key);
}

/**
 * Deterministically recommends runbooks appropriate for a specific operational incident.
 */
export function recommendRunbooksForIncident(incident: {
  service_id: string;
  severity: string;
  title?: string;
  incident_key?: string;
}): RunbookDefinition[] {
  const recommended: RunbookDefinition[] = [];

  const keyLower = (incident.incident_key || '').toLowerCase();
  const titleLower = (incident.title || '').toLowerCase();
  const service = incident.service_id.toUpperCase();

  // 1. Maintenance Job Failures
  if (keyLower.includes('job') || titleLower.includes('job') || keyLower.includes('maintenance')) {
    const rb = getRunbookByKey('RUNBOOK_MAINTENANCE_JOB_RETRY');
    if (rb) recommended.push(rb);
  }

  // 2. Notification Delivery Backlog / Failures
  if (service.includes('EMAIL') || service.includes('RESEND') || titleLower.includes('notification')) {
    const rb = getRunbookByKey('RUNBOOK_NOTIFICATION_OUTBOX_FLUSH');
    if (rb) recommended.push(rb);
  }

  // 3. Database Size or Pool Contention
  if (service.includes('POSTGRES') || service.includes('DATABASE') || titleLower.includes('database')) {
    if (titleLower.includes('size') || titleLower.includes('volume') || titleLower.includes('storage')) {
      const rb = getRunbookByKey('RUNBOOK_DATABASE_SIZE_GUARDRAIL');
      if (rb) recommended.push(rb);
    }
    if (titleLower.includes('pool') || titleLower.includes('connection') || titleLower.includes('latency')) {
      const rb = getRunbookByKey('RUNBOOK_DATABASE_CONNECTION_CONTENTION');
      if (rb) recommended.push(rb);
    }
  }

  // 4. Analytics Stale Rollup
  if (titleLower.includes('analytics') || titleLower.includes('rollup') || titleLower.includes('aggregate')) {
    const rb = getRunbookByKey('RUNBOOK_ANALYTICS_ROLLUP_REBUILD');
    if (rb) recommended.push(rb);
  }

  // 5. Upstream Provider Outage
  if (service.includes('CLOUDFLARE') || service.includes('SENTRY') || incident.severity === 'CRITICAL') {
    const rb = getRunbookByKey('RUNBOOK_EXTERNAL_PROVIDER_OUTAGE');
    if (rb && !recommended.some((r) => r.runbook_key === rb.runbook_key)) {
      recommended.push(rb);
    }
  }

  // Default fallback: Always recommend Telemetry Refresh & Cache Refresh if no specific matches
  if (recommended.length === 0) {
    const tRef = getRunbookByKey('RUNBOOK_TELEMETRY_REFRESH');
    const cRef = getRunbookByKey('RUNBOOK_CACHE_DERIVED_REFRESH');
    if (tRef) recommended.push(tRef);
    if (cRef) recommended.push(cRef);
  }

  return recommended;
}
