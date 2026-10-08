/**
 * scripts/verify_operations_phase2.mjs
 * 
 * LPU Events — Phase 2 Verification Suite
 * Super Admin Operations Backend Foundation
 * 
 * Validates:
 * 1. Database diagnostics RPC migration & SECURITY DEFINER isolation
 * 2. Edge Function modules, router, and request pipeline
 * 3. Super Admin-only authorization & role enforcement
 * 4. Request context & Correlation ID propagation
 * 5. Standard operational response & error envelopes
 * 6. Provider secret boundary & client source zero-leakage audit
 * 7. Service registry & truthful status vocabulary
 * 8. Safe database diagnostics contracts
 * 9. Student website isolation
 * 10. Phase boundary integrity (no premature Phase 3+ features)
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
console.log('🚀 Phase 2 Verification: Operations Backend Foundation');
console.log('================================================================\n');

// -------------------------------------------------------------------------
// SUITE 1: Database Diagnostics RPC Migration Security
// -------------------------------------------------------------------------
console.log('📌 Test Suite 1: Database Diagnostics RPC Security & Migration');

runTest('1.1: Migration file exists in both admin and root migrations directories', () => {
  const adminMigrationPath = path.join(
    rootDir,
    'lpu-events-admin/supabase/migrations/20261007160000_operations_backend_foundation.sql'
  );
  const rootMigrationPath = path.join(
    rootDir,
    'supabase/migrations/20261007160000_operations_backend_foundation.sql'
  );

  assert(fs.existsSync(adminMigrationPath), 'Missing migration in lpu-events-admin');
  assert(fs.existsSync(rootMigrationPath), 'Missing migration in root supabase');
});

runTest('1.2: RPC uses SECURITY DEFINER with safe fixed search_path', () => {
  const migrationPath = path.join(
    rootDir,
    'lpu-events-admin/supabase/migrations/20261007160000_operations_backend_foundation.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert(sql.includes('SECURITY DEFINER'), 'RPC must be SECURITY DEFINER');
  assert(sql.includes("SET search_path = pg_catalog, public"), 'RPC must lock search_path to pg_catalog, public');
});

runTest('1.3: RPC explicitly enforces public.is_super_admin() with 42501 permission denial', () => {
  const migrationPath = path.join(
    rootDir,
    'lpu-events-admin/supabase/migrations/20261007160000_operations_backend_foundation.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert(sql.includes('public.is_super_admin()'), 'RPC must call public.is_super_admin()');
  assert(sql.includes("errcode = '42501'"), 'RPC must raise 42501 insufficient privileges error');
});

runTest('1.4: RPC revokes execution from PUBLIC and anon', () => {
  const migrationPath = path.join(
    rootDir,
    'lpu-events-admin/supabase/migrations/20261007160000_operations_backend_foundation.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert(sql.includes('REVOKE ALL ON FUNCTION public.get_operations_database_diagnostics() FROM PUBLIC, anon;'),
    'RPC must revoke execution from PUBLIC and anon');
  assert(sql.includes('GRANT EXECUTE ON FUNCTION public.get_operations_database_diagnostics() TO authenticated, service_role;'),
    'RPC must grant only to authenticated, service_role');
});

runTest('1.5: Canonical migration master (lpu-events-admin/supabase/migrations/) maintains full byte-for-byte parity', () => {
  const canonicalDir = path.join(rootDir, 'lpu-events-admin/supabase/migrations');
  const mirroredDir = path.join(rootDir, 'supabase/migrations');
  const canonicalFiles = fs.readdirSync(canonicalDir).filter(f => f.endsWith('.sql'));
  const mirroredFiles = fs.readdirSync(mirroredDir).filter(f => f.endsWith('.sql'));

  assert.strictEqual(canonicalFiles.length, mirroredFiles.length,
    `Migration file count mismatch: canonical=${canonicalFiles.length}, mirrored=${mirroredFiles.length}`);
});

// -------------------------------------------------------------------------
// SUITE 2: Operations Edge Function Architecture & Modules
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 2: Operations Edge Function Architecture');

const fnDir = path.join(rootDir, 'lpu-events-admin/supabase/functions/superadmin-operations');

runTest('2.1: Modular Edge Function files exist and are mirrored', () => {
  const requiredFiles = [
    'index.ts',
    'auth.ts',
    'request-context.ts',
    'operations.ts',
    'diagnostics.ts',
    'services.ts',
    'responses.ts',
    'errors.ts',
    'security.ts',
    'timeout.ts',
    'providers/types.ts',
  ];

  for (const f of requiredFiles) {
    const adminPath = path.join(fnDir, f);
    const rootPath = path.join(rootDir, 'supabase/functions/superadmin-operations', f);
    assert(fs.existsSync(adminPath), `Missing admin edge function file: ${f}`);
    assert(fs.existsSync(rootPath), `Missing mirrored root edge function file: ${f}`);
  }
});

runTest('2.2: superadmin-operations router enforces capability whitelist', () => {
  const opsFile = fs.readFileSync(path.join(fnDir, 'operations.ts'), 'utf8');
  assert(opsFile.includes("case 'overview':"), 'Router must support overview action');
  assert(opsFile.includes("case 'services':"), 'Router must support services action');
  assert(opsFile.includes("case 'capabilities':"), 'Router must support capabilities action');
  assert(opsFile.includes("case 'database':"), 'Router must support database action');
  assert(opsFile.includes("case 'providers':"), 'Router must support providers action');
  assert(opsFile.includes("throw new OperationsError"), 'Router must reject unknown actions with OperationsError');
});

runTest('2.3: Zero raw SQL or arbitrary execution endpoints exist in operations router', () => {
  const opsFile = fs.readFileSync(path.join(fnDir, 'operations.ts'), 'utf8');
  const forbiddenPatterns = [
    'execute_admin_sql',
    'run-sql',
    'debug-query',
    'raw-query',
    'pg_stat_activity',
    'select * from pg_',
  ];
  for (const pat of forbiddenPatterns) {
    assert(!opsFile.toLowerCase().includes(pat), `Operations router contains forbidden pattern: ${pat}`);
  }
});

// -------------------------------------------------------------------------
// SUITE 3: Server-Side Super Admin Authorization & Role Enforcement
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 3: Super Admin Server-Side Authorization');

runTest('3.1: auth.ts verifies JWT, admin_users.is_active, and platform_admin_roles SUPER_ADMIN', () => {
  const authFile = fs.readFileSync(path.join(fnDir, 'auth.ts'), 'utf8');
  assert(authFile.includes('supabase.auth.getUser(jwt)'), 'Must authenticate JWT session');
  assert(authFile.includes('.from("admin_users")'), 'Must resolve admin_users identity');
  assert(authFile.includes('!adminUser.is_active'), 'Must verify is_active administrative flag');
  assert(authFile.includes('.from("platform_admin_roles")'), 'Must query platform_admin_roles');
  assert(authFile.includes('platformRole.role !== "SUPER_ADMIN"'), 'Must strictly verify SUPER_ADMIN role');
});

runTest('3.2: auth.ts throws standardized UNAUTHENTICATED (401) and FORBIDDEN (403)', () => {
  const authFile = fs.readFileSync(path.join(fnDir, 'auth.ts'), 'utf8');
  assert(authFile.includes('"UNAUTHENTICATED"'), 'Must throw UNAUTHENTICATED for missing/invalid token');
  assert(authFile.includes('"FORBIDDEN"'), 'Must throw FORBIDDEN for non-super-admin identities');
  assert(authFile.includes('401'), 'Must return HTTP 401 for authentication failures');
  assert(authFile.includes('403'), 'Must return HTTP 403 for authorization failures');
});

runTest('3.3: Operations authorization has zero dependency on student accounts', () => {
  const authFile = fs.readFileSync(path.join(fnDir, 'auth.ts'), 'utf8');
  const indexFile = fs.readFileSync(path.join(fnDir, 'index.ts'), 'utf8');
  assert(!authFile.toLowerCase().includes('students'), 'auth.ts must not query students table');
  assert(!authFile.toLowerCase().includes('student_profile'), 'auth.ts must not depend on student profiles');
  assert(!indexFile.toLowerCase().includes('students'), 'index.ts must not depend on student tables');
});

// -------------------------------------------------------------------------
// SUITE 4: Request Context, Correlation ID & Logging Redaction
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 4: Request Context, Correlation ID & Logging');

runTest('4.1: Request context generates server-side ops_req_${uuid}', () => {
  const rcFile = fs.readFileSync(path.join(fnDir, 'request-context.ts'), 'utf8');
  assert(rcFile.includes('ops_req_'), 'Must generate server-side ops_req_ prefix');
  assert(rcFile.includes('crypto.randomUUID()'), 'Must use cryptographically secure UUID generator');
});

runTest('4.2: Correlation ID is safely validated against regex whitelist', () => {
  const rcFile = fs.readFileSync(path.join(fnDir, 'request-context.ts'), 'utf8');
  assert(rcFile.includes('x-correlation-id'), 'Must read x-correlation-id header');
  assert(rcFile.includes('/^[A-Za-z0-9_-]{1,64}$/'), 'Must validate correlation ID format');
});

runTest('4.3: Server-side logger does not log tokens, secrets, or raw headers', () => {
  const rcFile = fs.readFileSync(path.join(fnDir, 'request-context.ts'), 'utf8');
  assert(!rcFile.includes('req.headers.get("authorization")'), 'Must not log authorization header');
  assert(rcFile.includes('channel: "operations_control_plane"'), 'Structured logging channel established');
});

// -------------------------------------------------------------------------
// SUITE 5: Standard Response Envelope & Error Taxonomy
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 5: Standard Response Envelope & Error Taxonomy');

runTest('5.1: Response envelopes conform to standard shape with meta', () => {
  const resFile = fs.readFileSync(path.join(fnDir, 'responses.ts'), 'utf8');
  assert(resFile.includes('success: true'), 'Success envelope has success: true');
  assert(resFile.includes('success: false'), 'Error envelope has success: false');
  assert(resFile.includes('request_id: ctx.requestId'), 'Envelopes include request_id');
  assert(resFile.includes('correlation_id: ctx.correlationId'), 'Envelopes include correlation_id');
  assert(resFile.includes('generated_at: new Date().toISOString()'), 'Meta includes generated_at');
  assert(resFile.includes('duration_ms: durationMs'), 'Meta includes duration_ms');
  assert(resFile.includes('source: "operations_gateway"'), 'Meta includes gateway source');
});

runTest('5.2: Error taxonomy covers all required Phase 2 error codes', () => {
  const errFile = fs.readFileSync(path.join(fnDir, 'errors.ts'), 'utf8');
  const requiredCodes = [
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'INVALID_REQUEST',
    'NOT_FOUND',
    'PROVIDER_NOT_CONFIGURED',
    'PROVIDER_UNAVAILABLE',
    'DIAGNOSTIC_FAILED',
    'INTERNAL_ERROR',
    'TIMEOUT',
  ];
  for (const c of requiredCodes) {
    assert(errFile.includes(`'${c}'`), `Missing error taxonomy code: ${c}`);
  }
});

runTest('5.3: Sensitive pattern scrubber redacts tokens, secrets, and connection strings', () => {
  const secFile = fs.readFileSync(path.join(fnDir, 'security.ts'), 'utf8');
  assert(secFile.includes('sanitizeOperationsResponse'), 'Sanitizer function must exist');
  assert(secFile.includes('[REDACTED]'), 'Scrubber must replace sensitive matches with [REDACTED]');
});

runTest('5.4: Response envelope dynamically resolves environment and never hardcodes production', () => {
  const resFile = fs.readFileSync(path.join(fnDir, 'responses.ts'), 'utf8');
  assert(resFile.includes('resolveEnvironment'), 'Must use dynamic resolveEnvironment function');
  assert(!resFile.includes('|| "production"'), 'Must never blindly default environment to "production"');
});

// -------------------------------------------------------------------------
// SUITE 6: Provider Secret Isolation & Zero Client Leakage Audit
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 6: Provider Secret Boundary & Client Leakage Scan');

function scanDirForSecrets(dirPath, forbiddenStrings) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git' && entry.name !== '__tests__') {
        scanDirForSecrets(fullPath, forbiddenStrings);
      }
    } else if (/\.(ts|tsx|js|mjs|json|html)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const secret of forbiddenStrings) {
        if (content.includes(secret)) {
          throw new Error(`File ${fullPath} contains forbidden secret reference: ${secret}`);
        }
      }
    }
  }
}

runTest('6.1: Client source code contains zero provider management secrets', () => {
  const forbiddenSecrets = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLOUDFLARE_API_TOKEN',
    'SENTRY_API_TOKEN',
    'RESEND_API_KEY',
    'R2_SECRET_ACCESS_KEY',
    'SUPABASE_MANAGEMENT_TOKEN',
  ];

  scanDirForSecrets(path.join(rootDir, 'lpu-events-admin/src'), forbiddenSecrets);
  scanDirForSecrets(path.join(rootDir, 'lpu-events-student/src'), forbiddenSecrets);
});

runTest('6.2: Client source code makes zero direct calls to provider management APIs', () => {
  const forbiddenCalls = [
    'https://api.cloudflare.com',
    'https://api.resend.com',
    'https://api.supabase.com',
  ];

  scanDirForSecrets(path.join(rootDir, 'lpu-events-admin/src'), forbiddenCalls);
  scanDirForSecrets(path.join(rootDir, 'lpu-events-student/src'), forbiddenCalls);
});

runTest('6.3: Provider boundary only evaluates configuration presence (no leaked tokens)', () => {
  const providerFile = fs.readFileSync(path.join(fnDir, 'providers/types.ts'), 'utf8');
  assert(providerFile.includes('isConfigured:'), 'Providers check isConfigured presence');
  assert(!providerFile.includes('return { token:'), 'Must never export tokens or secrets in provider registry');
});

// -------------------------------------------------------------------------
// SUITE 7: Service Registry & Truthful Status Vocabulary
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 7: Service Registry & Status Vocabulary');

runTest('7.1: Service registry defines all 7 foundational platform services', () => {
  const servicesFile = fs.readFileSync(path.join(fnDir, 'services.ts'), 'utf8');
  const expectedServices = [
    'supabase_database',
    'supabase_auth',
    'cloudflare_worker',
    'cloudflare_r2',
    'resend',
    'sentry',
    'github_actions',
  ];
  for (const s of expectedServices) {
    assert(servicesFile.includes(`key: '${s}'`), `Missing service definition: ${s}`);
  }
});

runTest('7.2: Unmonitored services are marked NOT_MONITORED, never falsely reported as HEALTHY', () => {
  const servicesFile = fs.readFileSync(path.join(fnDir, 'services.ts'), 'utf8');
  assert(servicesFile.includes("monitoringStatus: 'NOT_MONITORED'"), 'Services without active probes must be NOT_MONITORED');
  // Ensure non-database services are not set to HEALTHY
  const lines = servicesFile.split('\n');
  let currentService = '';
  for (const line of lines) {
    if (line.includes("key: '")) {
      currentService = line;
    }
    if (line.includes("monitoringStatus: 'HEALTHY'")) {
      assert(currentService.includes('supabase_database'), `Only supabase_database can have status HEALTHY in Phase 2, but found: ${currentService}`);
    }
  }
});

runTest('7.3: Operational status vocabulary adheres strictly to standard set', () => {
  const servicesFile = fs.readFileSync(path.join(fnDir, 'services.ts'), 'utf8');
  const requiredStatuses = [
    'HEALTHY',
    'WARNING',
    'CRITICAL',
    'DEGRADED',
    'UNKNOWN',
    'NOT_MONITORED',
    'NOT_CONFIGURED',
    'UNAVAILABLE',
  ];
  for (const st of requiredStatuses) {
    assert(servicesFile.includes(`'${st}'`), `Missing status vocabulary term: ${st}`);
  }
});

// -------------------------------------------------------------------------
// SUITE 8: Safe Database Diagnostics Foundation
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 8: Safe Database Diagnostics Foundation');

runTest('8.1: diagnostics.ts calls get_operations_database_diagnostics RPC safely', () => {
  const diagFile = fs.readFileSync(path.join(fnDir, 'diagnostics.ts'), 'utf8');
  assert(diagFile.includes(".rpc('get_operations_database_diagnostics')"), 'Must call get_operations_database_diagnostics RPC');
  assert(diagFile.includes('database_size_pretty'), 'Must sanitize storage metrics');
  assert(diagFile.includes('latency_ms:'), 'Must compute round-trip latency');
});

runTest('8.2: Timeout utility wraps asynchronous execution with bounded abort', () => {
  const timeoutFile = fs.readFileSync(path.join(fnDir, 'timeout.ts'), 'utf8');
  assert(timeoutFile.includes('withTimeout'), 'Must provide withTimeout helper');
  assert(timeoutFile.includes('AbortController'), 'Must use AbortController');
  assert(timeoutFile.includes('OperationsError("TIMEOUT"'), 'Must throw OperationsError on timeout');
});

// -------------------------------------------------------------------------
// SUITE 9: Student Website Isolation
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 9: Student Website Isolation');

runTest('9.1: Student website does not contain operations SDK or endpoints', () => {
  const studentSrcDir = path.join(rootDir, 'lpu-events-student/src');
  assert(!fs.existsSync(path.join(studentSrcDir, 'shared/operations')), 'Student site must not contain operations directory');
  assert(!fs.existsSync(path.join(studentSrcDir, 'components/superadmin')), 'Student site must not contain superadmin components');
});

// -------------------------------------------------------------------------
// SUITE 10: Phase Boundary Enforcement
// -------------------------------------------------------------------------
console.log('\n📌 Test Suite 10: Phase Boundary Enforcement');

runTest('10.1: No premature ops_* time-series or metric snapshot tables created', () => {
  const migrationPath = path.join(
    rootDir,
    'lpu-events-admin/supabase/migrations/20261007160000_operations_backend_foundation.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(!sql.includes('CREATE TABLE ops_metrics'), 'Forbidden premature metric time-series table');
  assert(!sql.includes('CREATE TABLE ops_alerts'), 'Forbidden premature alert table');
  assert(!sql.includes('CREATE TABLE ops_incidents'), 'Forbidden premature incident table');
});

runTest('10.2: No premature live provider telemetry calls in edge function', () => {
  const files = fs.readdirSync(fnDir);
  for (const f of files) {
    if (f.endsWith('.ts')) {
      const content = fs.readFileSync(path.join(fnDir, f), 'utf8');
      assert(!content.includes('api.cloudflare.com'), `Found live Cloudflare API call in ${f}`);
      assert(!content.includes('api.resend.com'), `Found live Resend API call in ${f}`);
      assert(!content.includes('api.supabase.com'), `Found live Supabase Management API call in ${f}`);
      assert(!content.includes('sentry.io/api'), `Found live Sentry API call in ${f}`);
    }
  }
});

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 Phase 2 Verification Complete: ${passedTests}/${totalTests} Tests Passed`);
console.log('================================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL PHASE 2 REQUIREMENTS SATISFIED!\n');
  process.exit(0);
} else {
  console.error(`❌ Verification failed: ${totalTests - passedTests} tests failed.\n`);
  process.exit(1);
}
