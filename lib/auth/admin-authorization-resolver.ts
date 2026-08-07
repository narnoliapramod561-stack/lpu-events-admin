import { getSafeNextPath } from '@/lib/auth-redirect';

/**
 * Determines the redirect destination based on admin user authorization status.
 * Uses user.id (not email) for all authorization decisions.
 */
export function resolveAdminAuthorizationDestination(
  adminUser: {
    role: string;
    status: string;
    is_active: boolean;
  } | null,
  pendingRequestExists: boolean,
  next: string | null
): string {
  // No admin profile exists
  if (!adminUser) {
    if (pendingRequestExists) {
      // User has already submitted a request
      return '/auth/pending';
    } else {
      // No admin record and no pending request - redirect to access request
      return '/auth/access-request';
    }
  }

  // Check if user is disabled/banned
  if (!adminUser.is_active || adminUser.status === 'disabled') {
    return '/auth/unauthorized?reason=disabled';
  }

  // Check approval status for admin roles
  if (adminUser.status === 'approved') {
    // Approved admin/organizer - redirect to dashboard or requested page
    return getSafeNextPath(next, '/dashboard');
  }

  // Non-approved admin status - treat as pending
  return '/auth/pending';
}

/**
 * Determines the redirect destination for access requests.
 */
export function resolveAccessRequestDestination(
  requestStatus: string | null
): string {
  if (!requestStatus) {
    // No request exists - should go to access request form
    return '/auth/access-request';
  }

  switch (requestStatus) {
    case 'pending':
      return '/auth/pending';
    case 'approved':
      return '/dashboard';
    case 'rejected':
      return '/auth/rejected';
    default:
      return '/auth/unauthorized?reason=unknown';
  }
}