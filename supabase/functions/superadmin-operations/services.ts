// supabase/functions/superadmin-operations/services.ts
// Canonical Service Registry & Operational Status Model (Phase 3 Telemetry Enabled)

import { ProviderKey } from "./providers/types.ts";

export type OperationalStatus =
  | 'HEALTHY'
  | 'WARNING'
  | 'CRITICAL'
  | 'DEGRADED'
  | 'UNKNOWN'
  | 'NOT_MONITORED'
  | 'NOT_CONFIGURED'
  | 'UNAVAILABLE';

export type ServiceCriticality = 'P0' | 'P1' | 'P2' | 'P3';

export interface ServiceCapabilities {
  healthProbe: boolean;
  usageMetrics: boolean;
  errorStats: boolean;
  quotaTracking: boolean;
}

export interface ServiceDefinition {
  key: string;
  displayName: string;
  provider: ProviderKey;
  category: 'database' | 'auth' | 'edge' | 'storage' | 'email' | 'monitoring' | 'ci_cd';
  criticality: ServiceCriticality;
  enabled: boolean;
  monitoringStatus: OperationalStatus;
  statusDetail: string;
  capabilities: ServiceCapabilities;
}

export function getServiceRegistry(latestProbes?: Array<{ service_id: string; status: string; error_message?: string }>): ServiceDefinition[] {
  const probeMap = new Map<string, { status: string; message?: string }>();
  if (latestProbes && Array.isArray(latestProbes)) {
    for (const p of latestProbes) {
      if (!probeMap.has(p.service_id)) {
        probeMap.set(p.service_id, { status: p.status, message: p.error_message });
      }
    }
  }

  const baseServices: ServiceDefinition[] = [
    {
      key: 'supabase_database',
      displayName: 'PostgreSQL Database Engine',
      provider: 'supabase',
      category: 'database',
      criticality: 'P0',
      enabled: true,
      monitoringStatus: 'HEALTHY',
      statusDetail: 'Operational via database diagnostic RPC probe',
      capabilities: {
        healthProbe: true,
        usageMetrics: true,
        errorStats: false,
        quotaTracking: false,
      },
    },
    {
      key: 'supabase_auth',
      displayName: 'Supabase Authentication Service',
      provider: 'supabase',
      category: 'auth',
      criticality: 'P0',
      enabled: true,
      monitoringStatus: 'NOT_MONITORED',
      statusDetail: 'Supabase Auth admin probe available in Phase 3',
      capabilities: {
        healthProbe: true,
        usageMetrics: true,
        errorStats: false,
        quotaTracking: false,
      },
    },
    {
      key: 'cloudflare_worker',
      displayName: 'Cloudflare Edge Worker API Gateway',
      provider: 'cloudflare',
      category: 'edge',
      criticality: 'P0',
      enabled: true,
      monitoringStatus: 'NOT_MONITORED',
      statusDetail: 'Worker reachability probe and GraphQL telemetry available in Phase 3',
      capabilities: {
        healthProbe: true,
        usageMetrics: true,
        errorStats: true,
        quotaTracking: false,
      },
    },
    {
      key: 'cloudflare_r2',
      displayName: 'Cloudflare R2 Content Storage',
      provider: 'r2',
      category: 'storage',
      criticality: 'P1',
      enabled: true,
      monitoringStatus: 'NOT_MONITORED',
      statusDetail: 'R2 gateway probe and media metadata reconciliation available in Phase 3',
      capabilities: {
        healthProbe: true,
        usageMetrics: true,
        errorStats: false,
        quotaTracking: false,
      },
    },
    {
      key: 'resend',
      displayName: 'Resend Transactional Mail Pipeline',
      provider: 'resend',
      category: 'email',
      criticality: 'P2',
      enabled: true,
      monitoringStatus: 'NOT_MONITORED',
      statusDetail: 'Resend non-destructive API probe and usage quota available in Phase 3',
      capabilities: {
        healthProbe: true,
        usageMetrics: true,
        errorStats: false,
        quotaTracking: true,
      },
    },
    {
      key: 'sentry',
      displayName: 'Sentry Crash & Error Telemetry',
      provider: 'sentry',
      category: 'monitoring',
      criticality: 'P2',
      enabled: true,
      monitoringStatus: 'NOT_MONITORED',
      statusDetail: 'Sentry organization stats_v2 error metrics available in Phase 3',
      capabilities: {
        healthProbe: true,
        usageMetrics: true,
        errorStats: true,
        quotaTracking: false,
      },
    },
    {
      key: 'github_actions',
      displayName: 'GitHub Actions CI/CD Pipeline',
      provider: 'github',
      category: 'ci_cd',
      criticality: 'P3',
      enabled: true,
      monitoringStatus: 'NOT_MONITORED',
      statusDetail: 'Workflow build duration and deployment status not instrumented in Phase 3',
      capabilities: {
        healthProbe: false,
        usageMetrics: false,
        errorStats: false,
        quotaTracking: false,
      },
    },
  ];

  if (probeMap.size > 0) {
    return baseServices.map((s) => {
      const probe = probeMap.get(s.key);
      if (probe) {
        let mappedStatus: OperationalStatus = 'UNKNOWN';
        if (probe.status === 'HEALTHY') mappedStatus = 'HEALTHY';
        else if (probe.status === 'DEGRADED') mappedStatus = 'DEGRADED';
        else if (probe.status === 'NOT_CONFIGURED') mappedStatus = 'NOT_CONFIGURED';
        else if (probe.status === 'UNAVAILABLE') mappedStatus = 'UNAVAILABLE';
        else if (probe.status === 'AUTHENTICATION_FAILED') mappedStatus = 'UNAVAILABLE';
        else if (probe.status === 'RATE_LIMITED') mappedStatus = 'WARNING';

        return {
          ...s,
          monitoringStatus: mappedStatus,
          statusDetail: probe.message || s.statusDetail,
        };
      }
      return s;
    });
  }

  return baseServices;
}
