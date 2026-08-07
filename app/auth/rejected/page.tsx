import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Access Rejected | LPU Events Admin',
  description: 'Your admin access request has been rejected.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RejectedAccessPage() {
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
            Access Rejected
          </h1>
          <p className="text-sm text-white/60">
            Your request for admin access has been reviewed and unfortunately was not approved.
          </p>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#ff9b54]">Why was my request rejected?</h2>
            <p className="text-xs text-white/60 leading-relaxed">
              Access requests may be rejected for various reasons including incomplete information,
              insufficient permissions, or organizational policies. If you believe this was a mistake,
              please contact your administrator.
            </p>
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
