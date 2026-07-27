import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { getUserProfile } from '@/lib/auth';
import { getDefaultRouteForRole } from '@/lib/auth-redirect';
import { VerifyForm } from '@/components/auth/verify-form';

export const metadata: Metadata = {
  title: 'Verify | LPU Events',
  description: 'Enter your verification code.',
  robots: {
    index: false,
    follow: true,
  },
};

type PageProps = {
  searchParams: Promise<{ email?: string; next?: string }>;
};

export default async function VerifyPage({ searchParams }: PageProps) {
  const profile = await getUserProfile();
  const params = await searchParams;

  if (profile) {
    redirect(getDefaultRouteForRole(profile.role));
  }

  if (!params.email) {
    redirect('/auth/sign-in');
  }

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
            Security check
          </h1>
          <p className="text-sm text-white/60">Enter the verification code sent to your email.</p>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <VerifyForm email={params.email} next={params.next || null} />
        </div>
      </div>
    </main>
  );
}
