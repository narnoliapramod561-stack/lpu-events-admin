import { redirect } from 'next/navigation';

import { getUserProfile } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function DashboardPage() {
  const profile = await getUserProfile();

  if (!profile) {
    redirect('/auth/sign-in');
  }

  return <DashboardShell profile={profile} />;
}
