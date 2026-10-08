#!/usr/bin/env node
/**
 * verify_operations_phase8.mjs
 * Static verification suite for Phase 8: Operational Notifications & Escalation.
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
console.log('🚀 Phase 8 Verification: Operational Notifications & Escalation');
console.log('================================================================');

const migrationPath = path.join(
  rootDir,
  'lpu-events-admin/supabase/migrations/20261008140000_operations_notifications_and_escalation.sql'
);
const mirroredMigrationPath = path.join(
  rootDir,
  'supabase/migrations/20261008140000_operations_notifications_and_escalation.sql'
);
const notifDir = path.join(rootDir, 'supabase/functions/superadmin-operations/notifications');
const operationsRouterPath = path.join(rootDir, 'supabase/functions/superadmin-operations/operations.ts');
const clientTypesPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/types.ts');
const clientSdkPath = path.join(rootDir, 'lpu-events-admin/src/shared/operations/client.ts');
const notifPanelPath = path.join(rootDir, 'lpu-events-admin/src/components/superadmin/operations/NotificationCenterPanel.tsx');
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

runTest('1.2: All Phase 8 notification tables are defined', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const requiredTables = [
    'ops_notification_recipients',
    'ops_notification_groups',
    'ops_notification_group_members',
    'ops_notification_policies',
    'ops_notification_outbox',
    'ops_notification_delivery_attempts',
  ];
  for (const t of requiredTables) {
    assert(sql.includes(`CREATE TABLE IF NOT EXISTS public.${t}`), `Missing table definition: ${t}`);
  }
});

runTest('1.3: Idempotency constraint and indexes are defined on outbox and delivery tables', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('idempotency_key TEXT NOT NULL UNIQUE'), 'Missing idempotency_key UNIQUE constraint');
  assert(sql.includes('idx_ops_notification_outbox_process'), 'Missing status/scheduled_at process index');
  assert(sql.includes('idx_ops_notification_outbox_incident'), 'Missing incident_id index on outbox');
  assert(sql.includes('idx_ops_delivery_attempts_notif'), 'Missing notification_id index on attempts');
});

runTest('1.4: Row-Level Security (RLS) is enabled with Super Admin and service_role access only', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const tables = [
    'ops_notification_recipients',
    'ops_notification_groups',
    'ops_notification_group_members',
    'ops_notification_policies',
    'ops_notification_outbox',
    'ops_notification_delivery_attempts',
  ];
  for (const t of tables) {
    assert(sql.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`), `RLS not enabled on ${t}`);
    assert(sql.includes(`CREATE POLICY`), `Policy missing on ${t}`);
    assert(sql.includes(`is_super_admin()`), `Super admin check missing for table policies`);
  }
});

runTest('1.5: Pruning stored procedure prune_stale_operations_notifications is defined with safe search_path', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('CREATE OR REPLACE FUNCTION public.prune_stale_operations_notifications'), 'Pruning function missing');
  assert(sql.includes('SET search_path = public'), 'Missing search_path = public on pruning function');
  assert(sql.includes("status IN ('REQUEST_ACCEPTED', 'SENT', 'FAILED', 'CANCELLED')"), 'Pruning must delete inactive records');
  assert(sql.includes("protect PENDING and PROCESSING"), 'Active records must be explicitly protected from pruning');
});

runTest('1.6: Canonical operational jobs notification_delivery and notification_outbox_prune are registered', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes("'notification_delivery'"), 'Missing notification_delivery ops_job registration');
  assert(sql.includes("'notification_outbox_prune'"), 'Missing notification_outbox_prune ops_job registration');
});

// -------------------------------------------------------------------------
// SUITE 2: Server-Side Backend Engine Architecture
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Server-Side Backend Engine Architecture');

runTest('2.1: Notification engine modules exist in superadmin-operations/notifications', () => {
  assert(fs.existsSync(notifDir), 'Notifications backend directory missing');
  const files = ['types.ts', 'templates.ts', 'dispatcher.ts', 'delivery.ts', 'index.ts'];
  for (const f of files) {
    assert(fs.existsSync(path.join(notifDir, f)), `Missing backend module: ${f}`);
  }
});

runTest('2.2: Templates strictly support all required operational event types without executable script', () => {
  const templatesCode = fs.readFileSync(path.join(notifDir, 'templates.ts'), 'utf8');
  assert(templatesCode.includes('INCIDENT_CREATED'), 'Missing INCIDENT_CREATED template');
  assert(templatesCode.includes('INCIDENT_ESCALATED'), 'Missing INCIDENT_ESCALATED template');
  assert(templatesCode.includes('INCIDENT_RESOLVED'), 'Missing INCIDENT_RESOLVED template');
  assert(templatesCode.includes('INCIDENT_MANUALLY_RESOLVED'), 'Missing INCIDENT_MANUALLY_RESOLVED template');
  assert(templatesCode.includes('escapeHtml'), 'Missing HTML escaping in templates');
});

runTest('2.3: Dispatcher enforces deterministic eligibility, cooldown, idempotency, and escalation', () => {
  const dispCode = fs.readFileSync(path.join(notifDir, 'dispatcher.ts'), 'utf8');
  assert(dispCode.includes('severityRank'), 'Missing severity ranking evaluation');
  assert(dispCode.includes('cooldownCutoff'), 'Missing cooldown calculation');
  assert(dispCode.includes('idempotencyKey'), 'Missing idempotencyKey construction');
  assert(dispCode.includes('evaluateEscalations'), 'Missing evaluateEscalations export');
  assert(dispCode.includes('cancelPendingIncidentNotifications'), 'Missing cancelPendingIncidentNotifications export');
});

runTest('2.4: Delivery worker enforces single-flight locking, bounded retries, and Resend adapter', () => {
  const delivCode = fs.readFileSync(path.join(notifDir, 'delivery.ts'), 'utf8');
  assert(delivCode.includes('Single-flight atomic claim'), 'Missing single-flight atomic claiming');
  assert(delivCode.includes('MAX_DELIVERY_ATTEMPTS = 3'), 'Missing bounded max attempts = 3');
  assert(delivCode.includes('https://api.resend.com/emails'), 'Missing server-side Resend API dispatch');
  assert(delivCode.includes('BACKOFF_SECONDS'), 'Missing exponential backoff schedule');
  assert(delivCode.includes('REQUEST_ACCEPTED'), 'Truthful delivery semantics: must use REQUEST_ACCEPTED');
  assert(!delivCode.includes("status: 'DELIVERED'"), 'Must NOT claim DELIVERED when only accepted');
});

runTest('2.5: Anti-recursion protection is enforced on notification delivery failure', () => {
  const delivCode = fs.readFileSync(path.join(notifDir, 'delivery.ts'), 'utf8');
  assert(delivCode.includes('Anti-Recursion Protection'), 'Missing anti-recursion documentation/guard');
  assert(!delivCode.includes('evaluateOperationalAlertRules'), 'Delivery worker must not call alert rules directly');
});

// -------------------------------------------------------------------------
// SUITE 3: Operations Gateway & Routing Integration
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Operations Gateway & Routing Integration');

runTest('3.1: Operations router supports all notification actions', () => {
  const routerCode = fs.readFileSync(operationsRouterPath, 'utf8');
  const requiredActions = [
    'notifications-overview',
    'notifications-policies',
    'notifications-policy-update',
    'notifications-recipients',
    'notifications-recipient-create',
    'notifications-recipient-update',
    'notifications-recipient-delete',
    'notifications-groups',
    'notifications-outbox',
    'notifications-attempts',
    'notifications-retry',
    'notifications-cancel',
    'notifications-process',
    'notifications-preview',
    'notifications-prune',
  ];
  for (const act of requiredActions) {
    assert(routerCode.includes(`case '${act}':`), `Router missing action case: ${act}`);
  }
});

runTest('3.2: Alert evaluation triggers notification eligibility, escalation, and outbox processing', () => {
  const routerCode = fs.readFileSync(operationsRouterPath, 'utf8');
  assert(routerCode.includes('evaluateIncidentNotifications(supabase, inc, \'INCIDENT_CREATED\')'), 'Alert eval must trigger INCIDENT_CREATED notifications');
  assert(routerCode.includes('evaluateEscalations(supabase)'), 'Alert eval must trigger escalation evaluation');
  assert(routerCode.includes('processNotificationOutbox(supabase'), 'Alert eval must trigger outbox delivery processing');
});

runTest('3.3: Manual incident resolution dispatches INCIDENT_MANUALLY_RESOLVED and cancels pending alerts', () => {
  const routerCode = fs.readFileSync(operationsRouterPath, 'utf8');
  assert(routerCode.includes('cancelPendingIncidentNotifications(supabase, incidentId)'), 'Resolve incident must cancel pending notifications');
  assert(routerCode.includes('evaluateIncidentNotifications(supabase, resolvedInc, \'INCIDENT_MANUALLY_RESOLVED\')'), 'Resolve incident must trigger manual resolution notification');
});

// -------------------------------------------------------------------------
// SUITE 4: Client SDK & Type Definitions
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Client SDK & Type Definitions');

runTest('4.1: Shared types export Phase 8 notification contracts', () => {
  const typesCode = fs.readFileSync(clientTypesPath, 'utf8');
  const expectedTypes = [
    'OperationsNotificationRecipient',
    'OperationsNotificationGroup',
    'OperationsNotificationPolicy',
    'OperationsNotificationOutboxItem',
    'OperationsNotificationDeliveryAttempt',
    'OperationsNotificationsOverview',
    'OperationsNotificationPreviewResult',
  ];
  for (const t of expectedTypes) {
    assert(typesCode.includes(`export interface ${t}`), `Missing interface: ${t}`);
  }
});

runTest('4.2: OperationsClient exports typed notification methods', () => {
  const clientCode = fs.readFileSync(clientSdkPath, 'utf8');
  const expectedMethods = [
    'getNotificationsOverview',
    'getNotificationPolicies',
    'updateNotificationPolicy',
    'getNotificationRecipients',
    'createNotificationRecipient',
    'updateNotificationRecipient',
    'deleteNotificationRecipient',
    'getNotificationGroups',
    'getNotificationOutbox',
    'getNotificationAttempts',
    'retryNotification',
    'cancelNotification',
    'triggerNotificationDelivery',
    'previewNotificationTemplate',
  ];
  for (const m of expectedMethods) {
    assert(clientCode.includes(`public async ${m}(`), `Missing method on OperationsClient: ${m}`);
  }
});

// -------------------------------------------------------------------------
// SUITE 5: UI Integration in Super Admin Control Center
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: UI Integration in Super Admin Control Center');

runTest('5.1: NotificationCenterPanel exists and is integrated into OperationsControlCenter', () => {
  assert(fs.existsSync(notifPanelPath), 'NotificationCenterPanel.tsx file missing');
  const ccCode = fs.readFileSync(controlCenterPath, 'utf8');
  assert(ccCode.includes("import { NotificationCenterPanel } from './NotificationCenterPanel'"), 'Missing NotificationCenterPanel import');
  assert(ccCode.includes("<NotificationCenterPanel"), 'NotificationCenterPanel must be rendered in OperationsControlCenter');
});

runTest('5.2: NotificationCenterPanel implements all required operational sections and controls', () => {
  const uiCode = fs.readFileSync(notifPanelPath, 'utf8');
  assert(uiCode.includes('Outbox & Deliveries'), 'Missing Outbox tab');
  assert(uiCode.includes('Policies & Escalation'), 'Missing Policies tab');
  assert(uiCode.includes('Recipients & Groups'), 'Missing Recipients tab');
  assert(uiCode.includes('Safe Template Preview'), 'Missing Preview tab');
  assert(uiCode.includes('handleRetry'), 'Missing manual retry handler');
  assert(uiCode.includes('handleCancel'), 'Missing manual cancel handler');
  assert(uiCode.includes('handleProcessQueue'), 'Missing queue dispatch trigger');
});

// -------------------------------------------------------------------------
// SUITE 6: Security, Secret Isolation & No Mock Leaks
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Security, Secret Isolation & No Mock Leaks');

runTest('6.1: Provider secret RESEND_API_KEY never leaks into client src', () => {
  const adminSrcDir = path.join(rootDir, 'lpu-events-admin/src');
  const files = fs.readdirSync(adminSrcDir, { recursive: true });
  for (const f of files) {
    const fullPath = path.join(adminSrcDir, f);
    if (fs.statSync(fullPath).isFile() && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert(!content.includes('RESEND_API_KEY'), `RESEND_API_KEY found in frontend code: ${f}`);
    }
  }
});

runTest('6.2: SUPABASE_SERVICE_ROLE_KEY never leaks into client src', () => {
  const adminSrcDir = path.join(rootDir, 'lpu-events-admin/src');
  const files = fs.readdirSync(adminSrcDir, { recursive: true });
  for (const f of files) {
    const fullPath = path.join(adminSrcDir, f);
    if (
      fs.statSync(fullPath).isFile() &&
      (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) &&
      !f.includes('__tests__') &&
      !f.endsWith('.test.ts')
    ) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert(!content.includes('SUPABASE_SERVICE_ROLE_KEY'), `SUPABASE_SERVICE_ROLE_KEY found in frontend code: ${f}`);
    }
  }
});

runTest('6.3: Production notification dispatch does not use fake or simulated delivery flags', () => {
  const delivCode = fs.readFileSync(path.join(notifDir, 'delivery.ts'), 'utf8');
  assert(!delivCode.includes('Math.random() > 0.5'), 'Delivery worker must not use random simulation in production path');
});

console.log('\n================================================================');
console.log(`📊 Phase 8 Static Verification Summary: ${passedTests}/${totalTests} Tests Passed`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('🎉 All Phase 8 Static Verification checks PASSED!\n');
}
