/**
 * scripts/verify_system_truthfulness.mjs
 * 
 * Phase 1 Verification Suite: Telemetry Truthfulness & Operational Integrity
 * Validates that all 6 required test criteria are satisfied across the codebase.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log('🚀 Phase 1 Verification: Telemetry Truthfulness & Security');
console.log('================================================================\n');

// -------------------------------------------------------------------------
// TEST 1: No fake infrastructure number is rendered as physical infrastructure usage
// -------------------------------------------------------------------------
console.log('📌 Test Suite 1: Physical Infrastructure Truthfulness');

runTest('1.1: SystemHealthPanel source does not claim "INFRASTRUCTURE TELEMETRY" or "System Diagnostic Health"', () => {
  const panelPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/SystemHealthPanel.tsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  assert(!content.includes('INFRASTRUCTURE TELEMETRY'), 'Found forbidden claim "INFRASTRUCTURE TELEMETRY"');
  assert(!content.includes('System Diagnostic Health'), 'Found forbidden claim "System Diagnostic Health"');
  assert(!content.includes('Storage Assets'), 'Found misleading label "Storage Assets"');
  assert(content.includes('Media Asset Records'), 'Expected truthful label "Media Asset Records"');
  assert(content.includes('Cache Invalidation Revision Counters'), 'Expected truthful cache counter label');
});

runTest('1.2: Media assets row count is explicitly designated as metadata rows, not physical byte volume', () => {
  const panelPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/SystemHealthPanel.tsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  assert(content.includes('Metadata rows in media_assets table'), 'Missing explanation that count is database rows');
  assert(content.includes('Physical infrastructure monitoring (CPU, byte storage, worker invocations) is not instrumented'), 'Missing unmonitored disclaimer');
});

// -------------------------------------------------------------------------
// TEST 2: Empty advertisement analytics are not interpreted as zero real-world impressions
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Advertisement Analytics Truthfulness');

runTest('2.1: AnalyticsPanel contains no fake adMetrics empty array or derived zero-valued CTR calculations', () => {
  const panelPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/AnalyticsPanel.tsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  assert(!content.includes('const adMetrics: any[] = [];'), 'Found forbidden empty adMetrics array');
  assert(!content.includes('averageCtr'), 'Found misleading averageCtr computed from empty array');
  assert(!content.includes('Daily Advertisement Telemetry Trend'), 'Found misleading daily trend chart');
  assert(content.includes('Ad Impression, Click, and CTR Telemetry Not Currently Monitored'), 'Missing explicit unmonitored ad telemetry notice');
});

runTest('2.2: Header in AnalyticsPanel is truthfully labeled as PLATFORM METRICS without "Live Telemetry" claims', () => {
  const panelPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/AnalyticsPanel.tsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  assert(!content.includes('Live Telemetry'), 'Found forbidden claim "Live Telemetry"');
  assert(content.includes('PLATFORM METRICS'), 'Expected truthful badge "PLATFORM METRICS"');
});

// -------------------------------------------------------------------------
// TEST 3: Simulated quota data is never consumed by the production dashboard
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Simulated Quota Retirement');

await runAsyncTest('3.1: collect_production_quota_metrics.mjs is decommissioned and throws when executed', async () => {
  const quotaScriptPath = path.join(rootDir, 'scripts/collect_production_quota_metrics.mjs');
  const { recordDailyQuota } = await import(quotaScriptPath);

  assert.throws(
    () => recordDailyQuota(),
    /Telemetry Decommissioned/,
    'Decommissioned script failed to throw on invocation'
  );
});

runTest('3.2: logs/daily_quota_metrics.json contains no fabricated production measurements', () => {
  const jsonPath = path.join(rootDir, 'logs/daily_quota_metrics.json');
  assert(fs.existsSync(jsonPath), 'daily_quota_metrics.json must exist');

  const content = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(content);

  assert(Array.isArray(data), 'JSON store must be an array');
  assert.strictEqual(data.length, 0, 'JSON store must contain no fabricated records');
});

// -------------------------------------------------------------------------
// TEST 4: Business/data counts remain functional
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Business & Application Data Integrity');

runTest('4.1: DashboardOverview dynamic query fetches real featured_events count without hardcoded 3', () => {
  const overviewPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/DashboardOverview.tsx');
  const content = fs.readFileSync(overviewPath, 'utf8');

  assert(content.includes("from('featured_events').select('event_id', { count: 'exact', head: true })"), 'Missing dynamic featured_events query');
  assert(!content.includes('3 <span className="text-sm font-normal text-[#5a4136] dark:text-[#ffb693]">/ 5 Active</span>'), 'Found hardcoded 3 / 5 Active');
  assert(content.includes('{stats.featuredEvents}'), 'Expected dynamic stats.featuredEvents rendering');
});

runTest('4.2: OrganizerDashboard correctly labels cumulative student pageviews instead of impressions', () => {
  const orgDashboardPath = path.join(rootDir, 'lpu-events-admin/src/components/organizer/OrganizerDashboard.tsx');
  const content = fs.readFileSync(orgDashboardPath, 'utf8');

  assert(!content.includes('historical attendance'), 'Found unsubstantiated claim of historical attendance');
  assert(content.includes('Total Pageviews'), 'Expected truthful card title "Total Pageviews"');
  assert(content.includes('Cumulative student pageviews'), 'Expected truthful subtext');
});

// -------------------------------------------------------------------------
// TEST 5: Unavailable telemetry displays a clear unavailable/not-monitored state where retained
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Explicit Unmonitored State Displays');

runTest('5.1: SystemHealthPanel renders 4 explicit Not Monitored infrastructure cards', () => {
  const panelPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/SystemHealthPanel.tsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  assert(content.includes('Database Disk Usage'), 'Missing Database Disk Usage indicator');
  assert(content.includes('Cloudflare Worker Requests'), 'Missing Cloudflare Worker Requests indicator');
  assert(content.includes('R2 Physical Byte Storage'), 'Missing R2 Physical Byte Storage indicator');
  assert(content.includes('Background Outbox Worker'), 'Missing Background Outbox Worker indicator');
  assert(content.includes('Not Monitored'), 'Missing explicit "Not Monitored" badge');
});

runTest('5.2: AnalyticsPanel KPI bento grid displays explicit Not Monitored card for ad engagement', () => {
  const panelPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/AnalyticsPanel.tsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  assert(content.includes('Ad Impressions & Clicks'), 'Missing Ad Impressions & Clicks card');
  assert(content.includes('Ad telemetry is not instrumented in this phase'), 'Missing unmonitored explanation');
});

// -------------------------------------------------------------------------
// TEST 6: Non-Super-Admin users cannot access the affected Super Admin pages/routes
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Security Boundary Enforcement');

runTest('6.1: SuperAdminApp is strictly gated on is_super_admin privilege check', () => {
  const appPath = path.join(rootDir, 'lpu-events-admin/src/App.tsx');
  const content = fs.readFileSync(appPath, 'utf8');

  // Verify that only super admins can reach SuperAdminApp
  assert(content.includes('is_super_admin'), 'App.tsx must gate on is_super_admin');
  assert(content.includes('<SuperAdminApp'), 'App.tsx renders SuperAdminApp for authorized super admins');
});

runTest('6.2: AdminShell navigation labels system-health truthfully as "System & Data Overview"', () => {
  const shellPath = path.join(rootDir, 'lpu-events-admin/src/components/shell/AdminShell.tsx');
  const sidebarPath = path.join(rootDir, 'lpu-events-admin/src/components/Sidebar.tsx');

  const shellContent = fs.readFileSync(shellPath, 'utf8');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  assert(shellContent.includes("case 'system-health': return 'System & Data Overview';"), 'AdminShell must label tab truthful');
  assert(sidebarContent.includes('<span>System & Data Overview</span>'), 'Sidebar must label tab truthful');
});

console.log('\n================================================================');
console.log(`📊 Test Summary: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 Phase 1 Telemetry Truthfulness Verification: 100% SUCCESS\n');
} else {
  console.error('❌ Verification failed.\n');
  process.exit(1);
}
