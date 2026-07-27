import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { getDefaultRouteForRole } from '@/lib/auth-redirect';

export default async function HomePage() {
  const profile = await getUserProfile();

  if (profile) {
    const destination = getDefaultRouteForRole(profile.role);
    if (destination === '/') {
      redirect('https://www.lpuevents.live');
    }
    redirect(destination);
  }

  redirect('/auth/sign-in');
}
