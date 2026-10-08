/**
 * scripts/verify_operations_phase5.mjs
 * 
 * LPU Events — Phase 5 Verification Suite
 * Alert & Incident Engine
 * 
 * Validates:
 * 1. Canonical Alert & Incident Schema (ops_alert_rules, ops_alerts, ops_incidents, ops_incident_events)
 * 2. Authoritative RPCs (acknowledge_operations_incident, resolve_operations_incident, prune_stale_operations_alerts_and_incidents)
 * 3. Seeded Alert Rules & Job Registry Integration (alert_rule_evaluation)
 * 4. Operations Gateway capabilities (alerts, alert, incidents, incident, incident-events, evaluate-alerts, acknowledge-incident, resolve-incident)
 * 5. Client SDK typed methods & state boundary
 * 6. Super Admin RLS policies and role isolation
 * 7. Phase boundary preservation (no premature external notifications, no forecasting, no ML)
 * 8. Migration ledger byte-for-byte parity
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
console.log('🚀 Phase 5 Verification: Alert & Incident Engine');
console.log('================================================================\n');

const fnDir = path.join(rootDir, 'lpu-events-admin/supabase/functions/superadmin-operations');
const migrationPath = path.join(
  rootDir,
  'lpu-events-admin/supabase/migrations/20261008110000_operations_alert_and_incident_engine.sql'
);
const rootMigrationPath = path.join(
  rootDir,
  'supabase/migrations/20261008110000_operations_alert_and_incident_engine.sql'
);

// -------------------------------------------------------------------------
// SUITE 1: Canonical Alert & Incident Schema
// -------------------------------------------------------------------------
console.log('📌 Test Suite 1: Canonical Alert & Incident Schema');

runTest('1.1: Migration file exists in canonical admin migrations directory', () => {
  assert(fs.existsSync(migrationPath), 'Missing Phase 5 migration file');
});

runTest('1.2: ops_alert_rules table created with canonical constraints & types', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_alert_rules'), 'ops_alert_rules table missing');
  assert(sql.includes("'THRESHOLD'"), 'Missing THRESHOLD condition');
  assert(sql.includes("'RATE'"), 'Missing RATE condition');
  assert(sql.includes("'HEALTH_FAILURE'"), 'Missing HEALTH_FAILURE condition');
  assert(sql.includes("'JOB_FAILURE'"), 'Missing JOB_FAILURE condition');
  assert(sql.includes("'JOB_STALE'"), 'Missing JOB_STALE condition');
  assert(sql.includes("'TELEMETRY_STALE'"), 'Missing TELEMETRY_STALE condition');
  assert(sql.includes("'PROVIDER_UNAVAILABLE'"), 'Missing PROVIDER_UNAVAILABLE condition');
  assert(sql.includes("'INFO', 'WARNING', 'HIGH', 'CRITICAL'"), 'Invalid severity constraint');
  assert(sql.includes('rule_key text UNIQUE NOT NULL'), 'rule_key must be unique');
  assert(sql.includes('incident_group_key text NOT NULL'), 'incident_group_key required');
});

runTest('1.3: ops_incidents table created with state machine & group key', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_incidents'), 'ops_incidents table missing');
  assert(sql.includes('incident_key text UNIQUE NOT NULL'), 'incident_key must be unique');
  assert(sql.includes("'OPEN', 'ACKNOWLEDGED', 'RESOLVED'"), 'Invalid incident status constraint');
  assert(sql.includes("'INFO', 'WARNING', 'HIGH', 'CRITICAL'"), 'Invalid incident severity constraint');
  assert(sql.includes('group_key text NOT NULL'), 'group_key required');
});

runTest('1.4: ops_alerts table created with deduplication counters and evidence', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_alerts'), 'ops_alerts table missing');
  assert(sql.includes('occurrence_count integer NOT NULL DEFAULT 1'), 'occurrence_count counter required');
  assert(sql.includes('evidence jsonb NOT NULL DEFAULT'), 'sanitized evidence jsonb required');
  assert(sql.includes('consecutive_failures integer'), 'flapping failure counter required');
  assert(sql.includes('consecutive_successes integer'), 'flapping recovery counter required');
});

runTest('1.5: ops_incident_events table created with append-only timeline events', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.ops_incident_events'), 'ops_incident_events table missing');
  assert(sql.includes("'INCIDENT_OPENED'"), 'Missing INCIDENT_OPENED event');
  assert(sql.includes("'ALERT_CREATED'"), 'Missing ALERT_CREATED event');
  assert(sql.includes("'ALERT_OCCURRED_AGAIN'"), 'Missing ALERT_OCCURRED_AGAIN event');
  assert(sql.includes("'SEVERITY_CHANGED'"), 'Missing SEVERITY_CHANGED event');
  assert(sql.includes("'INCIDENT_ACKNOWLEDGED'"), 'Missing INCIDENT_ACKNOWLEDGED event');
  assert(sql.includes("'INCIDENT_RESOLVED'"), 'Missing INCIDENT_RESOLVED event');
  assert(sql.includes("'ALERT_RESOLVED'"), 'Missing ALERT_RESOLVED event');
});

runTest('1.6: Canonical initial alert rules seeded into ops_alert_rules', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes("'database_storage_warning'"), 'Missing database_storage_warning seed');
  assert(sql.includes("'worker_error_rate_high'"), 'Missing worker_error_rate_high seed');
  assert(sql.includes("'cloudflare_provider_unavailable'"), 'Missing cloudflare_provider_unavailable seed');
  assert(sql.includes("'database_cleanup_failed'"), 'Missing database_cleanup_failed seed');
  assert(sql.includes("'r2_orphan_cleanup_failed'"), 'Missing r2_orphan_cleanup_failed seed');
  assert(sql.includes("'database_cleanup_stale'"), 'Missing database_cleanup_stale seed');
  assert(sql.includes("'provider_telemetry_stale'"), 'Missing provider_telemetry_stale seed');
});

runTest('1.7: alert_rule_evaluation job seeded into ops_jobs registry', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes("'alert_rule_evaluation'"), 'Missing alert_rule_evaluation job in ops_jobs');
  assert(sql.includes("'Operational Alert Rule Evaluation & Incident Engine'"), 'Missing job title');
});

runTest('1.8: Strict Super Admin RLS and service role access applied across all 4 tables', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('ALTER TABLE public.ops_alert_rules ENABLE ROW LEVEL SECURITY;'), 'RLS missing on rules');
  assert(sql.includes('ALTER TABLE public.ops_incidents ENABLE ROW LEVEL SECURITY;'), 'RLS missing on incidents');
  assert(sql.includes('ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;'), 'RLS missing on alerts');
  assert(sql.includes('ALTER TABLE public.ops_incident_events ENABLE ROW LEVEL SECURITY;'), 'RLS missing on events');
  assert(sql.includes('public.is_super_admin()'), 'Super admin helper check missing');
});

runTest('1.9: Canonical migration ledger maintains full byte-for-byte parity', () => {
  assert(fs.existsSync(rootMigrationPath), 'Root mirror migration missing');
  const adminSql = fs.readFileSync(migrationPath, 'utf8');
  const rootSql = fs.readFileSync(rootMigrationPath, 'utf8');
  assert.strictEqual(adminSql, rootSql, 'Canonical admin and root migrations must be identical');

  const followUpAdmin = path.join(
    rootDir,
    'lpu-events-admin/supabase/migrations/20261008113000_operations_alert_and_incident_actor_and_provenance.sql'
  );
  const followUpRoot = path.join(
    rootDir,
    'supabase/migrations/20261008113000_operations_alert_and_incident_actor_and_provenance.sql'
  );
  assert(fs.existsSync(followUpAdmin), 'Missing Phase 5 follow-up migration file in admin');
  assert(fs.existsSync(followUpRoot), 'Missing Phase 5 follow-up migration file in root');
  assert.strictEqual(
    fs.readFileSync(followUpAdmin, 'utf8'),
    fs.readFileSync(followUpRoot, 'utf8'),
    'Follow-up migrations must be byte-for-byte identical'
  );
});

runTest('1.10: ops_incidents schema includes resolution_type column with AUTO_RECOVERY and MANUAL constraints', () => {
  const followUpAdmin = path.join(
    rootDir,
    'lpu-events-admin/supabase/migrations/20261008113000_operations_alert_and_incident_actor_and_provenance.sql'
  );
  const sql = fs.readFileSync(followUpAdmin, 'utf8');
  assert(sql.includes('resolution_type text CHECK'), 'Missing resolution_type column');
  assert(sql.includes("'AUTO_RECOVERY', 'MANUAL'"), 'Missing AUTO_RECOVERY and MANUAL constraint values');
});

// -------------------------------------------------------------------------
// SUITE 2: Server-Side Authoritative RPCs & Actor Attribution Integrity
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Server-Side Authoritative RPCs & Actor Attribution Integrity');

runTest('2.1: acknowledge_operations_incident derives actor internally and rejects forged actor identity', () => {
  const followUpAdmin = path.join(
    rootDir,
    'lpu-events-admin/supabase/migrations/20261008113000_operations_alert_and_incident_actor_and_provenance.sql'
  );
  const sql = fs.readFileSync(followUpAdmin, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.acknowledge_operations_incident'), 'Missing acknowledge RPC');
  assert(sql.includes('v_auth_uid') && sql.includes('auth.uid()'), 'Must check auth.uid() internally');
  assert(sql.includes('Forged actor identity rejected'), 'Must reject forged actor identity');
  assert(sql.includes("status = 'ACKNOWLEDGED'"), 'Missing status update');
  assert(sql.includes("'INCIDENT_ACKNOWLEDGED'"), 'Missing timeline event insertion');
});

runTest('2.2: resolve_operations_incident records MANUAL resolution provenance and enforces internal actor derivation', () => {
  const followUpAdmin = path.join(
    rootDir,
    'lpu-events-admin/supabase/migrations/20261008113000_operations_alert_and_incident_actor_and_provenance.sql'
  );
  const sql = fs.readFileSync(followUpAdmin, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.resolve_operations_incident'), 'Missing resolve RPC');
  assert(sql.includes('length(v_clean_reason) < 3'), 'Missing reason validation check');
  assert(sql.includes("resolution_type = 'MANUAL'"), 'Must persist resolution_type = MANUAL');
  assert(sql.includes('Forged actor identity rejected'), 'Must reject forged actor identity');
  assert(sql.includes("status = 'RESOLVED'"), 'Missing status update');
  assert(sql.includes("'INCIDENT_RESOLVED'"), 'Missing timeline event insertion');
});

runTest('2.3: prune_stale_operations_alerts_and_incidents protects active/open records', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.prune_stale_operations_alerts_and_incidents'), 'Missing prune RPC');
  assert(sql.includes("status = 'RESOLVED'"), 'Prune must only delete RESOLVED status');
  assert(sql.includes('resolved_at < v_alert_cutoff'), 'Cutoff check missing for alerts');
  assert(sql.includes('resolved_at < v_incident_cutoff'), 'Cutoff check missing for incidents');
});

// -------------------------------------------------------------------------
// SUITE 3: Server-Side Rule Evaluator
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Server-Side Rule Evaluator');

runTest('3.1: evaluator.ts exports evaluateOperationalAlertRules with single-flight locking', () => {
  const evalPath = path.join(fnDir, 'alerts/evaluator.ts');
  assert(fs.existsSync(evalPath), 'Missing evaluator.ts file');
  const content = fs.readFileSync(evalPath, 'utf8');
  assert(content.includes('export async function evaluateOperationalAlertRules'), 'Missing evaluateOperationalAlertRules export');
  assert(content.includes('start_operations_job_run'), 'Must acquire single-flight lease from ops_job_runs');
  assert(content.includes('finish_operations_job_run'), 'Must complete job run execution');
});

runTest('3.2: Evaluator implements deduplication, correlation, dynamic severity, and flapping protection', () => {
  const evalPath = path.join(fnDir, 'alerts/evaluator.ts');
  const content = fs.readFileSync(evalPath, 'utf8');
  assert(content.includes('occurrence_count: activeAlert.occurrence_count + 1'), 'Deduplication counter update missing');
  assert(content.includes('ALERT_OCCURRED_AGAIN'), 'Timeline event for repeated occurrences missing');
  assert(content.includes('consecutive_count_threshold'), 'Flapping protection trigger threshold check missing');
  assert(content.includes('recovery_consecutive_threshold'), 'Flapping protection recovery threshold check missing');
  assert(content.includes('getHighestSeverity'), 'Dynamic severity calculation missing');
});

// -------------------------------------------------------------------------
// SUITE 4: Operations Gateway Router
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Operations Gateway Router');

runTest('4.1: operations.ts router exposes all Phase 5 capabilities', () => {
  const opsContent = fs.readFileSync(path.join(fnDir, 'operations.ts'), 'utf8');
  assert(opsContent.includes("case 'alerts':"), 'Missing alerts action');
  assert(opsContent.includes("case 'alert':"), 'Missing alert action');
  assert(opsContent.includes("case 'incidents':"), 'Missing incidents action');
  assert(opsContent.includes("case 'incident':"), 'Missing incident action');
  assert(opsContent.includes("case 'incident-events':"), 'Missing incident-events action');
  assert(opsContent.includes("case 'evaluate-alerts':"), 'Missing evaluate-alerts action');
  assert(opsContent.includes("case 'acknowledge-incident':"), 'Missing acknowledge-incident action');
  assert(opsContent.includes("case 'resolve-incident':"), 'Missing resolve-incident action');
});

runTest('4.2: Overview response includes Phase 5 status and incident/alert aggregates', () => {
  const opsContent = fs.readFileSync(path.join(fnDir, 'operations.ts'), 'utf8');
  assert(opsContent.includes("'PHASE_5_ALERT_AND_INCIDENT_ENGINE'"), 'Overview phase must be updated to Phase 5');
  assert(opsContent.includes('incidents_summary'), 'Overview must return incidents_summary');
  assert(opsContent.includes('alerts_summary'), 'Overview must return alerts_summary');
});

// -------------------------------------------------------------------------
// SUITE 5: Client SDK & Security Boundary
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Client SDK & Security Boundary');

runTest('5.1: OperationsClient exports typed Phase 5 methods', () => {
  const clientPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts');
  const content = fs.readFileSync(clientPath, 'utf8');
  assert(content.includes('public async getAlerts('), 'Missing getAlerts method');
  assert(content.includes('public async getAlert('), 'Missing getAlert method');
  assert(content.includes('public async getIncidents('), 'Missing getIncidents method');
  assert(content.includes('public async getIncident('), 'Missing getIncident method');
  assert(content.includes('public async getIncidentEvents('), 'Missing getIncidentEvents method');
  assert(content.includes('public async evaluateAlerts('), 'Missing evaluateAlerts method');
  assert(content.includes('public async acknowledgeIncident('), 'Missing acknowledgeIncident method');
  assert(content.includes('public async resolveIncident('), 'Missing resolveIncident method');
});

runTest('5.2: Client SDK contains zero rule-creation or arbitrary status-mutation methods', () => {
  const clientPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts');
  const content = fs.readFileSync(clientPath, 'utf8');
  assert(!content.includes('createAlert('), 'Forbidden createAlert method in client');
  assert(!content.includes('createIncident('), 'Forbidden createIncident method in client');
  assert(!content.includes('createAlertRule('), 'Forbidden createAlertRule method in client');
  assert(!content.includes('setSeverity('), 'Forbidden setSeverity method in client');
});

runTest('5.3: Zero server credentials present in client source or dist code', () => {
  const forbiddenPatterns = [
    'CLOUDFLARE_API_TOKEN',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
    'SENTRY_AUTH_TOKEN',
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
        for (const pat of forbiddenPatterns) {
          assert(!text.includes(pat), `Forbidden pattern ${pat} in ${full}`);
        }
      }
    }
  }

  scan(path.join(rootDir, 'lpu-events-admin/src'));
  scan(path.join(rootDir, 'lpu-events-student/src'));
});

// -------------------------------------------------------------------------
// SUITE 6: Phase Boundary Preservation
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Phase Boundary Preservation');

runTest('6.1: Zero premature external notification dispatch (no email, SMS, Slack, PagerDuty)', () => {
  const evalPath = path.join(fnDir, 'alerts/evaluator.ts');
  const content = fs.readFileSync(evalPath, 'utf8').toLowerCase();
  assert(!content.includes('nodemailer'), 'Forbidden email sender in evaluator');
  assert(!content.includes('resend.emails.send'), 'Forbidden direct email notification in alert evaluator');
  assert(!content.includes('slack.com/api'), 'Forbidden Slack notification in alert evaluator');
  assert(!content.includes('pagerduty.com'), 'Forbidden PagerDuty notification in alert evaluator');
  assert(!content.includes('twilio'), 'Forbidden SMS sender in alert evaluator');
});

runTest('6.2: Zero predictive forecasting or ML algorithms in operations router', () => {
  const opsContent = fs.readFileSync(path.join(fnDir, 'operations.ts'), 'utf8');
  assert(!opsContent.toLowerCase().includes('machine_learning'), 'Forbidden ML in operations');
});

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 Phase 5 Verification Complete: ${passedTests}/${totalTests} Tests Passed`);
console.log('================================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL PHASE 5 REQUIREMENTS SATISFIED!\n');
} else {
  console.error('❌ PHASE 5 VERIFICATION FAILED\n');
  process.exit(1);
}
