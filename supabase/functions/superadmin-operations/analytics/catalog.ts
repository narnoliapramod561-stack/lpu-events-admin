// catalog.ts — Controlled Metric Catalog for Phase 6 Historical Analytics
// Prevents arbitrary metric cardinality by maintaining a server-controlled registry of known metrics.

export type MetricType = 'GAUGE' | 'CUMULATIVE_COUNTER' | 'RATE';

export interface MetricDefinition {
  metricKey: string;
  serviceId: string;
  unit: 'bytes' | 'percent' | 'count' | 'milliseconds' | 'ratio';
  metricType: MetricType;
  title: string;
  description: string;
  supportsProjection: boolean;
  defaultThreshold?: number;
  category: 'STORAGE' | 'NETWORK' | 'COMPUTE' | 'EMAIL' | 'ERROR' | 'JOB' | 'INCIDENT';
}

export const CONTROLLED_METRIC_CATALOG: Record<string, MetricDefinition> = {
  // Supabase Database Metrics
  'database.storage_percent': {
    metricKey: 'database.storage_percent',
    serviceId: 'supabase_database',
    unit: 'percent',
    metricType: 'GAUGE',
    title: 'Database Storage Utilization',
    description: 'Percentage of allocated database disk space used.',
    supportsProjection: true,
    defaultThreshold: 85.0,
    category: 'STORAGE',
  },
  'database.size_bytes': {
    metricKey: 'database.size_bytes',
    serviceId: 'supabase_database',
    unit: 'bytes',
    metricType: 'GAUGE',
    title: 'Database Physical Size',
    description: 'Total disk space consumed by Postgres database in bytes.',
    supportsProjection: true,
    category: 'STORAGE',
  },
  'database.active_connections': {
    metricKey: 'database.active_connections',
    serviceId: 'supabase_database',
    unit: 'count',
    metricType: 'GAUGE',
    title: 'Active Postgres Connections',
    description: 'Concurrent active connections connected to database.',
    supportsProjection: false,
    category: 'COMPUTE',
  },
  'database.connection_utilization_ratio': {
    metricKey: 'database.connection_utilization_ratio',
    serviceId: 'supabase_database',
    unit: 'ratio',
    metricType: 'GAUGE',
    title: 'Connection Pool Utilization',
    description: 'Ratio of active connections to max permitted connections.',
    supportsProjection: true,
    defaultThreshold: 0.85,
    category: 'COMPUTE',
  },

  // Cloudflare R2 Metrics
  'r2.storage_bytes': {
    metricKey: 'r2.storage_bytes',
    serviceId: 'cloudflare_r2',
    unit: 'bytes',
    metricType: 'GAUGE',
    title: 'R2 Bucket Physical Storage',
    description: 'Physical storage bytes consumed in Cloudflare R2 bucket.',
    supportsProjection: true,
    category: 'STORAGE',
  },
  'r2.objects_count': {
    metricKey: 'r2.objects_count',
    serviceId: 'cloudflare_r2',
    unit: 'count',
    metricType: 'GAUGE',
    title: 'R2 Object Count',
    description: 'Number of active objects stored in R2 bucket.',
    supportsProjection: true,
    category: 'STORAGE',
  },

  // Cloudflare Worker Metrics
  'worker.requests_total': {
    metricKey: 'worker.requests_total',
    serviceId: 'cloudflare_worker',
    unit: 'count',
    metricType: 'CUMULATIVE_COUNTER',
    title: 'Worker Request Volume',
    description: 'Total HTTP requests routed through Cloudflare Edge Worker.',
    supportsProjection: false,
    category: 'NETWORK',
  },
  'worker.errors_total': {
    metricKey: 'worker.errors_total',
    serviceId: 'cloudflare_worker',
    unit: 'count',
    metricType: 'CUMULATIVE_COUNTER',
    title: 'Worker Error Count',
    description: 'Total 5xx and uncaught exceptions thrown by Edge Worker.',
    supportsProjection: false,
    category: 'ERROR',
  },
  'worker.error_rate': {
    metricKey: 'worker.error_rate',
    serviceId: 'cloudflare_worker',
    unit: 'percent',
    metricType: 'RATE',
    title: 'Worker Error Rate',
    description: 'Percentage of worker requests resulting in errors.',
    supportsProjection: true,
    defaultThreshold: 2.0,
    category: 'ERROR',
  },
  'worker.duration_avg_ms': {
    metricKey: 'worker.duration_avg_ms',
    serviceId: 'cloudflare_worker',
    unit: 'milliseconds',
    metricType: 'GAUGE',
    title: 'Worker Average Execution Duration',
    description: 'Average wall-clock execution duration of worker requests.',
    supportsProjection: true,
    defaultThreshold: 500.0,
    category: 'COMPUTE',
  },

  // Resend Email Quota Metrics
  'email.daily_quota_used': {
    metricKey: 'email.daily_quota_used',
    serviceId: 'resend_email',
    unit: 'count',
    metricType: 'CUMULATIVE_COUNTER',
    title: 'Resend Daily Emails Sent',
    description: 'Number of transactional emails sent within current 24h window.',
    supportsProjection: true,
    category: 'EMAIL',
  },
  'email.daily_quota_utilization_ratio': {
    metricKey: 'email.daily_quota_utilization_ratio',
    serviceId: 'resend_email',
    unit: 'ratio',
    metricType: 'GAUGE',
    title: 'Resend Daily Quota Utilization',
    description: 'Ratio of daily emails sent to daily quota limit.',
    supportsProjection: true,
    defaultThreshold: 0.9,
    category: 'EMAIL',
  },

  // Sentry Error Metrics
  'errors.events_24h_total': {
    metricKey: 'errors.events_24h_total',
    serviceId: 'sentry_error_tracking',
    unit: 'count',
    metricType: 'CUMULATIVE_COUNTER',
    title: 'Sentry 24h Error Volume',
    description: 'Total exceptions and errors captured by Sentry in past 24 hours.',
    supportsProjection: true,
    category: 'ERROR',
  },

  // Job Operational Metrics
  'job.duration_ms': {
    metricKey: 'job.duration_ms',
    serviceId: 'internal_maintenance',
    unit: 'milliseconds',
    metricType: 'GAUGE',
    title: 'Maintenance Job Duration',
    description: 'Wall-clock execution duration for scheduled maintenance jobs.',
    supportsProjection: true,
    category: 'JOB',
  },
  'job.success_rate': {
    metricKey: 'job.success_rate',
    serviceId: 'internal_maintenance',
    unit: 'percent',
    metricType: 'RATE',
    title: 'Maintenance Job Success Rate',
    description: 'Percentage of completed job runs vs failed runs.',
    supportsProjection: false,
    category: 'JOB',
  },

  // Incident & Alert Operational Metrics
  'alerts.open_count': {
    metricKey: 'alerts.open_count',
    serviceId: 'observability_engine',
    unit: 'count',
    metricType: 'GAUGE',
    title: 'Active Open Alerts',
    description: 'Number of open alerts currently tracking operational conditions.',
    supportsProjection: false,
    category: 'INCIDENT',
  },
  'incidents.open_count': {
    metricKey: 'incidents.open_count',
    serviceId: 'observability_engine',
    unit: 'count',
    metricType: 'GAUGE',
    title: 'Active Open Incidents',
    description: 'Number of active incidents requiring operator or automated resolution.',
    supportsProjection: false,
    category: 'INCIDENT',
  },
  'incidents.duration': {
    metricKey: 'incidents.duration',
    serviceId: 'observability_engine',
    unit: 'milliseconds',
    metricType: 'GAUGE',
    title: 'Incident Resolution Duration',
    description: 'Elapsed duration from incident creation to terminal resolution.',
    supportsProjection: true,
    category: 'INCIDENT',
  },
};

export function getMetricDefinition(metricKey: string): MetricDefinition | null {
  return CONTROLLED_METRIC_CATALOG[metricKey] || null;
}

export function isValidMetricKey(metricKey: string): boolean {
  return metricKey in CONTROLLED_METRIC_CATALOG;
}
