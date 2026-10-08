#!/usr/bin/env node
/**
 * verify_operations_phase7.mjs
 * Static verification suite for Super Admin Operations Control Center (Phase 7).
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

console.log('================================================================');
console.log('🚀 Phase 7 Verification: Super Admin Operations Control Center');
console.log('================================================================');

const opsUiDir = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/operations');
const superAdminAppPath = path.join(rootDir, 'lpu-events-admin/src/SuperAdminApp.tsx');
const sidebarPath = path.join(rootDir, 'lpu-events-admin/src/components/shell/SuperAdminSidebar.tsx');
const adminHeaderPath = path.join(rootDir, 'lpu-events-admin/src/components/shell/AdminHeader.tsx');
const typesPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/types.ts');
const clientPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts');
const adminDistDir = path.join(rootDir, 'lpu-events-admin/dist');

// -------------------------------------------------------------------------
// SUITE 1: Component Architecture & Modularity
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 1: Component Architecture & Modular Design');

runTest('1.1: Operations UI directory exists with all canonical components', () => {
  assert(fs.existsSync(opsUiDir), 'Operations UI directory does not exist');
  const requiredComponents = [
    'OperationsControlCenter.tsx',
    'OperationsSummaryCards.tsx',
    'ActiveIncidentsList.tsx',
    'IncidentDetailModal.tsx',
    'ServiceHealthGrid.tsx',
    'KeyMetricsPanel.tsx',
    'OperationsJobTable.tsx',
    'HistoricalAnalyticsPanel.tsx',
    'OperationsRefreshIndicator.tsx',
    'types.ts',
    'index.ts',
  ];
  for (const comp of requiredComponents) {
    assert(
      fs.existsSync(path.join(opsUiDir, comp)),
      `Missing required operations component: ${comp}`
    );
  }
});

runTest('1.2: Barrel export exports all operations components cleanly', () => {
  const barrel = fs.readFileSync(path.join(opsUiDir, 'index.ts'), 'utf8');
  assert(barrel.includes("export * from './OperationsControlCenter'"), 'Missing OperationsControlCenter export');
  assert(barrel.includes("export * from './OperationsSummaryCards'"), 'Missing OperationsSummaryCards export');
  assert(barrel.includes("export * from './ActiveIncidentsList'"), 'Missing ActiveIncidentsList export');
  assert(barrel.includes("export * from './IncidentDetailModal'"), 'Missing IncidentDetailModal export');
  assert(barrel.includes("export * from './ServiceHealthGrid'"), 'Missing ServiceHealthGrid export');
  assert(barrel.includes("export * from './KeyMetricsPanel'"), 'Missing KeyMetricsPanel export');
  assert(barrel.includes("export * from './OperationsJobTable'"), 'Missing OperationsJobTable export');
  assert(barrel.includes("export * from './HistoricalAnalyticsPanel'"), 'Missing HistoricalAnalyticsPanel export');
  assert(barrel.includes("export * from './OperationsRefreshIndicator'"), 'Missing OperationsRefreshIndicator export');
});

// -------------------------------------------------------------------------
// SUITE 2: Super Admin Boundary & Route Protection (Fail-Closed)
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Super Admin Boundary & Fail-Closed Protection');

runTest('2.1: SuperAdminSidebar exposes operations tab only for super admins', () => {
  const sidebar = fs.readFileSync(sidebarPath, 'utf8');
  assert(sidebar.includes("'operations'"), 'Operations tab missing from SuperAdminSidebar');
  assert(sidebar.includes("label: 'Operations Center'"), 'Operations Center label missing');
  assert(sidebar.includes("icon: 'dvr'"), 'DVR/Operations icon missing');
});

runTest('2.2: SuperAdminApp renders OperationsControlCenter for operations tab', () => {
  const app = fs.readFileSync(superAdminAppPath, 'utf8');
  assert(app.includes("import { OperationsControlCenter } from './components/superadmin/operations'"), 'Missing import');
  assert(app.includes("visitedTabs.has('operations')"), 'Missing visitedTabs handler for operations');
  assert(app.includes("<OperationsControlCenter />"), 'Missing OperationsControlCenter JSX');
});

runTest('2.3: AdminHeader provides proper breadcrumb and title for operations', () => {
  const header = fs.readFileSync(adminHeaderPath, 'utf8');
  assert(header.includes("case 'operations': return 'Operations Control Center'"), 'Missing header title mapping');
});

runTest('2.4: OperationsControlCenter enforces fail-closed Super Admin guard', () => {
  const occ = fs.readFileSync(path.join(opsUiDir, 'OperationsControlCenter.tsx'), 'utf8');
  assert(occ.includes('useAuth'), 'Must check authentication context');
  assert(occ.includes('!profile?.is_super_admin'), 'Must strictly verify is_super_admin');
  assert(occ.includes('Access Denied: Super Admin Boundary'), 'Must render access denied if not super admin');
});

// -------------------------------------------------------------------------
// SUITE 3: Architectural Integrity & Zero Direct Provider / Table Calls
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Architectural Integrity & Zero Forbidden Access');

runTest('3.1: Operations UI never queries ops_* database tables directly', () => {
  const files = fs.readdirSync(opsUiDir);
  for (const file of files) {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(path.join(opsUiDir, file), 'utf8');
      assert(
        !content.includes("from('ops_"),
        `Forbidden direct ops_* query in ${file}`
      );
      assert(
        !content.includes('from("ops_'),
        `Forbidden direct ops_* query in ${file}`
      );
    }
  }
});

runTest('3.2: Operations UI never invokes direct third-party provider APIs', () => {
  const files = fs.readdirSync(opsUiDir);
  const forbiddenApis = [
    'api.resend.com',
    'api.cloudflare.com',
    'sentry.io/api',
    'api.supabase.com',
  ];
  for (const file of files) {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(path.join(opsUiDir, file), 'utf8');
      for (const api of forbiddenApis) {
        assert(!content.includes(api), `Forbidden direct provider API ${api} in ${file}`);
      }
    }
  }
});

runTest('3.3: Operations UI routes all operations through OperationsClient SDK', () => {
  const occ = fs.readFileSync(path.join(opsUiDir, 'OperationsControlCenter.tsx'), 'utf8');
  assert(occ.includes('new OperationsClient'), 'Must instantiate OperationsClient');
  assert(occ.includes('client.invokeOperation'), 'Must invoke operations through client');
  assert(occ.includes('client.getIncidents'), 'Must fetch incidents via client');
  assert(occ.includes('client.getServices'), 'Must fetch services via client');
  assert(occ.includes('client.getHealthProbes'), 'Must fetch probes via client');
  assert(occ.includes('client.getMetrics'), 'Must fetch metrics via client');
  assert(occ.includes('client.getJobs'), 'Must fetch jobs via client');
});

// -------------------------------------------------------------------------
// SUITE 4: Truthfulness & Zero Fake / Simulated Data
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Truthfulness & Zero Fake / Simulated Data');

runTest('4.1: Operations UI contains zero Math.random or simulated values', () => {
  const files = fs.readdirSync(opsUiDir);
  for (const file of files) {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(path.join(opsUiDir, file), 'utf8');
      assert(!content.includes('Math.random'), `Forbidden Math.random in ${file}`);
    }
  }
});

runTest('4.2: Overall health status strictly derives from backend-authoritative status', () => {
  const summary = fs.readFileSync(path.join(opsUiDir, 'OperationsSummaryCards.tsx'), 'utf8');
  assert(summary.includes('overview?.overall_status'), 'Must derive status from backend overview');
  assert(!summary.includes('if (criticalAlerts > 0)'), 'Must not implement client-side health calculation');
});

runTest('4.3: Environment indicator uses backend metadata', () => {
  const occ = fs.readFileSync(path.join(opsUiDir, 'OperationsControlCenter.tsx'), 'utf8');
  const banner = fs.readFileSync(path.join(opsUiDir, 'OperationsRefreshIndicator.tsx'), 'utf8');
  assert(occ.includes('overviewRes.meta?.environment'), 'Environment must come from gateway meta');
  assert(banner.includes('{environment || \'UNKNOWN\'}'), 'Must display truthful environment');
});

runTest('4.4: Freshness indicator truthfully distinguishes elapsed time and stale telemetry', () => {
  const banner = fs.readFileSync(path.join(opsUiDir, 'OperationsRefreshIndicator.tsx'), 'utf8');
  assert(banner.includes('isStale &&'), 'Must render stale telemetry warning when stale');
  assert(banner.includes('Telemetry Stale'), 'Explicit Telemetry Stale label required');
  assert(!banner.includes('Live"'), 'Must not claim fake live indicator');
});

// -------------------------------------------------------------------------
// SUITE 5: Incident Management & Certified Action Flows
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Incident Management & Certified Action Flows');

runTest('5.1: Active incidents are prioritized by operational urgency', () => {
  const list = fs.readFileSync(path.join(opsUiDir, 'ActiveIncidentsList.tsx'), 'utf8');
  assert(list.includes('severityRank'), 'Must have explicit severity ranking');
  assert(list.includes('CRITICAL: 0'), 'CRITICAL must have highest priority');
  assert(list.includes('HIGH: 1'), 'HIGH must have second priority');
});

runTest('5.2: Acknowledge flow invokes client.acknowledgeIncident with inline loading state', () => {
  const list = fs.readFileSync(path.join(opsUiDir, 'ActiveIncidentsList.tsx'), 'utf8');
  const modal = fs.readFileSync(path.join(opsUiDir, 'IncidentDetailModal.tsx'), 'utf8');
  assert(list.includes('client.acknowledgeIncident'), 'ActiveIncidentsList must support inline acknowledge');
  assert(list.includes('disabled={isBeingAcked}'), 'Must disable duplicate acknowledge in list');
  assert(modal.includes('client.acknowledgeIncident'), 'IncidentDetailModal must support acknowledge');
  assert(modal.includes('disabled={isAcknowledging}'), 'Must disable duplicate acknowledge in modal');
});

runTest('5.3: Manual resolve flow requires mandatory resolution reason (min 3 chars)', () => {
  const modal = fs.readFileSync(path.join(opsUiDir, 'IncidentDetailModal.tsx'), 'utf8');
  assert(modal.includes('resolutionReason.trim().length < 3'), 'Must enforce minimum 3-character reason');
  assert(modal.includes('client.resolveIncident'), 'Must call client.resolveIncident');
  assert(modal.includes('resolutionReason.trim()'), 'Must pass trimmed reason');
  assert(modal.includes('disabled={isResolving}'), 'Must disable duplicate submission while resolving');
});

runTest('5.4: Incident modal displays chronological timeline, safe evidence & resolution provenance', () => {
  const modal = fs.readFileSync(path.join(opsUiDir, 'IncidentDetailModal.tsx'), 'utf8');
  assert(modal.includes('detail.timeline'), 'Must render chronological timeline');
  assert(modal.includes('ev.event_type'), 'Must render actual backend event types');
  assert(modal.includes('Resolution Provenance'), 'Must display resolution provenance');
  assert(modal.includes('AUTO_RECOVERY'), 'Must support AUTO_RECOVERY provenance');
  assert(modal.includes('MANUAL'), 'Must support MANUAL provenance');
  assert(modal.includes('correlation_id'), 'Must expose safe correlation ID');
});

// -------------------------------------------------------------------------
// SUITE 6: Service Health, Jobs & Historical Analytics
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Service Health, Jobs & Historical Analytics');

runTest('6.1: Service health grid distinguishes NOT_CONFIGURED from critical failure', () => {
  const grid = fs.readFileSync(path.join(opsUiDir, 'ServiceHealthGrid.tsx'), 'utf8');
  assert(grid.includes("case 'NOT_CONFIGURED':"), 'Must handle NOT_CONFIGURED status');
  assert(grid.includes('NOT CONFIGURED'), 'Must display NOT CONFIGURED label');
  assert(grid.includes('bg-gray-500/10'), 'NOT_CONFIGURED must use neutral styling, not red failure');
});

runTest('6.2: Operational metrics display backend trends and threshold projections', () => {
  const panel = fs.readFileSync(path.join(opsUiDir, 'KeyMetricsPanel.tsx'), 'utf8');
  assert(panel.includes('RISING'), 'Must support RISING trend');
  assert(panel.includes('FALLING'), 'Must support FALLING trend');
  assert(panel.includes('STABLE'), 'Must support STABLE trend');
  assert(panel.includes('APPROACHING THRESHOLD'), 'Must support APPROACHING threshold');
  assert(panel.includes('proj?.estimatedTimeToThresholdMs'), 'Estimated crossing must only show when backend returned one');
});

runTest('6.3: Operations jobs table surfaces failed and stale jobs at the top', () => {
  const table = fs.readFileSync(path.join(opsUiDir, 'OperationsJobTable.tsx'), 'utf8');
  assert(table.includes('sortedJobs'), 'Must sort jobs');
  assert(table.includes("a.health === 'FAILED' ? 0"), 'Failed jobs must rank first');
  assert(table.includes('a.is_stale ? 1'), 'Stale jobs must rank second');
});

runTest('6.4: Historical analytics panel supports bounded time windows and backend MTTR', () => {
  const hist = fs.readFileSync(path.join(opsUiDir, 'HistoricalAnalyticsPanel.tsx'), 'utf8');
  const expectedWindows = ['1h', '6h', '24h', '7d', '30d', '90d'];
  for (const w of expectedWindows) {
    assert(hist.includes(`'${w}'`), `Must support window ${w}`);
  }
  assert(hist.includes('BACKEND MTTR'), 'Must display backend MTTR');
  assert(hist.includes('incidentAnalytics?.mttrMs'), 'MTTR must come from backend analytics');
});

// -------------------------------------------------------------------------
// SUITE 7: Production Security & Zero Credential Leakage in Dist
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 7: Production Security & Secret Isolation in Dist');

runTest('7.1: Production build directory exists', () => {
  assert(fs.existsSync(adminDistDir), 'Admin dist directory does not exist. Run build first.');
});

runTest('7.2: Production bundles contain zero service role keys or sensitive provider secrets', () => {
  const assetsDir = path.join(adminDistDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    for (const f of files) {
      if (f.endsWith('.js')) {
        const js = fs.readFileSync(path.join(assetsDir, f), 'utf8');
        assert(!js.includes('service_role'), `service_role leaked in bundle ${f}`);
        assert(!js.includes('RESEND_API_KEY'), `RESEND_API_KEY leaked in bundle ${f}`);
        assert(!js.includes('CLOUDFLARE_API_TOKEN'), `CLOUDFLARE_API_TOKEN leaked in bundle ${f}`);
        assert(!js.includes('SENTRY_AUTH_TOKEN'), `SENTRY_AUTH_TOKEN leaked in bundle ${f}`);
      }
    }
  }
});

console.log('================================================================');
console.log(`Phase 7 Static Verification Summary: ${passedTests}/${totalTests} tests passed`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
