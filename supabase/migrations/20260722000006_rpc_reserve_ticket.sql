-- =============================================================================
-- TASK-014: RPC reserve_ticket() with Inline Lazy Cleanup + Outbox Pattern
-- Migration: 20260722000006_rpc_reserve_ticket.sql
-- Depends on: 20260722000001_canonical_schema.sql, 20260722000005_audit_triggers.sql
-- References: REQ-BOOK-001, WF-BOOK-001, DB-005, API-005, IMP-002, IMP-007
-- =============================================================================

-- ---------------------------------------------------------------------------
-- reserve_ticket(p_event_id, p_ticket_type_id, p_user_id)
-- Stage 1: Pessimistic row-locking reservation with 120-second hold expiry
-- and 2-step inline lazy cleanup for expired holds.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reserve_ticket(
  p_event_id      uuid,
  p_ticket_type_id uuid,
  p_user_id       uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_inventory        public.event_inventory%ROWTYPE;
  v_reservation_id   uuid;
  v_expires_at       timestamptz;
  v_cleaned          int := 0;
BEGIN
  -- -------------------------------------------------------------------------
  -- Step 1: Lock the inventory row with SELECT FOR UPDATE (pessimistic lock)
  -- -------------------------------------------------------------------------
  SELECT *
    INTO v_inventory
    FROM public.event_inventory
   WHERE event_id        = p_event_id
     AND ticket_type_id  = p_ticket_type_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'INVENTORY_NOT_FOUND',
      'message', 'No inventory record found for the specified event and ticket type.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 2: Inline lazy cleanup of expired holds (only if stock is zero)
  -- When available_tickets = 0, attempt to reclaim expired reservations
  -- -------------------------------------------------------------------------
  IF v_inventory.available_tickets = 0 THEN
    -- Release expired held reservations back to available
    WITH expired AS (
      UPDATE public.reservations
         SET status     = 'expired',
             updated_at = now()
       WHERE event_id        = p_event_id
         AND ticket_type_id  = p_ticket_type_id
         AND status          = 'held'
         AND expires_at      < now()
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_cleaned FROM expired;

    -- Restore inventory counters for each expired hold we just cleaned
    IF v_cleaned > 0 THEN
      UPDATE public.event_inventory
         SET available_tickets  = available_tickets + v_cleaned,
             reserved_tickets   = reserved_tickets  - v_cleaned,
             updated_at         = now()
       WHERE event_id       = p_event_id
         AND ticket_type_id = p_ticket_type_id;

      -- Re-read locked inventory row after cleanup
      SELECT *
        INTO v_inventory
        FROM public.event_inventory
       WHERE event_id       = p_event_id
         AND ticket_type_id = p_ticket_type_id
      FOR UPDATE;
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 3: Check availability after (optional) cleanup
  -- -------------------------------------------------------------------------
  IF v_inventory.available_tickets < 1 THEN
    RETURN jsonb_build_object(
      'error', 'NO_AVAILABILITY',
      'message', 'No tickets are currently available for this event.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 4: Decrement available, increment reserved, set expiry (+120 secs)
  -- -------------------------------------------------------------------------
  v_expires_at := now() + INTERVAL '120 seconds';

  UPDATE public.event_inventory
     SET available_tickets = available_tickets - 1,
         reserved_tickets  = reserved_tickets  + 1,
         updated_at        = now()
   WHERE event_id       = p_event_id
     AND ticket_type_id = p_ticket_type_id;

  -- -------------------------------------------------------------------------
  -- Step 5: Create the reservation record
  -- -------------------------------------------------------------------------
  INSERT INTO public.reservations (
    user_id,
    event_id,
    ticket_type_id,
    status,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_event_id,
    p_ticket_type_id,
    'held',
    v_expires_at,
    now(),
    now()
  )
  RETURNING id INTO v_reservation_id;

  -- -------------------------------------------------------------------------
  -- Step 6: Create outbox event for the reservation
  -- -------------------------------------------------------------------------
  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload,
    created_at
  ) VALUES (
    'reservation.created',
    'reservations',
    v_reservation_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'event_id', p_event_id,
      'ticket_type_id', p_ticket_type_id,
      'expires_at', v_expires_at
    ),
    now()
  );

  -- -------------------------------------------------------------------------
  -- Return success payload
  -- -------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'reservation_id', v_reservation_id,
    'expires_at',     v_expires_at
  );

  -- Note: No EXCEPTION handler — real database errors must propagate as
  -- PostgreSQL exceptions so the entire transaction (reservation + outbox
  -- INSERT) is atomically rolled back. Business-logic rejections
  -- (INVENTORY_NOT_FOUND, NO_AVAILABILITY) are handled with early RETURN
  -- statements above and do not reach here.
END;
$$;

-- =============================================================================
-- End of TASK-014: RPC reserve_ticket()
-- =============================================================================
