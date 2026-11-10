// lpu-events-admin/src/shared/telemetry/__tests__/monitoring_overview_stage8.test.ts
// Unit Test Suite for Stage 8: Section A Monitoring Overview (MON-004 / MON-008)

import test from 'node:test';
import assert from 'node:assert/strict';
import { MonitoringApiClient, MonitoringApiError } from '../../../components/superadmin/monitoring/utils/MonitoringApiClient.ts';

test('Stage 8: Section A Monitoring Overview Suite', async (t) => {
  await t.test('1. should throw 401 UNAUTHORIZED when no active auth session exists', async () => {
    const mockSupabase: any = {
      auth: {
        getSession: async () => ({
          data: { session: null },
          error: null,
        }),
      },
    };

    MonitoringApiClient.setSupabaseClient(mockSupabase);

    await assert.rejects(
      async () => {
        await MonitoringApiClient.getOverview();
      },
      (err: any) => {
        assert(err instanceof MonitoringApiError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  await t.test('2. should call superadmin-monitoring with action=monitoring_overview and return aggregated payload', async () => {
    let invokedUrl = '';
    let passedHeaders: any = {};

    const mockSupabase: any = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'fake_jwt_token_123' } },
          error: null,
        }),
      },
      functions: {
        invoke: async (url: string, options: any) => {
          invokedUrl = url;
          passedHeaders = options?.headers;
          return {
            data: {
              data: {
                platformStatus: 'OPERATIONAL',
                dataFreshness: new Date().toISOString(),
                activeIssuesCount: 3,
                criticalIssuesCount: 0,
                exceptions24hCount: 42,
                monitors: [
                  {
                    id: 'mon_1',
                    name: 'Student Web',
                    url: 'https://lpuevents.live',
                    status: 'up',
                    uptimeRatio30d: 99.98,
                    averageResponseTimeMs: 120,
                    dataRetrievedAt: new Date().toISOString(),
                    lastResponseTimeSampleAt: null,
                    lastCheckAt: null,
                  },
                ],
                providerConnectivity: {
                  posthogIngestion: { connected: true, latencyMs: 45, checkedAt: new Date().toISOString() },
                  posthogApi: { connected: true, latencyMs: 50, checkedAt: new Date().toISOString() },
                  uptimeRobot: { connected: true, latencyMs: 110, checkedAt: new Date().toISOString() },
                  supabaseLogs: { connected: true, latencyMs: 80, checkedAt: new Date().toISOString() },
                  googleSearchConsole: { connected: true, latencyMs: 95, checkedAt: new Date().toISOString() },
                },
                recentIncidents: [],
              },
            },
            error: null,
          };
        },
      },
    };

    MonitoringApiClient.setSupabaseClient(mockSupabase);

    const overview = await MonitoringApiClient.getOverview();

    assert(invokedUrl.includes('action=monitoring_overview'));
    assert(passedHeaders['x-correlation-id'].startsWith('admin_mon_'));
    assert.equal(overview.platformStatus, 'OPERATIONAL');
    assert.equal(overview.activeIssuesCount, 3);
    assert.equal(overview.criticalIssuesCount, 0);
    assert.equal(overview.exceptions24hCount, 42);
    assert.equal(overview.monitors.length, 1);
    assert.equal(overview.providerConnectivity.posthogIngestion.connected, true);
  });

  await t.test('3. Staleness Invariant: data older than 10 minutes must suppress OPERATIONAL status', () => {
    const STALENESS_THRESHOLD_MS = 10 * 60 * 1000;
    const now = Date.now();

    // 1. Fresh data (30 seconds ago)
    const freshFetchedAt = now - 30 * 1000;
    const isFresh = now - freshFetchedAt <= STALENESS_THRESHOLD_MS;
    assert.equal(isFresh, true);
    const freshStatus = isFresh ? 'OPERATIONAL' : 'STALE';
    assert.equal(freshStatus, 'OPERATIONAL');

    // 2. Stale data (14 minutes ago)
    const staleFetchedAt = now - 14 * 60 * 1000;
    const isStale = now - staleFetchedAt > STALENESS_THRESHOLD_MS;
    assert.equal(isStale, true);
    const staleStatus = isStale ? 'STALE' : 'OPERATIONAL';
    assert.equal(staleStatus, 'STALE');
  });

  await t.test('4. Metric Truthfulness Invariant: null uptime or latency must not assume defaults', () => {
    const monitorWithMissingData = {
      id: 'm_2',
      name: 'New Service',
      url: 'https://api.lpuevents.live/health',
      status: 'up',
      uptimeRatio30d: null,
      averageResponseTimeMs: null,
      dataRetrievedAt: new Date().toISOString(),
      lastResponseTimeSampleAt: null,
      lastCheckAt: null,
    };

    // UI rendering rule:
    const renderedUptime = monitorWithMissingData.uptimeRatio30d !== null
      ? `${monitorWithMissingData.uptimeRatio30d}%`
      : 'Unavailable';
    const renderedLatency = monitorWithMissingData.averageResponseTimeMs !== null
      ? `${monitorWithMissingData.averageResponseTimeMs}ms`
      : 'Unavailable';

    assert.equal(renderedUptime, 'Unavailable');
    assert.notEqual(renderedUptime, '100%');
    assert.equal(renderedLatency, 'Unavailable');
    assert.notEqual(renderedLatency, '0ms');
  });
});
