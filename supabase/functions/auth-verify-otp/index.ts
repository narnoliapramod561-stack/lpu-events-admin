/**
 * OTP Verification Edge Function — Verify OTP and establish session.
 *
 * Verifies the OTP sent to the user's email and returns a session JWT.
 * Profile creation is handled automatically by the handle_new_user trigger.
 *
 * POST /functions/v1/auth-verify-otp
 *
 * @see API-001 Section 3 — POST /api/v1/auth/verify-otp
 * @see WF-AUTH-002 — Email OTP Login Flow
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { handleCors } from '../_shared/cors.ts';
import * as response from '../_shared/response.ts';
import { handleUnexpectedError } from '../_shared/errors.ts';
import { parseJsonBody, validateOrRespond } from '../_shared/validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import type { Schema } from '../_shared/validation.ts';

// ─── Request Schema ─────────────────────────────────────────────────────────

const VERIFY_OTP_SCHEMA: Schema = {
    email: { type: 'string', required: true, minLength: 5, maxLength: 255 },
    otp: { type: 'string', required: true, minLength: 6, maxLength: 6 },
};

// ─── Rate Limit Config ──────────────────────────────────────────────────────
// 10 verification attempts per IP per 5 minutes (brute-force protection)
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    if (req.method !== 'POST') {
        return response.methodNotAllowed(['POST']);
    }

    try {
        // ── Rate Limiting (by IP) ───────────────────────────────────────────
        const clientIp =
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('cf-connecting-ip') ||
            'unknown';
        const rateLimited = checkRateLimit(
            `auth-verify-otp:${clientIp}`,
            RATE_LIMIT_MAX,
            RATE_LIMIT_WINDOW_MS
        );
        if (rateLimited) return rateLimited;

        // ── Parse & Validate Request Body ─────────────────────────────────
        const bodyResult = await parseJsonBody(req);
        if (bodyResult instanceof Response) return bodyResult;

        const invalid = validateOrRespond(bodyResult, VERIFY_OTP_SCHEMA);
        if (invalid) return invalid;

        const email = (bodyResult.email as string).trim().toLowerCase();
        const otp = (bodyResult.otp as string).trim();

        // ── Validate OTP format (exactly 6 digits) ────────────────────────
        if (!/^\d{6}$/.test(otp)) {
            return response.validationError('INVALID_OTP_FORMAT', 'OTP must be exactly 6 digits.');
        }

        // ── Per-email brute-force protection ──────────────────────────────
        const emailRateLimited = checkRateLimit(
            `auth-verify-otp:email:${email}`,
            5, // 5 attempts per email per 5 min
            RATE_LIMIT_WINDOW_MS
        );
        if (emailRateLimited) return emailRateLimited;

        // ── Verify OTP via Supabase Auth ──────────────────────────────────
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[AUTH_VERIFY_OTP] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
            return response.internalError();
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email',
        });

        if (verifyError) {
            console.warn('[AUTH_VERIFY_OTP] Verification failed:', verifyError.message);

            if (
                verifyError.message.includes('expired') ||
                verifyError.message.includes('invalid')
            ) {
                return response.error(
                    'INVALID_OTP',
                    'OTP is invalid or has expired. Please request a new one.',
                    401
                );
            }
            return response.error('VERIFICATION_FAILED', 'OTP verification failed.', 401);
        }

        if (!authData.session || !authData.user) {
            console.error('[AUTH_VERIFY_OTP] Verification succeeded but no session/user');
            return response.internalError();
        }

        // ── Fetch user role from profiles ─────────────────────────────────
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

        // ── Success Response ──────────────────────────────────────────────
        return response.success('OTP verified successfully.', {
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
});
