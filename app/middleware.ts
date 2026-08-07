import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware Session Refresh & Authorization
 *
 * This middleware:
 * 1. Refreshes Supabase sessions transparently via @supabase/ssr
 * 2. Protects /dashboard/* routes (requires valid session + organizer authorization)
 * 3. Checks organizer_profiles table for organizer access (Super Admin bypasses all checks)
 * 4. Propagates refreshed session cookies to the response
 *
 * Edge-safe implementation: directly uses @supabase/ssr without importing
 * Zod-dependent helpers (lib/auth, lib/env) that fail in Edge runtime.
 */

const DASHBOARD_PREFIX = '/dashboard';

function isDashboardPath(pathname: string): boolean {
  return pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`);
}

function createSignInRedirect(request: NextRequest): NextResponse {
  const signInUrl = new URL('/auth/sign-in', request.url);
  const { pathname, search } = request.nextUrl;

  signInUrl.searchParams.set('next', `${pathname}${search}`);

  return NextResponse.redirect(signInUrl);
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail-closed: block dashboard access when Supabase config unavailable
    if (isDashboardPath(request.nextUrl.pathname)) {
      return createSignInRedirect(request);
    }

    return NextResponse.next({ request });
  }

  let response = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
    });

    // Refresh session via getUser() (triggers token refresh when needed)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Redirect unauthenticated dashboard requests to sign-in
    if (!user && isDashboardPath(pathname)) {
      return createSignInRedirect(request);
    }

    // Check authorization for authenticated users accessing dashboard
    if (user && isDashboardPath(pathname)) {
      // Super Admin check
      if (user.email === 'subhamkumar16072006@gmail.com') {
        return response;
      }

      // Query organizer_applications using user.id
      const { data: organizerApplication } = await supabase
        .from('organizer_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      // No organizer record - redirect to access request
      if (!organizerApplication) {
        return NextResponse.redirect(new URL('/auth/access-request', request.url));
      }

      // Check status
      if (organizerApplication.status === 'pending') {
        return NextResponse.redirect(new URL('/auth/pending', request.url));
      }

      if (organizerApplication.status === 'rejected') {
        return NextResponse.redirect(new URL('/auth/rejected', request.url));
      }

      if (organizerApplication.status !== 'approved') {
        return NextResponse.redirect(new URL('/auth/unauthorized?reason=unknown', request.url));
      }

      // User is an approved organizer - allow access to dashboard
    }

    return response;
  } catch {
    // Fail-closed: never allow dashboard access when session validation fails
    if (isDashboardPath(request.nextUrl.pathname)) {
      return createSignInRedirect(request);
    }

    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
