/**
 * Health Check Edge Function.
 *
 * Provides a lightweight health endpoint for monitoring.
 * Checks database connectivity via a simple query.
 * No authentication required — this is a public endpoint.
 *
 * GET /functions/v1/health
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/auth.ts';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      latency_ms?: number;
      error?: string;
    };
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const health: HealthStatus = {
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'ok' },
    },
  };

  try {
    // Check database connectivity
    const dbStart = performance.now();
    const supabase = createServiceClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const dbLatency = Math.round(performance.now() - dbStart);

    if (error) {
      health.checks.database = {
        status: 'error',
        latency_ms: dbLatency,
        error: 'Database query failed',
      };
      health.status = 'degraded';
    } else {
      health.checks.database = {
        status: 'ok',
        latency_ms: dbLatency,
      };
    }
  } catch (_err) {
    health.checks.database = {
      status: 'error',
      error: 'Database unreachable',
    };
    health.status = 'unhealthy';
  }

  const httpStatus = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return new Response(JSON.stringify(health), {
    status: httpStatus,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
});
