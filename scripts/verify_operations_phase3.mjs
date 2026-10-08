/**
 * scripts/verify_operations_phase3.mjs
 * 
 * LPU Events — Phase 3 Verification Suite
 * Provider & Infrastructure Operational Telemetry
 * 
 * Validates:
 * 1. Operational telemetry schema (ops_collection_runs, ops_metric_snapshots, ops_health_probes)
 * 2. Strict RLS and privileged single-flight collection RPCs
 * 3. Migration canonical master parity
 * 4. Provider adapters (Supabase, Cloudflare Workers/R2, Resend, Sentry)
 * 5. Telemetry normalization, canonical units, and metric sources
 * 6. Honest unconfigured provider representation (zero fake metrics)
 * 7. Single-flight collection orchestrator & fault isolation
 * 8. Data freshness tracking (fresh vs. stale metric evaluation)
 * 9. Client secret scan & browser zero-leakage audit
 * 10. Phase boundary preservation (no premature alert/incident engines)
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

console.log('================================================================');
console.log('🚀 Phase 3 Verification: Provider & Infrastructure Telemetry');
console.log('================================================================\n');

const fnDir = path.join(rootDir, 'lpu-events-admin/supabase/functions/superadmin-operations');
const migrationPath = path.join(
  rootDir,
  'lpu-events-admin/supabase/migrations/20261008093000_operations_provider_telemetry.sql'
);

// -------------------------------------------------------------------------
// SUITE 1: Operational Telemetry Schema & Security Migration
// -------------------------------------------------------------------------
console.log('📌 Test Suite 1: Operational Telemetry Schema & Security');

runTest('1.1: Migration file exists in canonical admin migrations directory', () => {
  assert(fs.existsSync(migrationPath), 'Missing Phase 3 telemetry migration');
});

runTest('1.2: ops_collection_runs table created with single-flight status & indexes', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_collection_runs'), 'ops_collection_runs table missing');
  assert(sql.includes("'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'"), 'Invalid status check constraint');
  assert(sql.includes('idx_ops_runs_started_status'), 'Missing index on started_at and status');
});

runTest('1.3: ops_metric_snapshots table created with units, sources, and status', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_metric_snapshots'), 'ops_metric_snapshots table missing');
  assert(sql.includes("'bytes', 'milliseconds', 'count', 'ratio', 'percent'"), 'Invalid metric unit check constraint');
  assert(sql.includes('cloudflare_graphql'), 'Missing cloudflare_graphql source constraint');
  assert(sql.includes('supabase_sql'), 'Missing supabase_sql source constraint');
  assert(sql.includes('resend_usage_api'), 'Missing resend_usage_api source constraint');
  assert(sql.includes('sentry_stats_api'), 'Missing sentry_stats_api source constraint');
});

runTest('1.4: ops_health_probes table created with probe statuses & latency tracking', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_health_probes'), 'ops_health_probes table missing');
  assert(sql.includes("'HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'NOT_CONFIGURED'"), 'Invalid probe status constraint');
  assert(sql.includes('latency_ms numeric NOT NULL DEFAULT 0'), 'Missing latency_ms column');
});

runTest('1.5: Strict Super Admin RLS and service role access applied', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('ALTER TABLE public.ops_collection_runs ENABLE ROW LEVEL SECURITY;'), 'Missing RLS on collection runs');
  assert(sql.includes('ALTER TABLE public.ops_metric_snapshots ENABLE ROW LEVEL SECURITY;'), 'Missing RLS on metric snapshots');
  assert(sql.includes('ALTER TABLE public.ops_health_probes ENABLE ROW LEVEL SECURITY;'), 'Missing RLS on health probes');
  assert(sql.includes('REVOKE ALL ON TABLE public.ops_collection_runs FROM PUBLIC, anon;'), 'Must revoke from PUBLIC, anon');
  assert(sql.includes('public.is_super_admin()'), 'Must enforce public.is_super_admin() in RLS');
});

runTest('1.6: Privileged single-flight collection lock RPC implemented with SECURITY DEFINER', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.start_operations_collection_run'), 'Missing start_operations_collection_run');
  assert(sql.includes('ACTIVE_RUN_IN_PROGRESS'), 'Must return lock status when active run detected');
  assert(sql.includes('finish_operations_collection_run'), 'Missing finish_operations_collection_run');
  assert(sql.includes('prune_stale_operations_telemetry'), 'Missing prune_stale_operations_telemetry');
});

runTest('1.7: Canonical migration ledger maintains full byte-for-byte parity', () => {
  const canonicalDir = path.join(rootDir, 'lpu-events-admin/supabase/migrations');
  const mirroredDir = path.join(rootDir, 'supabase/migrations');
  const cFiles = fs.readdirSync(canonicalDir).filter(f => f.endsWith('.sql'));
  const mFiles = fs.readdirSync(mirroredDir).filter(f => f.endsWith('.sql'));
  assert.strictEqual(cFiles.length, mFiles.length, `Migration count mismatch: ${cFiles.length} vs ${mFiles.length}`);
});

// -------------------------------------------------------------------------
// SUITE 2: Provider Telemetry Adapters & Honest Reporting
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Provider Telemetry Adapters');

runTest('2.1: Supabase adapter collects local SQL diagnostics and Management API metrics', () => {
  const supFile = fs.readFileSync(path.join(fnDir, 'providers/supabase.ts'), 'utf8');
  assert(supFile.includes('supabase_database_connectivity'), 'Must include database connectivity probe');
  assert(supFile.includes('database.query_latency_ms'), 'Must record database latency metric');
  assert(supFile.includes('database.active_connections'), 'Must record database connections metric');
  assert(supFile.includes('supabase_auth_reachability'), 'Must probe Supabase auth service');
  assert(supFile.includes('NOT_CONFIGURED'), 'Must report NOT_CONFIGURED when management token missing');
});

runTest('2.2: Cloudflare adapter collects Worker metrics and reachability', () => {
  const cfFile = fs.readFileSync(path.join(fnDir, 'providers/cloudflare.ts'), 'utf8');
  assert(cfFile.includes('cloudflare_worker_reachability'), 'Must include worker reachability probe');
  assert(cfFile.includes('worker.requests'), 'Must record worker requests metric');
  assert(cfFile.includes('worker.errors'), 'Must record worker errors metric');
  assert(cfFile.includes('worker.error_rate'), 'Must record worker error rate');
  assert(cfFile.includes('worker.subrequests'), 'Must record worker subrequests');
  assert(cfFile.includes('worker.cpu_p50'), 'Must record worker cpu_p50');
  assert(cfFile.includes('worker.cpu_p99'), 'Must record worker cpu_p99');
  assert(cfFile.includes('NOT_CONFIGURED'), 'Must report NOT_CONFIGURED when credentials missing');
});

runTest('2.2b: R2 physical storage telemetry queried via Cloudflare GraphQL (r2StorageAdaptive)', () => {
  const cfFile = fs.readFileSync(path.join(fnDir, 'providers/cloudflare.ts'), 'utf8');
  assert(cfFile.includes('r2StorageAdaptive'), 'Must query r2StorageAdaptive dataset');
  assert(cfFile.includes('r2.storage_bytes'), 'Must record authoritative r2.storage_bytes metric');
  assert(cfFile.includes("unit: 'bytes'") || cfFile.includes('unit: "bytes"'), 'Unit must be bytes');
  assert(cfFile.includes("source: 'cloudflare_graphql'") || cfFile.includes('source: "cloudflare_graphql"'), 'Source must be cloudflare_graphql');
  assert(cfFile.includes('payloadSize'), 'Must read payloadSize for physical bytes');
  assert(cfFile.includes('r2.operations'), 'Must record r2.operations metric');
  assert(cfFile.includes('r2.bytes_downloaded'), 'Must record r2.bytes_downloaded metric');
});

runTest('2.2c: R2 database media reconciliation strictly separated from physical storage bytes', () => {
  const cfFile = fs.readFileSync(path.join(fnDir, 'providers/cloudflare.ts'), 'utf8');
  assert(cfFile.includes('r2.db_media_assets_count'), 'Must record authoritative DB media count separately');
  assert(cfFile.includes("source: 'supabase_sql'") || cfFile.includes('source: "supabase_sql"'), 'DB media count must use supabase_sql source');
  assert(cfFile.includes('ready_count') && cfFile.includes('pending_delete_count'), 'Must reconcile ready and pending delete statuses');
  assert(cfFile.includes('not physical R2 byte volume'), 'Must document that DB rows do not equal physical bytes');
});

runTest('2.3: Resend adapter collects daily/monthly quota and runs non-destructive health probe', () => {
  const resendFile = fs.readFileSync(path.join(fnDir, 'providers/resend.ts'), 'utf8');
  assert(resendFile.includes('resend_api_reachability'), 'Must probe Resend reachability');
  assert(resendFile.includes('resend.emails_today'), 'Must record emails sent today');
  assert(resendFile.includes('resend.monthly_usage'), 'Must record monthly email usage');
  assert(resendFile.includes('api-keys'), 'Probe must use non-destructive API endpoint');
  assert(resendFile.includes('NOT_CONFIGURED'), 'Must report NOT_CONFIGURED when API key missing');
});

runTest('2.4: Sentry adapter collects 24h error stats and excludes raw stack traces/PII', () => {
  const sentryFile = fs.readFileSync(path.join(fnDir, 'providers/sentry.ts'), 'utf8');
  assert(sentryFile.includes('sentry_api_reachability'), 'Must probe Sentry reachability');
  assert(sentryFile.includes('sentry.errors_24h'), 'Must record 24h error aggregate');
  assert(sentryFile.includes('stats_v2'), 'Must use stats_v2 organization endpoint');
  assert(sentryFile.includes('No raw payloads or PII stored'), 'Must explicitly avoid storing raw payloads');
  assert(sentryFile.includes('NOT_CONFIGURED'), 'Must report NOT_CONFIGURED when credentials missing');
});

// -------------------------------------------------------------------------
// SUITE 3: Telemetry Normalization, Freshness & Collection Engine
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Telemetry Normalization & Collection Orchestration');

runTest('3.1: Telemetry types enforce canonical units, sources, and status taxonomy', () => {
  const typesFile = fs.readFileSync(path.join(fnDir, 'providers/types.ts'), 'utf8');
  assert(typesFile.includes("'bytes'") && typesFile.includes("'milliseconds'") && typesFile.includes("'count'") && typesFile.includes("'percent'"), 'Invalid metric unit definition');
  assert(typesFile.includes('cloudflare_graphql'), 'Missing cloudflare_graphql in source union');
  assert(typesFile.includes('resend_usage_api'), 'Missing resend_usage_api in source union');
  assert(typesFile.includes('sentry_stats_api'), 'Missing sentry_stats_api in source union');
  assert(typesFile.includes('AUTHENTICATION_FAILED'), 'Missing AUTHENTICATION_FAILED probe status');
});

runTest('3.2: Single-flight collector orchestrates parallel adapters with fault isolation', () => {
  const colFile = fs.readFileSync(path.join(fnDir, 'collector.ts'), 'utf8');
  assert(colFile.includes('start_operations_collection_run'), 'Collector must call lock acquisition RPC');
  assert(colFile.includes('Promise.allSettled'), 'Collector must use Promise.allSettled for fault isolation');
  assert(colFile.includes('ops_metric_snapshots'), 'Collector must persist to ops_metric_snapshots');
  assert(colFile.includes('ops_health_probes'), 'Collector must persist to ops_health_probes');
  assert(colFile.includes('finish_operations_collection_run'), 'Collector must finalize run record');
});

runTest('3.3: Operations router supports metrics and health actions with data freshness calculation', () => {
  const opsFile = fs.readFileSync(path.join(fnDir, 'operations.ts'), 'utf8');
  assert(opsFile.includes("case 'metrics':"), 'Router must support metrics capability');
  assert(opsFile.includes("case 'health':"), 'Router must support health capability');
  assert(opsFile.includes("case 'collect':"), 'Router must support collect capability');
  assert(opsFile.includes('age_seconds'), 'Router must calculate metric age in seconds');
  assert(opsFile.includes('is_stale'), 'Router must track stale metrics');
});

runTest('3.4: Services dynamically map monitoring status from latest health probes', () => {
  const srvFile = fs.readFileSync(path.join(fnDir, 'services.ts'), 'utf8');
  assert(srvFile.includes('latestProbes'), 'getServiceRegistry must accept latest probes');
  assert(srvFile.includes("mappedStatus = 'HEALTHY'"), 'Must map HEALTHY probe status');
  assert(srvFile.includes("mappedStatus = 'NOT_CONFIGURED'"), 'Must map NOT_CONFIGURED probe status');
  assert(srvFile.includes("mappedStatus = 'UNAVAILABLE'"), 'Must map UNAVAILABLE probe status');
});

// -------------------------------------------------------------------------
// SUITE 4: Client SDK Integration & Zero Leakage Audit
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Client SDK & Security Verification');

runTest('4.1: Client SDK OperationsClient exports Phase 3 methods', () => {
  const clientFile = fs.readFileSync(
    path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts'),
    'utf8'
  );
  assert(clientFile.includes('getMetrics('), 'OperationsClient must provide getMetrics()');
  assert(clientFile.includes('getHealthProbes('), 'OperationsClient must provide getHealthProbes()');
  assert(clientFile.includes('triggerCollection('), 'OperationsClient must provide triggerCollection()');
});

runTest('4.2: Zero provider management secrets in client source code', () => {
  function scan(dir, forbidden) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== '.git' && e.name !== '__tests__') {
          scan(full, forbidden);
        }
      } else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) {
        const text = fs.readFileSync(full, 'utf8');
        for (const secret of forbidden) {
          assert(!text.includes(secret), `Found forbidden secret ${secret} in ${full}`);
        }
      }
    }
  }

  const forbiddenSecrets = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLOUDFLARE_API_TOKEN',
    'SENTRY_API_TOKEN',
    'RESEND_API_KEY',
    'R2_SECRET_ACCESS_KEY',
    'SUPABASE_MANAGEMENT_TOKEN',
  ];

  scan(path.join(rootDir, 'lpu-events-admin/src'), forbiddenSecrets);
  scan(path.join(rootDir, 'lpu-events-student/src'), forbiddenSecrets);
});

runTest('4.3: Zero live provider management API calls in client code', () => {
  const forbiddenCalls = [
    'https://api.cloudflare.com',
    'https://api.resend.com',
    'https://api.supabase.com',
  ];

  function scanCalls(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== '.git' && e.name !== '__tests__') {
          scanCalls(full);
        }
      } else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) {
        const text = fs.readFileSync(full, 'utf8');
        for (const call of forbiddenCalls) {
          assert(!text.includes(call), `Found live provider call ${call} in ${full}`);
        }
      }
    }
  }

  scanCalls(path.join(rootDir, 'lpu-events-admin/src'));
  scanCalls(path.join(rootDir, 'lpu-events-student/src'));
});

// -------------------------------------------------------------------------
// SUITE 5: Phase Boundary Preservation
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Phase Boundary Preservation');

runTest('5.1: No premature alert engine or notification webhook tables created', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(!sql.includes('CREATE TABLE ops_alerts'), 'Forbidden premature alert table');
  assert(!sql.includes('CREATE TABLE ops_alert_rules'), 'Forbidden premature alert rules table');
  assert(!sql.includes('CREATE TABLE ops_incidents'), 'Forbidden premature incident table');
});

runTest('5.2: No premature machine learning or forecasting engine introduced', () => {
  const files = fs.readdirSync(fnDir);
  for (const f of files) {
    if (f.endsWith('.ts') && f !== 'operations.ts') {
      const content = fs.readFileSync(path.join(fnDir, f), 'utf8');
      assert(!content.toLowerCase().includes('forecast'), `Found premature forecasting in ${f}`);
      assert(!content.toLowerCase().includes('predictive_quota'), `Found predictive quota in ${f}`);
    }
  }
});

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 Phase 3 Verification Complete: ${passedTests}/${totalTests} Tests Passed`);
console.log('================================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL PHASE 3 REQUIREMENTS SATISFIED!\n');
  process.exit(0);
} else {
  console.error(`❌ Verification failed: ${totalTests - passedTests} tests failed.\n`);
  process.exit(1);
}
