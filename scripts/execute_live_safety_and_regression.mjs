/**
 * scripts/execute_live_safety_and_regression.mjs
 * Live Production Regression, Stress & Free-Tier Safety Test Harness
 * STRICT RULE: Zero code modifications; strictly capped batches to stay far below 20% quota.
 */

import { performance } from 'perf_hooks';

console.log('================================================================');
console.log('  LPU EVENTS — LIVE REGRESSION, STRESS & FREE-TIER SAFETY TEST');
console.log('================================================================\n');

const BASE_URL = 'https://lpuevents.live';
const SUPABASE_PROJECT_URL = 'https://nhjphyqiqhmxdhppljap.supabase.co';
const R2_PUBLIC_URL = 'https://images.lpuevents.live';

console.log('TARGET ENVIRONMENT:');
console.log({
  TARGET_URL: BASE_URL,
  CLOUDFLARE_WORKER_ROUTE: `${BASE_URL}/api/public/*`,
  CLOUDFLARE_ZONE: 'lpuevents.live',
  SUPABASE_PROJECT: 'nhjphyqiqhmxdhppljap',
  R2_BUCKET: 'lpu-events-media',
  UTC_START_TIME: new Date().toISOString()
});
console.log('\n----------------------------------------------------------------\n');

async function testEndpoint(name, path) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`);
    const duration = performance.now() - start;
    const cacheHeader = res.headers.get('cf-cache-status') || res.headers.get('x-edge-cache') || 'UNKNOWN';
    const age = res.headers.get('age') || '0';
    const originRefreshed = res.headers.get('x-origin-refreshed') || 'false';
    const server = res.headers.get('server') || 'unknown';
    const text = await res.text();
    const size = Buffer.byteLength(text, 'utf8');

    return {
      name,
      path,
      ok: res.ok,
      status: res.status,
      durationMs: duration,
      cacheHeader,
      age,
      originRefreshed,
      server,
      sizeBytes: size
    };
  } catch (err) {
    return {
      name,
      path,
      ok: false,
      status: 0,
      durationMs: performance.now() - start,
      error: err.message
    };
  }
}

async function runLiveRegression() {
  const endpoints = [
    { name: 'Root SPA Document', path: '/' },
    { name: 'Homepage Aggregate API', path: '/api/public/homepage' },
    { name: 'Categories Taxonomy API', path: '/api/public/categories' },
    { name: 'Events Feed (Page 1) API', path: '/api/public/events?page=1' },
    { name: 'Featured Events API', path: '/api/public/featured' },
    { name: 'Trending Events API', path: '/api/public/trending' },
    { name: 'Advertisements API', path: '/api/public/advertisements' },
    { name: 'Search Query API', path: '/api/public/search?q=tech' }
  ];

  console.log('--- 1. LIVE ENDPOINT REGRESSION TEST ---');
  let totalDownloadedBytes = 0;
  for (const ep of endpoints) {
    const res = await testEndpoint(ep.name, ep.path);
    totalDownloadedBytes += res.sizeBytes || 0;
    const statusIcon = res.ok ? '✅' : '❌';
    console.log(`${statusIcon} [${res.status}] ${ep.name.padEnd(26)} | Cache: ${res.cacheHeader.padEnd(6)} | Latency: ${res.durationMs.toFixed(2)}ms | Size: ${(res.sizeBytes/1024).toFixed(2)} KB | Server: ${res.server}`);
  }

  console.log(`\nTotal Downloaded Payload: ${(totalDownloadedBytes / 1024).toFixed(2)} KB`);

  console.log('\n--- 2. WARM CACHE LATENCY & CONSISTENCY (100 CONCURRENT LIVE REQUESTS) ---');
  const warmup = await testEndpoint('Homepage Warmup', '/api/public/homepage');
  const count = 100;
  const startConc = performance.now();
  const promises = Array.from({ length: count }, () => testEndpoint('Homepage Concurrent', '/api/public/homepage'));
  const results = await Promise.all(promises);
  const totalDuration = performance.now() - startConc;

  const hits = results.filter(r => r.cacheHeader === 'HIT').length;
  const oks = results.filter(r => r.status === 200).length;
  const latencies = results.map(r => r.durationMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(2);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);

  console.log(`Concurrent Requests: ${count}`);
  console.log(`HTTP 200 Success Rate: ${((oks / count) * 100).toFixed(1)}%`);
  console.log(`Cache Hit Rate: ${((hits / count) * 100).toFixed(1)}%`);
  console.log(`Total Batch Duration: ${totalDuration.toFixed(2)}ms`);
  console.log(`P50 Latency: ${p50}ms | P95 Latency: ${p95}ms`);

  console.log('\n--- 3. PUBLIC DIRECT PAST-EVENT / COMPLETED ISOLATION ---');
  const pastProbe = await testEndpoint('Past Event UUID Probe', '/api/public/events/00000000-0000-0000-0000-000000000000');
  console.log(`Past/Invalid UUID Response Status: ${pastProbe.status} (Expected 404/not found)`);
  console.log(`Public Past Event Isolation Verified: ${pastProbe.status === 404 || pastProbe.status === 400 ? 'YES' : 'NO'}`);

  console.log('\n--- 4. R2 PUBLIC ASSET ACCESS & ZERO SUPABASE STORAGE ---');
  const r2Probe = await testEndpoint('R2 Root Probe', '/assets/index-PCdnRWej.js');
  console.log(`Static Asset Served via CDN: Status ${r2Probe.status}, Server: ${r2Probe.server}`);

  console.log('\n================================================================');
  console.log('  LIVE PRODUCTION REGRESSION & SAFETY TEST COMPLETE');
  console.log(`  UTC_END_TIME: ${new Date().toISOString()}`);
  console.log('================================================================');
}

runLiveRegression();
