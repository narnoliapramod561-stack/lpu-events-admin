-- =============================================================================
-- TASK-015: RPC extend_reservation() Stage 2 Extension
-- Migration: 20260722000007_rpc_extend_reservation.sql
-- Depends on: 20260722000006_rpc_reserve_ticket.sql
-- References: REQ-BOOK-002, WF-BOOK-001, DB-005, IMP-007
-- =============================================================================

-- ---------------------------------------------------------------------------
-- extend_reservation(p_reservation_id, p_user_id)
-- Stage 2: Transitions a 'held' reservation to 'payment_pending' and extends
-- the expiry by +300 seconds (5 minutes) from NOW().
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.extend_reservation(
  p_reservation_id uuid,
  p_user_id        uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_reservation public.reservations%ROWTYPE;
  v_expires_at  timestamptz;
BEGIN
  -- -------------------------------------------------------------------------
  -- Step 1: Lock and fetch the reservation for this user
  -- -------------------------------------------------------------------------
  SELECT *
    INTO v_reservation
    FROM public.reservations
   WHERE id      = p_reservation_id
     AND user_id = p_user_id
  FOR UPDATE;

  -- -------------------------------------------------------------------------
  -- Step 2: Validate existence
  -- -------------------------------------------------------------------------
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error',   'RESERVATION_NOT_FOUND',
      'message', 'Reservation not found or does not belong to the requesting user.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 3: Validate current status must be 'held'
  -- -------------------------------------------------------------------------
  IF v_reservation.status <> 'held' THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_STATUS',
      'message', format(
        'Reservation must be in ''held'' status to extend. Current status: %s',
        v_reservation.status
      )
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 4: Validate the hold has not already expired
  -- -------------------------------------------------------------------------
  IF v_reservation.expires_at < now() THEN
    RETURN jsonb_build_object(
      'error',   'RESERVATION_EXPIRED',
      'message', 'The reservation hold has already expired and cannot be extended.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 5: Extend expiry by +300 seconds and transition to payment_pending
  -- -------------------------------------------------------------------------
  v_expires_at := now() + INTERVAL '300 seconds';

  UPDATE public.reservations
     SET status     = 'payment_pending',
         expires_at = v_expires_at,
         updated_at = now()
   WHERE id = p_reservation_id;

  -- -------------------------------------------------------------------------
  -- Return success payload
  -- -------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'reservation_id', p_reservation_id,
    'status',         'payment_pending',
    'expires_at',     v_expires_at
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- =============================================================================
-- End of TASK-015: RPC extend_reservation()
-- =============================================================================
