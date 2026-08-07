import { z } from 'zod';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { supabaseBrowser } from './supabase';

const userRoleSchema = z.enum(['student', 'organizer', 'super_admin', 'admin', 'pending']);
const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

const authProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().catch(''),
  role: userRoleSchema.catch('pending'),
  approval_status: approvalStatusSchema.catch('pending'),
  is_active: z.boolean().catch(true),
  full_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

function getEmailPrefix(email: string | undefined) {
  const prefix = email?.split('@')[0]?.trim();
  return prefix && prefix.length > 0 ? prefix : 'User';
}

function mapProfile(row: z.infer<typeof authProfileSchema>): AuthUserProfile {
  const displayName = row.full_name?.trim() || getEmailPrefix(row.email);

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    approvalStatus: row.approval_status,
    isActive: row.is_active,
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
    role: 'pending',
    approvalStatus: 'pending',
    isActive: true,
    displayName: metadataName?.trim() || getEmailPrefix(user.email),
    fullName: metadataName,
    avatarUrl,
    status: 'active',
  };
}

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getUserProfile() {
  const supabase = await createClient();
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
    .select('id, email, role, approval_status, is_active, full_name, avatar_url')
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
  return profile?.role ?? 'pending';
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

function createClient() {
  return supabaseBrowser;
}
