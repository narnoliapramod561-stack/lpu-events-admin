import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function getEdgeBaseUrl() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }
  return `${base}/functions/v1`;
}

async function callAuthEdgeFunction(path: string, body: unknown, timeoutMs = 10000): Promise<Response> {
  const url = `${getEdgeBaseUrl()}${path}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

    if (!email) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Email is required.' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'INVALID_OTP_FORMAT', message: 'OTP must be exactly 6 digits.' }, { status: 400 });
    }

    const response = await callAuthEdgeFunction('/auth-verify-otp', {
      email,
      otp,
    });

    const data = await response.json().catch(() => ({}));
    const status = response.ok ? 200 : response.status;

    if (!response.ok) {
      return NextResponse.json(
        {
          error: {
            message: data?.message || data?.error?.message || 'OTP verification failed. Please try again.',
          },
          message: data?.message || data?.error?.message || 'OTP verification failed. Please try again.',
        },
        { status }
      );
    }

    if (response.ok && data?.session?.access_token && data?.session?.refresh_token) {
      try {
        const supabase = await createClient();
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      } catch {
        // Session error handled gracefully
      }
    }

    return NextResponse.json(data, { status });
  } catch {
    // Auth verify OTP error handled
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unable to verify OTP.' }, { status: 500 });
  }
}
