import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Unauthorized | LPU Events Admin',
  description: 'You do not have permission to access this area.',
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function UnauthorizedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const reason = params.reason || 'unknown';

  const messages: Record<string, { title: string; description: string }> = {
    student: {
      title: 'Student Account Detected',
      description:
        'This is the admin portal for event organizers and administrators. Student accounts do not have access to this area.',
    },
    disabled: {
      title: 'Account Disabled',
      description:
        'Your account has been disabled or suspended. Please contact an administrator for assistance.',
    },
    unknown: {
      title: 'Access Denied',
      description: 'You do not have permission to access this area.',
    },
  };

  const message = messages[reason] || messages.unknown;

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
            {message.title}
          </h1>
          <p className="text-sm text-white/60">
            {message.description}
          </p>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
          {reason === 'student' && (
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-2">
              <h2 className="text-sm font-semibold text-[#ff9b54]">Looking for the student portal?</h2>
              <p className="text-xs text-white/60 leading-relaxed">
                If you&apos;re a student looking to browse and register for events, please visit the main LPU Events student portal.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/auth/sign-in"
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff914d,#ffb36b)] px-5 text-base font-semibold text-[#2d1304] transition hover:scale-[1.01] hover:shadow-[0_16px_48px_rgba(255,145,77,0.28)]"
            >
              Back to Sign In
            </Link>
            {reason === 'student' && (
              <a
                href="https://lpuevents.live"
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Go to Student Portal
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
