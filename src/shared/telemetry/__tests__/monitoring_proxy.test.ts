// lpu-events-admin/src/shared/telemetry/__tests__/monitoring_proxy.test.ts
// Unit Test Suite for Stage 7: Secure Super Admin Monitoring Proxy (MON-006 / MON-008)

import test from 'node:test';
import assert from 'node:assert/strict';

import { authorizeSuperAdminRequest } from '../../../../supabase/functions/superadmin-monitoring/auth.ts';
import { MonitoringSecurityError } from '../../../../supabase/functions/superadmin-monitoring/types.ts';
import {
  fetchPostHogIssues,
  fetchPostHogIssueDetail,
  updatePostHogIssue,
  buildDeepLink,
} from '../../../../supabase/functions/superadmin-monitoring/providers/posthog.ts';
import { fetchUptimeRobotMonitors } from '../../../../supabase/functions/superadmin-monitoring/providers/uptimerobot.ts';
import { querySupabaseLogs } from '../../../../supabase/functions/superadmin-monitoring/providers/supabase-logs.ts';
import { fetchGscOverview } from '../../../../supabase/functions/superadmin-monitoring/providers/gsc.ts';

test('Stage 7: Secure Super Admin Monitoring Proxy Suite', async (t) => {
  await t.test('1. should throw 401 UNAUTHORIZED when Authorization header is missing', async () => {
    const req = new Request('https://admin.lpuevents.live/functions/v1/superadmin-monitoring', {
      headers: {},
    });

    await assert.rejects(
      async () => {
        await authorizeSuperAdminRequest(req);
      },
      (err: any) => {
        assert(err instanceof MonitoringSecurityError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  await t.test('2. should throw 401 UNAUTHORIZED when Bearer token is empty or malformed', async () => {
    const req = new Request('https://admin.lpuevents.live/functions/v1/superadmin-monitoring', {
      headers: {
        Authorization: 'Bearer ',
      },
    });

    await assert.rejects(
      async () => {
        await authorizeSuperAdminRequest(req);
      },
      (err: any) => {
        assert(err instanceof MonitoringSecurityError);
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  await t.test('3. should throw 403 FORBIDDEN when user has is_super_admin: false (Organizer role)', async () => {
    const mockSupabase: any = {
      auth: {
        getUser: async (token: string) => ({
          data: { user: { id: 'auth_organizer_123', email: 'org@lpu.co.in' } },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'admin_row_123', is_super_admin: false },
              error: null,
            }),
          }),
        }),
      }),
    };

    const req = new Request('https://admin.lpuevents.live/functions/v1/superadmin-monitoring', {
      headers: {
        Authorization: 'Bearer valid_organizer_jwt',
      },
    });

    await assert.rejects(
      async () => {
        await authorizeSuperAdminRequest(req, mockSupabase);
      },
      (err: any) => {
        assert(err instanceof MonitoringSecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FORBIDDEN');
        assert(err.message.includes('Super Admin privileges required'));
        return true;
      }
    );
  });

  await t.test('4. should throw 403 FORBIDDEN when no admin profile exists for auth user', async () => {
    const mockSupabase: any = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'auth_student_999', email: 'student@lpu.co.in' } },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    };

    const req = new Request('https://admin.lpuevents.live/functions/v1/superadmin-monitoring', {
      headers: {
        Authorization: 'Bearer valid_student_jwt',
      },
    });

    await assert.rejects(
      async () => {
        await authorizeSuperAdminRequest(req, mockSupabase);
      },
      (err: any) => {
        assert(err instanceof MonitoringSecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FORBIDDEN');
        assert(err.message.includes('No registered administrative profile'));
        return true;
      }
    );
  });

  await t.test('5. should succeed and return AuthenticatedSuperAdmin when is_super_admin: true', async () => {
    const mockSupabase: any = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'auth_super_1', email: 'superadmin@lpuevents.live' } },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'admin_user_super_1', is_super_admin: true },
              error: null,
            }),
          }),
        }),
      }),
    };

    const req = new Request('https://admin.lpuevents.live/functions/v1/superadmin-monitoring', {
      headers: {
        Authorization: 'Bearer valid_superadmin_jwt',
      },
    });

    const result = await authorizeSuperAdminRequest(req, mockSupabase);
    assert.equal(result.isSuperAdmin, true);
    assert.equal(result.authUserId, 'auth_super_1');
    assert.equal(result.adminUserId, 'admin_user_super_1');
  });

  await t.test('6. PostHog provider queries verified DRF endpoint and constructs deep links', async () => {
    const originalFetch = globalThis.fetch;
    try {
      let requestedUrl = '';
      let requestedHeaders: any = {};

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        requestedUrl = input.toString();
        requestedHeaders = init?.headers;
        return new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                id: 'issue-uuid-1',
                name: 'TypeError: Cannot read properties of undefined',
                status: 'active',
                severity: 'P1',
                app: 'student',
                occurrences: 45,
                users: 12,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const { issues, total } = await fetchPostHogIssues({
        apiKey: 'ph_test_key_123',
        projectId: '531855',
        status: 'active',
      });

      assert(requestedUrl.startsWith('https://us.posthog.com/api/projects/531855/error_tracking/issues/'));
      assert.equal(requestedHeaders.Authorization, 'Bearer ph_test_key_123');
      assert.equal(total, 1);
      assert.equal(issues[0].id, 'issue-uuid-1');
      assert.equal(issues[0].deepLink, 'https://us.posthog.com/project/531855/error_tracking/issue-uuid-1');
      assert.equal(issues[0].users, 12);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('7. PostHog backend service issues normalize affected users to N/A', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                id: 'issue-uuid-backend',
                name: 'Worker edge exception in /api/events',
                status: 'active',
                app: 'backend',
                occurrences: 5,
                users: 1,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const { issues } = await fetchPostHogIssues({
        apiKey: 'ph_test_key',
        projectId: '531855',
      });

      assert.equal(issues[0].app, 'backend');
      assert.equal(issues[0].users, 'N/A');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('8. PostHog updatePostHogIssue validates status and sends PATCH request', async () => {
    const originalFetch = globalThis.fetch;
    try {
      let patchMethod = '';
      let patchBody = '';

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        patchMethod = init?.method || '';
        patchBody = init?.body ? String(init.body) : '';
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      };

      await updatePostHogIssue('valid-issue-uuid', 'suppressed', {
        apiKey: 'ph_key',
        projectId: '531855',
      });

      assert.equal(patchMethod, 'PATCH');
      assert.deepEqual(JSON.parse(patchBody), { status: 'suppressed' });

      // Rejects invalid status
      await assert.rejects(async () => {
        await updatePostHogIssue('valid-issue-uuid', 'deleted' as any, { apiKey: 'ph_key' });
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('9. UptimeRobot provider enforces metric truthfulness (null for missing uptime/response time)', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            stat: 'ok',
            monitors: [
              {
                id: 101,
                friendly_name: 'Student Web',
                url: 'https://lpuevents.live',
                status: 2,
                custom_uptime_ratios: '99.98-99.95',
                average_response_time: '124',
                response_times: [{ datetime: 1731234000, value: 124 }],
                logs: [{ datetime: 1731234000 }],
              },
              {
                id: 102,
                friendly_name: 'New Service',
                url: 'https://api.lpuevents.live/health',
                status: 2,
                custom_uptime_ratios: '', // Missing ratio
                average_response_time: null, // Missing response time
                response_times: [],
              },
            ],
          }),
          { status: 200 }
        );
      };

      const monitors = await fetchUptimeRobotMonitors('ur_test_key');
      assert.equal(monitors.length, 2);

      // Monitor 1: Real metrics
      assert.equal(monitors[0].uptimeRatio30d, 99.98);
      assert.equal(monitors[0].averageResponseTimeMs, 124);
      assert.equal(monitors[0].status, 'up');

      // Monitor 2: Metric Truthfulness Invariant: null, NEVER defaulted to 100% or 0ms
      assert.equal(monitors[1].uptimeRatio30d, null);
      assert.equal(monitors[1].averageResponseTimeMs, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('10. Supabase logs provider enforces 24-hour maximum window constraint', async () => {
    const now = new Date();
    const olderThan24h = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();

    await assert.rejects(
      async () => {
        await querySupabaseLogs({
          token: 'sb_test_token',
          projectRef: 'test-ref',
          isoTimestampStart: olderThan24h,
          isoTimestampEnd: now.toISOString(),
        });
      },
      (err: any) => {
        assert(err.message.includes('restricted to a maximum window of 24 hours'));
        return true;
      }
    );
  });

  await t.test('11. GSC provider gracefully returns platform delay notice without throwing', async () => {
    const summary = await fetchGscOverview({ days: 28 });
    assert.equal(typeof summary.clicks, 'number');
    assert.equal(typeof summary.impressions, 'number');
    assert(summary.delayNotice.includes('2–3 days ago (Google platform delay)'));
    assert.equal(summary.deepLink, 'https://search.google.com/search-console');
  });
});
