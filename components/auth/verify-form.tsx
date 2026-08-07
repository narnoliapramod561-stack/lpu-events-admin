'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getSafeNextPath } from '@/lib/auth-redirect';

type VerifyFormProps = {
  email: string;
  next: string | null;
};

const DIGITS = 6;

export function VerifyForm({ email, next }: VerifyFormProps) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array.from({ length: DIGITS }, () => ''));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const token = useMemo(() => digits.join(''), [digits]);

  function updateDigit(index: number, value: string) {
    const nextDigits = [...digits];
    nextDigits[index] = value;
    setDigits(nextDigits);
  }

  function focusInput(index: number) {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  }

  function handleDigitChange(index: number, rawValue: string) {
    const cleaned = rawValue.replace(/\D/g, '');

    if (cleaned.length === 0) {
      updateDigit(index, '');
      return;
    }

    if (cleaned.length > 1) {
      const incoming = cleaned.slice(0, DIGITS).split('');
      const nextDigits = Array.from(
        { length: DIGITS },
        (_, currentIndex) => incoming[currentIndex] ?? ''
      );
      setDigits(nextDigits);
      const targetIndex = Math.min(incoming.length, DIGITS - 1);
      focusInput(targetIndex);
      return;
    }

    updateDigit(index, cleaned);

    if (index < DIGITS - 1) {
      focusInput(index + 1);
    }
  }

  function handlePaste(value: string) {
    const cleaned = value.replace(/\D/g, '').slice(0, DIGITS);

    if (cleaned.length === 0) {
      return;
    }

    const nextDigits = Array.from({ length: DIGITS }, (_, index) => cleaned[index] ?? '');
    setDigits(nextDigits);
    focusInput(Math.min(cleaned.length, DIGITS - 1));
  }

  function handleKeyDown(index: number, key: string) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      focusInput(index - 1);
    }

    if (key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    }

    if (key === 'ArrowRight' && index < DIGITS - 1) {
      focusInput(index + 1);
    }
  }

  async function handleVerification() {
    setIsPending(true);
    setError(null);
    setMessage(null);

    let response: Response | undefined;
    try {
      response = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: token }),
      });
    } catch {
      setError('Network error. Please try again.');
      setIsPending(false);
      return;
    } finally {
      setIsPending(false);
    }

    const data = await response.json().catch(() => ({}));

    // This is the admin portal — the API resolves organizer_profiles authorization
    // (approved/pending/rejected/unauthorized) and returns the destination.
    if (response.ok && data?.adminDestination) {
      const destination = getSafeNextPath(next, data.adminDestination);
      setMessage('Verification complete. Redirecting you into LPU Events...');
      router.replace(destination);
      return;
    }

    if (response.ok && data?.session?.access_token && data?.session?.refresh_token) {
      // Session established but admin authorization could not be resolved —
      // send to access request flow rather than the public site.
      const destination = getSafeNextPath(next, '/auth/access-request');
      setMessage('Verification complete. Redirecting you into LPU Events...');
      router.replace(destination);
      return;
    }

    setError(data?.error?.message || data?.message || 'Verification failed.');
  }

  async function handleResend() {
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstile_token: undefined }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (typeof data.dev_otp === 'string' && /^\d{6}$/.test(data.dev_otp)) {
          sessionStorage.setItem(`lpu-events-dev-otp:${email.toLowerCase()}`, data.dev_otp);
          setDigits(data.dev_otp.split(''));
          setMessage('Fresh local preview code filled automatically.');
          return;
        }

        setMessage('A fresh code has been sent.');
        return;
      }

      setError(data?.message || data?.error?.message || 'Failed to resend OTP.');
    } catch {
      setError('Network error. Please try again.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-white/60">Code sent to</p>
        <p className="text-lg font-medium text-white">{email}</p>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={digit}
            onChange={(event) => handleDigitChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event.key)}
            onPaste={(event) => {
              event.preventDefault();
              handlePaste(event.clipboardData.getData('text'));
            }}
            className="h-16 rounded-2xl border border-white/10 bg-black/30 text-center text-2xl font-semibold tracking-[0.12em] text-white outline-none transition focus:border-[#ff9b54] focus:bg-black/40"
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => void handleVerification()}
        disabled={isPending || token.length !== DIGITS}
        className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff914d,#ffb36b)] px-5 text-base font-semibold text-[#2d1304] transition hover:scale-[1.01] hover:shadow-[0_16px_48px_rgba(255,145,77,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Verifying...' : 'Verify and continue'}
      </button>

      <button
        type="button"
        onClick={() => void handleResend()}
        className="text-sm font-medium text-[#ffb36b] transition hover:text-[#ffd0a5]"
      >
        Resend code
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
