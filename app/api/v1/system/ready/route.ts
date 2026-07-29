import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        success: false,
        status: 'not_ready',
        service: 'lpu-events-admin',
        checks: {
          configuration: 'error',
          supabase: 'skipped',
        },
      },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const ready = response.ok || response.status === 404;

    return NextResponse.json(
      {
        success: ready,
        status: ready ? 'ready' : 'not_ready',
        service: 'lpu-events-admin',
        checks: {
          configuration: 'ok',
          supabase: ready ? 'ok' : 'error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: ready ? 200 : 503 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        status: 'not_ready',
        service: 'lpu-events-admin',
        checks: {
          configuration: 'ok',
          supabase: 'error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
