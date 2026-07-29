import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Email is required.' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'INVALID_EMAIL_DOMAIN', message: 'Please use a valid email address.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      // Auth OTP error handled
      const errorMessage = typeof error?.message === 'string' && error.message.trim().length > 0
        ? error.message
        : 'Unable to send OTP.';

      return NextResponse.json(
        {
          error: 'OTP_SEND_FAILED',
          message: errorMessage,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'OTP sent successfully. Check your email.'
    }, { status: 200 });
  } catch (error) {
    console.error('[AUTH][OTP] Proxy error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unable to process OTP request.' }, { status: 500 });
  }
}
