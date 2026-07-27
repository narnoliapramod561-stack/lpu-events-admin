-- =============================================================================
-- TASK-018: RPC confirm_reservation() Free Booking Finalization
-- Migration: 20260722000016_rpc_confirm_reservation.sql
-- Depends on: 20260722000006_rpc_reserve_ticket.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.confirm_reservation(
  p_reservation_id uuid,
  p_user_id        uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_reservation     public.reservations%ROWTYPE;
  v_registration    public.registrations%ROWTYPE;
  v_existing_ticket public.tickets%ROWTYPE;
  v_ticket_id       uuid;
  v_qr_token        text;
  v_ticket_number   text;
  v_has_registration boolean := false;
BEGIN
  SELECT *
    INTO v_reservation
    FROM public.reservations
   WHERE id = p_reservation_id
     AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'RESERVATION_NOT_FOUND',
      'message', 'Reservation not found or does not belong to the requesting user.'
    );
  END IF;

  IF v_reservation.expires_at < now() AND v_reservation.status <> 'confirmed' THEN
    RETURN jsonb_build_object(
      'error', 'RESERVATION_EXPIRED',
      'message', 'The reservation hold has expired and cannot be confirmed.'
    );
  END IF;

  SELECT *
    INTO v_registration
    FROM public.registrations
   WHERE reservation_id = p_reservation_id
   LIMIT 1;

  IF FOUND THEN
    v_has_registration := true;

    SELECT *
      INTO v_existing_ticket
      FROM public.tickets
     WHERE registration_id = v_registration.id
     LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ticket_id', v_existing_ticket.id,
        'qr_token', v_existing_ticket.qr_token,
        'status', 'confirmed'
      );
    END IF;
  END IF;

  IF NOT v_has_registration THEN
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
    ) VALUES (
      p_reservation_id,
      v_reservation.user_id,
      v_reservation.event_id,
      v_reservation.ticket_type_id,
      'individual',
      v_reservation.quantity,
      0,
      'confirmed',
      now()
    )
    RETURNING * INTO v_registration;
  ELSE
    UPDATE public.registrations
       SET status = 'confirmed',
           confirmed_at = now(),
           updated_at = now()
     WHERE id = v_registration.id
     RETURNING * INTO v_registration;
  END IF;

  v_ticket_number := 'TKT-' || upper(substring(md5(v_registration.id::text || now()::text) FROM 1 FOR 8));
  v_qr_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.tickets (
    registration_id,
    event_id,
    user_id,
    ticket_number,
    qr_token,
    status,
    issued_at
  ) VALUES (
    v_registration.id,
    v_registration.event_id,
    v_registration.user_id,
    v_ticket_number,
    v_qr_token,
    'valid',
    now()
  )
  RETURNING id INTO v_ticket_id;

  UPDATE public.event_inventory
     SET reserved_tickets = reserved_tickets - v_registration.quantity,
         sold_tickets = sold_tickets + v_registration.quantity,
         version = version + 1,
         updated_at = now()
   WHERE event_id = v_registration.event_id
     AND (
       ticket_type_id = v_registration.ticket_type_id
       OR ticket_type_id IS NULL
     );

  UPDATE public.reservations
     SET status = 'confirmed',
         confirmed_at = now(),
         updated_at = now()
   WHERE id = p_reservation_id;

  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload,
    created_at
  ) VALUES (
    'booking.confirmed',
    'registration',
    v_registration.id,
    jsonb_build_object(
      'registration_id', v_registration.id,
      'ticket_id', v_ticket_id,
      'user_id', v_registration.user_id,
      'event_id', v_registration.event_id
    ),
    now()
  );

  RETURN jsonb_build_object(
    'ticket_id', v_ticket_id,
    'qr_token', v_qr_token,
    'status', 'confirmed'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', 'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- =============================================================================
-- End of TASK-018
-- =============================================================================
