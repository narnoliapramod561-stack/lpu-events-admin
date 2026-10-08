// src/components/superadmin/operations/types.ts
// LPU Events — Phase 7: Super Admin Operations Control Center UI Types

import {
  OperationsOverview,
  OperationsServiceDefinition,
  OperationsHealthProbe,
  OperationsMetricSnapshot,
  OperationsJob,
  OperationsJobRun,
  OperationsAlert,
  OperationsIncident,
  OperationsAnalyticsWindow,
  OperationsMetricHistoryResult,
  OperationsThresholdProjectionResult,
  OperationsIncidentAnalytics,
  OperationsAlertAnalytics,
  OperationsJobAnalytics,
  OperationsCrossServiceAnalytics,
} from '../../../shared/operations/types';

export interface OperationsControlCenterState {
  // Staged data
  overview: OperationsOverview | null;
  services: OperationsServiceDefinition[];
  probes: OperationsHealthProbe[];
  metrics: OperationsMetricSnapshot[];
  jobs: OperationsJob[];
  jobRuns: OperationsJobRun[];
  activeIncidents: OperationsIncident[];
  allIncidents: OperationsIncident[];
  alerts: OperationsAlert[];
  
  // Historical Analytics
  selectedWindow: OperationsAnalyticsWindow;
  crossServiceAnalytics: OperationsCrossServiceAnalytics | null;
  incidentAnalytics: OperationsIncidentAnalytics | null;
  alertAnalytics: OperationsAlertAnalytics | null;
  jobAnalytics: OperationsJobAnalytics | null;
  
  // Metric Projections Map: keyed by "service_id:metric_key"
  projections: Record<string, OperationsThresholdProjectionResult>;
  metricHistories: Record<string, OperationsMetricHistoryResult>;

  // Metadata
  environment: string;
  lastFetchedAt: Date | null;
  isStale: boolean;
  
  // Loading states
  loadingOverview: boolean;
  loadingIncidents: boolean;
  loadingServices: boolean;
  loadingMetrics: boolean;
  loadingJobs: boolean;
  loadingAnalytics: boolean;
  isSyncing: boolean;

  // Errors
  errors: {
    overview?: string;
    incidents?: string;
    services?: string;
    metrics?: string;
    jobs?: string;
    analytics?: string;
  };
}

export type IncidentFilterSeverity = 'ALL' | 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
export type IncidentFilterStatus = 'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type JobFilterStatus = 'ALL' | 'HEALTHY' | 'RUNNING' | 'FAILED' | 'STALE' | 'PARTIAL';

export type HistoricalTab = 'incidents' | 'alerts' | 'jobs' | 'services';
