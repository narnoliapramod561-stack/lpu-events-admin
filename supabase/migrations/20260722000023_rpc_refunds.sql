-- =============================================================================
-- Phase 5 RPCs: initiate_refund() and process_refund()
-- Migration: 20260722000016_rpc_refunds.sql
-- Depends on: 20260722000015_fix_rpc_audit_log.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. initiate_refund() RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.initiate_refund(
  p_payment_id UUID,
  p_admin_id   UUID,
  p_amount     NUMERIC,
  p_reason     TEXT
)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_payment       RECORD;
  v_admin_role    public.user_role;
  v_refund_id     UUID;
BEGIN
  -- Validate caller is super_admin
  SELECT role INTO v_admin_role
    FROM public.profiles
   WHERE id = p_admin_id;

  IF v_admin_role IS NULL OR v_admin_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin users can initiate refunds'
      USING ERRCODE = '42501';
  END IF;

  -- Fetch and lock payment row
  SELECT *
    INTO v_payment
    FROM public.payments
   WHERE id = p_payment_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status <> 'captured' THEN
    RAISE EXCEPTION 'Payment status is not captured (current: %)', v_payment.status
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount <= 0 OR p_amount > v_payment.amount THEN
    RAISE EXCEPTION 'Invalid refund amount: % (Payment amount: %)', p_amount, v_payment.amount
      USING ERRCODE = 'P0003';
  END IF;

  -- Insert refund record
  INSERT INTO public.refunds (
    payment_id,
    amount,
    reason,
    initiated_by,
    status
  )
  VALUES (
    p_payment_id,
    p_amount,
    p_reason,
    p_admin_id,
    'pending'
  )
  RETURNING id INTO v_refund_id;

  -- Audit Log
  INSERT INTO public.audit_log (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    after_state
  )
  VALUES (
    p_admin_id,
    v_admin_role::text,
    'refund.initiate',
    'refund',
    v_refund_id,
    jsonb_build_object(
      'refund_id', v_refund_id,
      'payment_id', p_payment_id,
      'amount', p_amount,
      'status', 'pending'
    )
  );

  -- Outbox Event
  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload
  )
  VALUES (
    'refund.initiated',
    'refund',
    v_refund_id,
    jsonb_build_object(
      'refund_id', v_refund_id,
      'payment_id', p_payment_id,
      'amount', p_amount,
      'reason', p_reason,
      'razorpay_payment_id', v_payment.razorpay_payment_id
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'refund_id', v_refund_id,
    'status', 'pending'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. process_refund() RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_refund(
  p_refund_id       UUID,
  p_rzp_refund_id   TEXT
)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_refund        RECORD;
  v_payment       RECORD;
  v_registration  RECORD;
BEGIN
  -- Lock refund row
  SELECT *
    INTO v_refund
    FROM public.refunds
   WHERE id = p_refund_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund not found: %', p_refund_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_refund.status = 'processed' THEN
    RETURN jsonb_build_object('success', TRUE, 'message', 'Already processed');
  END IF;

  -- Fetch payment and registration
  SELECT *
    INTO v_payment
    FROM public.payments
   WHERE id = v_refund.payment_id
     FOR UPDATE;

  SELECT *
    INTO v_registration
    FROM public.registrations
   WHERE id = v_payment.registration_id
     FOR UPDATE;

  -- Update refund status
  UPDATE public.refunds
     SET status = 'processed',
         razorpay_refund_id = p_rzp_refund_id,
         updated_at = now()
   WHERE id = p_refund_id;

  -- Update payment status to refunded
  UPDATE public.payments
     SET status = 'refunded',
         updated_at = now()
   WHERE id = v_refund.payment_id;

  -- Update registration status to cancelled
  UPDATE public.registrations
     SET status = 'cancelled',
         updated_at = now()
   WHERE id = v_payment.registration_id;

  -- Cancel associated tickets
  UPDATE public.tickets
     SET status = 'cancelled',
         updated_at = now()
   WHERE registration_id = v_payment.registration_id;

  -- Adjust inventory counters
  UPDATE public.event_inventory
     SET available_tickets = available_tickets + v_registration.quantity,
         sold_tickets = sold_tickets - v_registration.quantity,
         updated_at = now()
   WHERE event_id = v_registration.event_id
     AND ticket_type_id = v_registration.ticket_type_id;

  -- Audit Log
  INSERT INTO public.audit_log (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    after_state
  )
  VALUES (
    v_refund.initiated_by,
    'super_admin',
    'refund.process',
    'refund',
    p_refund_id,
    jsonb_build_object(
      'refund_id', p_refund_id,
      'razorpay_refund_id', p_rzp_refund_id,
      'status', 'processed'
    )
  );

  -- Outbox Event
  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload
  )
  VALUES (
    'refund.processed',
    'refund',
    p_refund_id,
    jsonb_build_object(
      'refund_id', p_refund_id,
      'payment_id', v_refund.payment_id,
      'registration_id', v_payment.registration_id,
      'amount', v_refund.amount
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'refund_id', p_refund_id,
    'status', 'processed'
  );
END;
$$;
