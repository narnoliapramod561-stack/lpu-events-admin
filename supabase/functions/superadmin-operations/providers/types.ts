// supabase/functions/superadmin-operations/providers/types.ts
// Provider Contract, Telemetry Interfaces & Credential Isolation Boundary (Phase 3)

export type ProviderKey =
  | 'supabase'
  | 'cloudflare'
  | 'r2'
  | 'resend'
  | 'sentry'
  | 'github';

export type MetricSource =
  | 'supabase_sql'
  | 'supabase_management_api'
  | 'cloudflare_graphql'
  | 'cloudflare_http_probe'
  | 'r2_s3'
  | 'resend_usage_api'
  | 'sentry_stats_api'
  | 'internal_probe';

export type MetricUnit =
  | 'bytes'
  | 'milliseconds'
  | 'count'
  | 'ratio'
  | 'percent';

export type MetricStatus =
  | 'HEALTHY'
  | 'WARNING'
  | 'CRITICAL'
  | 'DEGRADED'
  | 'STALE'
  | 'NOT_CONFIGURED'
  | 'UNAVAILABLE'
  | 'INVALID';

export type ProbeStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMITED';

export interface NormalizedMetricSnapshot {
  serviceId: string;
  metricKey: string;
  metricValue: number | null;
  metricLimit?: number | null;
  unit: MetricUnit;
  status: MetricStatus;
  source: MetricSource;
  capturedAt: string;
  observedFrom?: string;
  observedTo?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthProbeResult {
  serviceId: string;
  probeKey: string;
  success: boolean;
  status: ProbeStatus;
  latencyMs: number;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
  checkedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderCollectionResult {
  provider: ProviderKey;
  metrics: NormalizedMetricSnapshot[];
  probes: HealthProbeResult[];
  errors: string[];
  isConfigured: boolean;
}

export interface ProviderDescriptor {
  provider: ProviderKey;
  displayName: string;
  category: 'database' | 'compute' | 'storage' | 'email' | 'monitoring' | 'ci_cd';
  isConfigured: boolean;
  requiredCredentialsSummary: string[]; // names of required env variables only (never their values!)
}

/**
 * Evaluates whether required server-side credentials exist for each provider.
 * Returns only boolean status and environment variable names. Never leaks secrets!
 */
export function getProviderRegistry(): ProviderDescriptor[] {
  return [
    {
      provider: 'supabase',
      displayName: 'Supabase Platform',
      category: 'database',
      isConfigured: Boolean(Deno.env.get('SUPABASE_URL') && Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
      requiredCredentialsSummary: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_MANAGEMENT_TOKEN'],
    },
    {
      provider: 'cloudflare',
      displayName: 'Cloudflare Edge Network',
      category: 'compute',
      isConfigured: Boolean(Deno.env.get('CLOUDFLARE_API_TOKEN') && Deno.env.get('CLOUDFLARE_ACCOUNT_ID')),
      requiredCredentialsSummary: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
    },
    {
      provider: 'r2',
      displayName: 'Cloudflare R2 Object Storage',
      category: 'storage',
      isConfigured: Boolean(
        (Deno.env.get('CLOUDFLARE_API_TOKEN') && Deno.env.get('CLOUDFLARE_ACCOUNT_ID')) ||
        (Deno.env.get('R2_ACCOUNT_ID') && Deno.env.get('R2_ACCESS_KEY_ID') && Deno.env.get('R2_SECRET_ACCESS_KEY'))
      ),
      requiredCredentialsSummary: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'R2_BUCKET_NAME'],
    },
    {
      provider: 'resend',
      displayName: 'Resend Transactional Email',
      category: 'email',
      isConfigured: Boolean(Deno.env.get('RESEND_API_KEY')),
      requiredCredentialsSummary: ['RESEND_API_KEY'],
    },
    {
      provider: 'sentry',
      displayName: 'Sentry Error Observability',
      category: 'monitoring',
      isConfigured: Boolean(Deno.env.get('SENTRY_AUTH_TOKEN') && Deno.env.get('SENTRY_ORG')),
      requiredCredentialsSummary: ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG'],
    },
    {
      provider: 'github',
      displayName: 'GitHub Actions Automation',
      category: 'ci_cd',
      isConfigured: Boolean(Deno.env.get('GITHUB_TOKEN') && Deno.env.get('GITHUB_REPO')),
      requiredCredentialsSummary: ['GITHUB_TOKEN', 'GITHUB_REPO'],
    },
  ];
}
