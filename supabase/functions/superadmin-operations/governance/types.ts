// supabase/functions/superadmin-operations/governance/types.ts
// LPU Events — Phase 11: SLO, Capacity & Production Readiness Governance Types

export type SliCalculationType =
  | 'AVAILABILITY'
  | 'ERROR_RATE'
  | 'SUCCESS_RATE'
  | 'LATENCY'
  | 'FRESHNESS'
  | 'DURATION'
  | 'RECOVERY_TIME';

export type SliUnit = 'PERCENT' | 'MILLISECONDS' | 'SECONDS' | 'COUNT' | 'RATIO';

export type SliAggregation = 'RATIO' | 'P95' | 'P99' | 'AVERAGE' | 'DELTA' | 'LATEST';

export interface SliDefinition {
  sli_key: string;
  name: string;
  service_id: string;
  metric_source: string;
  calculation_type: SliCalculationType;
  unit: SliUnit;
  aggregation: SliAggregation;
  description: string;
  is_enabled: boolean;
}

export type SloWindow = '24h' | '7d' | '30d' | '90d';
export type SloDirection = 'GREATER_EQUAL' | 'LESS_EQUAL';

export interface SloDefinition {
  id?: string;
  slo_key: string;
  name: string;
  service_id: string;
  sli_key: string;
  target: number;
  window: SloWindow;
  direction: SloDirection;
  warning_threshold?: number | null;
  enabled: boolean;
  description: string;
  version: number;
  effective_from: string;
  effective_to?: string | null;
}

export type SloStatus =
  | 'MEETING'
  | 'AT_RISK'
  | 'BREACHED'
  | 'INSUFFICIENT_DATA'
  | 'NOT_CONFIGURED';

export type ErrorBudgetStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'EXHAUSTED';

export type DataQuality =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INSUFFICIENT'
  | 'NOT_CONFIGURED'
  | 'NOT_AVAILABLE';

export interface ErrorBudget {
  total_budget: number;
  consumed_budget: number;
  remaining_budget: number;
  consumption_percent: number;
  status: ErrorBudgetStatus;
  burn_rate: number | null;
}

export interface SloEvaluationRecord {
  id?: string;
  slo_key: string;
  version: number;
  evaluated_at: string;
  window: SloWindow;
  window_start: string;
  window_end: string;
  sample_count: number;
  actual_value: number | null;
  target: number;
  status: SloStatus;
  error_budget: ErrorBudget | null;
  data_quality: DataQuality;
  details: Record<string, unknown>;
}

export type CapacityCategory = 'DATABASE' | 'STORAGE' | 'WORKER' | 'QUEUE' | 'EMAIL';
export type CapacityUnit = 'BYTES' | 'COUNT' | 'PERCENT' | 'MILLISECONDS';
export type CapacityState =
  | 'HEALTHY'
  | 'WATCH'
  | 'CRITICAL'
  | 'EXHAUSTED'
  | 'NOT_CONFIGURED'
  | 'NOT_AVAILABLE';

export interface CapacityDefinition {
  resource_key: string;
  name: string;
  category: CapacityCategory;
  unit: CapacityUnit;
  hard_limit: number | null;
  soft_threshold_percent: number;
  critical_threshold_percent: number;
  source: string;
  is_enabled: boolean;
}

export interface CapacityResourceEvaluation {
  resource_key: string;
  name: string;
  category: CapacityCategory;
  unit: CapacityUnit;
  current_usage: number | null;
  hard_limit: number | null;
  headroom: number | null;
  utilization_percent: number | null;
  state: CapacityState;
  soft_threshold_percent: number;
  critical_threshold_percent: number;
  forecast_status?: 'APPROACHING' | 'NOT_APPROACHING' | 'ALREADY_EXCEEDED' | 'INSUFFICIENT_DATA';
  estimated_exhaustion_days?: number | null;
  data_quality: DataQuality;
  updated_at: string;
}

export type ReadinessStatus = 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY' | 'UNKNOWN';
export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';

export interface ReadinessCheckResult {
  check_key: string;
  name: string;
  status: CheckStatus;
  blocking: boolean;
  observed_value: string;
  expected_condition: string;
  source: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ReadinessEvaluationRecord {
  id?: string;
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' | 'UNKNOWN';
  overall_status: ReadinessStatus;
  evaluated_at: string;
  evaluated_by: string;
  correlation_id: string;
  checks: ReadinessCheckResult[];
  blocking_count: number;
  warning_count: number;
  passed_count: number;
  evidence: Record<string, unknown>;
}

export interface GovernanceOverview {
  slo_summary: {
    total_slos: number;
    meeting: number;
    at_risk: number;
    breached: number;
    insufficient_data: number;
    compliance_rate: number;
    error_budgets_exhausted: number;
  };
  capacity_summary: {
    total_resources: number;
    healthy: number;
    watch: number;
    critical: number;
    exhausted: number;
  };
  readiness_summary: {
    environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' | 'UNKNOWN';
    overall_status: ReadinessStatus;
    blocking_count: number;
    warning_count: number;
    last_evaluated: string | null;
  };
}
