import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Access Pending | LPU Events Admin',
  description: 'Your admin access request is pending approval.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PendingAccessPage() {
  return (
    <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#ff914d]/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] z-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-[#ff914d] flex items-center justify-center text-[#050507] font-bold text-2xl mx-auto select-none">
            LPU
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display mt-4">
            Access Pending
          </h1>
          <p className="text-sm text-white/60">
            Your request for admin access has been submitted and is awaiting review by a super administrator.
          </p>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#ff9b54]">What happens next?</h2>
            <ul className="space-y-1 text-xs text-white/60">
              <li>&bull; A super admin will review your request</li>
              <li>&bull; You&apos;ll receive an email notification once approved</li>
              <li>&bull; You can sign in again after approval</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/auth/sign-in"
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff914d,#ffb36b)] px-5 text-base font-semibold text-[#2d1304] transition hover:scale-[1.01] hover:shadow-[0_16px_48px_rgba(255,145,77,0.28)]"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
