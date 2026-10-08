// supabase/functions/superadmin-operations/errors.ts
// Standardized Operations Error Taxonomy & Sanitization

export type OperationsErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_UNAVAILABLE'
  | 'DIAGNOSTIC_FAILED'
  | 'INTERNAL_ERROR'
  | 'TIMEOUT';

export class OperationsError extends Error {
  public readonly code: OperationsErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: OperationsErrorCode,
    message: string,
    status = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OperationsError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface NormalizedError {
  code: OperationsErrorCode;
  message: string;
  status: number;
}

/**
 * Normalizes any caught runtime exception or OperationsError into a safe,
 * standardized representation suitable for transmission to the browser.
 * Never leaks raw database error strings, SQL queries, or provider stack traces.
 */
export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof OperationsError) {
    return {
      code: err.code,
      message: err.message,
      status: err.status,
    };
  }

  const rawMessage = err instanceof Error ? err.message : String(err);

  // Identify known Supabase / PostgREST error codes
  if (rawMessage.includes('42501') || rawMessage.toLowerCase().includes('permission denied')) {
    return {
      code: 'FORBIDDEN',
      message: 'Access denied: Super Administrator privilege required.',
      status: 403,
    };
  }

  if (rawMessage.toLowerCase().includes('timeout') || rawMessage.toLowerCase().includes('aborted')) {
    return {
      code: 'TIMEOUT',
      message: 'The requested operational probe timed out.',
      status: 504,
    };
  }

  // Safe fallback for unhandled exceptions
  return {
    code: 'INTERNAL_ERROR',
    message: 'An internal operational error occurred while processing the request.',
    status: 500,
  };
}
