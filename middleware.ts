import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * TASK-005: Next.js Edge Middleware Session Refresh
 *
 * This middleware:
 * 1. Refreshes Supabase sessions transparently via @supabase/ssr
 * 2. Protects /dashboard/* routes (requires valid session)
 * 3. Propagates refreshed session cookies to the response
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
  matcher: ['/dashboard/:path*', '/admin/:path*', '/auth/:path*'],
};
