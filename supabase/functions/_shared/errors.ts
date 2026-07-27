/**
 * RPC Error → HTTP Error Mapping.
 *
 * Maps PostgreSQL RAISE EXCEPTION error codes (from RPCs) to
 * appropriate HTTP status codes and safe user-facing messages.
 *
 * Aligned with DB-006 RPC Specification error codes.
 */

import * as response from './response.ts';

/**
 * Known RPC error code → HTTP mapping.
 * Key = PostgreSQL error code string from RAISE EXCEPTION.
 */
const RPC_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  // ─── Authentication / Authorization ─────────────────────────────────
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' },
  FORBIDDEN: {
    status: 403,
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
  },
  NOT_ORGANIZER: { status: 403, code: 'FORBIDDEN', message: 'Organizer role required.' },
  NOT_ADMIN: { status: 403, code: 'FORBIDDEN', message: 'Admin access required.' },

  // ─── Not Found ──────────────────────────────────────────────────────
  EVENT_NOT_FOUND: { status: 404, code: 'EVENT_NOT_FOUND', message: 'Event not found.' },
  TICKET_TYPE_NOT_FOUND: {
    status: 404,
    code: 'TICKET_TYPE_NOT_FOUND',
    message: 'Ticket type not found.',
  },
  REGISTRATION_NOT_FOUND: {
    status: 404,
    code: 'REGISTRATION_NOT_FOUND',
    message: 'Registration not found.',
  },
  TICKET_NOT_FOUND: { status: 404, code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' },
  PAYMENT_NOT_FOUND: { status: 404, code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' },
  PROFILE_NOT_FOUND: { status: 404, code: 'PROFILE_NOT_FOUND', message: 'User profile not found.' },
  APPLICATION_NOT_FOUND: {
    status: 404,
    code: 'APPLICATION_NOT_FOUND',
    message: 'Organizer application not found.',
  },

  // ─── Conflict / Business Rules ──────────────────────────────────────
  EVENT_NOT_PUBLISHED: {
    status: 409,
    code: 'EVENT_NOT_PUBLISHED',
    message: 'Event is not published.',
  },
  EVENT_ALREADY_PUBLISHED: {
    status: 409,
    code: 'EVENT_ALREADY_PUBLISHED',
    message: 'Event is already published.',
  },
  EVENT_CANCELLED: { status: 409, code: 'EVENT_CANCELLED', message: 'Event has been cancelled.' },
  EVENT_COMPLETED: {
    status: 409,
    code: 'EVENT_COMPLETED',
    message: 'Event has already completed.',
  },
  REGISTRATION_CLOSED: {
    status: 409,
    code: 'REGISTRATION_CLOSED',
    message: 'Registration is closed for this event.',
  },
  ALREADY_REGISTERED: {
    status: 409,
    code: 'ALREADY_REGISTERED',
    message: 'You are already registered for this event.',
  },
  TICKETS_SOLD_OUT: { status: 409, code: 'TICKETS_SOLD_OUT', message: 'Tickets are sold out.' },
  INSUFFICIENT_INVENTORY: {
    status: 409,
    code: 'INSUFFICIENT_INVENTORY',
    message: 'Not enough tickets available.',
  },
  RESERVATION_EXPIRED: {
    status: 409,
    code: 'RESERVATION_EXPIRED',
    message: 'Your reservation has expired.',
  },
  RESERVATION_NOT_RESERVED: {
    status: 409,
    code: 'RESERVATION_NOT_RESERVED',
    message: 'Reservation is not in reserved state.',
  },
  TICKET_ALREADY_USED: {
    status: 409,
    code: 'TICKET_ALREADY_USED',
    message: 'Ticket has already been used.',
  },
  TICKET_CANCELLED: {
    status: 409,
    code: 'TICKET_CANCELLED',
    message: 'Ticket has been cancelled.',
  },
  TICKET_EXPIRED: { status: 409, code: 'TICKET_EXPIRED', message: 'Ticket has expired.' },
  DUPLICATE_PAYMENT: {
    status: 409,
    code: 'DUPLICATE_PAYMENT',
    message: 'Payment has already been processed.',
  },
  INVALID_STATE_TRANSITION: {
    status: 409,
    code: 'INVALID_STATE_TRANSITION',
    message: 'Invalid state transition.',
  },
  APPLICATION_ALREADY_PROCESSED: {
    status: 409,
    code: 'APPLICATION_ALREADY_PROCESSED',
    message: 'Application has already been processed.',
  },
  INVENTORY_MISMATCH: {
    status: 409,
    code: 'INVENTORY_MISMATCH',
    message: 'Inventory count mismatch detected.',
  },

  // ─── Validation ─────────────────────────────────────────────────────
  INVALID_INPUT: { status: 422, code: 'INVALID_INPUT', message: 'Invalid input provided.' },
  INVALID_QUANTITY: { status: 422, code: 'INVALID_QUANTITY', message: 'Invalid ticket quantity.' },
  INVALID_AMOUNT: { status: 422, code: 'INVALID_AMOUNT', message: 'Invalid payment amount.' },
  INVALID_EVENT_DATES: {
    status: 422,
    code: 'INVALID_EVENT_DATES',
    message: 'Invalid event dates.',
  },
  MAX_TICKETS_EXCEEDED: {
    status: 422,
    code: 'MAX_TICKETS_EXCEEDED',
    message: 'Maximum tickets per user exceeded.',
  },
};

/**
 * Handles a Supabase RPC error and returns an appropriate HTTP response.
 *
 * Extracts the error code from the PostgreSQL error message and maps it
 * to a safe HTTP response. Falls back to 500 for unknown errors.
 *
 * @param rpcError - The error object from supabase.rpc() call
 */
export function handleRpcError(rpcError: {
  message?: string;
  code?: string;
  details?: string;
}): Response {
  const errorMessage = rpcError.message || '';

  // Try to match against known RPC error codes
  for (const [key, mapping] of Object.entries(RPC_ERROR_MAP)) {
    if (errorMessage.includes(key)) {
      return response.error(mapping.code, mapping.message, mapping.status);
    }
  }

  // Log unknown errors server-side for debugging
  console.error('[RPC_ERROR]', {
    message: rpcError.message,
    code: rpcError.code,
    details: rpcError.details,
  });

  // Never expose raw database errors to clients
  return response.internalError();
}

/**
 * Safely handles any caught exception and returns an appropriate response.
 * Never exposes stack traces or internal details.
 */
export function handleUnexpectedError(err: unknown): Response {
  if (err instanceof Error) {
    console.error('[UNEXPECTED_ERROR]', {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
  } else {
    console.error('[UNEXPECTED_ERROR]', err);
  }

  return response.internalError();
}
