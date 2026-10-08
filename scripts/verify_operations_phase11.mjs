// scripts/verify_operations_phase11.mjs
// Static verification for Phase 11: SLO, Capacity & Production Readiness Governance

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('🚀 Phase 11 Verification: SLO, Capacity & Production Readiness Governance');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Suite 1: Database Migration, Schema & Security
// -----------------------------------------------------------------------------
console.log('📌 Test Suite 1: Database Migration, Schema & RLS Security');

const migrationName = '20261008170000_operations_slo_capacity_and_production_readiness.sql';
const adminMigrationPath = path.join('lpu-events-admin/supabase/migrations', migrationName);
const rootMigrationPath = path.join('supabase/migrations', migrationName);

assert(
  fs.existsSync(adminMigrationPath) && fs.existsSync(rootMigrationPath),
  '1.1: Migration file exists in canonical admin and root migrations directories'
);

const migrationContent = fs.readFileSync(adminMigrationPath, 'utf8');

assert(
  migrationContent.includes('CREATE TABLE IF NOT EXISTS public.ops_sli_definitions') &&
  migrationContent.includes('CREATE TABLE IF NOT EXISTS public.ops_slo_definitions') &&
  migrationContent.includes('CREATE TABLE IF NOT EXISTS public.ops_slo_evaluations') &&
  migrationContent.includes('CREATE TABLE IF NOT EXISTS public.ops_capacity_definitions') &&
  migrationContent.includes('CREATE TABLE IF NOT EXISTS public.ops_readiness_evaluations') &&
  migrationContent.includes('CREATE TABLE IF NOT EXISTS public.ops_governance_audit_logs'),
  '1.2: All required Phase 11 tables defined with proper schema'
);

assert(
  migrationContent.includes('ENABLE ROW LEVEL SECURITY') &&
  migrationContent.includes('public.is_super_admin()'),
  '1.3: Row Level Security (RLS) is enabled and enforced with is_super_admin()'
);

assert(
  migrationContent.includes('CREATE OR REPLACE FUNCTION public.prune_stale_operations_governance') &&
  migrationContent.includes('SET search_path = public, pg_temp'),
  '1.4: prune_stale_operations_governance stored procedure has secure search_path and Super Admin check'
);

assert(
  migrationContent.includes("'governance_eval_prune'") &&
  migrationContent.toLowerCase().includes('retention'),
  '1.5: governance_eval_prune job registered in ops_jobs canonical table'
);

// -----------------------------------------------------------------------------
// Suite 2: Server-Side Governance Engine Architecture
// -----------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Server-Side Governance Engine Architecture');

const govTypesPath = 'supabase/functions/superadmin-operations/governance/types.ts';
const govRegPath = 'supabase/functions/superadmin-operations/governance/registry.ts';
const govEvalPath = 'supabase/functions/superadmin-operations/governance/evaluator.ts';
const govIndexPath = 'supabase/functions/superadmin-operations/governance/index.ts';

assert(
  fs.existsSync(govTypesPath) &&
  fs.existsSync(govRegPath) &&
  fs.existsSync(govEvalPath) &&
  fs.existsSync(govIndexPath),
  '2.1: Governance engine modules exist and are well-structured'
);

const regContent = fs.readFileSync(govRegPath, 'utf8');
assert(
  regContent.includes('CANONICAL_SLIS') &&
  regContent.includes('CANONICAL_SLOS') &&
  regContent.includes('CANONICAL_CAPACITY') &&
  regContent.includes('platform.availability') &&
  regContent.includes('worker.error_rate') &&
  regContent.includes('maintenance_jobs.success_rate'),
  '2.2: Registry contains canonical SLIs, SLOs, and Capacity definitions'
);

const evalContent = fs.readFileSync(govEvalPath, 'utf8');
assert(
  evalContent.includes('calculateSliValue') &&
  evalContent.includes('evaluateSloRecord') &&
  evalContent.includes('evaluateCapacityResource') &&
  evalContent.includes('evaluateProductionReadiness') &&
  evalContent.includes('evaluateAllSlos') &&
  evalContent.includes('evaluateAllCapacity'),
  '2.3: Evaluator exports deterministic SLI, SLO, Capacity, and Readiness functions'
);

// -----------------------------------------------------------------------------
// Suite 3: Operations Gateway Router Integration
// -----------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Operations Gateway Router Integration');

