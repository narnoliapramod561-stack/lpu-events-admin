/**
 * Shared TypeScript types for all Edge Functions.
 *
 * Aligned with DB-009 Enums, API-000 Design Principles,
 * and DB-003 Table Specifications.
 */

// ─── User Roles (DB-009: user_role enum) ────────────────────────────────────
export type UserRole = 'student' | 'organizer' | 'super_admin';

// ─── Event Status (DB-009: event_status enum) ───────────────────────────────
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed' | 'archived';

// ─── Registration Status (DB-009: registration_status enum) ─────────────────
export type RegistrationStatus = 'reserved' | 'confirmed' | 'cancelled' | 'expired';

// ─── Payment Status (DB-009: payment_status enum) ───────────────────────────
export type PaymentStatus =
  'pending' | 'initiated' | 'captured' | 'failed' | 'refund_initiated' | 'refunded';

// ─── Ticket Status (DB-009: ticket_status enum) ─────────────────────────────
export type TicketStatus = 'valid' | 'used' | 'cancelled' | 'expired';

// ─── Verification Method (DB-009: verification_method enum) ─────────────────
export type VerificationMethod = 'qr_scan' | 'manual_lookup';

// ─── Organizer Application Status ───────────────────────────────────────────
export type OrganizerApplicationStatus = 'pending' | 'approved' | 'rejected';

// ─── Registration Mode (DB-009) ─────────────────────────────────────────────
export type RegistrationMode = 'free' | 'paid' | 'approval';

// ─── Advertisement Placement ────────────────────────────────────────────────
export type AdPlacement = 'home_banner' | 'event_sidebar' | 'event_footer';

// ─── Sync Resource Type ─────────────────────────────────────────────────────
export type SyncResourceType = 'events' | 'categories' | 'ticket_types';

// ─── API Response Types (API-000 Standard Response Format) ──────────────────

/** Successful API response */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  page?: number;
  limit?: number;
  total?: number;
  total_pages?: number;
}

/** Error API response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/** Union type for all API responses */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Auth Context ───────────────────────────────────────────────────────────

/** Authenticated user context extracted from JWT */
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
}

// ─── Pagination Parameters ──────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

// ─── RPC Error Structure ────────────────────────────────────────────────────

/** Structure returned by PostgreSQL RPCs on error via RAISE EXCEPTION */
export interface RpcError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}
