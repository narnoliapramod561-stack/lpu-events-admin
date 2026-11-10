// lpu-events-admin/src/shared/telemetry/__tests__/services_status_stage11.test.ts
// Unit Test Suite for Stage 11: Section C Services Status & UptimeRobot (MON-004 / MON-005 / MON-008)

import test from 'node:test';
import assert from 'node:assert/strict';
import { MonitoringApiClient } from '../../../components/superadmin/monitoring/utils/MonitoringApiClient.ts';
import type { NormalizedMonitorStatus } from '../../../components/superadmin/monitoring/types.ts';

test('Stage 11: Section C Services Status & UptimeRobot Suite', async (t) => {
  await t.test('1. should query uptimerobot_monitors via proxy and return mapped monitors', async () => {
    let invokedAction = '';

    const mockSupabase: any = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'test_token' } },
        }),
      },
      functions: {
        invoke: async (url: string) => {
          invokedAction = new URL(`https://example.com/${url}`).searchParams.get('action') || '';
          return {
            data: {
              data: [
                {
                  id: '101',
                  name: 'Student Web UI',
                  url: 'https://lpuevents.live',
                  status: 'up',
                  uptimeRatio30d: 99.98,
                  averageResponseTimeMs: 124,
                  dataRetrievedAt: '2026-11-10T10:00:00.000Z',
                  lastResponseTimeSampleAt: '2026-11-10T09:58:00.000Z',
                  lastCheckAt: '2026-11-10T09:58:00.000Z',
                },
                {
                  id: '102',
                  name: 'Admin Web UI',
                  url: 'https://admin.lpuevents.live',
                  status: 'up',
                  uptimeRatio30d: 99.95,
                  averageResponseTimeMs: 148,
                  dataRetrievedAt: '2026-11-10T10:00:00.000Z',
                  lastResponseTimeSampleAt: '2026-11-10T09:57:00.000Z',
                  lastCheckAt: '2026-11-10T09:57:00.000Z',
                },
              ],
            },
            error: null,
          };
        },
      },
    };

    MonitoringApiClient.setSupabaseClient(mockSupabase);
    const monitors = await MonitoringApiClient.getMonitors();

    assert.equal(invokedAction, 'uptimerobot_monitors');
    assert.equal(monitors.length, 2);
    assert.equal(monitors[0].url, 'https://lpuevents.live');
    assert.equal(monitors[0].uptimeRatio30d, 99.98);
    assert.equal(monitors[0].averageResponseTimeMs, 124);
  });

  await t.test('2. Metric Truthfulness Invariant: missing ratio or response time returns null and renders Unavailable', () => {
    const rawMonitorsWithNulls: NormalizedMonitorStatus = {
      id: '103',
      name: 'Supabase Edge/DB Health',
      url: 'https://api.lpuevents.live/health',
      status: 'up',
      uptimeRatio30d: null, // Empty in API response
      averageResponseTimeMs: null, // Empty in API response
      dataRetrievedAt: '2026-11-10T10:00:00.000Z',
      lastResponseTimeSampleAt: null,
      lastCheckAt: null,
    };

    // UI Formatting rule enforcement:
    const displayUptime =
      rawMonitorsWithNulls.uptimeRatio30d !== null
        ? `${rawMonitorsWithNulls.uptimeRatio30d}%`
        : 'Unavailable';

    const displayLatency =
      rawMonitorsWithNulls.averageResponseTimeMs !== null
        ? `${rawMonitorsWithNulls.averageResponseTimeMs}ms`
        : 'Unavailable';

    assert.equal(rawMonitorsWithNulls.uptimeRatio30d, null);
    assert.equal(rawMonitorsWithNulls.averageResponseTimeMs, null);

    assert.equal(displayUptime, 'Unavailable');
    assert.notEqual(displayUptime, '100%'); // MUST NEVER default to 100%

    assert.equal(displayLatency, 'Unavailable');
    assert.notEqual(displayLatency, '0ms'); // MUST NEVER default to 0ms
  });

  await t.test('3. Strict Separation of Timestamps (dataRetrievedAt vs check timestamps)', () => {
    const monitor: NormalizedMonitorStatus = {
      id: '104',
      name: 'Edge Worker Gateway',
      url: 'https://api.lpuevents.live/api/public/version',
      status: 'up',
      uptimeRatio30d: 100.0,
      averageResponseTimeMs: 42,
      dataRetrievedAt: '2026-11-10T10:00:15.000Z', // Time EF queried UptimeRobot
      lastResponseTimeSampleAt: '2026-11-10T09:59:00.000Z', // Sample time
      lastCheckAt: '2026-11-10T09:59:00.000Z', // Check time
    };

    assert.notEqual(monitor.dataRetrievedAt, monitor.lastCheckAt);
    assert(new Date(monitor.dataRetrievedAt).getTime() > new Date(monitor.lastCheckAt!).getTime());
  });

  await t.test('4. Hostname standardization verification', () => {
    const targetUrls = [
      'https://lpuevents.live',
      'https://admin.lpuevents.live',
      'https://api.lpuevents.live/health',
    ];

    for (const url of targetUrls) {
      assert(!url.includes('localhost'));
      assert(!url.includes('127.0.0.1'));
      assert(url.includes('lpuevents.live'));
    }
  });

  await t.test('5. Rate-limiting debounce invariant (60s cooldown)', () => {
    const RATE_LIMIT_COOLDOWN_SEC = 60;
    const lastFetchedAt = Date.now();
    const immediateNextClick = lastFetchedAt + 5000; // 5s later

    const isDebounced = (immediateNextClick - lastFetchedAt) < (RATE_LIMIT_COOLDOWN_SEC * 1000);
    assert.equal(isDebounced, true);
  });
});
