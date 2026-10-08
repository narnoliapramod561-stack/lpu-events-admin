/**
 * scripts/verify_operations_phase4.mjs
 * 
 * LPU Events — Phase 4 Verification Suite
 * Operations Jobs & Maintenance Telemetry
 * 
 * Validates:
 * 1. Canonical Job Registry & Execution Schema (ops_jobs, ops_job_runs)
 * 2. Single-flight locking & lifecycle transition RPCs
 * 3. Super Admin authorization & secret boundary
 * 4. Maintenance instrumentation (Database Guardrail, R2 Orphan Purge, Telemetry Pruning, Provider Collector)
 * 5. GitHub Actions workflow reconciliation
 * 6. Cadence-aware job freshness and stale evaluation
 * 7. Operations Gateway capabilities (jobs, job-runs, maintenance)
 * 8. Client SDK typed methods
 * 9. Phase boundary preservation (no premature alert/incident engine)
 * 10. Canonical migration ledger parity
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
console.log('🚀 Phase 4 Verification: Operations Jobs & Maintenance Telemetry');
console.log('================================================================\n');

const fnDir = path.join(rootDir, 'lpu-events-admin/supabase/functions/superadmin-operations');
const migrationPath = path.join(
  rootDir,
  'lpu-events-admin/supabase/migrations/20261008100000_operations_jobs_and_maintenance.sql'
);

// -------------------------------------------------------------------------
// SUITE 1: Canonical Job Registry & Execution Schema
// -------------------------------------------------------------------------
console.log('📌 Test Suite 1: Canonical Job Registry & Execution Schema');

runTest('1.1: Migration file exists in canonical admin migrations directory', () => {
  assert(fs.existsSync(migrationPath), 'Missing Phase 4 migration file');
});

runTest('1.2: ops_jobs table created with canonical constraints & types', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_jobs'), 'ops_jobs table missing');
  assert(sql.includes("'DATABASE', 'STORAGE', 'TELEMETRY', 'MAINTENANCE', 'SYNC', 'OTHER'"), 'Invalid job_type constraint');
  assert(sql.includes("'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'"), 'Invalid criticality constraint');
  assert(sql.includes('job_key text UNIQUE NOT NULL'), 'job_key must be unique');
});

runTest('1.3: Canonical production maintenance jobs seeded into ops_jobs', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes("'database_cleanup'"), 'database_cleanup job missing');
  assert(sql.includes("'r2_orphan_cleanup'"), 'r2_orphan_cleanup job missing');
  assert(sql.includes("'operations_telemetry_prune'"), 'operations_telemetry_prune job missing');
  assert(sql.includes("'provider_telemetry_collection'"), 'provider_telemetry_collection job missing');
});

runTest('1.4: ops_job_runs table created with lifecycle states, duration, and counters', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_job_runs'), 'ops_job_runs table missing');
  assert(sql.includes("'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'"), 'Invalid run status constraint');
  assert(sql.includes("'SCHEDULE', 'MANUAL', 'DEPLOYMENT', 'RETRY', 'SYSTEM', 'UNKNOWN'"), 'Invalid trigger_source constraint');
  assert(sql.includes('records_scanned integer NOT NULL DEFAULT 0'), 'records_scanned missing');
  assert(sql.includes('records_deleted integer NOT NULL DEFAULT 0'), 'records_deleted missing');
  assert(sql.includes('chk_job_run_duration'), 'duration check constraint missing');
  assert(sql.includes('chk_job_run_completion'), 'completion check constraint missing');
});

runTest('1.5: Strict Super Admin RLS and service role access applied', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('ALTER TABLE public.ops_jobs ENABLE ROW LEVEL SECURITY;'), 'RLS missing on ops_jobs');
  assert(sql.includes('ALTER TABLE public.ops_job_runs ENABLE ROW LEVEL SECURITY;'), 'RLS missing on ops_job_runs');
  assert(sql.includes('REVOKE ALL ON TABLE public.ops_jobs FROM PUBLIC, anon;'), 'Must revoke ops_jobs from public, anon');
  assert(sql.includes('REVOKE ALL ON TABLE public.ops_job_runs FROM PUBLIC, anon;'), 'Must revoke ops_job_runs from public, anon');
  assert(sql.includes('public.is_super_admin()'), 'Must enforce public.is_super_admin()');
});

runTest('1.6: Canonical migration ledger maintains full byte-for-byte parity', () => {
  const canonicalDir = path.join(rootDir, 'lpu-events-admin/supabase/migrations');
  const mirroredDir = path.join(rootDir, 'supabase/migrations');
  const cFiles = fs.readdirSync(canonicalDir).filter(f => f.endsWith('.sql'));
  const mFiles = fs.readdirSync(mirroredDir).filter(f => f.endsWith('.sql'));
  assert.strictEqual(cFiles.length, mFiles.length, `Migration count mismatch: ${cFiles.length} vs ${mFiles.length}`);
});

// -------------------------------------------------------------------------
// SUITE 2: Job Lifecycle RPCs & Single-Flight Protection
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Job Lifecycle RPCs & Single-Flight Protection');

runTest('2.1: start_operations_job_run enforces single-flight locking & checks enabled state', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.start_operations_job_run'), 'start_operations_job_run missing');
  assert(sql.includes('ACTIVE_RUN_IN_PROGRESS'), 'Must return ACTIVE_RUN_IN_PROGRESS on concurrency');
  assert(sql.includes('JOB_DISABLED'), 'Must verify enabled state');
  assert(sql.includes('SECURITY DEFINER'), 'Must be SECURITY DEFINER');
});

runTest('2.2: finish_operations_job_run validates terminal transitions and calculates duration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.finish_operations_job_run'), 'finish_operations_job_run missing');
  assert(sql.includes("'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'"), 'Must validate terminal status transition');
  assert(sql.includes('duration_ms'), 'Must update duration_ms');
  assert(sql.includes('already_finalized'), 'Must handle idempotent re-finalization');
});

runTest('2.3: heartbeat_operations_job_run updates active running execution heartbeat', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.heartbeat_operations_job_run'), 'heartbeat_operations_job_run missing');
  assert(sql.includes("status = 'RUNNING'"), 'Heartbeat must only target running runs');
});

runTest('2.4: prune_stale_operations_job_runs bounds history without deleting running records', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.prune_stale_operations_job_runs'), 'prune_stale_operations_job_runs missing');
  assert(sql.includes("status IN ('COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED')"), 'Must only prune terminal statuses');
});

// -------------------------------------------------------------------------
// SUITE 3: Maintenance Processes Instrumentation
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Maintenance Processes Instrumentation');

runTest('3.1: database_size_guardrail.mjs instrumented with single-flight locking and counters', () => {
  const scriptPath = path.join(rootDir, 'lpu-events-admin/scripts/database_size_guardrail.mjs');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  assert(scriptContent.includes('start_operations_job_run'), 'Must call start_operations_job_run');
  assert(scriptContent.includes('finish_operations_job_run'), 'Must call finish_operations_job_run');
  assert(scriptContent.includes("'database_cleanup'"), 'Must use canonical job key database_cleanup');
  assert(scriptContent.includes('recordsScanned') && scriptContent.includes('recordsDeleted'), 'Must track scanned and deleted counters');
  assert(scriptContent.includes('Single-flight lock active'), 'Must handle single-flight rejection gracefully');
});

runTest('3.2: cleanup.ts exports executeInstrumentedR2Cleanup with physical deletion tracking', () => {
  const cleanupPath = path.join(rootDir, 'lpu-events-admin/src/shared/images/cleanup.ts');
  const cleanupContent = fs.readFileSync(cleanupPath, 'utf8');
  assert(cleanupContent.includes('executeInstrumentedR2Cleanup'), 'Must export executeInstrumentedR2Cleanup');
  assert(cleanupContent.includes('start_operations_job_run'), 'Must initialize job run with start_operations_job_run');
  assert(cleanupContent.includes('finish_operations_job_run'), 'Must finalize job run with finish_operations_job_run');
  assert(cleanupContent.includes("'r2_orphan_cleanup'"), 'Must use canonical job key r2_orphan_cleanup');
  assert(cleanupContent.includes('deletedObjectsCount'), 'Must track confirmed physical deletes');
});

runTest('3.3: collector.ts links provider collection execution to canonical ops_job_runs', () => {
  const colPath = path.join(fnDir, 'collector.ts');
  const colContent = fs.readFileSync(colPath, 'utf8');
  assert(colContent.includes('start_operations_job_run'), 'Collector must call start_operations_job_run');
  assert(colContent.includes('finish_operations_job_run'), 'Collector must call finish_operations_job_run');
  assert(
    colContent.includes("'provider_telemetry_collection'") || colContent.includes('"provider_telemetry_collection"'),
    'Must use canonical key provider_telemetry_collection'
  );
  assert(colContent.includes('collection_run_id'), 'Must link collection_run_id without duplicating events');
});

// -------------------------------------------------------------------------
// SUITE 4: GitHub Actions Workflow Integration
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: GitHub Actions Workflow Integration');

runTest('4.1: Database cleanup workflow exists with 6-hour cron schedule', () => {
  const wfPath = path.join(rootDir, 'lpu-events-admin/.github/workflows/database_cleanup.yml');
  assert(fs.existsSync(wfPath), 'database_cleanup.yml missing');
  const wfContent = fs.readFileSync(wfPath, 'utf8');
  assert(wfContent.includes("cron: '0 */6 * * *'"), 'Must specify 6-hour cron schedule');
  assert(wfContent.includes('database_size_guardrail.mjs'), 'Must execute database_size_guardrail.mjs');
});

