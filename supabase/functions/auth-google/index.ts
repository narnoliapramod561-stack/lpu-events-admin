/**
 * Google OAuth Authentication Edge Function.
 *
 * Resolves a Google OAuth 2.0 ID token into a Supabase session JWT.
 * Profile creation is handled automatically by the handle_new_user trigger.
 *
 * POST /functions/v1/auth-google
 *
 * @see API-001 Section 1 — POST /api/v1/auth/google
 * @see WF-AUTH-001 — Google OAuth Login Flow
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { handleCors } from '../_shared/cors.ts';
import * as response from '../_shared/response.ts';
import { handleUnexpectedError } from '../_shared/errors.ts';
import { parseJsonBody, validateOrRespond } from '../_shared/validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import type { Schema } from '../_shared/validation.ts';
import { withSentry } from '../_shared/sentry.ts';

// ─── Request Schema ─────────────────────────────────────────────────────────

const AUTH_GOOGLE_SCHEMA: Schema = {
    id_token: { type: 'string', required: true, minLength: 10, maxLength: 4096 },
    provider: { type: 'string', required: true, enum: ['google'] as const },
};

// ─── Rate Limit Config ──────────────────────────────────────────────────────
// 30 requests per IP per minute (per API-001 Section 1.9)
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(withSentry('auth-google', async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return response.methodNotAllowed(['POST']);
    }

    try {
        // ── Rate Limiting ─────────────────────────────────────────────────
        const clientIp =
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('cf-connecting-ip') ||
            'unknown';
        const rateLimited = checkRateLimit(`auth-google:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
        if (rateLimited) return rateLimited;

        // ── Parse & Validate Request Body ─────────────────────────────────
        const bodyResult = await parseJsonBody(req);
        if (bodyResult instanceof Response) return bodyResult;

        const invalid = validateOrRespond(bodyResult, AUTH_GOOGLE_SCHEMA);
        if (invalid) return invalid;

        const idToken = bodyResult.id_token as string;

        // ── Sign in with Google ID token via Supabase Auth ────────────────
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[AUTH_GOOGLE] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
            return response.internalError();
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
        });

        if (authError) {
            console.warn('[AUTH_GOOGLE] Auth failed:', authError.message);

            // Map specific error conditions
            if (
                authError.message.includes('invalid') ||
                authError.message.includes('expired') ||
                authError.message.includes('token')
            ) {
                return response.error('INVALID_TOKEN', 'Google ID token has expired or is invalid.', 401);
            }
            return response.error('AUTH_FAILED', 'Authentication failed. Please try again.', 401);
        }

        if (!authData.session || !authData.user) {
            console.error('[AUTH_GOOGLE] Auth succeeded but no session/user returned');
            return response.internalError();
        }

        // ── Fetch user role from profiles ─────────────────────────────────
        // Use the authenticated client so RLS applies
        const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: `Bearer ${authData.session.access_token}` },
            },
        });

        const { data: profile } = await authedClient
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single();

        const userRole = profile?.role || 'student';

        // ── Success Response (API-001 Section 1.6) ────────────────────────
        return response.success('Authentication successful.', {
            user: {
                id: authData.user.id,
                email: authData.user.email,
                role: userRole,
            },
            session: {
                access_token: authData.session.access_token,
                refresh_token: authData.session.refresh_token,
                expires_in: authData.session.expires_in,
            },
        });
    } catch (err) {
        return handleUnexpectedError(err);
    }
}));
