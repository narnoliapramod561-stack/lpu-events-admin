/**
 * OTP Request Edge Function — Send Magic Link / OTP via email.
 *
 * Initiates passwordless authentication by sending an OTP to the user's email.
 * Any valid email address is permitted.
 *
 * POST /functions/v1/auth-otp
 *
 * @see API-001 Section 2 — POST /api/v1/auth/otp
 * @see WF-AUTH-002 — Email OTP Login Flow
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { handleCors } from '../_shared/cors.ts';
import * as response from '../_shared/response.ts';
import { handleUnexpectedError } from '../_shared/errors.ts';
import { parseJsonBody, validateOrRespond } from '../_shared/validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import type { Schema } from '../_shared/validation.ts';
import { withSentry } from '../_shared/sentry.ts';

// ─── Request Schema ─────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;

const AUTH_OTP_SCHEMA: Schema = {
    email: { type: 'string', required: true, minLength: 5, maxLength: 255 },
    turnstile_token: { type: 'string', required: false, minLength: 0, maxLength: 4096 },
};

// ─── Rate Limit Config ──────────────────────────────────────────────────────
// 5 OTP requests per email per 5 minutes (strict to prevent spam)
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(withSentry('auth-otp', async (req: Request): Promise<Response> => {
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
        const rateLimited = checkRateLimit(`auth-otp:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
        if (rateLimited) return rateLimited;

        // ── Parse & Validate Request Body ─────────────────────────────────
        const bodyResult = await parseJsonBody(req);
        if (bodyResult instanceof Response) return bodyResult;

        const invalid = validateOrRespond(bodyResult, AUTH_OTP_SCHEMA);
        if (invalid) return invalid;

        const email = (bodyResult.email as string).trim().toLowerCase();
        const turnstileToken = bodyResult.turnstile_token as string;

        // ── Validate email format ───────────────────────────────────────
        if (!EMAIL_REGEX.test(email)) {
            return response.validationError(
                'INVALID_EMAIL_DOMAIN',
                'Please use a valid email address.'
            );
        }

        // ── Per-email rate limiting ────────────────────────────────────────
        const emailRateLimited = checkRateLimit(
            `auth-otp:email:${email}`,
            3, // 3 OTPs per email per 5 min
            RATE_LIMIT_WINDOW_MS
        );
        if (emailRateLimited) return emailRateLimited;

        // ── Turnstile Verification (optional when proxied through Next.js) ──
        if (turnstileToken) {
            const turnstileResult = await verifyTurnstile(turnstileToken, clientIp);
            if (turnstileResult) return turnstileResult;
        }

        // ── Send OTP via Supabase Auth ────────────────────────────────────
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[AUTH_OTP] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
            return response.internalError();
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { error: otpError } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: true,
            },
        });

        if (otpError) {
            console.warn('[AUTH_OTP] OTP send failed:', otpError.message);

            if (otpError.message.includes('rate') || otpError.message.includes('limit')) {
                return response.tooManyRequests('Too many OTP requests. Please wait before trying again.');
            }
            return response.error('OTP_SEND_FAILED', 'Failed to send OTP. Please try again.', 500);
        }

        // ── Success — always return 200 to avoid email enumeration ────────
        return response.success('OTP sent successfully. Check your email.');
    } catch (err) {
        return handleUnexpectedError(err);
    }
}));
