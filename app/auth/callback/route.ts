import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDefaultRouteForRole, getSafeNextPath } from '@/lib/auth-redirect';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');

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

        const role = profile?.role ?? 'student';
        const destination = getSafeNextPath(next, getDefaultRouteForRole(role));
        return NextResponse.redirect(new URL(destination, requestUrl.origin));
      }
    }
  }

  // Fallback to sign-in page if code exchange fails or no code
  return NextResponse.redirect(new URL('/auth/sign-in', requestUrl.origin));
}