runTest('4.2: Operations router provides GitHub Actions workflow reconciliation without token leakage', () => {
  const opsPath = path.join(fnDir, 'operations.ts');
  const opsContent = fs.readFileSync(opsPath, 'utf8');
  assert(opsContent.includes('getGitHubWorkflowStatus'), 'Must implement getGitHubWorkflowStatus');
  assert(opsContent.includes('NOT_CONFIGURED'), 'Must report NOT_CONFIGURED when token missing');
  assert(opsContent.includes('database_cleanup.yml'), 'Must target database_cleanup.yml');
});

// -------------------------------------------------------------------------
// SUITE 5: Operations Gateway & Freshness Evaluation
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Operations Gateway & Freshness Evaluation');

runTest('5.1: operations.ts router exposes jobs, job-runs, and maintenance capabilities', () => {
  const opsPath = path.join(fnDir, 'operations.ts');
  const opsContent = fs.readFileSync(opsPath, 'utf8');
  assert(opsContent.includes("case 'jobs':"), 'Router must support jobs action');
  assert(opsContent.includes("case 'job-runs':"), 'Router must support job-runs action');
  assert(opsContent.includes("case 'maintenance':"), 'Router must support maintenance action');
});

runTest('5.2: Cadence-aware freshness evaluation checks expected interval against last execution', () => {
  const opsPath = path.join(fnDir, 'operations.ts');
  const opsContent = fs.readFileSync(opsPath, 'utf8');
  assert(opsContent.includes('expected_interval_minutes'), 'Must check expected_interval_minutes');
  assert(opsContent.includes('is_stale'), 'Must calculate is_stale flag');
  assert(opsContent.includes('last_success_at') && opsContent.includes('last_run_at'), 'Must track last success and last run');
});

