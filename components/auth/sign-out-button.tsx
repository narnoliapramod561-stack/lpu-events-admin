'use client';

import { useState } from 'react';

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      const response = await fetch('/auth/sign-out', {
        method: 'POST',
      });
      if (response.ok) {
        window.location.href = '/auth/sign-in';
      }
    } catch {
      // Ignore sign-out errors
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Signing out...' : 'Sign out'}
    </button>
  );
}
