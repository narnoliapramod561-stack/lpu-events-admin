// lpu-events-admin/src/shared/telemetry/__tests__/uptimerobot_deep_audit.test.ts
// Exhaustive Audit & Fault Injection Test Suite for UptimeRobot Integration

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchUptimeRobotMonitors,
  pingUptimeRobot,
  _clearMonitorsCacheForTesting,
} from '../../../../supabase/functions/superadmin-monitoring/providers/uptimerobot.ts';

test('Exhaustive UptimeRobot Reliability & Fault-Injection Suite', async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
    _clearMonitorsCacheForTesting();
  });

  await t.test('1. Aspect: Real API custom_uptime_ratio (singular) parsing', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          stat: 'ok',
          monitors: [
            {
              id: 804626509,
              friendly_name: 'Student Website',
              url: 'https://lpuevents.live',
              status: 2,
              custom_uptime_ratio: '99.980', // Real UptimeRobot API singular key
              average_response_time: '142',
              response_times: [{ datetime: 1731475000, value: 142 }],
            },
          ],
        }),
        { status: 200 }
      );
    };

    const monitors = await fetchUptimeRobotMonitors('dummy_key', true);
    assert.equal(monitors.length, 1);
    assert.equal(monitors[0].uptimeRatio30d, 99.98);
    assert.equal(monitors[0].averageResponseTimeMs, 142);
    assert.equal(monitors[0].status, 'up');
  });

  await t.test('2. Aspect: Obsolete Render monitor filtering', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          stat: 'ok',
          monitors: [
            {
              id: 802820990,
              friendly_name: 'lpu-events.onrender.com/health',
              url: 'https://lpu-events.onrender.com/health',
              status: 2,
            },
            {
              id: 804626509,
              friendly_name: 'Student Website',
              url: 'https://lpuevents.live',
              status: 2,
            },
          ],
        }),
        { status: 200 }
      );
    };

    const monitors = await fetchUptimeRobotMonitors('dummy_key', true);
    assert.equal(monitors.length, 1);
    assert.equal(monitors[0].name, 'Student Website');
    assert(!monitors.some((m) => m.url.includes('onrender.com')));
  });

  await t.test('3. Aspect: HTTP 429 Rate Limit error handling', async () => {
    globalThis.fetch = async () => {
      return new Response('Rate limited', { status: 429 });
    };

    await assert.rejects(
      async () => {
        await fetchUptimeRobotMonitors('dummy_key', true);
      },
      (err: any) => {
        assert(err.message.includes('rate limit reached'));
        return true;
      }
    );
  });

  await t.test('4. Aspect: HTTP 502/500 Provider Outage error handling', async () => {
    globalThis.fetch = async () => {
      return new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    };

    await assert.rejects(
      async () => {
        await fetchUptimeRobotMonitors('dummy_key', true);
      },
      (err: any) => {
        assert(err.message.includes('UptimeRobot HTTP error: 502'));
        return true;
      }
    );
  });

  await t.test('5. Aspect: UptimeRobot internal JSON error (stat: fail)', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          stat: 'fail',
          error: { message: 'api_key not found.' },
        }),
        { status: 200 }
      );
    };

    await assert.rejects(
      async () => {
        await fetchUptimeRobotMonitors('dummy_key', true);
      },
      (err: any) => {
        assert.equal(err.message, 'UptimeRobot error: api_key not found.');
        return true;
      }
    );
  });

  await t.test('6. Aspect: Missing API Key resilience', async () => {
    await assert.rejects(
      async () => {
        await fetchUptimeRobotMonitors('', true);
      },
      (err: any) => {
        assert(err.message.includes('UPTIMEROBOT_API_KEY is not configured'));
        return true;
      }
    );

    // pingUptimeRobot must NOT crash, but return connected: false
    const ping = await pingUptimeRobot('');
    assert.equal(ping.connected, false);
    assert(ping.error?.includes('not configured'));
  });

  await t.test('7. Aspect: In-flight deduplication & caching (Prevents double billing/429s)', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return new Response(
        JSON.stringify({
          stat: 'ok',
          monitors: [{ id: 1, friendly_name: 'M1', url: 'https://lpuevents.live', status: 2 }],
        }),
        { status: 200 }
      );
    };

    // Fire 2 concurrent fetches
    const [res1, res2] = await Promise.all([
      fetchUptimeRobotMonitors('dummy_key', false),
      fetchUptimeRobotMonitors('dummy_key', false),
    ]);

    // Both should receive identical results from a single fetch
    assert.equal(callCount, 1);
    assert.equal(res1.length, 1);
    assert.equal(res2.length, 1);

    // Subsequent call within cache TTL (30s) should use cache without new fetch
    const res3 = await fetchUptimeRobotMonitors('dummy_key', false);
    assert.equal(callCount, 1);
    assert.equal(res3.length, 1);
  });

  await t.test('8. Aspect: Metric Truthfulness (no fake 100% or 0ms)', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          stat: 'ok',
          monitors: [
            {
              id: 2,
              friendly_name: 'Edge Health',
              url: 'https://lpuevents.live/health',
              status: 2,
              custom_uptime_ratio: '', // empty
              average_response_time: null, // missing
            },
          ],
        }),
        { status: 200 }
      );
    };

    const monitors = await fetchUptimeRobotMonitors('dummy_key', true);
    assert.equal(monitors[0].uptimeRatio30d, null);
    assert.equal(monitors[0].averageResponseTimeMs, null);

    // UI Formatting rule check
    const displayRatio = monitors[0].uptimeRatio30d !== null ? `${monitors[0].uptimeRatio30d}%` : 'Unavailable';
    const displayLatency = monitors[0].averageResponseTimeMs !== null ? `${monitors[0].averageResponseTimeMs}ms` : 'Unavailable';

    assert.equal(displayRatio, 'Unavailable');
    assert.equal(displayLatency, 'Unavailable');
  });

  await t.test('9. Aspect: Down and Seems_Down monitor status degradation', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          stat: 'ok',
          monitors: [
            { id: 1, friendly_name: 'Up', url: 'https://lpuevents.live', status: 2 },
            { id: 2, friendly_name: 'Degraded', url: 'https://www.lpueventsadmin.live', status: 8 }, // seems_down
            { id: 3, friendly_name: 'Outage', url: 'https://api.lpuevents.live', status: 9 }, // down
          ],
        }),
        { status: 200 }
      );
    };

    const monitors = await fetchUptimeRobotMonitors('dummy_key', true);
    assert.equal(monitors[0].status, 'up');
    assert.equal(monitors[1].status, 'seems_down');
    assert.equal(monitors[2].status, 'down');

    // Simulate platform status logic:
    const hasDown = monitors.some((m) => m.status === 'down' || m.status === 'seems_down');
    assert.equal(hasDown, true);
    const platformStatus = hasDown ? 'DEGRADED' : 'OPERATIONAL';
    assert.equal(platformStatus, 'DEGRADED');
  });
});
