import { z } from 'zod';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import type { AuthUserProfile, UserRole } from '@/lib/types/auth';

const userRoleSchema = z.enum(['student', 'organizer', 'super_admin', 'admin']);

const authProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().catch(''),
  role: userRoleSchema.catch('student'),
  full_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

function getEmailPrefix(email: string | undefined) {
  const prefix = email?.split('@')[0]?.trim();
  return prefix && prefix.length > 0 ? prefix : 'LPU Student';
}

function mapProfile(row: z.infer<typeof authProfileSchema>): AuthUserProfile {
  const displayName = row.full_name?.trim() || getEmailPrefix(row.email);

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName,
    fullName: row.full_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    status: 'active',
  };
}

function buildFallbackProfile(user: User): AuthUserProfile {
  const metadataName =
    typeof user.user_metadata.name === 'string'
      ? user.user_metadata.name
      : typeof user.user_metadata.full_name === 'string'
        ? user.user_metadata.full_name
        : null;

  const avatarUrl =
    typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : null;

  return {
    id: user.id,
    email: user.email ?? '',
    role: 'student',
    displayName: metadataName?.trim() || getEmailPrefix(user.email),
    fullName: metadataName,
    avatarUrl,
    status: 'active',
  };
}

export async function getSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getUserProfile() {
  const supabase = await createServerSupabaseClient();
  return getUserProfileFromClient(supabase);
}

export async function getUserRole() {
  const profile = await getUserProfile();
  return profile?.role ?? null;
}

export async function getUserProfileFromClient(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    return buildFallbackProfile(user);
  }

  const parsed = authProfileSchema.safeParse(data);
  return parsed.success ? mapProfile(parsed.data) : buildFallbackProfile(user);
}

export async function getUserRoleFromClient(supabase: SupabaseClient) {
  const profile = await getUserProfileFromClient(supabase);
  return profile?.role ?? 'student';
}

export function isOrganizerRole(role: UserRole) {
  return role === 'organizer' || role === 'super_admin' || role === 'admin';
}

export function hasActiveSession(session: Session | null) {
  return Boolean(session?.access_token);
}

/**
 * Initiates Google OAuth 2.0 PKCE authentication flow.
 */
export async function signInWithGoogleOAuth(supabase: SupabaseClient, redirectTo?: string) {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo:
        redirectTo || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
}

/**
 * Dispatches 6-digit Email OTP to student email address.
 */
export async function sendStudentEmailOTP(supabase: SupabaseClient, email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
}

/**
 * Verifies 6-digit Email OTP token.
 */
export async function verifyStudentEmailOTP(
  supabase: SupabaseClient,
  email: string,
  token: string
) {
  return supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
}

/**
 * Writes encrypted HttpOnly, Secure session cookies to HTTP response headers.
 */
export function setAuthSessionCookies(response: NextResponse, session: Session): NextResponse {
  const maxAge = session.expires_in || 3600;

  response.cookies.set('sb-access-token', session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  if (session.refresh_token) {
    response.cookies.set('sb-refresh-token', session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAge * 24,
    });
  }

  return response;
}
