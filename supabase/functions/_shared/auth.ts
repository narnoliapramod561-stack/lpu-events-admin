/**
 * Authentication & Authorization Utilities for Edge Functions.
 *
 * Handles JWT extraction, Supabase client creation, role verification,
 * and ownership checks. Aligned with IMP-006 Authentication Implementation.
 *
 * IMPORTANT: Edge Functions use the service_role key for admin operations
 * and the user's JWT for authenticated client operations.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import type { AuthContext, UserRole } from './types.ts';
import * as response from './response.ts';

// ─── Environment Helpers ────────────────────────────────────────────────────

function getSupabaseUrl(): string {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('SUPABASE_URL is not set');
  return url;
}

function getSupabaseAnonKey(): string {
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!key) throw new Error('SUPABASE_ANON_KEY is not set');
  return key;
}

function getSupabaseServiceRoleKey(): string {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return key;
}

// ─── Supabase Client Factories ──────────────────────────────────────────────

/**
 * Creates a Supabase client authenticated as the requesting user.
 * Uses the user's JWT from the Authorization header.
 * This client respects RLS policies.
 */
export function createUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') || '';
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: { Authorization: authHeader },
    },
  });
}

/**
 * Creates a Supabase client with the service_role key.
 * This client bypasses RLS — use only for admin/system operations.
 * NEVER expose this client to user-facing logic without authorization checks.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ─── JWT / Auth Extraction ──────────────────────────────────────────────────

/**
 * Extracts the JWT token string from the Authorization header.
 * Returns null if no valid Bearer token is found.
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Authenticates the request by verifying the JWT and extracting user context.
 * Returns AuthContext on success, or a 401 Response on failure.
 *
 * Usage:
 * ```ts
 * const authResult = await authenticate(req);
 * if (authResult instanceof Response) return authResult;
 * const { userId, email, role } = authResult;
 * ```
 */
export async function authenticate(req: Request): Promise<AuthContext | Response> {
  const token = extractToken(req);
  if (!token) {
    return response.unauthorized('Missing or invalid Authorization header.');
  }

  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return response.unauthorized('Invalid or expired token.');
  }

  // Get role from profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('[AUTH] Profile lookup failed:', profileError?.message);
    return response.unauthorized('User profile not found.');
  }

  return {
    userId: user.id,
    email: user.email || '',
    role: profile.role as UserRole,
  };
}

// ─── Authorization Helpers ──────────────────────────────────────────────────

/**
 * Checks if the authenticated user has one of the required roles.
 * Returns null if authorized, or a 403 Response if not.
 *
 * Usage:
 * ```ts
 * const denied = requireRole(auth, ['super_admin', 'organizer']);
 * if (denied) return denied;
 * ```
 */
export function requireRole(auth: AuthContext, allowedRoles: UserRole[]): Response | null {
  if (!allowedRoles.includes(auth.role)) {
    return response.forbidden(`This action requires one of: ${allowedRoles.join(', ')}.`);
  }
  return null;
}

/**
 * Checks if the authenticated user is the owner of a resource.
 * Returns null if authorized, or a 403 Response if not.
 */
export function requireOwnership(auth: AuthContext, resourceOwnerId: string): Response | null {
  if (auth.userId !== resourceOwnerId) {
    return response.forbidden('You can only access your own resources.');
  }
  return null;
}

/**
 * Checks if the user is either the owner OR has one of the allowed roles.
 * Super admins always pass.
 */
export function requireOwnershipOrRole(
  auth: AuthContext,
  resourceOwnerId: string,
  allowedRoles: UserRole[]
): Response | null {
  if (auth.userId === resourceOwnerId) return null;
  if (allowedRoles.includes(auth.role)) return null;
  return response.forbidden('You do not have permission to access this resource.');
}
