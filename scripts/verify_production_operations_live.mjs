/**
 * scripts/verify_production_operations_live.mjs
 * 
 * LPU Events — Real Production Operations Control Plane Verification Suite
 * 
 * Performs 100% genuine HTTPS and database checks against production infrastructure.
 * Zero simulation. Zero fake passes. Fails closed if production is unreachable.
 */

import https from 'https';
import { execSync } from 'child_process';

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

function httpsRequest(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 10000,
      };

      const req = https.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(body); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body, json });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request to ${urlStr} timed out`));
      });

      if (postData) {
        req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

console.log('========================================================================');
console.log('🔬 LPU Events — Operations Control Plane Real Production Verification');
console.log('========================================================================\n');

async function runVerification() {
  const supabaseUrl = 'https://nhjphyqiqhmxdhppljap.supabase.co';
  const functionUrl = `${supabaseUrl}/functions/v1/superadmin-operations`;

  // ---------------------------------------------------------------------------
  // Suite 1: Production Infrastructure HTTPS Reachability
  // ---------------------------------------------------------------------------
  console.log('📌 Test Suite 1: Production Infrastructure Reachability');

  const restRes = await httpsRequest(`${supabaseUrl}/auth/v1/health`, {
    headers: { apikey: 'sb_publishable_S9KH9_RTpx1MiPwyEBWxRQ_QkJVgzsA' },
  });
  assert(
    restRes.status === 200,
    `1.1: Production Supabase instance nhjphyqiqhmxdhppljap responds (HTTP ${restRes.status})`
  );

  const studentRes = await httpsRequest('https://lpuevents.live');
  assert(
    studentRes.status === 200,
    `1.2: Production Student Website is reachable (HTTP ${studentRes.status})`
  );

  const studentOpsRes = await httpsRequest('https://lpuevents.live/api/operations');
  assert(
    studentOpsRes.status === 404,
    `1.3: Student Website strictly isolates operations endpoints (HTTP ${studentOpsRes.status} 404)`
  );

  // ---------------------------------------------------------------------------
  // Suite 2: Operations Gateway CORS & Preflight Verification
  // ---------------------------------------------------------------------------
  console.log('\n📌 Test Suite 2: Operations Gateway CORS & Preflight Policy');

  const optionsRes = await httpsRequest(functionUrl, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://lpueventsadmin.live',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization, content-type',
    },
  });

  assert(
    optionsRes.status === 200,
    `2.1: Preflight OPTIONS request returns HTTP 200 on Edge Function gateway`
  );

  const allowOrigin = optionsRes.headers['access-control-allow-origin'];
  assert(
    allowOrigin === 'https://lpueventsadmin.live',
    `2.2: CORS Access-Control-Allow-Origin correctly restricts to allowed origin (${allowOrigin})`
  );

  const varyHeader = optionsRes.headers['vary'];
  assert(
    varyHeader && varyHeader.includes('Origin'),
    `2.3: CORS response includes Vary: Origin header (${varyHeader})`
  );

  // ---------------------------------------------------------------------------
  // Suite 3: Super Admin Security Boundary & Rejection Verification
  // ---------------------------------------------------------------------------
  console.log('\n📌 Test Suite 3: Operations Gateway Authentication Boundary');

  const unauthRes = await httpsRequest(functionUrl, {
    method: 'POST',
    headers: {
      'Origin': 'https://lpueventsadmin.live',
      'Content-Type': 'application/json',
    },
  }, { action: 'overview' });

  assert(
    unauthRes.status === 401,
    `3.1: Unauthenticated request rejected with HTTP 401 (received HTTP ${unauthRes.status})`
  );
  assert(
    unauthRes.json?.error?.code === 'UNAUTHENTICATED',
    `3.2: Rejection envelope returns structured code UNAUTHENTICATED (${unauthRes.json?.error?.code})`
  );

  const invalidTokenRes = await httpsRequest(functionUrl, {
    method: 'POST',
    headers: {
      'Origin': 'https://lpueventsadmin.live',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-test-token-778899',
    },
  }, { action: 'overview' });

  assert(
    invalidTokenRes.status === 401,
    `3.3: Invalid bearer token rejected with HTTP 401 (received HTTP ${invalidTokenRes.status})`
  );
  assert(
    invalidTokenRes.json?.error?.code === 'UNAUTHENTICATED',
    `3.4: Invalid token envelope returns structured code UNAUTHENTICATED`
  );

  assert(
    invalidTokenRes.json?.meta?.environment === 'production',
    `3.5: Gateway meta.environment correctly reports "production" (${invalidTokenRes.json?.meta?.environment})`
  );

  // ---------------------------------------------------------------------------
  // Suite 4: Production Database Migrations & Canonical Registry
  // ---------------------------------------------------------------------------
  console.log('\n📌 Test Suite 4: Production Database Canonical Tables & Migrations');

  try {
    const tableQueryOut = execSync(
      `npx supabase db query --linked --project-ref nhjphyqiqhmxdhppljap "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ops_%';"`,
      { encoding: 'utf8', timeout: 15000 }
    );
    const tableMatch = tableQueryOut.match(/"count":\s*(\d+)/);
    const opsTableCount = tableMatch ? parseInt(tableMatch[1], 10) : 0;
    assert(
      opsTableCount >= 28,
      `4.1: Production database contains all 28 canonical ops_* tables (found ${opsTableCount})`
    );
  } catch (err) {
    assert(false, `4.1: Failed to query ops_* table count: ${err.message}`);
  }

  try {
    const jobsQueryOut = execSync(
      `npx supabase db query --linked --project-ref nhjphyqiqhmxdhppljap "SELECT count(*) FROM public.ops_jobs;"`,
      { encoding: 'utf8', timeout: 15000 }
    );
    const jobsMatch = jobsQueryOut.match(/"count":\s*(\d+)/);
    const opsJobsCount = jobsMatch ? parseInt(jobsMatch[1], 10) : 0;
    assert(
      opsJobsCount === 13,
      `4.2: Canonical background jobs registry contains exactly 13 registered jobs (found ${opsJobsCount})`
    );
  } catch (err) {
    assert(false, `4.2: Failed to query ops_jobs count: ${err.message}`);
  }

  try {
    const diagQueryOut = execSync(
      `npx supabase db query --linked --project-ref nhjphyqiqhmxdhppljap "SELECT public.get_operations_database_diagnostics();"`,
      { encoding: 'utf8', timeout: 15000 }
    );
    const diagHealthy = diagQueryOut.includes('"status": "HEALTHY"') && diagQueryOut.includes('"connected": true');
    assert(
      diagHealthy,
      `4.3: Database diagnostics RPC get_operations_database_diagnostics() returns HEALTHY & connected: true`
    );
  } catch (err) {
    assert(false, `4.3: Failed to execute diagnostics RPC: ${err.message}`);
  }

  try {
    const adminQueryOut = execSync(
      `npx supabase db query --linked --project-ref nhjphyqiqhmxdhppljap "SELECT count(*) FROM public.admin_users u JOIN public.platform_admin_roles r ON r.admin_user_id = u.id WHERE r.role = 'SUPER_ADMIN' AND u.is_active = true;"`,
      { encoding: 'utf8', timeout: 15000 }
    );
    const adminMatch = adminQueryOut.match(/"count":\s*(\d+)/);
    const superAdminCount = adminMatch ? parseInt(adminMatch[1], 10) : 0;
    assert(
      superAdminCount >= 1,
      `4.4: Canonical SUPER_ADMIN identity verified in platform_admin_roles (found ${superAdminCount} active)`
    );
  } catch (err) {
    assert(false, `4.4: Failed to verify SUPER_ADMIN: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Suite 5: Authenticated Super Admin Operations (Operator Token Verification)
  // ---------------------------------------------------------------------------
  console.log('\n📌 Test Suite 5: Authenticated Super Admin Operations');

  const operatorToken = process.env.OPERATOR_SUPER_ADMIN_TOKEN || process.env.SUPER_ADMIN_JWT;

  if (operatorToken) {
    console.log('  🔑 Operator Super Admin Token detected. Running live authenticated capability tests...');

    const authOverviewRes = await httpsRequest(functionUrl, {
      method: 'POST',
      headers: {
        'Origin': 'https://lpueventsadmin.live',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${operatorToken}`,
      },
    }, { action: 'overview' });

    assert(
      authOverviewRes.status === 200 && authOverviewRes.json?.success === true,
      `5.1: Live authenticated overview returned HTTP 200 with success: true`
    );

    const data = authOverviewRes.json?.data;
    assert(
      data?.services_summary?.total_registered !== undefined && data.services_summary.total_registered > 0,
      `5.2: Real services summary returned (${data?.services_summary?.total_registered} registered services)`
    );

    assert(
      data?.jobs_summary?.total_jobs !== undefined && data.jobs_summary.total_jobs === 13,
      `5.3: Real jobs summary returned (${data?.jobs_summary?.total_jobs} total jobs)`
    );

    assert(
      data?.database_health === 'HEALTHY',
      `5.4: Live database health is HEALTHY (${data?.database_health})`
    );
  } else {
    console.log('  ℹ️  [NOTE] OPERATOR_SUPER_ADMIN_TOKEN / SUPER_ADMIN_JWT environment variable not provided.');
    console.log('      To run Suite 5 live authenticated tests, set: OPERATOR_SUPER_ADMIN_TOKEN=<temporary_jwt>');
    console.log('      Token is never hardcoded, committed, printed, or stored in artifacts.');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`📊 REAL PRODUCTION OPERATIONS AUDIT SUMMARY`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Status: ${failed === 0 ? '🟢 ALL PRODUCTION CHECKS PASSED' : '🔴 SOME CHECKS FAILED'}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
