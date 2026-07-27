'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { getDefaultRouteForRole, getSafeNextPath } from '@/lib/auth-redirect';

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

    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    setIsPending(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    if (!data.user) {
      setError('Verification failed: User session not created.');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    const role =
      profile?.role === 'super_admin' || profile?.role === 'organizer' || profile?.role === 'student'
        ? profile.role
        : 'student';

    const destination = getSafeNextPath(next, getDefaultRouteForRole(role));
    setMessage('Verification complete. Redirecting you into LPU Events...');
    router.replace(destination);
  }

  async function handleResend() {
    setMessage(null);
    setError(null);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setMessage('A fresh code has been sent.');
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
