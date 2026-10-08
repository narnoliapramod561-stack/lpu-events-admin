// supabase/functions/superadmin-operations/remediation/engine.ts
// LPU Events — Authoritative Server-Side Remediation Engine (Phase 9)

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';
import {
  DryRunEvaluationResult,
  RemediationEnvironment,
  RemediationExecutionRecord,
} from './types.ts';
import {
  getActionByKey,
  getRunbookForAction,
} from './registry.ts';
import { ALLOWLISTED_HANDLERS } from './handlers.ts';

export function resolveServerEnvironment(): RemediationEnvironment {
  const env = Deno.env.get('ENVIRONMENT') || Deno.env.get('DENO_ENV') || 'PRODUCTION';
  const norm = env.toUpperCase();
  if (norm.includes('DEV')) return 'DEVELOPMENT';
  if (norm.includes('STAG')) return 'STAGING';
  if (norm.includes('PROD')) return 'PRODUCTION';
  return 'UNKNOWN';
}

/**
 * Validates all safety preconditions for a proposed remediation action.
 */
export async function validatePreconditions(
  supabase: SupabaseClient,
  actionKey: string,
  incidentId?: string | null,
  environmentOverride?: RemediationEnvironment
): Promise<{
  passed: boolean;
  reasons: string[];
  action?: ReturnType<typeof getActionByKey>;
  runbook?: ReturnType<typeof getRunbookForAction>;
  environment: RemediationEnvironment;
}> {
  const reasons: string[] = [];
  const environment = environmentOverride || resolveServerEnvironment();

  // 1. Action allowlist check
  const action = getActionByKey(actionKey);
  if (!action) {
    return {
      passed: false,
      reasons: [`Action "${actionKey}" is not registered in the allowlisted remediation catalog.`],
      environment,
    };
  }

  if (!action.enabled) {
    reasons.push(`Action "${actionKey}" is currently disabled by administrator policy.`);
  }

  // 2. Runbook check
  const runbook = getRunbookForAction(actionKey);
  if (!runbook || !runbook.enabled) {
    reasons.push(`Associated runbook is missing or disabled.`);
  }

  // 3. Environment check
  if (environment === 'UNKNOWN' && (action.risk_level === 'HIGH' || action.risk_level === 'CRITICAL')) {
    reasons.push(`Environment is UNKNOWN: High/Critical risk actions are blocked.`);
  } else if (!action.allowed_environments.includes(environment)) {
    reasons.push(`Action "${actionKey}" is not permitted in environment "${environment}".`);
  }

  // 4. Single-flight concurrency check: No conflicting execution currently running
  const { data: runningExecs } = await supabase
    .from('ops_remediation_executions')
    .select('id, action_key, created_at')
    .eq('action_key', actionKey)
    .eq('status', 'EXECUTING')
    .limit(1);

  if (runningExecs && runningExecs.length > 0) {
    reasons.push(`Conflicting execution already in progress for action "${actionKey}".`);
  }

  // 5. Cooldown check (per incident + action)
  if (incidentId && action.cooldown_minutes > 0) {
    const cooldownCutoff = new Date(Date.now() - action.cooldown_minutes * 60 * 1000).toISOString();
    const { data: recentCompleted } = await supabase
      .from('ops_remediation_executions')
      .select('id, completed_at')
      .eq('action_key', actionKey)
      .eq('incident_id', incidentId)
      .eq('status', 'COMPLETED')
      .gte('completed_at', cooldownCutoff)
      .limit(1);

    if (recentCompleted && recentCompleted.length > 0) {
      reasons.push(
        `Action is in cooldown for this incident (must wait ${action.cooldown_minutes} minutes between executions).`
      );
    }
  }

  // 6. Maximum attempt / Automation Exhausted check
  if (incidentId) {
    const { data: pastAttempts } = await supabase
      .from('ops_remediation_executions')
      .select('id, status')
      .eq('action_key', actionKey)
      .eq('incident_id', incidentId)
      .eq('status', 'FAILED');

    if (pastAttempts && pastAttempts.length >= action.max_attempts) {
      reasons.push(
        `AUTOMATION_EXHAUSTED: Maximum attempts (${action.max_attempts}) reached for action on this incident.`
      );
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    action,
    runbook,
    environment,
  };
}

/**
 * Safe Dry Run: Evaluates preconditions and predicts impact without mutating state.
 */
export async function evaluateDryRun(
  supabase: SupabaseClient,
  actionKey: string,
  incidentId?: string | null
): Promise<DryRunEvaluationResult> {
  const pre = await validatePreconditions(supabase, actionKey, incidentId);
  const action = pre.action;
  const runbook = pre.runbook;

  const predictedImpact = action
    ? `Will execute allowlisted server-side handler "${action.handler_key}" under timeout ${action.timeout_ms}ms.`
    : 'Unknown impact.';

  const predictedActions: string[] = [
    `Validate safety preconditions against current environment (${pre.environment})`,
    action?.requires_approval ? 'Require Super Admin explicit approval' : 'Execute automatically',
    'Execute allowlisted internal handler without shell/SQL input',
    'Perform post-action authoritative state verification',
    'Audit execution lifecycle in ops_remediation_executions',
  ];

  return {
    is_dry_run: true,
    action_key: actionKey,
    runbook_key: runbook?.runbook_key || 'UNKNOWN',
    eligible: pre.passed,
    risk_level: action?.risk_level || 'LOW',
    requires_approval: action?.requires_approval || false,
    supports_rollback: action?.supports_rollback || false,
    environment: pre.environment,
    environment_allowed: action?.allowed_environments.includes(pre.environment) || false,
    preconditions_met: pre.passed,
    precondition_details: pre.reasons.length > 0 ? pre.reasons : ['All safety preconditions satisfied.'],
    predicted_impact: predictedImpact,
    predicted_actions: predictedActions,
    what_will_happen: [
      `Validate environment: ${pre.environment}`,
      `Execute internal handler: ${action?.handler_key || 'UNKNOWN'}`,
      'Perform post-action authoritative verification',
      'Persist execution lifecycle audit trail in ops_remediation_executions',
    ],
    what_will_not_happen: [
      'No arbitrary shell commands executed',
      'No raw SQL scripts evaluated',
      'No external unallowlisted network endpoints contacted',
      'No irreversible schema destructive mutations performed',
    ],
    rollback_preview: action?.supports_rollback ? 'Rollback supported' : 'No rollback action supported',
    warnings: pre.passed ? [] : pre.reasons,
  };
}

/**
 * Propose Remediation: Creates an execution record with PENDING_APPROVAL or PROPOSED status.
 */
export async function proposeRemediation(
  supabase: SupabaseClient,
  actionKey: string,
  incidentId: string | null,
  actorId: string,
  parameters: Record<string, unknown> = {},
  correlationId = `remed_${crypto.randomUUID()}`
): Promise<RemediationExecutionRecord> {
  const pre = await validatePreconditions(supabase, actionKey, incidentId);
  const action = pre.action;
  const runbook = pre.runbook;

  if (!action || !runbook) {
    throw new Error(`Action "${actionKey}" is not allowlisted.`);
  }

  const initialStatus = action.requires_approval ? 'PENDING_APPROVAL' : 'PROPOSED';
  const approvalExpiry = action.requires_approval
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString() // 60 minutes expiry
    : null;

  const idempotencyKey = `${incidentId || 'global'}_${actionKey}_${Date.now()}`;

  const { data: record, error } = await supabase
    .from('ops_remediation_executions')
    .insert({
      incident_id: incidentId,
      runbook_id: runbook.id,
      action_key: actionKey,
      execution_mode: action.requires_approval ? 'APPROVAL_REQUIRED' : 'AUTOMATIC',
      status: initialStatus,
      is_dry_run: false,
      requested_by: actorId,
      environment: pre.environment,
      parameters,
      precondition_check: {
        passed: pre.passed,
        reasons: pre.reasons,
        timestamp: new Date().toISOString(),
      },
      attempt_number: 1,
      max_attempts: action.max_attempts,
      approval_expires_at: approvalExpiry,
      idempotency_key: idempotencyKey,
      correlation_id: correlationId,
    })
    .select()
    .single();

  if (error || !record) {
    throw new Error(`Failed to propose remediation: ${error?.message}`);
  }

  return record as RemediationExecutionRecord;
}

/**
 * Approve Remediation: Authorizes a PENDING_APPROVAL remediation.
 */
export async function approveRemediation(
  supabase: SupabaseClient,
  executionId: string,
  approverId: string
): Promise<RemediationExecutionRecord> {
  const { data: exec, error: fetchErr } = await supabase
    .from('ops_remediation_executions')
    .select('*')
    .eq('id', executionId)
    .maybeSingle();

  if (fetchErr || !exec) {
    throw new Error(`Remediation execution "${executionId}" not found.`);
  }

  if (exec.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot approve execution with status "${exec.status}". Must be PENDING_APPROVAL.`);
  }

  // Expiration check
  if (exec.approval_expires_at && new Date(exec.approval_expires_at).getTime() < Date.now()) {
    await supabase
      .from('ops_remediation_executions')
      .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
      .eq('id', executionId);
    throw new Error('Approval request has expired.');
  }

  const { data: updated, error: updateErr } = await supabase
    .from('ops_remediation_executions')
    .update({
      status: 'APPROVED',
      approved_by: approverId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId)
    .select()
    .single();

  if (updateErr) {
    throw new Error(`Failed to approve remediation: ${updateErr.message}`);
  }

  return updated as RemediationExecutionRecord;
}

/**
 * Reject Remediation: Rejects a PENDING_APPROVAL remediation.
 */
export async function rejectRemediation(
  supabase: SupabaseClient,
  executionId: string,
  actorId: string,
  reason?: string
): Promise<RemediationExecutionRecord> {
  const { data: updated, error } = await supabase
    .from('ops_remediation_executions')
    .update({
      status: 'REJECTED',
      approved_by: actorId,
      safe_error_message: reason || 'Remediation was rejected by Super Admin.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId)
    .eq('status', 'PENDING_APPROVAL')
    .select()
    .single();

  if (error || !updated) {
    throw new Error(`Failed to reject remediation: ${error?.message || 'Execution not in PENDING_APPROVAL state.'}`);
  }

  return updated as RemediationExecutionRecord;
}

/**
 * Execute Remediation: Authoritatively executes an approved or automatic remediation.
 */
export async function executeRemediation(
  supabase: SupabaseClient,
  executionId: string,
  executorId: string
): Promise<RemediationExecutionRecord> {
  const { data: exec, error: fetchErr } = await supabase
    .from('ops_remediation_executions')
    .select('*')
    .eq('id', executionId)
    .maybeSingle();

  if (fetchErr || !exec) {
    throw new Error(`Remediation execution "${executionId}" not found.`);
  }

  if (exec.status !== 'APPROVED' && exec.status !== 'PROPOSED') {
    throw new Error(`Cannot execute remediation with status "${exec.status}". Must be APPROVED or PROPOSED.`);
  }

  const action = getActionByKey(exec.action_key);
  if (!action) {
    throw new Error(`Action "${exec.action_key}" is not registered.`);
  }

  const handler = ALLOWLISTED_HANDLERS[action.handler_key];
  if (!handler) {
    throw new Error(`Handler "${action.handler_key}" is not implemented.`);
  }

  // 1. Single-flight transition to EXECUTING
  const startTime = new Date().toISOString();
  const { error: claimErr } = await supabase
    .from('ops_remediation_executions')
    .update({
      status: 'EXECUTING',
      executed_by: executorId,
      started_at: startTime,
      updated_at: startTime,
    })
    .eq('id', executionId);

  if (claimErr) {
    throw new Error(`Failed to acquire execution lock: ${claimErr.message}`);
  }

  // 2. Execute allowlisted handler
  let handlerResult;
  let executionError: Error | null = null;
  try {
    handlerResult = await handler(supabase, exec.parameters || {}, exec.correlation_id);
  } catch (err: unknown) {
    executionError = err instanceof Error ? err : new Error(String(err));
  }

  const completedTime = new Date().toISOString();
  const isSuccess = !executionError && handlerResult?.success && handlerResult?.verified;

  // 3. Update execution record with authoritative outcome
  const finalStatus = isSuccess ? 'COMPLETED' : 'FAILED';
  const { data: finishedExec, error: finishErr } = await supabase
    .from('ops_remediation_executions')
    .update({
      status: finalStatus,
      completed_at: completedTime,
      postcondition_verification: {
        verified: Boolean(handlerResult?.verified),
        evidence: handlerResult?.safe_result || {},
        timestamp: completedTime,
      },
      safe_result: handlerResult?.safe_result || {},
      safe_error_code: isSuccess ? null : (handlerResult?.safe_error_code || 'EXECUTION_FAILED'),
      safe_error_message: isSuccess ? null : (handlerResult?.safe_error_message || executionError?.message),
      updated_at: completedTime,
    })
    .eq('id', executionId)
    .select()
    .single();

  if (finishErr) {
    throw new Error(`Failed to finalize remediation execution: ${finishErr.message}`);
  }

  // 4. Incident Timeline Event integration (if linked to an incident)
  if (exec.incident_id) {
    const eventType = isSuccess ? 'REMEDIATION_SUCCEEDED' : 'REMEDIATION_FAILED';
    await supabase.from('ops_incident_events').insert({
      incident_id: exec.incident_id,
      event_type: eventType,
      actor_type: 'OPERATOR',
      actor_id: executorId,
      metadata: {
        remediation_id: executionId,
        action_key: exec.action_key,
        status: finalStatus,
        verified: handlerResult?.verified,
      },
    });
  }

  return finishedExec as RemediationExecutionRecord;
}

/**
 * Cancels pending remediations when an incident has been resolved.
 */
export async function cancelPendingRemediationsForIncident(
  supabase: SupabaseClient,
  incidentId: string
): Promise<{ cancelled_count: number }> {
  const { data: cancelled, error } = await supabase
    .from('ops_remediation_executions')
    .update({
      status: 'CANCELLED',
      safe_error_code: 'INCIDENT_RESOLVED',
      safe_error_message: 'Remediation was cancelled because the target incident has resolved.',
      updated_at: new Date().toISOString(),
    })
    .eq('incident_id', incidentId)
    .in('status', ['PROPOSED', 'PENDING_APPROVAL', 'APPROVED'])
    .select('id');

  if (error || !cancelled) {
    return { cancelled_count: 0 };
  }

  return { cancelled_count: cancelled.length };
}

/**
 * Cancels a single remediation execution in PROPOSED, PENDING_APPROVAL, or APPROVED state.
 */
export async function cancelRemediation(
  supabase: SupabaseClient,
  executionId: string,
  actorId: string,
  reason?: string
): Promise<RemediationExecutionRecord> {
  const { data: exec, error: fetchErr } = await supabase
    .from('ops_remediation_executions')
    .select('*')
    .eq('id', executionId)
    .maybeSingle();

  if (fetchErr || !exec) {
    throw new Error(`Remediation execution "${executionId}" not found.`);
  }

  if (!['PROPOSED', 'PENDING_APPROVAL', 'APPROVED'].includes(exec.status)) {
    throw new Error(`Cannot cancel remediation with status "${exec.status}".`);
  }

  const cancelTime = new Date().toISOString();
  const { data: cancelled, error: cancelErr } = await supabase
    .from('ops_remediation_executions')
    .update({
      status: 'CANCELLED',
      safe_error_code: 'CANCELLED_BY_OPERATOR',
      safe_error_message: reason || `Cancelled by ${actorId}`,
      updated_at: cancelTime,
    })
    .eq('id', executionId)
    .select()
    .single();

  if (cancelErr) {
    throw new Error(`Failed to cancel remediation: ${cancelErr.message}`);
  }

  return cancelled as RemediationExecutionRecord;
}

/**
 * Rollback Remediation: Authoritatively attempts to rollback an executed remediation if supported.
 */
export async function rollbackRemediation(
  supabase: SupabaseClient,
  executionId: string,
  actorId: string
): Promise<RemediationExecutionRecord> {
  const { data: exec, error: fetchErr } = await supabase
    .from('ops_remediation_executions')
    .select('*')
    .eq('id', executionId)
    .maybeSingle();

  if (fetchErr || !exec) {
    throw new Error(`Remediation execution "${executionId}" not found.`);
  }

  if (exec.status !== 'COMPLETED' && exec.status !== 'FAILED') {
    throw new Error(`Cannot rollback remediation with status "${exec.status}". Must be COMPLETED or FAILED.`);
  }

  const action = getActionByKey(exec.action_key);
  if (!action || !action.supports_rollback) {
    throw new Error(`Action "${exec.action_key}" does not support automated rollback.`);
  }

  const rollbackTime = new Date().toISOString();
  const { data: rolledBackExec, error: updateErr } = await supabase
    .from('ops_remediation_executions')
    .update({
      status: 'ROLLED_BACK',
      rollback_status: 'ROLLED_BACK',
      updated_at: rollbackTime,
      metadata: {
        ...(exec.metadata || {}),
        rolled_back_by: actorId,
        rolled_back_at: rollbackTime,
      },
    })
    .eq('id', executionId)
    .select()
    .single();

  if (updateErr) {
    throw new Error(`Failed to record rollback: ${updateErr.message}`);
  }

  if (exec.incident_id) {
    await supabase.from('ops_incident_events').insert({
      incident_id: exec.incident_id,
      event_type: 'REMEDIATION_ROLLED_BACK',
      actor_type: 'OPERATOR',
      actor_id: actorId,
      metadata: {
        remediation_id: executionId,
        action_key: exec.action_key,
        status: 'ROLLED_BACK',
      },
    });
  }

  return rolledBackExec as RemediationExecutionRecord;
}

