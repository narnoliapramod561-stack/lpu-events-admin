/**
 * Rate Limiting Helper for Edge Functions.
 *
 * Uses an in-memory sliding window approach for basic rate limiting.
 * For production at scale, this should be backed by Redis or a database table.
 *
 * Note: Supabase Edge Functions are stateless — each invocation gets a fresh
 * instance. This in-memory approach works within a single warm instance.
 * For cross-instance rate limiting, use the database-backed approach.
 */

import * as response from './response.ts';
import { createServiceClient } from './auth.ts';

// ─── In-Memory Rate Limiter (per warm instance) ────────────────────────────

const windowStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter for the current warm instance.
 * Returns null if within limit, or a 429 Response if exceeded.
 *
 * @param key - Unique identifier (e.g., userId, IP, endpoint)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Response | null {
  const now = Date.now();
  const entry = windowStore.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    windowStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfterSeconds),
        },
      }
    );
  }

  entry.count++;
  return null;
}

// ─── Database-Backed Rate Limiter ───────────────────────────────────────────

/**
 * Database-backed rate limiter using a rate_limits table.
 * Works across all Edge Function instances.
 *
 * Requires a `rate_limits` table:
 * ```sql
 * CREATE TABLE IF NOT EXISTS public.rate_limits (
 *   key TEXT PRIMARY KEY,
 *   count INTEGER NOT NULL DEFAULT 1,
 *   window_start TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 * ```
 *
 * Falls back to allowing the request if the database check fails
 * (fail-open to avoid blocking users due to infra issues).
 */
export async function checkRateLimitDb(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<Response | null> {
  try {
    const supabase = createServiceClient();

    // Use upsert with a conflict check
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      // Fail open — don't block requests due to rate limit infra issues
      console.error('[RATE_LIMIT] DB check failed:', error.message);
      return null;
    }

    if (data === false) {
      return response.tooManyRequests();
    }

    return null;
  } catch (err) {
    console.error('[RATE_LIMIT] Unexpected error:', err);
    // Fail open
    return null;
  }
}

// ─── Periodic Cleanup ───────────────────────────────────────────────────────

/**
 * Cleans up expired entries from the in-memory store.
 * Called periodically to prevent memory leaks in long-lived instances.
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of windowStore.entries()) {
    if (now > entry.resetAt) {
      windowStore.delete(key);
    }
  }
}
