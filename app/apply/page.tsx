import type { Metadata } from 'next';
import Link from 'next/link';

import { getSiteUrl } from '@/lib/site';
import { buildCanonicalUrl } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: 'Organizer Application | LPU Events',
  description: 'Apply to become an organizer for Lovely Professional University campus events.',
  alternates: {
    canonical: buildCanonicalUrl(getSiteUrl(), '/apply'),
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ApplyPage() {
  return (
    <main className="min-h-screen bg-[#050507] text-[#e6e2dc]">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-5 py-12 sm:px-6 lg:px-8">
        <section className="max-w-2xl space-y-8">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.24em] text-[#ffb36b]">
              Organizer Access
            </p>
            <h1 className="font-display text-4xl font-semibold text-white sm:text-5xl">
              Apply to organize events at LPU
            </h1>
            <p className="max-w-xl text-base leading-8 text-white/64">
              Student clubs, departments, and approved coordinators can request organizer access to
              publish and manage campus events on LPU Events.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#fa5e29] px-5 text-sm font-semibold text-white transition hover:bg-[#fa5e29]/90"
              href="/dashboard/organizer/apply"
            >
              Start application
            </Link>
            <a
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              href="https://www.lpuevents.live"
              target="_blank"
              rel="noopener noreferrer"
            >
              Browse events
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
