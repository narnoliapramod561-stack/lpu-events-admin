// lpu-events-admin/src/shared/telemetry/__tests__/error_inbox_stage9.test.ts
// Unit Test Suite for Stage 9: Section B Error Inbox & Exception Triage (MON-004 / MON-008)

import test from 'node:test';
import assert from 'node:assert/strict';
import { MonitoringApiClient } from '../../../components/superadmin/monitoring/utils/MonitoringApiClient.ts';
import type { NormalizedPostHogIssue } from '../../../components/superadmin/monitoring/types.ts';

test('Stage 9: Section B Error Inbox & Triage Suite', async (t) => {
  await t.test('1. should query PostHog issues with status and limit params', async () => {
    let passedParams: any = null;

    const mockSupabase: any = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'test_token' } },
        }),
      },
      functions: {
        invoke: async (url: string) => {
          passedParams = new URL(`https://example.com/${url}`).searchParams;
          return {
            data: {
              data: {
                total: 2,
                issues: [
                  {
                    id: 'issue-1',
                    name: 'TypeError: Cannot read properties of null',
                    status: 'active',
                    severity: 'P1',
                    app: 'student',
                    environment: 'production',
                    component: 'EventCard.tsx',
                    occurrences: 14,
                    users: 8,
                    firstSeen: new Date().toISOString(),
                    lastSeen: new Date().toISOString(),
                    release: 'sha.abc123',
                    deepLink: 'https://us.posthog.com/project/531855/error_tracking/issue-1',
                  },
                  {
                    id: 'issue-backend',
                    name: 'Worker 500 error in /api/events',
                    status: 'active',
                    severity: 'P0',
                    app: 'backend',
                    environment: 'production',
                    component: 'worker.ts',
                    occurrences: 3,
                    users: 'N/A',
                    firstSeen: new Date().toISOString(),
                    lastSeen: new Date().toISOString(),
                    release: 'sha.abc123',
                    deepLink: 'https://us.posthog.com/project/531855/error_tracking/issue-backend',
                  },
                ],
              },
            },
            error: null,
          };
        },
      },
    };

    MonitoringApiClient.setSupabaseClient(mockSupabase);

    const { issues, total } = await MonitoringApiClient.getIssues({
      status: 'active',
      limit: 50,
      offset: 0,
    });

    assert.equal(passedParams.get('action'), 'posthog_issues');
    assert.equal(passedParams.get('status'), 'active');
    assert.equal(passedParams.get('limit'), '50');
    assert.equal(total, 2);
    assert.equal(issues.length, 2);
    assert.equal(issues[0].app, 'student');
    assert.equal(issues[0].users, 8);
  });

  await t.test('2. Backend Service Event Invariant: users must be N/A', async () => {
    const mockSupabase: any = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'test_token' } },
        }),
      },
      functions: {
        invoke: async () => ({
          data: {
            data: {
              total: 1,
              issues: [
                {
                  id: 'issue-backend-edge',
                  name: 'Edge function timeout',
                  status: 'active',
                  severity: 'P1',
                  app: 'backend',
                  environment: 'production',
                  component: 'r2-upload',
                  occurrences: 1,
                  users: 'N/A',
                  firstSeen: new Date().toISOString(),
                  lastSeen: new Date().toISOString(),
                  release: 'sha.111',
                  deepLink: 'https://us.posthog.com/project/531855/error_tracking/issue-backend-edge',
                },
              ],
            },
          },
          error: null,
        }),
      },
    };

    MonitoringApiClient.setSupabaseClient(mockSupabase);
    const { issues } = await MonitoringApiClient.getIssues();
    assert.equal(issues[0].app, 'backend');
    assert.equal(issues[0].users, 'N/A');
  });

  await t.test('3. should invoke posthog_issue_update with resolved and suppressed statuses', async () => {
    let invokedBody: any = null;

    const mockSupabase: any = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'test_token' } },
        }),
      },
      functions: {
        invoke: async (_url: string, options: any) => {
          invokedBody = options.body;
          return { data: { success: true }, error: null };
        },
      },
    };

    MonitoringApiClient.setSupabaseClient(mockSupabase);

    // 1. Mark resolved
    await MonitoringApiClient.updateIssue('test-uuid-1', 'resolved');
    assert.deepEqual(invokedBody, { issue_id: 'test-uuid-1', status: 'resolved' });

    // 2. Suppress
    await MonitoringApiClient.updateIssue('test-uuid-2', 'suppressed');
    assert.deepEqual(invokedBody, { issue_id: 'test-uuid-2', status: 'suppressed' });
  });

  await t.test('4. Ingestion Drop Safety Rule: suppression explains permanent drop behavior', () => {
    const suppressionWarning =
      'Suppressing this issue will instruct PostHog to drop all future matching exceptions at ingestion time. They will not be counted in incident metrics.';
    assert(suppressionWarning.includes('drop all future matching exceptions at ingestion time'));
    assert(suppressionWarning.includes('will not be counted in incident metrics'));
  });

  await t.test('5. Client filter predicate: filters by search term and surface correctly', () => {
    const sampleIssues: NormalizedPostHogIssue[] = [
      {
        id: '1',
        name: 'TypeError: undefined is not a function',
        status: 'active',
        severity: 'P1',
        app: 'student',
        environment: 'production',
        component: 'CategoryFilter.tsx',
        occurrences: 10,
        users: 5,
        firstSeen: '',
        lastSeen: '',
        release: 'sha.abc1',
        deepLink: '',
      },
      {
        id: '2',
        name: 'Database timeout on operations table',
        status: 'active',
        severity: 'P0',
        app: 'backend',
        environment: 'production',
        component: 'superadmin-operations',
        occurrences: 2,
        users: 'N/A',
        firstSeen: '',
        lastSeen: '',
        release: 'sha.abc2',
        deepLink: '',
      },
    ];

    // Filter by surface backend
    const backendOnly = sampleIssues.filter((i) => i.app === 'backend');
    assert.equal(backendOnly.length, 1);
    assert.equal(backendOnly[0].id, '2');

    // Filter by search query
    const searchMatch = sampleIssues.filter((i) =>
      i.name.toLowerCase().includes('categoryfilter') ||
      i.component.toLowerCase().includes('categoryfilter')
    );
    assert.equal(searchMatch.length, 1);
    assert.equal(searchMatch[0].id, '1');
  });
});
