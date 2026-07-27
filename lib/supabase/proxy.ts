import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getUserRoleFromClient, isOrganizerRole } from '@/lib/auth';
import { getDefaultRouteForRole, getSafeNextPath } from '@/lib/auth-redirect';
import { getPublicEnv } from '@/lib/env';

function isProtectedPath(pathname: string) {
  return pathname.startsWith('/dashboard') || pathname.startsWith('/admin');
}

function isAuthPath(pathname: string) {
  return pathname.startsWith('/auth/sign-in') || pathname.startsWith('/auth/verify');
}

export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (!user) {
    return response;
  }

  const role = await getUserRoleFromClient(supabase);
  const roleHome = getDefaultRouteForRole(role);

  if (isAuthPath(pathname)) {
    return NextResponse.redirect(new URL(roleHome, request.url));
  }

  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL(roleHome, request.url));
  }

  if (pathname.startsWith('/dashboard') && !isOrganizerRole(role)) {
    const studentUrl = new URL('https://www.lpuevents.live', request.url);
    return NextResponse.redirect(studentUrl);
  }

  if (pathname === '/auth/callback') {
    const safeNext = getSafeNextPath(request.nextUrl.searchParams.get('next'), roleHome);
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  return response;
}
