'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { getPublicEnv } from '@/lib/env';
import { trackAdminLogin } from '@/components/observability/analytics-provider';

type SignInFormProps = {
  defaultEmail: string;
};

export function SignInForm({ defaultEmail }: SignInFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(defaultEmail);
  const [isOtpPending, setIsOtpPending] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = searchParams.get('next');

  async function handleEmailOtp() {
    setIsOtpPending(true);
    setMessage(null);
    setError(null);

    trackAdminLogin('otp');

    let response: Response | undefined;
    try {
      response = await fetch('/api/v1/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstile_token: undefined }),
      });
    } catch {
      setError('Network error. Please try again.');
      setIsOtpPending(false);
      return;
    } finally {
      setIsOtpPending(false);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.message || data.error?.message || 'OTP request failed.');
      return;
    }

    setMessage('A 6-digit verification code is on its way to your inbox.');
    const verifyQuery = new URLSearchParams({ email });

    if (next) {
      verifyQuery.set('next', next);
    }

    router.push(`/auth/verify?${verifyQuery.toString()}`);
  }

  async function handleGoogleSignIn() {
    setIsGooglePending(true);
    setMessage(null);
    setError(null);

    trackAdminLogin('google');

    const env = getPublicEnv();
    const supabase = createClient();

    const origin = typeof window !== 'undefined' ? window.location.origin : env.NEXT_PUBLIC_APP_URL;
    const callbackUrl = new URL('/auth/callback', origin);

    if (next) {
      callbackUrl.searchParams.set('next', next);
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    setIsGooglePending(false);

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/72" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base text-white outline-none transition placeholder:text-white/28 focus:border-[#ff9b54] focus:bg-black/40"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleEmailOtp()}
        disabled={isOtpPending || email.trim().length === 0}
        className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff914d,#ffb36b)] px-5 text-base font-semibold text-[#2d1304] transition hover:scale-[1.01] hover:shadow-[0_16px_48px_rgba(255,145,77,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isOtpPending ? 'Sending secure code...' : 'Continue with email OTP'}
      </button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="h-px w-full bg-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="rounded-full border border-white/10 bg-[#140f13] px-4 py-1 text-xs uppercase tracking-[0.28em] text-white/45">
            or
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={isGooglePending}
        className="inline-flex h-14 w-full items-center justify-center rounded-2xl border border-white/12 bg-white/6 px-5 text-base font-medium text-white transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isGooglePending ? 'Connecting to Google...' : 'Continue with Google'}
      </button>

      {message ? (
        <p className="rounded-2xl border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}
