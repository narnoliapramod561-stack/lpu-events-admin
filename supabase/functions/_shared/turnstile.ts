/**
 * Cloudflare Turnstile Verification — Bot protection for Edge Functions.
 *
 * Verifies Turnstile tokens server-side against the Cloudflare API.
 * Required for public-facing endpoints (booking, registration, etc.)
 * per WF-SECURITY-001 and Security Requirements.
 */

import * as response from './response.ts';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 5000;

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
}

/**
 * Verifies a Cloudflare Turnstile token.
 *
 * @param token - The Turnstile token from the client
 * @param remoteIp - Optional client IP for additional validation
 * @returns null if verification passes, or a Response if it fails
 */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<Response | null> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('[TURNSTILE] TURNSTILE_SECRET_KEY is not configured');
    return response.internalError('Bot protection configuration error.');
  }

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return response.badRequest('TURNSTILE_MISSING', 'Turnstile token is required.');
  }

  try {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);

    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!verifyResponse.ok) {
      console.error('[TURNSTILE] Cloudflare API returned non-OK status:', verifyResponse.status);
      // Fail open: allow request if Turnstile API is down (configurable)
      const failOpen = Deno.env.get('TURNSTILE_FAIL_OPEN') === 'true';
      if (failOpen) {
        console.warn('[TURNSTILE] Failing open — allowing request despite API error');
        return null;
      }
      return response.internalError('Bot verification service unavailable.');
    }

    const result = (await verifyResponse.json()) as TurnstileVerifyResponse;

    if (!result.success) {
      console.warn('[TURNSTILE] Verification failed:', result['error-codes']);
      return response.badRequest('TURNSTILE_FAILED', 'Bot verification failed. Please try again.');
    }

    // Token verified successfully
    return null;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('[TURNSTILE] Verification timed out');
    } else {
      console.error('[TURNSTILE] Verification error:', err);
    }

    const failOpen = Deno.env.get('TURNSTILE_FAIL_OPEN') === 'true';
    if (failOpen) {
      console.warn('[TURNSTILE] Failing open — allowing request despite error');
      return null;
    }
    return response.internalError('Bot verification service unavailable.');
  }
}
