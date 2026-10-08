// supabase/functions/superadmin-operations/remediation/types.ts
// LPU Events — Phase 9: Safe Operational Remediation & Runbook Types

export type RunbookCategory =
  | 'DATABASE'
  | 'TELEMETRY'
  | 'MAINTENANCE'
  | 'NOTIFICATIONS'
  | 'ANALYTICS'
  | 'GENERAL';

export type RemediationRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RunbookExecutionMode = 'OBSERVE_ONLY' | 'AUTOMATIC' | 'APPROVAL_REQUIRED';

export type RemediationExecutionStatus =
  | 'PROPOSED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'ROLLBACK_FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type RemediationEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' | 'UNKNOWN';

export interface RunbookDefinition {
  id?: string;
  runbook_key: string;
  name: string;
  description: string;
  category: RunbookCategory;
  risk_level: RemediationRiskLevel;
  execution_mode: RunbookExecutionMode;
  enabled: boolean;
  version: string;
  preconditions_description: string;
  postconditions_description: string;
  instructions_markdown: string;
  supports_rollback: boolean;
  requires_approval: boolean;
  target_service_id?: string | null;
  actions?: RemediationActionDefinition[];
  created_at?: string;
  updated_at?: string;
}

export interface RemediationActionDefinition {
  id?: string;
  action_key: string;
  runbook_id?: string;
  runbook_key?: string;
  name: string;
  description: string;
  handler_key: string;
  risk_level: RemediationRiskLevel;
  supports_auto_execution: boolean;
  supports_rollback: boolean;
  rollback_action_key?: string | null;
  requires_approval: boolean;
  timeout_ms: number;
  cooldown_minutes: number;
  max_attempts: number;
  allowed_environments: RemediationEnvironment[];
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RemediationExecutionRecord {
  id: string;
  incident_id?: string | null;
  runbook_id?: string | null;
  action_key: string;
  execution_mode: RunbookExecutionMode | 'DRY_RUN';
  status: RemediationExecutionStatus;
  is_dry_run: boolean;
  requested_by: string;
  approved_by?: string | null;
  executed_by?: string | null;
  environment: RemediationEnvironment;
  parameters: Record<string, unknown>;
  precondition_check: {
    passed: boolean;
    reasons: string[];
    timestamp: string;
  };
  postcondition_verification: {
    verified: boolean;
    evidence: Record<string, unknown>;
    timestamp: string;
  };
  safe_result: Record<string, unknown>;
  safe_error_code?: string | null;
  safe_error_message?: string | null;
  attempt_number: number;
  max_attempts: number;
  approval_expires_at?: string | null;
  idempotency_key: string;
  correlation_id: string;
  job_run_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DryRunEvaluationResult {
  is_dry_run: true;
  action_key: string;
  runbook_key: string;
  eligible: boolean;
  risk_level: RemediationRiskLevel;
  requires_approval: boolean;
  supports_rollback: boolean;
  environment: RemediationEnvironment;
  environment_allowed: boolean;
  preconditions_met: boolean;
  precondition_details: string[];
  predicted_impact: string;
  predicted_actions: string[];
  what_will_happen: string[];
  what_will_not_happen: string[];
  rollback_preview?: string | null;
  warnings: string[];
}

export interface HandlerExecutionResult {
  success: boolean;
  verified: boolean;
  safe_result: Record<string, unknown>;
  safe_error_code?: string;
  safe_error_message?: string;
  records_processed?: number;
  records_deleted?: number;
}
