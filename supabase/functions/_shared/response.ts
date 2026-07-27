/**
 * Standardized API Response Builder — Consistent response formatting
 * per API-000 Design Principles (Section 9).
 *
 * All Edge Functions MUST use these helpers to construct responses.
 * Never expose stack traces, SQL errors, or internal details.
 */

import { corsHeaders } from './cors.ts';
import type { ApiSuccessResponse, ApiErrorResponse } from './types.ts';

/**
 * Creates a successful JSON response.
 *
 * @param message - Human-readable success message
 * @param data - Response payload (optional)
 * @param status - HTTP status code (default: 200)
 * @param pagination - Optional pagination metadata
 */
export function success<T>(
  message: string,
  data?: T,
  status = 200,
  pagination?: { page: number; limit: number; total: number; total_pages: number }
): Response {
  const body: ApiSuccessResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(pagination && {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      total_pages: pagination.total_pages,
    }),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Creates a 201 Created response.
 */
export function created<T>(message: string, data?: T): Response {
  return success(message, data, 201);
}

/**
 * Creates a 204 No Content response (no body).
 */
export function noContent(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Creates an error JSON response.
 *
 * @param code - Machine-readable error code (e.g., 'UNAUTHORIZED', 'EVENT_NOT_FOUND')
 * @param message - Human-readable error message (safe to display)
 * @param status - HTTP status code
 */
export function error(code: string, message: string, status: number): Response {
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// ─── Convenience Error Helpers ──────────────────────────────────────────────

/** 400 Bad Request */
export function badRequest(code: string, message: string): Response {
  return error(code, message, 400);
}

/** 401 Unauthorized */
export function unauthorized(message = 'Authentication required.'): Response {
  return error('UNAUTHORIZED', message, 401);
}

/** 403 Forbidden */
export function forbidden(
  message = 'You do not have permission to perform this action.'
): Response {
  return error('FORBIDDEN', message, 403);
}

/** 404 Not Found */
export function notFound(code: string, message: string): Response {
  return error(code, message, 404);
}

/** 409 Conflict */
export function conflict(code: string, message: string): Response {
  return error(code, message, 409);
}

/** 422 Validation Error */
export function validationError(code: string, message: string): Response {
  return error(code, message, 422);
}

/** 429 Too Many Requests */
export function tooManyRequests(message = 'Too many requests. Please try again later.'): Response {
  return error('RATE_LIMIT_EXCEEDED', message, 429);
}

/** 405 Method Not Allowed */
export function methodNotAllowed(allowed: string[]): Response {
  return error('METHOD_NOT_ALLOWED', `Allowed methods: ${allowed.join(', ')}`, 405);
}

/** 500 Internal Server Error — never expose details */
export function internalError(
  message = 'An unexpected error occurred. Please try again later.'
): Response {
  return error('INTERNAL_ERROR', message, 500);
}
