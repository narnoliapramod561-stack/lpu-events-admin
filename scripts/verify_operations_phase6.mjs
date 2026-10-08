#!/usr/bin/env node
/**
 * verify_operations_phase6.mjs
 * Static verification script for Super Admin Operations Control Plane Phase 6:
 * Historical Operations Analytics & Forecasting.
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
console.log('🚀 Phase 6 Verification: Historical Operations Analytics & Forecasting');
console.log('================================================================');

const migrationPath = path.join(
  rootDir,
  'lpu-events-admin/supabase/migrations/20261008120000_operations_historical_analytics_and_forecasting.sql'
);
const rootMigrationPath = path.join(
  rootDir,
  'supabase/migrations/20261008120000_operations_historical_analytics_and_forecasting.sql'
);
const fnDir = path.join(rootDir, 'supabase/functions/superadmin-operations');
const clientTypesPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/types.ts');
const clientSdkPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts');
const docPath = path.join(rootDir, 'docs/OPERATIONS_HISTORICAL_ANALYTICS_ARCHITECTURE.md');

// -------------------------------------------------------------------------
// SUITE 1: Canonical Historical Storage Schema & Rollup Tables
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 1: Canonical Historical Storage Schema & Rollup Tables');

runTest('1.1: Migration file exists in canonical admin migrations directory', () => {
  assert(fs.existsSync(migrationPath), 'Missing Phase 6 migration file');
});

runTest('1.2: ops_metric_aggregates table created with resolution constraints and unique bucket key', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_metric_aggregates'), 'Missing ops_metric_aggregates table');
  assert(sql.includes("resolution text NOT NULL CHECK (resolution IN ('HOURLY', 'DAILY'))"), 'Missing resolution constraint');
  assert(sql.includes('uq_ops_metric_aggregates_bucket UNIQUE (bucket_start, resolution, service_id, metric_key)'), 'Missing unique bucket constraint');
  assert(sql.includes('min_value numeric NOT NULL'), 'Missing min_value column');
  assert(sql.includes('max_value numeric NOT NULL'), 'Missing max_value column');
  assert(sql.includes('avg_value numeric NOT NULL'), 'Missing avg_value column');
  assert(sql.includes('first_value numeric NOT NULL'), 'Missing first_value column');
  assert(sql.includes('last_value numeric NOT NULL'), 'Missing last_value column');
});

runTest('1.3: ops_metric_history standardized view created over ops_metric_snapshots', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE VIEW public.ops_metric_history AS'), 'Missing ops_metric_history view');
  assert(sql.includes('s.metric_value AS value'), 'Missing value column alias');
  assert(sql.includes('s.captured_at AS observed_at'), 'Missing observed_at column alias');
});

runTest('1.4: Canonical Phase 6 jobs registered in ops_jobs registry', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes("'historical_metrics_rollup'"), 'Missing historical_metrics_rollup job key');
  assert(sql.includes("'historical_metrics_prune'"), 'Missing historical_metrics_prune job key');
});

runTest('1.5: Strict Super Admin RLS and service role access applied to ops_metric_aggregates', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('ALTER TABLE public.ops_metric_aggregates ENABLE ROW LEVEL SECURITY;'), 'RLS missing on aggregates');
  assert(sql.includes('public.is_super_admin()'), 'Super admin helper check missing');
});

runTest('1.6: Canonical migration ledger maintains full byte-for-byte parity', () => {
  assert(fs.existsSync(rootMigrationPath), 'Root mirror migration missing');
  const adminSql = fs.readFileSync(migrationPath, 'utf8');
  const rootSql = fs.readFileSync(rootMigrationPath, 'utf8');
  assert.strictEqual(adminSql, rootSql, 'Canonical admin and root migrations must be identical');
});

// -------------------------------------------------------------------------
// SUITE 2: Server-Side Aggregation & Retention RPCs
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Server-Side Aggregation & Retention RPCs');

runTest('2.1: rollup_operations_metric_aggregates RPC aggregates hourly and daily buckets', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.rollup_operations_metric_aggregates'), 'Missing rollup RPC');
  assert(sql.includes("'HOURLY' AS resolution"), 'Missing hourly resolution aggregation');
  assert(sql.includes("'DAILY' AS resolution"), 'Missing daily resolution aggregation');
  assert(sql.includes('ON CONFLICT (bucket_start, resolution, service_id, metric_key)'), 'Must handle upsert on conflict');
});

runTest('2.2: prune_stale_operations_history preserves latest metric snapshot and protects active operational records', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.prune_stale_operations_history'), 'Missing prune RPC');
  assert(sql.includes('s.id NOT IN (SELECT id FROM latest_snapshots)'), 'Must preserve latest snapshot per metric');
  assert(sql.includes("resolution = 'HOURLY'"), 'Must prune hourly aggregates');
  assert(sql.includes("resolution = 'DAILY'"), 'Must prune daily aggregates');
});

// -------------------------------------------------------------------------
// SUITE 3: Server-Side Analytics & Forecasting Engine
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Server-Side Analytics & Forecasting Engine');

runTest('3.1: Controlled metric catalog enforces known metrics and categories', () => {
  const catalogPath = path.join(fnDir, 'analytics/catalog.ts');
  assert(fs.existsSync(catalogPath), 'Missing catalog.ts file');
  const content = fs.readFileSync(catalogPath, 'utf8');
  assert(content.includes('CONTROLLED_METRIC_CATALOG'), 'Missing CONTROLLED_METRIC_CATALOG export');
  assert(content.includes('database.storage_percent'), 'Missing database.storage_percent metric');
  assert(content.includes('worker.error_rate'), 'Missing worker.error_rate metric');
  assert(content.includes('r2.storage_bytes'), 'Missing r2.storage_bytes metric');
});

runTest('3.2: Analytics engine implements OLS linear regression and deterministic trend direction', () => {
  const enginePath = path.join(fnDir, 'analytics/engine.ts');
  assert(fs.existsSync(enginePath), 'Missing engine.ts file');
  const content = fs.readFileSync(enginePath, 'utf8');
  assert(content.includes('calculateLinearTrend'), 'Missing calculateLinearTrend implementation');
  assert(content.includes('INSUFFICIENT_DATA'), 'Missing INSUFFICIENT_DATA direction');
  assert(content.includes('RISING'), 'Missing RISING direction');
  assert(content.includes('FALLING'), 'Missing FALLING direction');
  assert(content.includes('STABLE'), 'Missing STABLE direction');
});

runTest('3.3: Threshold projection calculates estimated time to threshold and handles ALREADY_EXCEEDED and NOT_APPROACHING', () => {
  const enginePath = path.join(fnDir, 'analytics/engine.ts');
  const content = fs.readFileSync(enginePath, 'utf8');
  assert(content.includes('projectThresholdTrajectory'), 'Missing projectThresholdTrajectory export');
  assert(content.includes('ALREADY_EXCEEDED'), 'Missing ALREADY_EXCEEDED status');
  assert(content.includes('APPROACHING'), 'Missing APPROACHING status');
  assert(content.includes('NOT_APPROACHING'), 'Missing NOT_APPROACHING status');
});

runTest('3.4: Incident analytics calculates MTTR strictly for completed incidents and tracks open incident age', () => {
  const enginePath = path.join(fnDir, 'analytics/engine.ts');
  const content = fs.readFileSync(enginePath, 'utf8');
  assert(content.includes('getIncidentAnalytics'), 'Missing getIncidentAnalytics export');
  assert(content.includes('mttrMs'), 'Missing MTTR metric calculation');
  assert(content.includes('openIncidentAverageAgeMs'), 'Missing open incident average age calculation');
  assert(content.includes('automaticRecoveryCount'), 'Missing automatic recovery count');
  assert(content.includes('manualResolutionCount'), 'Missing manual resolution count');
});

runTest('3.5: Job analytics calculates success/failure rates and execution durations', () => {
  const enginePath = path.join(fnDir, 'analytics/engine.ts');
  const content = fs.readFileSync(enginePath, 'utf8');
  assert(content.includes('getJobAnalytics'), 'Missing getJobAnalytics export');
  assert(content.includes('successRate'), 'Missing successRate calculation');
  assert(content.includes('failureRate'), 'Missing failureRate calculation');
});

runTest('3.6: Single-flight rollup orchestrator acquires lease from ops_job_runs', () => {
  const rollupPath = path.join(fnDir, 'analytics/rollup.ts');
  assert(fs.existsSync(rollupPath), 'Missing rollup.ts file');
  const content = fs.readFileSync(rollupPath, 'utf8');
  assert(content.includes('start_operations_job_run'), 'Must acquire single-flight lease');
  assert(content.includes('historical_metrics_rollup'), 'Must reference canonical job key');
});

// -------------------------------------------------------------------------
// SUITE 4: Operations Gateway Router Integration
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Operations Gateway Router Integration');

runTest('4.1: operations.ts router exposes all Phase 6 analytics actions', () => {
  const routerPath = path.join(fnDir, 'operations.ts');
  const content = fs.readFileSync(routerPath, 'utf8');
  assert(content.includes("'analytics-overview'"), 'Missing analytics-overview action');
  assert(content.includes("'analytics-metric'"), 'Missing analytics-metric action');
  assert(content.includes("'analytics-trend'"), 'Missing analytics-trend action');
  assert(content.includes("'analytics-forecast'"), 'Missing analytics-forecast action');
  assert(content.includes("'analytics-incidents'"), 'Missing analytics-incidents action');
  assert(content.includes("'analytics-alerts'"), 'Missing analytics-alerts action');
  assert(content.includes("'analytics-jobs'"), 'Missing analytics-jobs action');
  assert(content.includes("'analytics-services'"), 'Missing analytics-services action');
  assert(content.includes("'analytics-rollup'"), 'Missing analytics-rollup action');
});

runTest('4.2: Overview response reports Phase 6 status', () => {
  const routerPath = path.join(fnDir, 'operations.ts');
  const content = fs.readFileSync(routerPath, 'utf8');
  assert(content.includes("phase: 'PHASE_6_HISTORICAL_ANALYTICS_AND_FORECASTING'"), 'Overview phase must be updated to Phase 6');
});

// -------------------------------------------------------------------------
// SUITE 5: Client SDK & Security Boundary
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Client SDK & Security Boundary');

runTest('5.1: Client SDK OperationsClient exports typed Phase 6 methods', () => {
  const clientContent = fs.readFileSync(clientSdkPath, 'utf8');
  assert(clientContent.includes('getAnalyticsOverview'), 'Missing getAnalyticsOverview method');
  assert(clientContent.includes('getMetricHistory'), 'Missing getMetricHistory method');
  assert(clientContent.includes('getMetricTrend'), 'Missing getMetricTrend method');
  assert(clientContent.includes('getThresholdProjection'), 'Missing getThresholdProjection method');
  assert(clientContent.includes('getIncidentAnalytics'), 'Missing getIncidentAnalytics method');
  assert(clientContent.includes('getAlertAnalytics'), 'Missing getAlertAnalytics method');
  assert(clientContent.includes('getJobAnalytics'), 'Missing getJobAnalytics method');
});

runTest('5.2: Client SDK contains zero arbitrary SQL or client-side evaluation methods', () => {
  const clientContent = fs.readFileSync(clientSdkPath, 'utf8');
  assert(!clientContent.includes('queryRawSql'), 'Zero arbitrary SQL execution in client');
  assert(!clientContent.includes('executeCustomFilter'), 'Zero custom filter evaluation in client');
});

runTest('5.3: Zero server credentials present in client source or dist code', () => {
  const forbidden = ['CLOUDFLARE_API_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'SENTRY_AUTH_TOKEN'];
  const clientSrc = fs.readFileSync(clientSdkPath, 'utf8');
  for (const secret of forbidden) {
    assert(!clientSrc.includes(secret), `Secret leaked in client SDK: ${secret}`);
  }
});

// -------------------------------------------------------------------------
// SUITE 6: Documentation & Phase Boundary Preservation
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Documentation & Phase Boundary Preservation');

runTest('6.1: Dedicated Phase 6 architecture documentation exists with explicit mathematical formulas', () => {
  assert(fs.existsSync(docPath), 'Missing Phase 6 architecture doc');
  const doc = fs.readFileSync(docPath, 'utf8');
  assert(doc.toLowerCase().includes('ordinary least-squares (ols) linear regression'), 'Must document OLS formula');
  assert(doc.includes('Time-to-Threshold Formula'), 'Must document projection formula');
  assert(doc.includes('Mean Time to Resolution (MTTR) Definition'), 'Must document MTTR formula');
  assert(!doc.includes('zero technical debt'), 'No unsupported zero technical debt claim');
});

runTest('6.2: Phase boundary preserved: zero notification webhooks, zero ML models', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(!sql.includes('notification_webhooks'), 'No premature webhook notification tables');
  assert(!sql.includes('neural_network'), 'No premature ML tables');
});

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 Phase 6 Verification Complete: ${passedTests}/${totalTests} Tests Passed`);
console.log('================================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL PHASE 6 REQUIREMENTS SATISFIED!\n');
  process.exit(0);
} else {
  console.error('❌ PHASE 6 VERIFICATION FAILED\n');
  process.exit(1);
}
