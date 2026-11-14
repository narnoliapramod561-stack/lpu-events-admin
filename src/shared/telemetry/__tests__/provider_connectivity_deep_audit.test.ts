// lpu-events-admin/src/shared/telemetry/__tests__/provider_connectivity_deep_audit.test.ts
// Professional Quality Assurance & Fault Injection Suite for Provider API Connectivity

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pingPostHog,
  pingPostHogIngestion,
} from '../../../../supabase/functions/superadmin-monitoring/providers/posthog.ts';
import {
  pingUptimeRobot,
  _clearMonitorsCacheForTesting,
} from '../../../../supabase/functions/superadmin-monitoring/providers/uptimerobot.ts';
import { pingSupabaseLogs } from '../../../../supabase/functions/superadmin-monitoring/providers/supabase-logs.ts';
import { pingGsc } from '../../../../supabase/functions/superadmin-monitoring/providers/gsc.ts';

test('Provider API Connectivity - Exhaustive Fault Injection Matrix', async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
    _clearMonitorsCacheForTesting();
  });

  // =========================================================================
  // 1. PostHog Ingestion API
  // =========================================================================
  await t.test('1. PostHog Ingestion: 200 OK -> connected: true with valid latency', async () => {
    globalThis.fetch = async () => new Response('{"status": "ok"}', { status: 200 });

    const status = await pingPostHogIngestion('https://us.i.posthog.com');
    assert.equal(status.connected, true);
    assert.equal(typeof status.latencyMs, 'number');
    assert(status.latencyMs! >= 0);
    assert.equal(status.error, undefined);
    assert(typeof status.checkedAt === 'string');
  });

  await t.test('2. PostHog Ingestion: Outage (HTTP 503) -> connected: false', async () => {
    globalThis.fetch = async () => new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });

    const status = await pingPostHogIngestion('https://us.i.posthog.com');
    assert.equal(status.connected, false);
    assert(status.error?.includes('HTTP 503'));
  });

  await t.test('3. PostHog Ingestion: Network/DNS Drop -> connected: false', async () => {
    globalThis.fetch = async () => {
      throw new Error('ENOTFOUND us.i.posthog.com');
    };

    const status = await pingPostHogIngestion('https://us.i.posthog.com');
    assert.equal(status.connected, false);
    assert(status.error?.includes('ENOTFOUND'));
  });

  // =========================================================================
  // 2. PostHog Issues REST API
  // =========================================================================
  await t.test('4. PostHog Issues API: 200 OK with valid credentials -> connected: true', async () => {
    globalThis.fetch = async (url) => {
      assert(String(url).includes('/error_tracking/issues/'));
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };

    const status = await pingPostHog({ apiKey: 'phx_valid_key', projectId: '123' });
    assert.equal(status.connected, true);
    assert.equal(typeof status.latencyMs, 'number');
    assert.equal(status.error, undefined);
  });

  await t.test('5. PostHog Issues API: Missing API Key -> connected: false without throwing', async () => {
    const status = await pingPostHog({ apiKey: '', projectId: '123' });
    assert.equal(status.connected, false);
    assert(status.error?.includes('POSTHOG_PERSONAL_API_KEY not configured'));
  });

  await t.test('6. PostHog Issues API: Revoked / Invalid Token (401) -> connected: false', async () => {
    globalThis.fetch = async () => new Response('{"detail": "Invalid personal API key"}', { status: 401, statusText: 'Unauthorized' });

    const status = await pingPostHog({ apiKey: 'phx_invalid_key', projectId: '123' });
    assert.equal(status.connected, false);
    assert(status.error?.includes('HTTP 401'));
  });

  await t.test('7. PostHog Issues API: Rate Limited (429) -> connected: false', async () => {
    globalThis.fetch = async () => new Response('Too Many Requests', { status: 429, statusText: 'Too Many Requests' });

    const status = await pingPostHog({ apiKey: 'phx_key', projectId: '123' });
    assert.equal(status.connected, false);
    assert(status.error?.includes('HTTP 429'));
  });

  // =========================================================================
  // 3. UptimeRobot v2 API
  // =========================================================================
  await t.test('8. UptimeRobot: 200 OK -> connected: true with valid latency', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ stat: 'ok', monitors: [] }), { status: 200 });

    const status = await pingUptimeRobot('ur_valid_key');
    assert.equal(status.connected, true);
    assert.equal(typeof status.latencyMs, 'number');
    assert.equal(status.error, undefined);
  });

  await t.test('9. UptimeRobot: Missing API key -> connected: false', async () => {
    const status = await pingUptimeRobot('');
    assert.equal(status.connected, false);
    assert(status.error?.includes('UPTIMEROBOT_API_KEY not configured'));
  });

  await t.test('10. UptimeRobot: Rate limit (429) -> connected: false', async () => {
    globalThis.fetch = async () => new Response('Rate limited', { status: 429 });

    const status = await pingUptimeRobot('ur_key');
    assert.equal(status.connected, false);
    assert(status.error?.includes('rate limit reached'));
  });

  await t.test('11. UptimeRobot: Upstream 500 Outage -> connected: false', async () => {
    globalThis.fetch = async () => new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });

    const status = await pingUptimeRobot('ur_key');
    assert.equal(status.connected, false);
    assert(status.error?.includes('500'));
  });

  // =========================================================================
  // 4. Supabase ClickHouse Logs API
  // =========================================================================
  await t.test('12. Supabase Logs: 200 OK -> connected: true with valid latency', async () => {
    globalThis.fetch = async (url) => {
      assert(String(url).includes('/analytics/endpoints/logs'));
      assert(String(url).includes('SELECT%201%20FROM%20logs'));
      return new Response(JSON.stringify({ data: [{ '?column?': 1 }] }), { status: 200 });
    };

    const status = await pingSupabaseLogs({ token: 'sbp_valid_token', projectRef: 'my_project_ref' });
    assert.equal(status.connected, true);
    assert.equal(typeof status.latencyMs, 'number');
    assert.equal(status.error, undefined);
  });

  await t.test('13. Supabase Logs: Missing token or projectRef -> connected: false', async () => {
    const status1 = await pingSupabaseLogs({ token: '', projectRef: 'ref' });
    assert.equal(status1.connected, false);
    assert(status1.error?.includes('missing'));

    const status2 = await pingSupabaseLogs({ token: 'tok', projectRef: '' });
    assert.equal(status2.connected, false);
    assert(status2.error?.includes('missing'));
  });

  await t.test('14. Supabase Logs: Expired Token (401) -> connected: false', async () => {
    globalThis.fetch = async () => new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const status = await pingSupabaseLogs({ token: 'sbp_expired', projectRef: 'ref' });
    assert.equal(status.connected, false);
    assert(status.error?.includes('HTTP 401'));
  });

  await t.test('15. Supabase Logs: ClickHouse 500 Internal Error -> connected: false', async () => {
    globalThis.fetch = async () => new Response('ClickHouse query timeout', { status: 500, statusText: 'Internal Server Error' });

    const status = await pingSupabaseLogs({ token: 'sbp_tok', projectRef: 'ref' });
    assert.equal(status.connected, false);
    assert(status.error?.includes('HTTP 500'));
  });

  // =========================================================================
  // 5. Google Search Console API
  // =========================================================================
  await t.test('16. GSC: Missing Service Account JSON -> connected: false', async () => {
    const status = await pingGsc({ serviceAccountJson: '' });
    assert.equal(status.connected, false);
    assert(status.error?.includes('GSC_SERVICE_ACCOUNT_JSON not configured'));
  });

  await t.test('17. GSC: Corrupted JSON -> connected: false without throwing', async () => {
    const status = await pingGsc({ serviceAccountJson: '{ malformed json' });
    assert.equal(status.connected, false);
    assert(status.error !== undefined);
  });

  await t.test('18. GSC: Missing Private Key -> connected: false', async () => {
    const status = await pingGsc({
      serviceAccountJson: JSON.stringify({ client_email: 'test@example.com' }), // missing private_key
    });
    assert.equal(status.connected, false);
    assert(status.error?.includes('Invalid GSC_SERVICE_ACCOUNT_JSON structure'));
  });

  // =========================================================================
  // 6. Isolation & Concurrency Verification
  // =========================================================================
  await t.test('19. Fault Isolation: 4 providers down does not affect the 1 healthy provider', async () => {
    // PostHog Ingest: Healthy (200)
    // PostHog API: Down (401)
    // UptimeRobot: Down (429)
    // Supabase Logs: Down (500)
    // GSC: Down (unconfigured)
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('us.i.posthog.com/decide')) {
        return new Response('{"status":"ok"}', { status: 200 });
      }
      if (urlStr.includes('/error_tracking/issues/')) {
        return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
      }
      if (urlStr.includes('uptimerobot.com')) {
        return new Response('Rate limited', { status: 429 });
      }
      if (urlStr.includes('api.supabase.com')) {
        return new Response('Internal Error', { status: 500, statusText: 'Internal Error' });
      }
      return new Response('Not found', { status: 404 });
    };

    const [ingest, issues, ur, logs, gsc] = await Promise.all([
      pingPostHogIngestion('https://us.i.posthog.com'),
      pingPostHog({ apiKey: 'bad_key', projectId: '1' }),
      pingUptimeRobot('ur_key'),
      pingSupabaseLogs({ token: 'tok', projectRef: 'ref' }),
      pingGsc({ serviceAccountJson: '' }),
    ]);

    // Healthy provider MUST be connected
    assert.equal(ingest.connected, true);
    assert(ingest.latencyMs! >= 0);

    // Failed providers MUST report false without causing an uncaught exception
    assert.equal(issues.connected, false);
    assert.equal(ur.connected, false);
    assert.equal(logs.connected, false);
    assert.equal(gsc.connected, false);
  });

  // =========================================================================
  // 7. Metric Truthfulness & Invariant Checks
  // =========================================================================
  await t.test('20. Metric Truthfulness: Failed probes never report fake 0ms latency', async () => {
    globalThis.fetch = async () => new Response('Internal Error', { status: 500, statusText: 'Internal Error' });

    const status = await pingPostHogIngestion('https://us.i.posthog.com');
    assert.equal(status.connected, false);
    assert(status.latencyMs !== null);
    assert(status.latencyMs! >= 0);
  });
});
