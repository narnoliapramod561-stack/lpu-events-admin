// lpu-events-admin/src/shared/telemetry/__tests__/error_inbox_deep_audit.test.ts
// Deep Audit Test Suite for Section B Error Inbox Fixes

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchPostHogIssues,
  fetchPostHogIssueDetail,
  updatePostHogIssue,
  deletePostHogIssue,
  buildDeepLink,
} from '../../../../supabase/functions/superadmin-monitoring/providers/posthog.ts';

test('Section B Error Inbox & Exception Triage - Exhaustive Fix Audit', async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test('1. "All" Status filter: does NOT inject &status=active', async () => {
    let requestedUrl = '';
    globalThis.fetch = async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({ results: [], count: 0 }), { status: 200 });
    };

    // When status is "all"
    await fetchPostHogIssues({ status: 'all', apiKey: 'test_key', projectId: '123' });
    assert(!requestedUrl.includes('status='), 'URL should not have status parameter when status is "all"');

    // When status is specific
    await fetchPostHogIssues({ status: 'resolved', apiKey: 'test_key', projectId: '123' });
    assert(requestedUrl.includes('status=resolved'), 'URL should have status=resolved');
  });

  await t.test('2. Deep property extraction from raw.properties', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          results: [
            {
              id: 'err-101',
              name: 'Unhandled Promise Rejection',
              properties: {
                app: 'app', // mobile app
                component: 'EventBookingScreen.tsx',
                $release: 'git.9942a',
                environment: 'production',
              },
              occurrences: 5,
              users: 2,
            },
          ],
          count: 1,
        }),
        { status: 200 }
      );
    };

    const { issues } = await fetchPostHogIssues({ apiKey: 'test_key', projectId: '123' });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].app, 'app');
    assert.equal(issues[0].component, 'EventBookingScreen.tsx');
    assert.equal(issues[0].release, 'git.9942a');
  });

  await t.test('3. Mobile App classification: Recognize "mobile" and "app"', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          results: [
            { id: '1', name: 'Mobile Error', app: 'mobile' },
            { id: '2', name: 'App Error', properties: { app: 'app' } },
            { id: '3', name: 'Admin Error', app: 'admin' },
          ],
        }),
        { status: 200 }
      );
    };

    const { issues } = await fetchPostHogIssues({ apiKey: 'test_key', projectId: '123' });
    assert.equal(issues[0].app, 'app');
    assert.equal(issues[1].app, 'app');
    assert.equal(issues[2].app, 'admin');
  });

  await t.test('4. Custom POSTHOG_HOST is respected in requests and deepLinks', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ results: [], count: 0 }), { status: 200 });
    };

    const customHost = 'https://eu.posthog.com';
    const { issues } = await fetchPostHogIssues({
      apiKey: 'test_key',
      projectId: '456',
      host: customHost,
    });

    assert(capturedUrl.startsWith(customHost));
    const link = buildDeepLink('456', 'issue-7', customHost);
    assert(link.startsWith('https://eu.posthog.com/project/456/error_tracking/issue-7'));
  });

  await t.test('5. updatePostHogIssue validation and request handling', async () => {
    let patchBody: any = null;
    let patchUrl = '';
    globalThis.fetch = async (url, options) => {
      patchUrl = String(url);
      patchBody = JSON.parse(options?.body as string);
      return new Response(JSON.stringify({ status: patchBody.status }), { status: 200 });
    };

    await updatePostHogIssue('valid-id-1', 'active', { apiKey: 'test_key', projectId: '123' });
    assert.equal(patchBody.status, 'active');
    assert(patchUrl.includes('/issues/valid-id-1/'));

    // Invalid status rejected
    await assert.rejects(
      async () => {
        await updatePostHogIssue('valid-id-1', 'invalid_status' as any, { apiKey: 'test_key', projectId: '123' });
      },
      (err: any) => {
        assert(err.message.includes('Invalid status'));
        return true;
      }
    );
  });

  await t.test('6. deletePostHogIssue sends DELETE method to PostHog', async () => {
    let methodUsed = '';
    let targetUrl = '';
    globalThis.fetch = async (url, options) => {
      targetUrl = String(url);
      methodUsed = options?.method || 'GET';
      return new Response(null, { status: 204 });
    };

    const res = await deletePostHogIssue('issue-uuid-to-delete', { apiKey: 'test_key', projectId: '123' });
    assert.equal(methodUsed, 'DELETE');
    assert(targetUrl.includes('/issues/issue-uuid-to-delete/'));
    assert.equal(res.success, true);
  });

  await t.test('7. deletePostHogIssue falls back to status suppressed if DELETE returns error', async () => {
    let patchBody: any = null;
    globalThis.fetch = async (url, options) => {
      if (options?.method === 'DELETE') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      if (options?.method === 'PATCH') {
        patchBody = JSON.parse(options?.body as string);
        return new Response(JSON.stringify({ status: patchBody.status }), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    };

    const res = await deletePostHogIssue('issue-uuid-fallback', { apiKey: 'test_key', projectId: '123' });
    assert.equal(patchBody.status, 'suppressed');
  });
});
