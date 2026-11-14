// lpu-events-admin/src/components/superadmin/monitoring/utils/MonitoringApiClient.ts
// Typed Client for Super Admin Monitoring Proxy (MON-004 / MON-008 Stage 8)

import type {
  MonitoringOverviewPayload,
  NormalizedPostHogIssue,
  NormalizedMonitorStatus,
  SupabaseLogRecord,
  GscOverviewData,
  ProviderConnectivityStatus,
} from '../types.ts';

export class MonitoringApiError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', statusCode: number = 500) {
    super(message);
    this.name = 'MonitoringApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

let defaultSupabaseInstance: any = null;

async function resolveDefaultSupabase(): Promise<any> {
  if (defaultSupabaseInstance) return defaultSupabaseInstance;
  try {
    const mod = await import('../../../../supabase');
    defaultSupabaseInstance = mod.supabase;
  } catch {
    // Fallback in Node.js test environment where Vite alias @lpu-events/shared is not loaded
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url =
        (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '') ||
        'https://demo.supabase.co';
      const key =
        (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '') ||
        'dummy_anon_key';
      defaultSupabaseInstance = createClient(url, key);
    } catch {
      defaultSupabaseInstance = null;
    }
  }
  return defaultSupabaseInstance;
}

export class MonitoringApiClient {
  private static injectedSupabase: any = null;

  static setSupabaseClient(client: any) {
    this.injectedSupabase = client;
  }

  private static async getClient() {
    if (this.injectedSupabase) return this.injectedSupabase;
    return await resolveDefaultSupabase();
  }

  private static async invokeFunction<T>(
    action: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH';
      params?: Record<string, string | number | undefined>;
      body?: Record<string, unknown>;
    } = {}
  ): Promise<T> {
    const supabase = await this.getClient();
    if (!supabase) {
      throw new MonitoringApiError('Supabase client unavailable.', 'CLIENT_UNAVAILABLE', 500);
    }

    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data?.session?.access_token;

    if (!token) {
      throw new MonitoringApiError('Authentication required. No active session.', 'UNAUTHORIZED', 401);
    }

    const correlationId = `admin_mon_${crypto.randomUUID()}`;
    const queryParams = new URLSearchParams();
    queryParams.set('action', action);

    if (options.params) {
      for (const [key, val] of Object.entries(options.params)) {
        if (val !== undefined && val !== null) {
          queryParams.set(key, String(val));
        }
      }
    }

    const { data, error } = await supabase.functions.invoke(
      `superadmin-monitoring?${queryParams.toString()}`,
      {
        method: options.method || (options.body ? 'POST' : 'GET'),
        body: options.body,
        headers: {
          'x-correlation-id': correlationId,
        },
      }
    );

    if (error) {
      let message = error.message || 'Failed to communicate with monitoring service';
      const status = (error as any).status || 500;
      if ((error as any).context && typeof (error as any).context.json === 'function') {
        try {
          const body = await (error as any).context.json();
          if (body?.error?.message) {
            message = body.error.message;
          } else if (typeof body?.error === 'string') {
            message = body.error;
          } else if (body?.message) {
            message = body.message;
          }
        } catch {
          // ignore stream parse errors
        }
      }
      throw new MonitoringApiError(message, 'INVOKE_FAILED', status);
    }

    if (data?.error) {
      throw new MonitoringApiError(
        data.error.message || 'Operation rejected',
        data.error.code || 'PROXY_ERROR',
        400
      );
    }

    return (data?.data !== undefined ? data.data : data) as T;
  }

  static async getOverview(): Promise<MonitoringOverviewPayload> {
    return this.invokeFunction<MonitoringOverviewPayload>('monitoring_overview');
  }

  static async getIssues(params: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ issues: NormalizedPostHogIssue[]; total: number }> {
    return this.invokeFunction<{ issues: NormalizedPostHogIssue[]; total: number }>(
      'posthog_issues',
      { params }
    );
  }

  static async getIssueDetail(issueId: string): Promise<any> {
    return this.invokeFunction<any>('posthog_issue_detail', {
      params: { issue_id: issueId },
    });
  }

  static async updateIssue(
    issueId: string,
    status: 'resolved' | 'suppressed' | 'active'
  ): Promise<any> {
    return this.invokeFunction<any>('posthog_issue_update', {
      method: 'POST',
      body: { issue_id: issueId, status },
    });
  }

  static async deleteIssue(issueId: string): Promise<any> {
    return this.invokeFunction<any>('posthog_issue_delete', {
      method: 'POST',
      body: { issue_id: issueId },
    });
  }

  static async getMonitors(forceRefresh: boolean = false): Promise<NormalizedMonitorStatus[]> {
    return this.invokeFunction<NormalizedMonitorStatus[]>('uptimerobot_monitors', {
      params: forceRefresh ? { force_refresh: 'true' } : undefined,
    });
  }

  static async queryLogs(options: {
    source?: string;
    iso_timestamp_start?: string;
    iso_timestamp_end?: string;
    correlation_id?: string;
    sql?: string;
    limit?: number;
  }): Promise<SupabaseLogRecord[]> {
    return this.invokeFunction<SupabaseLogRecord[]>('supabase_logs', {
      method: 'POST',
      body: options,
    });
  }

  static async getGscOverview(days: number = 28): Promise<GscOverviewData> {
    return this.invokeFunction<GscOverviewData>('gsc_overview', {
      params: { days },
    });
  }

  static async getProviderHealth(): Promise<Record<string, ProviderConnectivityStatus>> {
    return this.invokeFunction<Record<string, ProviderConnectivityStatus>>('provider_health');
  }

  static async getInternalServices(): Promise<Array<{ name: string; target: string; role: string; status: string; latency_ms: number | null }>> {
    return this.invokeFunction('internal_services_health');
  }
}
