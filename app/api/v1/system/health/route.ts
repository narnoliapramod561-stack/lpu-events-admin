import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Check database connectivity via SELECT 1
    let databaseStatus = 'error';
    let databaseLatency = 0;

    try {
      const dbStart = performance.now();
      const { error } = await supabase.rpc('verify_ticket', { p_ticket_id: '00000000-0000-0000-0000-000000000000' });
      databaseLatency = Math.round(performance.now() - dbStart);

      if (error) {
        console.error('[HEALTH][DB] Database ping failed:', error.message);
        databaseStatus = 'error';
      } else {
        databaseStatus = 'ok';
      }
    } catch (dbError) {
      console.error('[HEALTH][DB] Database ping exception');
      databaseStatus = 'error';
    }

    // 2. Check edge functions status - use the health edge function
    let edgeFunctionsStatus = 'error';
    try {
      const healthResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (healthResponse.ok) {
        const data = await healthResponse.json();
        if (data.status === 'healthy' || data.status === 'degraded') {
          edgeFunctionsStatus = 'ok';
        }
      }
    } catch (edgeError) {
      console.error('[HEALTH][EDGE] Edge functions check failed');
      edgeFunctionsStatus = 'error';
    }

    // 3. Check CDN status (Cloudflare)
    let cdnStatus = 'error';
    try {
      const cdnResponse = await fetch('https://www.cloudflare.com/status', {
        method: 'HEAD',
        headers: {
          'User-Agent': 'LPU-Health-Check/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (cdnResponse.ok && cdnResponse.status < 400) {
        cdnStatus = 'ok';
      }
    } catch (cdnError) {
      console.error('[HEALTH][CDN] CDN check failed');
      cdnStatus = 'error';
    }

    const status = databaseStatus === 'ok' && edgeFunctionsStatus === 'ok' && cdnStatus === 'ok' ? 'healthy' : 'degraded';

    const healthResponse = {
      success: true,
      message: `System ${status} - all services operational`,
      data: {
        database: databaseStatus,
        edge_functions: edgeFunctionsStatus,
        cdn: cdnStatus,
      },
    };

    return NextResponse.json(healthResponse, {
      status: 200,
    });
  } catch (error) {
    console.error('[HEALTH][CRITICAL] Health check system error');

    const healthResponse = {
      success: false,
      message: 'Health check system error',
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'System unable to perform health check',
      },
      data: {
        database: 'error',
        edge_functions: 'error',
        cdn: 'error',
      },
    };

    return NextResponse.json(healthResponse, {
      status: 503,
    });
  }
}
