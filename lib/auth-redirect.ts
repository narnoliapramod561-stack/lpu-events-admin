import { redirect } from 'next/navigation';

import type { UserRole } from '@/lib/types/auth';

export function getDefaultRouteForRole(role: UserRole) {
  if (role === 'admin' || role === 'super_admin') {
    return '/dashboard';
  }

  if (role === 'organizer') {
    return '/dashboard';
  }

  return '/';
}

export function getSafeNextPath(candidate: string | null | undefined, fallback: string) {
  if (!candidate) {
    return fallback;
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  return candidate;
}

export function redirectToRoleHome(role: UserRole) {
  redirect(getDefaultRouteForRole(role));
}
