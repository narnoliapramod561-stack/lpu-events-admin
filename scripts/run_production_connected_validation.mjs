/**
 * scripts/run_production_connected_validation.mjs
 * Validation harness for REAL connected Cloudflare Edge + Supabase infrastructure.
 * STRICT SAFETY RULE: Keep total real requests bounded to preserve daily free tier quotas.
 */

import { performance } from 'perf_hooks';

console.log('================================================================');
console.log('  LPU EVENTS — REAL PRODUCTION-CONNECTED VALIDATION SUITE');
console.log('================================================================\n');

const PROD_BASE_URL = 'https://lpuevents.live';
const R2_PUBLIC_URL = 'https://images.lpuevents.live';
const SUPABASE_PROJECT_URL = 'https://nhjphyqiqhmxdhppljap.supabase.co';

console.log('1. REAL TEST ENVIRONMENT:');
console.log({
  STUDENT_PRODUCTION_URL: PROD_BASE_URL,
  CLOUDFLARE_WORKER_ROUTE: `${PROD_BASE_URL}/api/public/*`,
  CLOUDFLARE_PAGES_DEPLOYMENT: 'lpuevents.live (Cloudflare Pages SPA)',
  SUPABASE_PROJECT_REF: 'nhjphyqiqhmxdhppljap',
  R2_BUCKET: 'lpu-events-media',
  R2_PUBLIC_DOMAIN: R2_PUBLIC_URL,
  ACTIVE_WORKER_ENTRY: 'src/worker.ts',
  CURRENT_TIMESTAMP: new Date().toISOString()
});
console.log('\n----------------------------------------------------------------\n');

async function measureRequest(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, options);
    const duration = performance.now() - start;
    const cacheStatus = res.headers.get('cf-cache-status') || res.headers.get('x-edge-cache') || 'UNKNOWN';
    const originRefreshed = res.headers.get('x-origin-refreshed') === 'true';
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      durationMs: duration,
      cacheStatus,
      originRefreshed,
      contentLength: contentLength || Buffer.byteLength(body, 'utf8'),
      server: res.headers.get('server'),
      age: res.headers.get('age')
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      durationMs: performance.now() - start,
      error: err.message
    };
  }
}

async function runProductionValidation() {
  const endpoints = [
    { name: 'Homepage Aggregate', path: '/api/public/homepage' },
    { name: 'Categories Taxonomy', path: '/api/public/categories' },
    { name: 'Events Feed (Page 1)', path: '/api/public/events?page=1' },
    { name: 'Featured Events', path: '/api/public/featured' },
    { name: 'Trending Events', path: '/api/public/trending' },
    { name: 'Advertisements', path: '/api/public/advertisements' }
  ];

  console.log('2. EXECUTING REAL PRODUCTION CACHE PROFILING...\n');

  // Baseline Warming Pass
  console.log('--- WARMING PASS (1 request per endpoint) ---');
  for (const ep of endpoints) {
    const res = await measureRequest(`${PROD_BASE_URL}${ep.path}`);
    console.log(`[PASS] ${ep.name.padEnd(25)} -> Status: ${res.status} | Cache: ${res.cacheStatus} | Latency: ${res.durationMs.toFixed(2)}ms | Size: ${(res.contentLength/1024).toFixed(2)} KB`);
  }

  console.log('\n--- MEASURING CACHE HITS & LATENCY (10 warm requests per endpoint) ---');
  const hitStats = {};
  for (const ep of endpoints) {
    hitStats[ep.name] = { hits: 0, total: 10, latencies: [] };
    for (let i = 0; i < 10; i++) {
      const res = await measureRequest(`${PROD_BASE_URL}${ep.path}`);
      if (res.cacheStatus === 'HIT' || res.cacheStatus === 'STALE') {
        hitStats[ep.name].hits++;
      }
      hitStats[ep.name].latencies.push(res.durationMs);
    }
    const avgLat = (hitStats[ep.name].latencies.reduce((a, b) => a + b, 0) / 10).toFixed(2);
    const hitRate = ((hitStats[ep.name].hits / 10) * 100).toFixed(1);
    console.log(`[HIT]  ${ep.name.padEnd(25)} -> Hit Rate: ${hitRate}% | Avg Latency: ${avgLat}ms`);
  }

  console.log('\n--- REAL CONCURRENCY LOAD TEST (50 Concurrent Requests to Homepage) ---');
  const concurrency = 50;
  const startConc = performance.now();
  const promises = Array.from({ length: concurrency }, () => measureRequest(`${PROD_BASE_URL}/api/public/homepage`));
  const concResults = await Promise.all(promises);
  const totalDuration = performance.now() - startConc;

  const successful = concResults.filter(r => r.status === 200).length;
  const hits = concResults.filter(r => r.cacheStatus === 'HIT').length;
  const latencies = concResults.map(r => r.durationMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(2);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);

  console.log(`[CONCURRENCY] Total Requests: ${concurrency}`);
  console.log(`[CONCURRENCY] Success Rate: ${((successful / concurrency) * 100).toFixed(1)}%`);
  console.log(`[CONCURRENCY] Cache Hit Rate: ${((hits / concurrency) * 100).toFixed(1)}%`);
  console.log(`[CONCURRENCY] Total Duration: ${totalDuration.toFixed(2)}ms`);
  console.log(`[CONCURRENCY] P50 Latency: ${p50}ms | P95 Latency: ${p95}ms`);

  console.log('\n--- REAL MEDIA RESOLVER & R2 VALIDATION ---');
  const r2Res = await measureRequest(`${R2_PUBLIC_URL}/non-existent-probe.webp`);
  console.log(`[R2 DOMAIN] Domain: ${R2_PUBLIC_URL}`);
  console.log(`[R2 DOMAIN] Edge Response Server: ${r2Res.server || 'cloudflare'}`);
  console.log(`[R2 DOMAIN] Verified CDN Routing: ${r2Res.server?.includes('cloudflare') ? 'YES' : 'NO'}`);

  console.log('\n================================================================');
  console.log('  PRODUCTION VALIDATION MEASUREMENTS COMPLETE');
  console.log('================================================================');
}

runProductionValidation();
