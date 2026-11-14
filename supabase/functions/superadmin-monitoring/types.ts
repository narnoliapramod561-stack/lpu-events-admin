// lpu-events-admin/supabase/functions/superadmin-monitoring/types.ts
// LPU Events — Monitoring Proxy Type Definitions (MON-001 - MON-008 / Stage 7)

export type MonitoringAction =
  | 'monitoring_overview'
  | 'posthog_issues'
  | 'posthog_issue_detail'
  | 'posthog_issue_update'
  | 'posthog_issue_delete'
  | 'uptimerobot_monitors'
  | 'supabase_logs'
  | 'gsc_overview'
  | 'provider_health'
  | 'internal_services_health';

export class MonitoringSecurityError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = 'MonitoringSecurityError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface MonitoringRequestContext {
  requestId: string;
  correlationId: string;
  startedAt: string;
  startTimeMs: number;
  adminUserId?: string;
  action?: MonitoringAction;
  origin?: string;
}

export interface AuthenticatedSuperAdmin {
  authUserId: string;
  adminUserId: string;
  email?: string;
  isSuperAdmin: true;
}

export interface ProviderConnectivityStatus {
  connected: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt: string;
}

export interface NormalizedMonitorStatus {
  id: string;
  name: string;
  url: string;
  status: 'up' | 'down' | 'seems_down' | 'paused' | 'unknown';
  uptimeRatio30d: number | null; // null represents Unavailable (NEVER assumed 100)
  averageResponseTimeMs: number | null; // null represents Unavailable (NEVER assumed 0)
  dataRetrievedAt: string;
  lastResponseTimeSampleAt: string | null;
  lastCheckAt: string | null;
}

export interface NormalizedPostHogIssue {
  id: string;
  name: string;
  status: 'active' | 'resolved' | 'suppressed';
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  app: 'student' | 'admin' | 'backend' | 'multi' | 'app';
  environment: string;
  component: string;
  occurrences: number;
  users: number | string; // 'N/A' for backend service events
  firstSeen: string;
  lastSeen: string;
  release: string;
  deepLink: string;
}

export interface MonitoringOverviewPayload {
  platformStatus: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE' | 'STALE' | 'UNKNOWN';
  dataFreshness: string;
  activeIssuesCount: number;
  criticalIssuesCount: number;
  exceptions24hCount: number;
  monitors: NormalizedMonitorStatus[];
  providerConnectivity: {
    posthogIngestion: ProviderConnectivityStatus;
    posthogApi: ProviderConnectivityStatus;
    uptimeRobot: ProviderConnectivityStatus;
    supabaseLogs: ProviderConnectivityStatus;
    googleSearchConsole: ProviderConnectivityStatus;
  };
  recentIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    created_at: string;
  }>;
}

export interface SupabaseLogRecord {
  id: string;
  timestamp: string;
  event_message?: string;
  source: 'function_logs' | 'function_edge_logs' | 'edge_logs' | 'postgres_logs' | 'auth_logs';
  status_code?: number;
  log_attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface GscDimensionRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscOverviewData {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  delayNotice: string;
  deepLink: string;
  topQueries?: GscDimensionRow[];
  topPages?: GscDimensionRow[];
  status?: 'connected' | 'unconfigured' | 'error';
  errorMessage?: string;
  propertyUrl?: string;
}
