import { Metadata } from 'next';
import Link from 'next/link';
import { AccessRequestForm } from '@/components/auth/access-request-form';

export const metadata: Metadata = {
  title: 'Access Request | LPU Events Admin',
  description: 'Request admin access to manage LPU campus events.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccessRequestPage() {
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
            Request Admin Access
          </h1>
          <p className="text-sm text-white/60">
            You don&apos;t have admin access yet. To manage events on the LPU Events platform, request access from a super administrator.
          </p>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#ff9b54]">What you need to know:</h2>
            <ul className="space-y-1 text-xs text-white/60">
              <li>&bull; Admin access allows you to create and manage events</li>
              <li>&bull; Your request will be reviewed by a super admin</li>
              <li>&bull; You&apos;ll receive an email notification once approved</li>
            </ul>
          </div>

          <AccessRequestForm />

          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/auth/sign-out?redirect=/auth/sign-in"
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12"
                />
              </svg>
              Sign Out
            </Link>

            <p className="text-center text-xs text-white/40">
              Already have an account?{' '}
              <Link href="/auth/sign-in" className="font-medium text-[#ff9b54] hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}