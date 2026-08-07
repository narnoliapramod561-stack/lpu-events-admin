'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AccessRequestForm() {
  const router = useRouter();
  const [organisation, setOrganisation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to submit request');
        return;
      }

      // Redirect to pending page
      router.push('/auth/pending');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="organisation" className="text-sm font-medium text-white/72">
          Organisation/Club *
        </label>
        <input
          type="text"
          id="organisation"
          required
          minLength={2}
          maxLength={200}
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base text-white outline-none transition placeholder:text-white/28 focus:border-[#ff9b54] focus:bg-black/40"
          placeholder="e.g., LPU Tech Club, Sports Committee"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || organisation.trim().length < 2}
        className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff914d,#ffb36b)] px-5 text-base font-semibold text-[#2d1304] transition hover:scale-[1.01] hover:shadow-[0_16px_48px_rgba(255,145,77,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Submitting request...' : 'Submit Access Request'}
      </button>
    </form>
  );
}