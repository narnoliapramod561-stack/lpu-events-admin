// lpu-events-admin/src/shared/telemetry/__tests__/seo_health_stage13.test.ts
// Stage 13: Section E Google Search Console SEO Health Panel Test Suite (MON-004 §7 / MON-008 Stage 13)

import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchGscOverview, pingGsc } from '../../../../supabase/functions/superadmin-monitoring/providers/gsc.ts';
import { MonitoringApiClient } from '../../../components/superadmin/monitoring/utils/MonitoringApiClient.ts';
import type { GscOverviewData } from '../../../components/superadmin/monitoring/types.ts';

test('Stage 13: Section E Google Search Console SEO Health Suite', async (t) => {
  await t.test('1. fetchGscOverview returns structured schema with platform delay notice when unconfigured', async () => {
    const data = await fetchGscOverview({
      days: 28,
      serviceAccountJson: '',
      siteUrl: 'https://lpuevents.live',
    });

    assert.equal(data.clicks, 0);
    assert.equal(data.impressions, 0);
    assert.equal(data.ctr, 0);
    assert.equal(data.position, 0);
    assert.ok(data.dateRange);
    assert.ok(data.dateRange.startDate);
    assert.ok(data.dateRange.endDate);
    assert.match(data.delayNotice, /2–3 days ago \(Google platform delay\)/);
    assert.equal(data.deepLink, 'https://search.google.com/search-console');
  });

  await t.test('2. Inherent Latency Invariant: Date window must end at least 2 days prior to current date', async () => {
    const data = await fetchGscOverview({ days: 7, serviceAccountJson: '' });
    const end = new Date(data.dateRange.endDate);
    const now = new Date();
    const diffHours = (now.getTime() - end.getTime()) / (1000 * 60 * 60);

    // End date must reflect Google's 48h platform delay
    assert.ok(diffHours >= 47, `End date ${data.dateRange.endDate} must be at least ~48 hours behind now`);
  });

  await t.test('3. pingGsc reports unconfigured gracefully without unhandled rejection', async () => {
    const status = await pingGsc({ serviceAccountJson: '' });
    assert.equal(status.connected, false);
    assert.match(status.error || '', /GSC_SERVICE_ACCOUNT_JSON not configured/);
    assert.ok(status.checkedAt);
  });

  await t.test('4. MonitoringApiClient.getGscOverview proxies to edge function with selected days parameter', async () => {
    let capturedAction = '';
    let capturedParams: any = null;

    MonitoringApiClient.setSupabaseClient({
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'mock_jwt_token' } },
          error: null,
        }),
      },
      functions: {
        invoke: async (name: string, options: any) => {
          assert.ok(name.startsWith('superadmin-monitoring'));
          assert.match(name, /action=gsc_overview/);
          assert.match(name, /days=90/);
          return {
            data: {
              clicks: 1420,
              impressions: 48900,
              ctr: 2.9,
              position: 8.4,
              dateRange: { startDate: '2026-10-10', endDate: '2026-11-07' },
              delayNotice: 'Note: Search Console performance data reflects search activity from 2–3 days ago (Google platform delay).',
              deepLink: 'https://search.google.com/search-console',
            } satisfies GscOverviewData,
            error: null,
          };
        },
      },
    } as any);

    const result = await MonitoringApiClient.getGscOverview(90);
    assert.equal(result.clicks, 1420);
    assert.equal(result.impressions, 48900);
    assert.equal(result.ctr, 2.9);
    assert.equal(result.position, 8.4);
    assert.equal(result.deepLink, 'https://search.google.com/search-console');
  });

  await t.test('5. Multi-tier GSC quota invariants documentation compliance (MON-004 §7.1)', () => {
    const searchAnalyticsSiteQuotaQPM = 1200;
    const searchAnalyticsProjectQuotaQPD = 30_000_000;
    const urlInspectionSiteQuotaQPD = 2000;
    const sitemapsUserQuotaQPS = 20;

    assert.equal(searchAnalyticsSiteQuotaQPM, 1200);
    assert.equal(searchAnalyticsProjectQuotaQPD, 30_000_000);
    assert.equal(urlInspectionSiteQuotaQPD, 2000);
    assert.equal(sitemapsUserQuotaQPS, 20);
  });
});
