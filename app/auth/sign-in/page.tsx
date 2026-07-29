import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { getUserProfile } from '@/lib/auth';
import { getDefaultRouteForRole } from '@/lib/auth-redirect';
import { SignInForm } from '@/components/auth/sign-in-form';

export const metadata: Metadata = {
  title: 'Sign In | LPU Events',
  description: 'Log in to the LPU Events Organizer Portal.',
  robots: {
    index: false,
    follow: true,
  },
};

type PageProps = {
  searchParams: Promise<{ email?: string; next?: string }>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const profile = await getUserProfile();
  const params = await searchParams;

  if (profile) {
    redirect(getDefaultRouteForRole(profile.role));
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050507] p-4 text-[#e6e2dc] sm:p-6">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#ff914d]/5 blur-[120px] pointer-events-none" />

      <div className="z-10 w-full max-w-[440px] space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-[#ff914d] flex items-center justify-center text-[#050507] font-bold text-2xl mx-auto select-none">
            LPU
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display mt-4">
            Welcome back
          </h1>
          <p className="text-sm text-white/60">Log in to manage LPU campus events.</p>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-8">
          <SignInForm defaultEmail={params.email || ''} />
        </div>
      </div>
    </main>
  );
}
