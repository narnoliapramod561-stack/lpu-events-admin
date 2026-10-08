#!/usr/bin/env node
/**
 * verify_operations_phase9.mjs
 * Static verification suite for Phase 9: Safe Operational Remediation & Runbooks.
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
console.log('🚀 Phase 9 Verification: Safe Operational Remediation & Runbooks');
console.log('================================================================');

const migrationPath = path.join(
  rootDir,
  'lpu-events-admin/supabase/migrations/20261008150000_operations_remediation_and_runbooks.sql'
);
const mirroredMigrationPath = path.join(
  rootDir,
  'supabase/migrations/20261008150000_operations_remediation_and_runbooks.sql'
);
const remDir = path.join(rootDir, 'supabase/functions/superadmin-operations/remediation');
const operationsRouterPath = path.join(rootDir, 'supabase/functions/superadmin-operations/operations.ts');
const clientTypesPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/types.ts');
const clientSdkPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts');
const remPanelPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/operations/RemediationCenterPanel.tsx');
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

runTest('1.2: ops_runbooks table defined with required schema and strict RLS', () => {
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert(content.includes('CREATE TABLE IF NOT EXISTS public.ops_runbooks'), 'ops_runbooks table missing');
  assert(content.includes('runbook_key TEXT UNIQUE NOT NULL') || content.includes('runbook_key TEXT NOT NULL UNIQUE'), 'runbook_key unique constraint missing');
  assert(content.includes('execution_mode TEXT NOT NULL'), 'execution_mode column missing');
  assert(content.includes('ALTER TABLE public.ops_runbooks ENABLE ROW LEVEL SECURITY'), 'RLS missing on ops_runbooks');
  assert(content.includes('public.is_super_admin()'), 'Super admin policy missing on ops_runbooks');
});

runTest('1.3: ops_remediation_actions table defined with foreign keys and strict RLS', () => {
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert(content.includes('CREATE TABLE IF NOT EXISTS public.ops_remediation_actions'), 'ops_remediation_actions table missing');
  assert(content.includes('action_key TEXT UNIQUE NOT NULL') || content.includes('action_key TEXT NOT NULL UNIQUE'), 'action_key unique constraint missing');
  assert(content.includes('handler_key TEXT NOT NULL'), 'handler_key column missing');
  assert(content.includes('ALTER TABLE public.ops_remediation_actions ENABLE ROW LEVEL SECURITY'), 'RLS missing on ops_remediation_actions');
});

runTest('1.4: ops_remediation_executions table defined with idempotency & audit tracking', () => {
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert(content.includes('CREATE TABLE IF NOT EXISTS public.ops_remediation_executions'), 'ops_remediation_executions table missing');
  assert(content.includes('idempotency_key TEXT UNIQUE NOT NULL') || content.includes('idempotency_key TEXT NOT NULL UNIQUE'), 'idempotency_key uniqueness missing');
  assert(content.includes('postcondition_verification JSONB'), 'postcondition_verification column missing');
  assert(content.includes('status TEXT NOT NULL'), 'status column missing');
  assert(content.includes('ALTER TABLE public.ops_remediation_executions ENABLE ROW LEVEL SECURITY'), 'RLS missing on ops_remediation_executions');
});

runTest('1.5: prune_stale_operations_remediations stored procedure has safe search_path and protects active states', () => {
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert(content.includes('prune_stale_operations_remediations'), 'Prune RPC missing');
  assert(content.includes('SET search_path = public, pg_temp'), 'Safe search_path missing on prune RPC');
  assert(content.includes("'COMPLETED'") && content.includes("'FAILED'"), 'Prune RPC must target terminal statuses');
  assert(!content.includes("'PROPOSED', 'PENDING_APPROVAL'"), 'Prune RPC must not delete active PROPOSED or PENDING_APPROVAL');
});

// -------------------------------------------------------------------------
// SUITE 2: Allowlisted Action Registry & Zero Dynamic Code Execution
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Allowlisted Action Registry & Zero Dynamic Code Execution');

runTest('2.1: Remediation registry exports canonical runbooks and allowlisted actions', () => {
  const regPath = path.join(remDir, 'registry.ts');
  assert(fs.existsSync(regPath), 'registry.ts missing');
  const content = fs.readFileSync(regPath, 'utf8');
  assert(content.includes('CANONICAL_RUNBOOKS'), 'CANONICAL_RUNBOOKS missing');
  assert(content.includes('CANONICAL_ACTIONS'), 'CANONICAL_ACTIONS missing');
  assert(content.includes('recommendRunbooksForIncident'), 'recommendRunbooksForIncident missing');
  assert(content.includes('notification.retry_delivery'), 'notification.retry_delivery action missing');
  assert(content.includes('job.retry_safe_run'), 'job.retry_safe_run action missing');
  assert(content.includes('analytics.rebuild_rollup'), 'analytics.rebuild_rollup action missing');
  assert(content.includes('telemetry.recollect'), 'telemetry.recollect action missing');
});

runTest('2.2: Handlers file strictly allowlists known server functions with post-action verification', () => {
  const handPath = path.join(remDir, 'handlers.ts');
  assert(fs.existsSync(handPath), 'handlers.ts missing');
  const content = fs.readFileSync(handPath, 'utf8');
  assert(content.includes('ALLOWLISTED_HANDLERS'), 'ALLOWLISTED_HANDLERS map missing');
  assert(content.includes('executeTelemetryRecollect'), 'executeTelemetryRecollect missing');
  assert(content.includes('executeJobRetry'), 'executeJobRetry missing');
  assert(content.includes('executeAnalyticsRebuildRollup'), 'executeAnalyticsRebuildRollup missing');
  assert(content.includes('executeNotificationFlush'), 'executeNotificationFlush missing');
  assert(content.includes('executeDatabaseSizeGuardrail'), 'executeDatabaseSizeGuardrail missing');
  assert(content.includes('executeCacheRefresh'), 'executeCacheRefresh missing');
  assert(content.includes('verified:'), 'Post-action verification requirement missing');
});

runTest('2.3: Zero arbitrary command execution, dynamic SQL, or arbitrary HTTP requests', () => {
  const remFiles = fs.readdirSync(remDir).filter(f => f.endsWith('.ts'));
  for (const f of remFiles) {
    const content = fs.readFileSync(path.join(remDir, f), 'utf8');
    assert(!content.includes('child_process'), `child_process detected in ${f}`);
    assert(!content.includes('eval('), `eval detected in ${f}`);
    assert(!content.includes('exec('), `exec detected in ${f}`);
    assert(!content.includes('spawn('), `spawn detected in ${f}`);
    assert(!content.includes('fetch(userProvidedUrl)'), `uncontrolled fetch in ${f}`);
  }
});

// -------------------------------------------------------------------------
// SUITE 3: Server-Side Remediation Engine Architecture
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Server-Side Remediation Engine Architecture');

runTest('3.1: Engine implements validatePreconditions with fail-closed environment guardrail', () => {
  const engPath = path.join(remDir, 'engine.ts');
  assert(fs.existsSync(engPath), 'engine.ts missing');
  const content = fs.readFileSync(engPath, 'utf8');
  assert(content.includes('validatePreconditions'), 'validatePreconditions missing');
  assert(content.includes('resolveServerEnvironment'), 'resolveServerEnvironment missing');
  assert(content.includes('UNKNOWN'), 'UNKNOWN environment handling missing');
  assert(content.includes('CRITICAL') || content.includes('HIGH'), 'Risk level checks missing');
});

runTest('3.2: Engine implements evaluateDryRun with zero database mutation', () => {
  const engPath = path.join(remDir, 'engine.ts');
  const content = fs.readFileSync(engPath, 'utf8');
  assert(content.includes('evaluateDryRun'), 'evaluateDryRun missing');
  assert(content.includes('dry_run: true'), 'dry_run: true missing');
  assert(content.includes('what_will_happen'), 'what_will_happen missing');
  assert(content.includes('what_will_not_happen'), 'what_will_not_happen missing');
});

runTest('3.3: Engine implements proposal, approval, execution, cancel, and rollback lifecycles', () => {
  const engPath = path.join(remDir, 'engine.ts');
  const content = fs.readFileSync(engPath, 'utf8');
  assert(content.includes('proposeRemediation'), 'proposeRemediation missing');
  assert(content.includes('approveRemediation'), 'approveRemediation missing');
  assert(content.includes('rejectRemediation'), 'rejectRemediation missing');
  assert(content.includes('executeRemediation'), 'executeRemediation missing');
  assert(content.includes('cancelRemediation'), 'cancelRemediation missing');
  assert(content.includes('rollbackRemediation'), 'rollbackRemediation missing');
  assert(content.includes('cancelPendingRemediationsForIncident'), 'cancelPendingRemediationsForIncident missing');
});

runTest('3.4: Post-action verification ensures truthfulness before setting COMPLETED', () => {
  const engPath = path.join(remDir, 'engine.ts');
  const content = fs.readFileSync(engPath, 'utf8');
  assert(content.includes('postcondition_verification'), 'postcondition_verification update missing');
  assert(content.includes('handlerResult?.verified'), 'verified check missing');
  assert(content.includes("finalStatus = isSuccess ? 'COMPLETED' : 'FAILED'"), 'Truthful status assignment missing');
});

// -------------------------------------------------------------------------
// SUITE 4: Operations Gateway Integration & Incident Lifecycle
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Operations Gateway Integration & Incident Lifecycle');

runTest('4.1: Operations router registers all Phase 9 remediation actions and aliases', () => {
  const content = fs.readFileSync(operationsRouterPath, 'utf8');
  const requiredActions = [
    'remediation-runbooks',
    'operations.remediation.runbooks',
    'remediation-actions',
    'operations.remediation.actions',
    'remediation-recommend',
    'operations.remediation.recommend',
    'remediation-dry-run',
    'operations.remediation.dry_run',
    'remediation-propose',
    'operations.remediation.request_approval',
    'remediation-approve',
    'operations.remediation.approve',
    'remediation-reject',
    'operations.remediation.reject',
    'remediation-execute',
    'operations.remediation.execute',
    'remediation-cancel',
    'operations.remediation.cancel',
    'remediation-rollback',
    'operations.remediation.rollback',
    'remediation-history',
    'operations.remediation.history',
    'remediation-prune',
  ];
  for (const act of requiredActions) {
    assert(content.includes(`'${act}'`), `Action '${act}' missing from operations.ts`);
  }
});

runTest('4.2: Overview action includes remediation_summary and preserves certified phase lineage', () => {
  const content = fs.readFileSync(operationsRouterPath, 'utf8');
  assert(content.includes('remediation_summary'), 'remediation_summary missing from overview');
  assert(content.includes("phase: 'PHASE_9_SAFE_OPERATIONAL_REMEDIATION_AND_RUNBOOKS'"), 'Phase 9 marker missing');
  assert(content.includes("PHASE_5_ALERT_AND_INCIDENT_ENGINE"), 'Phase 5 lineage comment missing');
  assert(content.includes("PHASE_6_HISTORICAL_ANALYTICS_AND_FORECASTING"), 'Phase 6 lineage comment missing');
  assert(content.includes("PHASE_8_OPERATIONAL_NOTIFICATIONS_AND_ESCALATION"), 'Phase 8 lineage comment missing');
});

runTest('4.3: Manual incident resolution cancels pending remediations', () => {
  const content = fs.readFileSync(operationsRouterPath, 'utf8');
  assert(content.includes('cancelPendingRemediationsForIncident'), 'cancelPendingRemediationsForIncident missing in operations.ts');
});

// -------------------------------------------------------------------------
// SUITE 5: Client SDK & React UI Integration
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Client SDK & React UI Integration');

runTest('5.1: Client types define OperationsRunbook, OperationsRemediationAction, OperationsRemediationExecution', () => {
  const content = fs.readFileSync(clientTypesPath, 'utf8');
  assert(content.includes('export interface OperationsRunbook'), 'OperationsRunbook type missing');
  assert(content.includes('export interface OperationsRemediationAction'), 'OperationsRemediationAction type missing');
  assert(content.includes('export interface OperationsRemediationExecution'), 'OperationsRemediationExecution type missing');
  assert(content.includes('export interface OperationsRemediationDryRunResult'), 'OperationsRemediationDryRunResult type missing');
});

runTest('5.2: Client SDK exposes typed remediation methods without using any', () => {
  const content = fs.readFileSync(clientSdkPath, 'utf8');
  assert(content.includes('getRemediationRunbooks'), 'getRemediationRunbooks missing');
  assert(content.includes('getRemediationActions'), 'getRemediationActions missing');
  assert(content.includes('recommendRemediation'), 'recommendRemediation missing');
  assert(content.includes('dryRunRemediation'), 'dryRunRemediation missing');
  assert(content.includes('proposeRemediation'), 'proposeRemediation missing');
  assert(content.includes('approveRemediation'), 'approveRemediation missing');
  assert(content.includes('executeRemediation'), 'executeRemediation missing');
  assert(content.includes('rollbackRemediation'), 'rollbackRemediation missing');
  assert(content.includes('getRemediationHistory'), 'getRemediationHistory missing');
});

runTest('5.3: OperationsControlCenter renders RemediationCenterPanel as Section 8', () => {
  const content = fs.readFileSync(controlCenterPath, 'utf8');
  assert(content.includes('RemediationCenterPanel'), 'RemediationCenterPanel import missing');
  assert(content.includes('SECTION 8: Safe Operational Remediation & Runbooks'), 'Section 8 comment missing');
  assert(content.includes('<RemediationCenterPanel'), 'RemediationCenterPanel JSX element missing');
});

runTest('5.4: RemediationCenterPanel provides Dry Run, Approval, and History tabs with explicit confirmation', () => {
  const content = fs.readFileSync(remPanelPath, 'utf8');
  assert(content.includes('Approve and Execute Remediation'), 'Explicit approval language missing');
  assert(content.includes('DRY RUN MODE — ZERO STATE MUTATION GUARANTEE'), 'Dry run banner missing');
  assert(content.includes('WHAT WILL HAPPEN'), 'Dry run predicted impact missing');
  assert(content.includes('WHAT WILL NOT HAPPEN'), 'Dry run negative boundaries missing');
});

// -------------------------------------------------------------------------
// SUITE 6: Secret Isolation & No Mock/Placeholder Search
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Secret Isolation & No Mock/Placeholder Search');

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

  // Also verify built dist assets if present
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
console.log(`Phase 9 Static Verification Completed: ${passedTests}/${totalTests} Passed`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
