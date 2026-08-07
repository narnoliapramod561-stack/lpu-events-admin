import { redirect } from 'next/navigation';

import { getUserProfile } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function DashboardPage() {
  const profile = await getUserProfile();

  if (!profile) {
    redirect('/auth/sign-in');
  }

  // Check if account is disabled
  if (!profile.isActive) {
    redirect('/auth/unauthorized?reason=disabled');
  }

  // Students cannot access admin dashboard
  if (profile.role === 'student') {
    redirect('/auth/unauthorized?reason=student');
  }

  // Pending users have already submitted a request
  if (profile.role === 'pending') {
    redirect('/auth/pending');
  }

  // Check approval status for admin roles
  if (profile.role === 'organizer' || profile.role === 'admin' || profile.role === 'super_admin') {
    if (profile.approvalStatus === 'pending') {
      redirect('/auth/pending');
    }

    if (profile.approvalStatus === 'rejected') {
      redirect('/auth/rejected');
    }
  }

  return <DashboardShell profile={profile} />;
}
