/**
 * CORS Headers — Shared CORS configuration for all Edge Functions.
 *
 * Handles preflight OPTIONS requests and provides consistent CORS headers.
 * ALLOWED_ORIGIN is read from environment variable; defaults to '*' in development.
 */

const ALLOWED_METHODS = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
const ALLOWED_HEADERS =
  'Authorization, X-Client-Info, Content-Type, Accept, X-Request-Id, X-Razorpay-Signature';
const MAX_AGE = '86400'; // 24 hours

/**
 * Returns the allowed origin from environment or wildcard fallback.
 */
function getAllowedOrigin(): string {
  return Deno.env.get('ALLOWED_ORIGIN') || '*';
}

/**
 * Standard CORS headers applied to every response.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': getAllowedOrigin(),
  'Access-Control-Allow-Methods': ALLOWED_METHODS,
  'Access-Control-Allow-Headers': ALLOWED_HEADERS,
  'Access-Control-Max-Age': MAX_AGE,
};

/**
 * Handles CORS preflight (OPTIONS) requests.
 * Returns a 204 No Content response with appropriate CORS headers.
 *
 * Usage in Edge Functions:
 * ```ts
 * if (req.method === 'OPTIONS') {
 *   return handleCors();
 * }
 * ```
 */
export function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
