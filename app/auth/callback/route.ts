import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface ProfileAuthInfo {
  role: string;
  approval_status: string;
  is_active: boolean;
}

export function resolveAuthorizationDestination(
  profile: ProfileAuthInfo | null,
  next: string | null
): string {
  if (!profile) {
    return '/auth/access-request';
  }

  if (!profile.is_active) {
    return '/auth/unauthorized?reason=disabled';
  }

  if (profile.role === 'pending') {
    return '/auth/access-request';
  }

  if (profile.role === 'student') {
    return '/auth/unauthorized?reason=student';
  }

  if (profile.role === 'organizer' || profile.role === 'admin' || profile.role === 'super_admin') {
    if (profile.approval_status === 'pending') {
      return '/auth/pending';
    }
    if (profile.approval_status === 'rejected') {
      return '/auth/rejected';
    }
    if (profile.approval_status === 'approved') {
      return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    }
  }

  return '/auth/unauthorized?reason=unknown';
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Step 1: Get authenticated user.id (canonical identity)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Super Admin check
        if (user.email === 'subhamkumar16072006@gmail.com') {
          const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
          return NextResponse.redirect(new URL(destination, requestUrl.origin));
        }

        // Query profiles using user.id
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, approval_status, is_active')
          .eq('id', user.id)
          .maybeSingle();

        const destination = resolveAuthorizationDestination(profile, next);
        return NextResponse.redirect(new URL(destination, requestUrl.origin));
      }
    }
  }

  // Fallback to sign-in page if code exchange fails or no code
  return NextResponse.redirect(new URL('/auth/sign-in', requestUrl.origin));
}
