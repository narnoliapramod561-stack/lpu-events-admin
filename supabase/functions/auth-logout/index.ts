/**
 * Logout Edge Function — Invalidate the current session.
 *
 * Signs out the authenticated user by invalidating their Supabase session.
 * Requires a valid JWT in the Authorization header.
 *
 * POST /functions/v1/auth-logout
 *
 * @see API-001 Section 5 — POST /api/v1/auth/logout
 * @see WF-AUTH-003 — Logout Flow
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { handleCors } from '../_shared/cors.ts';
import * as response from '../_shared/response.ts';
import { handleUnexpectedError } from '../_shared/errors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

// ─── Rate Limit Config ──────────────────────────────────────────────────────
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    if (req.method !== 'POST') {
        return response.methodNotAllowed(['POST']);
    }

    try {
        // ── Rate Limiting ─────────────────────────────────────────────────
        const clientIp =
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('cf-connecting-ip') ||
            'unknown';
        const rateLimited = checkRateLimit(`auth-logout:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
        if (rateLimited) return rateLimited;

        // ── Extract JWT from Authorization header ─────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return response.unauthorized('Missing or invalid Authorization header.');
        }
        const token = authHeader.replace('Bearer ', '');

        // ── Create authenticated Supabase client ──────────────────────────
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[AUTH_LOGOUT] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
            return response.internalError();
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
        });

        // ── Verify the user is authenticated ──────────────────────────────
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return response.unauthorized('Invalid or expired session.');
        }

        // ── Sign out ──────────────────────────────────────────────────────
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
            console.warn('[AUTH_LOGOUT] Sign out error:', signOutError.message);
            // Still return success — the token may already be invalidated
        }

        return response.success('Logged out successfully.');
    } catch (err) {
        return handleUnexpectedError(err);
    }
});
