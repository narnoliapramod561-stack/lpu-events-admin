-- =============================================================================
-- TASK-017: RPC expire_reservations_batch() Scheduled Expiry
-- Migration: 20260722000009_rpc_expire_reservations.sql
-- Depends on: 20260722000006_rpc_reserve_ticket.sql (TASK-014)
-- References: REQ-BOOK-003, WF-BOOK-004, DB-006, IMP-007
-- =============================================================================

-- ---------------------------------------------------------------------------
-- expire_reservations_batch(p_batch_size)
--
-- Batch-expires all overdue reservations with status IN ('held','payment_pending')
-- where expires_at < now(). For each expired reservation:
--   1. Sets status = 'expired'
--   2. Returns inventory: increments available_tickets, decrements reserved_tickets
--   3. Emits reservation.expired outbox event
-- Returns count of reservations expired in this batch run.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_reservations_batch(
  p_batch_size integer DEFAULT 100
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_expired_ids   uuid[];
  v_reservation   RECORD;
  v_expired_count integer := 0;
BEGIN
  -- -------------------------------------------------------------------------
  -- Step 1: Collect and lock a batch of overdue reservations
  -- -------------------------------------------------------------------------
  SELECT ARRAY_AGG(id)
    INTO v_expired_ids
    FROM (
      SELECT id
        FROM public.reservations
       WHERE status IN ('held', 'payment_pending')
         AND expires_at < now()
       ORDER BY expires_at ASC
       LIMIT p_batch_size
       FOR UPDATE SKIP LOCKED
    ) sub;

  -- Nothing to expire
  IF v_expired_ids IS NULL OR array_length(v_expired_ids, 1) = 0 THEN
    RETURN jsonb_build_object('expired_count', 0);
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 2: Mark all collected reservations as expired
  -- -------------------------------------------------------------------------
  UPDATE public.reservations
     SET status     = 'expired',
         updated_at = now()
   WHERE id = ANY(v_expired_ids);

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- -------------------------------------------------------------------------
  -- Step 3: Return inventory for each expired reservation
  -- -------------------------------------------------------------------------
  FOR v_reservation IN
    SELECT r.id,
           r.event_id,
           r.ticket_type_id,
           r.quantity,
           r.user_id
      FROM public.reservations r
     WHERE r.id = ANY(v_expired_ids)
  LOOP
    -- Increment available_tickets, decrement reserved_tickets
    UPDATE public.event_inventory
       SET available_tickets = available_tickets + v_reservation.quantity,
           reserved_tickets  = reserved_tickets - v_reservation.quantity,
           version           = version + 1,
           updated_at        = now()
     WHERE event_id = v_reservation.event_id
       AND (
         ticket_type_id = v_reservation.ticket_type_id
         OR ticket_type_id IS NULL
       );

    -- Emit reservation.expired outbox event
    INSERT INTO public.outbox_events (
      event_type,
      resource_type,
      resource_id,
      payload
    )
    VALUES (
      'reservation.expired',
      'reservation',
      v_reservation.id,
      jsonb_build_object(
        'reservation_id', v_reservation.id,
        'user_id',        v_reservation.user_id,
        'event_id',       v_reservation.event_id,
        'quantity',       v_reservation.quantity,
        'expired_at',     now()
      )
    );
  END LOOP;

  -- -------------------------------------------------------------------------
  -- Return batch result
  -- -------------------------------------------------------------------------
  RETURN jsonb_build_object('expired_count', v_expired_count);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- =============================================================================
-- End of TASK-017: RPC expire_reservations_batch()
-- =============================================================================
