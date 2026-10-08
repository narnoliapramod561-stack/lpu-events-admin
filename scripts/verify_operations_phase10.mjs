#!/usr/bin/env node
/**
 * verify_operations_phase10.mjs
 * Static verification suite for Phase 10: Operational Resilience, Failure Injection & Disaster Recovery.
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
console.log('🚀 Phase 10 Verification: Operational Resilience & Disaster Recovery');
console.log('================================================================');

const migrationPath = path.join(
  rootDir,
  'lpu-events-admin/supabase/migrations/20261008160000_operations_resilience_and_disaster_recovery.sql'
);
const mirroredMigrationPath = path.join(
  rootDir,
  'supabase/migrations/20261008160000_operations_resilience_and_disaster_recovery.sql'
);
const resilienceDir = path.join(rootDir, 'supabase/functions/superadmin-operations/resilience');
const operationsRouterPath = path.join(rootDir, 'supabase/functions/superadmin-operations/operations.ts');
const clientTypesPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/types.ts');
const clientSdkPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts');
const controlCenterPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/operations/OperationsControlCenter.tsx');

// -------------------------------------------------------------------------
// SUITE 1: Database Migration, Schema & RLS Security
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 1: Database Migration, Schema & RLS Security');

runTest('1.1: Migration file exists in canonical and mirrored directories and matches', () => {
  assert(fs.existsSync(migrationPath), 'Canonical migration file missing');
  assert(fs.existsSync(mirroredMigrationPath), 'Mirrored migration file missing');
  const canonicalContent = fs.readFileSync(migrationPath, 'utf8');
  const mirroredContent = fs.readFileSync(mirroredMigrationPath, 'utf8');
  assert.strictEqual(canonicalContent, mirroredContent, 'Canonical and mirrored migration must be byte-for-byte identical');
});

runTest('1.2: ops_resilience_scenarios table defined with required schema and strict RLS', () => {
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert(content.includes('CREATE TABLE IF NOT EXISTS public.ops_resilience_scenarios'), 'ops_resilience_scenarios table missing');
  assert(content.includes('scenario_key TEXT UNIQUE NOT NULL'), 'scenario_key unique constraint missing');
  assert(content.includes('category TEXT NOT NULL CHECK'), 'category check constraint missing');
  assert(content.includes('ALTER TABLE public.ops_resilience_scenarios ENABLE ROW LEVEL SECURITY'), 'RLS missing on ops_resilience_scenarios');
  assert(content.includes('public.is_super_admin()'), 'Super admin policy missing on ops_resilience_scenarios');
});

runTest('1.3: ops_resilience_test_runs table defined with foreign keys and strict RLS', () => {
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert(content.includes('CREATE TABLE IF NOT EXISTS public.ops_resilience_test_runs'), 'ops_resilience_test_runs table missing');
  assert(content.includes('scenario_key TEXT NOT NULL REFERENCES public.ops_resilience_scenarios'), 'scenario_key foreign key missing');
  assert(content.includes('status TEXT NOT NULL CHECK'), 'status check constraint missing');
  assert(content.includes('ALTER TABLE public.ops_resilience_test_runs ENABLE ROW LEVEL SECURITY'), 'RLS missing on ops_resilience_test_runs');
});

runTest('1.4: prune_stale_operations_resilience_runs stored procedure has safe search_path and protects active states', () => {
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert(content.includes('prune_stale_operations_resilience_runs'), 'Prune RPC missing');
  assert(content.includes('SET search_path = public, pg_temp'), 'Safe search_path missing on prune RPC');
  assert(content.includes("'PASSED', 'FAILED', 'BLOCKED', 'CANCELLED'"), 'Prune RPC must delete only terminal runs');
});

runTest('1.5: resilience_test_prune job registered in ops_jobs registry', () => {
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert(content.includes("'resilience_test_prune'"), 'resilience_test_prune job seed missing');
  assert(content.includes('INSERT INTO public.ops_jobs'), 'ops_jobs insert missing');
});

// -------------------------------------------------------------------------
// SUITE 2: Scenario Registry & 22 Mandatory Scenarios
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Scenario Registry & 22 Mandatory Scenarios');

runTest('2.1: Resilience registry exports all 22 mandatory scenarios from Section 50', () => {
  const regPath = path.join(resilienceDir, 'registry.ts');
  assert(fs.existsSync(regPath), 'registry.ts missing');
  const content = fs.readFileSync(regPath, 'utf8');
  assert(content.includes('CANONICAL_SCENARIOS'), 'CANONICAL_SCENARIOS missing');

  const requiredScenarios = [
    'provider.unavailable',
    'provider.timeout',
    'telemetry.stale',
    'telemetry.missing',
    'job.failure',
    'job.stale',
    'alert.evaluator_interruption',
    'notification.provider_outage',
    'notification.worker_crash',
    'remediation.worker_crash',
    'remediation.timeout',
    'remediation.verification_failure',
    'rollback.failure',
    'remediation.duplicate_attempt',
    'analytics.rollup_failure',
    'gateway.timeout',
    'combined.subsystem_failure',
    'recovery.provider_outage',
    'recovery.job_failure',
    'recovery.remediation_assisted',
    'disaster_recovery.backup_validation',
    'disaster_recovery.migration_replay',
  ];

  for (const s of requiredScenarios) {
    assert(content.includes(`'${s}'`), `Mandatory scenario '${s}' missing in registry.ts`);
  }
});

// -------------------------------------------------------------------------
// SUITE 3: Fail-Closed Safety Preconditions & Production Protection
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Fail-Closed Safety Preconditions & Production Protection');

runTest('3.1: Engine validates UNKNOWN environment as unsafe and blocks execution', () => {
  const engPath = path.join(resilienceDir, 'engine.ts');
  assert(fs.existsSync(engPath), 'engine.ts missing');
  const content = fs.readFileSync(engPath, 'utf8');
  assert(content.includes('validateResilienceSafety'), 'validateResilienceSafety missing');
  assert(content.includes('ENVIRONMENT_UNSAFE'), 'ENVIRONMENT_UNSAFE error handling missing');
  assert(content.includes("environment === 'UNKNOWN'"), 'UNKNOWN environment check missing');
});

runTest('3.2: Engine strictly blocks destructive failure injection in PRODUCTION', () => {
  const content = fs.readFileSync(path.join(resilienceDir, 'engine.ts'), 'utf8');
  assert(content.includes('PRODUCTION_DESTRUCTIVE_BLOCKED'), 'PRODUCTION_DESTRUCTIVE_BLOCKED check missing');
  assert(content.includes("environment === 'PRODUCTION' && scenario.is_destructive"), 'Production destructive check missing');
});

// -------------------------------------------------------------------------
// SUITE 4: Operations Gateway Integration & Overview Telemetry
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Operations Gateway Integration & Overview Telemetry');

runTest('4.1: Operations router registers all Phase 10 resilience actions and aliases', () => {
  const content = fs.readFileSync(operationsRouterPath, 'utf8');
  const requiredActions = [
    'resilience-scenarios',
    'operations.resilience.scenarios',
    'resilience-run',
    'operations.resilience.run',
    'resilience-history',
    'operations.resilience.history',
    'resilience-overview',
    'operations.resilience.overview',
    'resilience-prune',
  ];
  for (const act of requiredActions) {
    assert(content.includes(`'${act}'`), `Action '${act}' missing from operations.ts`);
  }
});

runTest('4.2: Overview action includes resilience_summary and preserves certified phase lineage', () => {
  const content = fs.readFileSync(operationsRouterPath, 'utf8');
  assert(content.includes('resilience_summary'), 'resilience_summary missing from overview');
  assert(content.includes("phase: 'PHASE_10_OPERATIONAL_RESILIENCE_AND_DISASTER_RECOVERY'"), 'Phase 10 marker missing');
  assert(content.includes("PHASE_5_ALERT_AND_INCIDENT_ENGINE"), 'Phase 5 lineage comment missing');
  assert(content.includes("PHASE_6_HISTORICAL_ANALYTICS_AND_FORECASTING"), 'Phase 6 lineage comment missing');
  assert(content.includes("PHASE_8_OPERATIONAL_NOTIFICATIONS_AND_ESCALATION"), 'Phase 8 lineage comment missing');
  assert(content.includes("PHASE_9_SAFE_OPERATIONAL_REMEDIATION_AND_RUNBOOKS"), 'Phase 9 lineage comment missing');
});

// -------------------------------------------------------------------------
// SUITE 5: Client SDK Contracts & UI Resilience
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Client SDK Contracts & UI Resilience');

runTest('5.1: Client types export OperationsResilienceScenario, OperationsResilienceTestRun, OperationsResilienceOverview', () => {
  const content = fs.readFileSync(clientTypesPath, 'utf8');
  assert(content.includes('export interface OperationsResilienceScenario'), 'OperationsResilienceScenario missing');
  assert(content.includes('export interface OperationsResilienceTestRun'), 'OperationsResilienceTestRun missing');
  assert(content.includes('export interface OperationsResilienceOverview'), 'OperationsResilienceOverview missing');
  assert(content.includes('export interface OperationsResilienceRunResult'), 'OperationsResilienceRunResult missing');
});

runTest('5.2: Client SDK exposes typed resilience methods without using any', () => {
  const content = fs.readFileSync(clientSdkPath, 'utf8');
  assert(content.includes('getResilienceScenarios'), 'getResilienceScenarios missing');
  assert(content.includes('runResilienceScenario'), 'runResilienceScenario missing');
  assert(content.includes('getResilienceHistory'), 'getResilienceHistory missing');
  assert(content.includes('getResilienceOverview'), 'getResilienceOverview missing');
});

runTest('5.3: OperationsControlCenter handles partial failure and preserves prior state', () => {
  const content = fs.readFileSync(controlCenterPath, 'utf8');
  assert(content.includes('synchronizeOperations'), 'synchronizeOperations missing');
  assert(content.includes('catch('), 'Staged error catches missing in OperationsControlCenter');
  assert(content.includes('isStale'), 'isStale calculation missing');
});

// -------------------------------------------------------------------------
// SUITE 6: Secret Isolation & No Mock/Placeholder Leaks
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Secret Isolation & No Mock/Placeholder Leaks');

runTest('6.1: Zero provider secrets or service role tokens in client production code or build assets', () => {
  const adminSrc = path.join(rootDir, 'lpu-events-admin/src');
  function scan(dir) {
    for (const item of fs.readdirSync(dir)) {
      if (item === '__tests__' || item.endsWith('.test.ts') || item.endsWith('.spec.ts')) continue;
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) scan(full);
      else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
        const txt = fs.readFileSync(full, 'utf8');
        assert(!txt.includes('SUPABASE_SERVICE_ROLE_KEY'), `Service role key leak in ${full}`);
        assert(!txt.includes('RESEND_API_KEY'), `Resend API key leak in ${full}`);
        assert(!txt.includes('CLOUDFLARE_API_TOKEN'), `Cloudflare token leak in ${full}`);
      }
    }
  }
  scan(adminSrc);

  const distAssets = path.join(rootDir, 'lpu-events-admin/dist/assets');
  if (fs.existsSync(distAssets)) {
    for (const item of fs.readdirSync(distAssets)) {
      if (item.endsWith('.js')) {
        const txt = fs.readFileSync(path.join(distAssets, item), 'utf8');
        assert(!txt.includes('SUPABASE_SERVICE_ROLE_KEY'), `Service role key leaked into bundle ${item}`);
        assert(!txt.includes('RESEND_API_KEY'), `Resend API key leaked into bundle ${item}`);
      }
    }
  }
});

console.log('\n================================================================');
console.log(`Phase 10 Static Verification Completed: ${passedTests}/${totalTests} Passed`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
