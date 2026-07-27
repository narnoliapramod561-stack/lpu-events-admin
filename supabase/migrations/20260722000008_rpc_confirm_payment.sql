-- =============================================================================
-- TASK-016: RPC confirm_payment() Payment Capture & Idempotency Lock
-- Migration: 20260722000008_rpc_confirm_payment.sql
-- Depends on: 20260722000006_rpc_reserve_ticket.sql (TASK-014)
-- References: REQ-PAY-001, WF-PAY-002, DB-006, IMP-007
-- =============================================================================

-- ---------------------------------------------------------------------------
-- confirm_payment(p_order_id, p_payment_id, p_signature)
--
-- Atomically confirms a payment by:
--   1. Idempotency guard — if razorpay_payment_id already captured, return
--      the existing ticket without re-processing.
--   2. Looks up the payment record via razorpay_order_id.
--   3. Marks the payment as captured.
--   4. Creates a confirmed registration row.
--   5. Issues a ticket with a secure QR token.
--   6. Decrements reserved_tickets, increments sold_tickets on event_inventory.
--   7. Transitions the reservation status to 'confirmed'.
--   8. Emits a booking.confirmed outbox event.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_payment(
  p_order_id   text,
  p_payment_id text,
  p_signature  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_payment        public.payments%ROWTYPE;
  v_reservation    public.reservations%ROWTYPE;
  v_registration   public.registrations%ROWTYPE;
  v_existing_ticket public.tickets%ROWTYPE;
  v_ticket_id      uuid;
  v_qr_token       text;
  v_ticket_number  text;
  v_reg_id         uuid;
BEGIN
  -- -------------------------------------------------------------------------
  -- Step 1: Idempotency guard — check if this payment_id is already captured
  -- -------------------------------------------------------------------------
  SELECT *
    INTO v_payment
    FROM public.payments
   WHERE razorpay_payment_id = p_payment_id
   LIMIT 1;

  IF FOUND AND v_payment.status = 'captured' THEN
    -- Return existing ticket without re-processing
    SELECT *
      INTO v_existing_ticket
      FROM public.tickets
     WHERE registration_id = (
       SELECT id FROM public.registrations
        WHERE reservation_id = (
          SELECT id FROM public.reservations
           WHERE id = (
             SELECT reservation_id FROM public.registrations
              WHERE id = (
                SELECT registration_id FROM public.payments
                 WHERE id = v_payment.id
                LIMIT 1
              )
              LIMIT 1
           )
          LIMIT 1
        )
        LIMIT 1
     )
     LIMIT 1;

    -- Simpler approach: get ticket via registration linked to this payment
    SELECT t.*
      INTO v_existing_ticket
      FROM public.tickets t
      JOIN public.registrations r ON r.id = t.registration_id
     WHERE r.id = v_payment.registration_id
     LIMIT 1;

    RETURN jsonb_build_object(
      'ticket_id', v_existing_ticket.id,
      'qr_token',  v_existing_ticket.qr_token,
      'status',    'confirmed'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 2: Look up payment by razorpay_order_id and lock it
  -- -------------------------------------------------------------------------
  SELECT *
    INTO v_payment
    FROM public.payments
   WHERE razorpay_order_id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error',   'PAYMENT_NOT_FOUND',
      'message', 'No payment record found for the given order ID.'
    );
  END IF;

  -- Guard against double-processing on this same order
  IF v_payment.status = 'captured' THEN
    SELECT t.*
      INTO v_existing_ticket
      FROM public.tickets t
     WHERE t.registration_id = v_payment.registration_id
     LIMIT 1;

    RETURN jsonb_build_object(
      'ticket_id', v_existing_ticket.id,
      'qr_token',  v_existing_ticket.qr_token,
      'status',    'confirmed'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 3: Load and lock the associated reservation
  -- -------------------------------------------------------------------------
  SELECT *
    INTO v_reservation
    FROM public.reservations
   WHERE id = (
     SELECT reservation_id
       FROM public.registrations
      WHERE id = v_payment.registration_id
      LIMIT 1
   )
   FOR UPDATE;

  -- If there's no registration yet, we need to find reservation by order metadata.
  -- For the canonical flow: the payment record links to an existing registration
  -- created during the booking initiation phase. If not found, proceed with
  -- reservation-only lookup via the outbox approach.

  -- -------------------------------------------------------------------------
  -- Step 4: Mark payment as captured with Razorpay IDs
  -- -------------------------------------------------------------------------
  UPDATE public.payments
     SET razorpay_payment_id = p_payment_id,
         razorpay_signature  = p_signature,
         status              = 'captured',
         captured_at         = now(),
         updated_at          = now()
   WHERE id = v_payment.id;

  -- -------------------------------------------------------------------------
  -- Step 5: Get or create the confirmed registration
  -- -------------------------------------------------------------------------
  -- The registration should already exist from the initiation step.
  -- Update its status to confirmed if it isn't already.
  SELECT *
    INTO v_registration
    FROM public.registrations
   WHERE id = v_payment.registration_id
   FOR UPDATE;

  IF NOT FOUND THEN
    -- Fallback: registration not yet created — create it now from reservation
    IF v_reservation.id IS NOT NULL THEN
      INSERT INTO public.registrations (
        reservation_id,
        user_id,
        event_id,
        ticket_type_id,
        registration_mode,
        quantity,
        total_amount,
        status,
        confirmed_at
      )
      VALUES (
        v_reservation.id,
        v_reservation.user_id,
        v_reservation.event_id,
        v_reservation.ticket_type_id,
        'individual',
        v_reservation.quantity,
        v_payment.amount,
        'confirmed',
        now()
      )
      RETURNING * INTO v_registration;
    ELSE
      RETURN jsonb_build_object(
        'error',   'REGISTRATION_NOT_FOUND',
        'message', 'Cannot find or create registration for this payment.'
      );
    END IF;
  ELSE
    -- Update existing registration to confirmed
    UPDATE public.registrations
       SET status       = 'confirmed',
           confirmed_at = now(),
           updated_at   = now()
     WHERE id = v_registration.id;
  END IF;

  v_reg_id := v_registration.id;

  -- -------------------------------------------------------------------------
  -- Step 6: Issue a ticket with secure QR token
  -- -------------------------------------------------------------------------
  -- Check if ticket already exists for this registration
  SELECT *
    INTO v_existing_ticket
    FROM public.tickets
   WHERE registration_id = v_reg_id
   LIMIT 1;

  IF NOT FOUND THEN
    -- Generate secure unique QR token and ticket number
    v_qr_token      := encode(gen_random_bytes(32), 'hex');
    v_ticket_number := 'TKT-' || upper(substring(md5(v_reg_id::text || now()::text) FROM 1 FOR 8));

    INSERT INTO public.tickets (
      registration_id,
      event_id,
      user_id,
      ticket_number,
      qr_token,
      status,
      issued_at
    )
    VALUES (
      v_reg_id,
      v_registration.event_id,
      v_registration.user_id,
      v_ticket_number,
      v_qr_token,
      'valid',
      now()
    )
    RETURNING id INTO v_ticket_id;
  ELSE
    v_ticket_id := v_existing_ticket.id;
    v_qr_token  := v_existing_ticket.qr_token;
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 7: Update inventory counters — decrement reserved, increment sold
  -- -------------------------------------------------------------------------
  UPDATE public.event_inventory
     SET reserved_tickets = reserved_tickets - v_registration.quantity,
         sold_tickets     = sold_tickets + v_registration.quantity,
         version          = version + 1,
         updated_at       = now()
   WHERE event_id       = v_registration.event_id
     AND (
       ticket_type_id = v_registration.ticket_type_id
       OR ticket_type_id IS NULL
     );

  -- -------------------------------------------------------------------------
  -- Step 8: Transition reservation to 'confirmed'
  -- -------------------------------------------------------------------------
  IF v_reservation.id IS NOT NULL THEN
    UPDATE public.reservations
       SET status       = 'confirmed',
           confirmed_at = now(),
           updated_at   = now()
     WHERE id = v_reservation.id;
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 9: Emit booking.confirmed outbox event
  -- -------------------------------------------------------------------------
  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload
  )
  VALUES (
    'booking.confirmed',
    'registration',
    v_reg_id,
    jsonb_build_object(
      'registration_id', v_reg_id,
      'ticket_id',       v_ticket_id,
      'user_id',         v_registration.user_id,
      'event_id',        v_registration.event_id,
      'payment_id',      v_payment.id,
      'razorpay_order_id',   p_order_id,
      'razorpay_payment_id', p_payment_id
    )
  );

  -- -------------------------------------------------------------------------
  -- Return success payload
  -- -------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'ticket_id', v_ticket_id,
    'qr_token',  v_qr_token,
    'status',    'confirmed'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- =============================================================================
-- End of TASK-016: RPC confirm_payment()
-- =============================================================================
