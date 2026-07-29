import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDefaultRouteForRole, getSafeNextPath } from '@/lib/auth-redirect';

const VALID_ROLES = ['student', 'organizer', 'super_admin', 'admin'] as const;

type CallbackRole = (typeof VALID_ROLES)[number];

export function resolveCallbackDestination(
  next: string | null,
  roleHint: string | null,
  profileRole: string | null | undefined
) {
  const normalizedProfileRole =
    profileRole && VALID_ROLES.includes(profileRole as CallbackRole) ? profileRole : null;

  const fallbackRoute =
    roleHint === 'admin' ? '/dashboard' : getDefaultRouteForRole((normalizedProfileRole ?? 'student') as CallbackRole);

  return getSafeNextPath(next, fallbackRoute);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const roleHint = requestUrl.searchParams.get('role');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Fetch the user role to direct them to the correct dashboard
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const destination = resolveCallbackDestination(next, roleHint, profile?.role);
        return NextResponse.redirect(new URL(destination, requestUrl.origin));
      }
    }
  }

  // Fallback to sign-in page if code exchange fails or no code
  return NextResponse.redirect(new URL('/auth/sign-in', requestUrl.origin));
}