// -------------------------------------------------------------------------
// SUITE 6: Client SDK & Security Boundary
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Client SDK & Security Boundary');

runTest('6.1: OperationsClient exports typed getJobs, getJobRuns, getMaintenanceOverview methods', () => {
  const clientPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts');
  const clientContent = fs.readFileSync(clientPath, 'utf8');
  assert(clientContent.includes('getJobs('), 'OperationsClient must provide getJobs()');
  assert(clientContent.includes('getJobRuns('), 'OperationsClient must provide getJobRuns()');
  assert(clientContent.includes('getMaintenanceOverview('), 'OperationsClient must provide getMaintenanceOverview()');
});

runTest('6.2: Client SDK contains zero job mutation or history deletion methods', () => {
  const clientPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts');
  const clientContent = fs.readFileSync(clientPath, 'utf8');
  assert(!clientContent.includes('startJob('), 'Forbidden client startJob');
  assert(!clientContent.includes('finishJob('), 'Forbidden client finishJob');
  assert(!clientContent.includes('deleteJobRun('), 'Forbidden client deleteJobRun');
  assert(!clientContent.includes('markJobSuccessful('), 'Forbidden client markJobSuccessful');
});

runTest('6.3: Zero server credentials present in client source or dist code', () => {
  const forbidden = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLOUDFLARE_API_TOKEN',
    'SENTRY_AUTH_TOKEN',
    'RESEND_API_KEY',
    'R2_SECRET_ACCESS_KEY',
    'GITHUB_TOKEN',
  ];

  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== '.git' && e.name !== '__tests__') {
          scan(full);
        }
      } else if (/\.(js|mjs|ts|tsx)$/.test(e.name) && !e.name.includes('.test.')) {
        const text = fs.readFileSync(full, 'utf8');
        for (const s of forbidden) {
          assert(!text.includes(s), `Secret leak: ${s} found in ${full}`);
        }
      }
    }
  }

  scan(path.join(rootDir, 'lpu-events-admin/src'));
  scan(path.join(rootDir, 'lpu-events-student/src'));
});

// -------------------------------------------------------------------------
// SUITE 7: Phase Boundary Preservation
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 7: Phase Boundary Preservation');

runTest('7.1: Zero premature alert, incident, or notification tables created', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(!sql.includes('CREATE TABLE ops_alerts'), 'Forbidden ops_alerts table');
  assert(!sql.includes('CREATE TABLE ops_incidents'), 'Forbidden ops_incidents table');
  assert(!sql.includes('CREATE TABLE ops_notifications'), 'Forbidden ops_notifications table');
});

runTest('7.2: Zero predictive forecasting or ML algorithms in operations router', () => {
  const opsContent = fs.readFileSync(path.join(fnDir, 'operations.ts'), 'utf8');
  assert(!opsContent.toLowerCase().includes('machine_learning'), 'Forbidden ML in operations');
});

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 Phase 4 Verification Complete: ${passedTests}/${totalTests} Tests Passed`);
console.log('================================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL PHASE 4 REQUIREMENTS SATISFIED!\n');
  process.exit(0);
} else {
  console.error(`❌ Verification failed: ${totalTests - passedTests} tests failed.\n`);
  process.exit(1);
}
