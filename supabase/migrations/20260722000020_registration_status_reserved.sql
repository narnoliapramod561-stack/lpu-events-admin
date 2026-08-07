-- =============================================================================
-- TASK-017: Add reserved registration status for pre-payment bookings
-- Migration: 20260722000015_registration_status_reserved.sql
-- =============================================================================

DO $$
BEGIN
  ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'reserved';
END $$;

-- =============================================================================
-- End of TASK-017
-- =============================================================================
