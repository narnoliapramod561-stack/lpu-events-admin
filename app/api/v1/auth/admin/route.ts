import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getUserRoleFromClient, setAuthSessionCookies, signInWithGoogleOAuth } from '@/lib/auth';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

const adminAuthSchema = z.object({
  method: z.string(),
  redirectTo: z.string().optional(),
});

function isEmailWhitelisted(email: string, whitelistJson: unknown): boolean {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check environment variable whitelist (SUPER_ADMIN_EMAIL or SUPER_ADMIN_EMAILS)
  const envEmails = (process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);

  if (envEmails.includes(normalizedEmail)) {
    return true;
  }

  // 2. Check system_config table whitelist data if present
  if (Array.isArray(whitelistJson)) {
    return whitelistJson.some(
      (item) => typeof item === 'string' && item.toLowerCase().trim() === normalizedEmail
    );
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = adminAuthSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid Super Admin authentication request payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { method, redirectTo } = parseResult.data;

    // Strict Enforcement: Reject any OTP, password, or non-Google authentication attempts
    if (method !== 'google' && method !== 'verify_google') {
      return NextResponse.json(
        {
          error: 'Admin authentication prohibited',
          message:
            'Email OTP and non-Google login for Super Admin are explicitly prohibited. Google Sign-In ONLY is permitted.',
        },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Method 1: Initiate Google OAuth 2.0 PKCE Flow
    if (method === 'google') {
      const targetRedirect =
        redirectTo ||
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?role=admin`;

      const { data, error } = await signInWithGoogleOAuth(supabase, targetRedirect);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      return NextResponse.json({ url: data.url }, { status: 200 });
    }

    // Method 2: Verify Authenticated Google Session & Enforce Dual Guard (Whitelist + Role)
    if (method === 'verify_google') {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (userError || !user || !session) {
        return NextResponse.json(
          { error: 'Invalid or unauthenticated Google session' },
          { status: 401 }
        );
      }

      const userEmail = user.email || '';

      // Step A: Query system_config table for admin_whitelist
      const { data: configData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'admin_whitelist')
        .maybeSingle();

      let whitelistJson: unknown = [];
      if (configData?.value) {
        try {
          whitelistJson = JSON.parse(configData.value);
        } catch {
          whitelistJson = configData.value;
        }
      }

      // Step B: Whitelist Guard Verification
      const whitelisted = isEmailWhitelisted(userEmail, whitelistJson);

      // Step C: Role Guard Verification
      const role = await getUserRoleFromClient(supabase);
      const isSuperAdminRole = role === 'super_admin' || role === 'admin';

      // Revoke session if EITHER whitelist or role check fails
      if (!whitelisted || !isSuperAdminRole) {
        await supabase.auth.signOut().catch(() => {});

        console.warn(
          `[ADMIN_AUTH_SECURITY] Unauthorized Super Admin access attempt: Email=${userEmail}, Role=${role}, Whitelisted=${whitelisted}, Timestamp=${new Date().toISOString()}`
        );

        return NextResponse.json(
          {
            error: 'Unauthorized Super Admin account',
            message:
              'Your Google account is not authorized for Super Admin access. Session revoked.',
          },
          { status: 403 }
        );
      }

      console.info(
        `[ADMIN_AUTH_SUCCESS] Super Admin authenticated: Email=${userEmail}, Timestamp=${new Date().toISOString()}`
      );

      const response = NextResponse.json(
        {
          message: 'Super Admin authenticated successfully',
          user,
          role,
        },
        { status: 200 }
      );

      return setAuthSessionCookies(response, session);
    }

    return NextResponse.json({ error: 'Unsupported method' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
