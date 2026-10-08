// supabase/functions/superadmin-operations/resilience/types.ts
// LPU Events — Phase 10: Operational Resilience & Disaster Recovery Types

export type ResilienceCategory =
  | 'TELEMETRY_FAILURE'
  | 'PROVIDER_FAILURE'
  | 'JOB_FAILURE'
  | 'ALERTING_FAILURE'
  | 'NOTIFICATION_FAILURE'
  | 'REMEDIATION_FAILURE'
  | 'DATABASE_DEGRADATION'
  | 'NETWORK_FAILURE'
  | 'RECOVERY_FAILURE'
  | 'COMBINED_FAILURE'
  | 'DISASTER_RECOVERY';

export type ResilienceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ResilienceEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' | 'UNKNOWN';

export type ResilienceTestStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED';

export interface ResilienceScenarioRecord {
  id?: string;
  scenario_key: string;
  name: string;
  description: string;
  category: ResilienceCategory;
  risk_level: ResilienceRiskLevel;
  allowed_environments: ResilienceEnvironment[];
  is_destructive: boolean;
  enabled: boolean;
  expected_detection: string;
  expected_recovery: string;
  timeout_ms: number;
  created_at?: string;
  updated_at?: string;
}

export interface ResilienceTestRunRecord {
  id: string;
  scenario_key: string;
  environment: ResilienceEnvironment;
  status: ResilienceTestStatus;
  correlation_id: string;
  requested_by: string;
  executed_by?: string | null;
  is_simulation: boolean;
  detection_verified: boolean;
  recovery_verified: boolean;
  duration_ms?: number | null;
  evidence: Record<string, unknown>;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface ResilienceRunResult {
  success: boolean;
  run_id: string;
  scenario_key: string;
  status: ResilienceTestStatus;
  detection_verified: boolean;
  recovery_verified: boolean;
  duration_ms: number;
  environment: ResilienceEnvironment;
  evidence: Record<string, unknown>;
  error_code?: string;
  error_message?: string;
}