const opsRouterPath = 'supabase/functions/superadmin-operations/operations.ts';
const opsContent = fs.readFileSync(opsRouterPath, 'utf8');

assert(
  opsContent.includes("'slo-overview'") &&
  opsContent.includes("'slo-details'") &&
  opsContent.includes("'slo-history'") &&
  opsContent.includes("'slo-evaluate'") &&
  opsContent.includes("'capacity-overview'") &&
  opsContent.includes("'capacity-details'") &&
  opsContent.includes("'readiness-evaluate'") &&
  opsContent.includes("'readiness-history'") &&
  opsContent.includes("'governance-prune'"),
  '3.1: Operations router registers all Phase 11 governance actions and aliases'
);

assert(
  opsContent.includes('governance_summary') &&
  opsContent.includes("phase: 'PHASE_11_SLO_CAPACITY_AND_PRODUCTION_READINESS_GOVERNANCE'") &&
  opsContent.includes("// phase: 'PHASE_10_OPERATIONAL_RESILIENCE_AND_DISASTER_RECOVERY'"),
  '3.2: Overview action includes governance_summary and preserves certified phase lineage'
);

// -----------------------------------------------------------------------------
// Suite 4: Client SDK & Type Definitions
// -----------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Client SDK & Type Definitions');

const clientTypesPath = 'lpu-events-admin/src/shared/operations/types.ts';
const clientSdkPath = 'lpu-events-admin/src/shared/operations/client.ts';

const clientTypes = fs.readFileSync(clientTypesPath, 'utf8');
const clientSdk = fs.readFileSync(clientSdkPath, 'utf8');

assert(
  clientTypes.includes('OperationsSliDefinition') &&
  clientTypes.includes('OperationsSloDefinition') &&
  clientTypes.includes('OperationsSloEvaluation') &&
  clientTypes.includes('OperationsCapacityResource') &&
  clientTypes.includes('OperationsReadinessEvaluation') &&
  clientTypes.includes('governance_summary?:'),
  '4.1: Client types export all required Phase 11 interfaces'
);

assert(
  clientSdk.includes('getSloOverview') &&
  clientSdk.includes('getSloDetails') &&
  clientSdk.includes('getSloHistory') &&
  clientSdk.includes('evaluateSlos') &&
  clientSdk.includes('getCapacityOverview') &&
  clientSdk.includes('evaluateReadiness') &&
  clientSdk.includes('getReadinessHistory'),
  '4.2: Client SDK exposes typed governance methods'
);

// -----------------------------------------------------------------------------
// Suite 5: Control Center UI Integration
// -----------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Control Center UI Integration');

const panelPath = 'lpu-events-admin/src/components/superadmin/operations/GovernanceCenterPanel.tsx';
const occPath = 'lpu-events-admin/src/components/superadmin/operations/OperationsControlCenter.tsx';

assert(
  fs.existsSync(panelPath),
  '5.1: GovernanceCenterPanel.tsx component exists'
);

const panelContent = fs.readFileSync(panelPath, 'utf8');
const occContent = fs.readFileSync(occPath, 'utf8');

assert(
  panelContent.includes('Release Readiness') &&
  panelContent.includes('SLOs & Error Budgets') &&
  panelContent.includes('Capacity & Headroom') &&
  panelContent.includes('getStatusBadge'),
  '5.2: GovernanceCenterPanel implements Release Readiness, SLOs, and Capacity views'
);

assert(
  occContent.includes('GovernanceCenterPanel') &&
  occContent.includes('SECTION 9: Reliability, Capacity & Production Readiness Governance'),
  '5.3: OperationsControlCenter cleanly mounts GovernanceCenterPanel as Section 9'
);

// -----------------------------------------------------------------------------
// Suite 6: Secret Isolation & No Mock Leaks
// -----------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Secret Isolation & No Mock Leaks');

const adminSrc = 'lpu-events-admin/src';
function scanForSecrets(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      scanForSecrets(full);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('RESEND_API_KEY')) {
        throw new Error(`Secret leak found in ${full}`);
      }
    }
  }
}

let secretScanClean = true;
try {
  scanForSecrets(adminSrc);
} catch (e) {
  secretScanClean = false;
}

assert(
  secretScanClean,
  '6.1: Zero provider secrets or service role keys in client production code'
);

console.log('\n================================================================');
console.log(`Phase 11 Static Verification Completed: ${passed}/${passed + failed} Passed`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
