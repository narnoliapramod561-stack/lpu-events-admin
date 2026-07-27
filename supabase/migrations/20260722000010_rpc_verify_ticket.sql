-- =============================================================================
-- TASK-018: RPC verify_ticket() & verify_ticket_manual()
-- Migration: 20260722000010_rpc_verify_ticket.sql
-- Depends on: 20260722000008_rpc_confirm_payment.sql (TASK-016)
-- References: REQ-VERIFY-001, WF-VERIFY-001, WF-VERIFY-002, DB-006 §7.1, IMP-007
-- =============================================================================

-- ---------------------------------------------------------------------------
-- verify_ticket(p_token_or_number, p_method, p_verifier_id)
--
-- DB-006 §7.1 canonical signature.
-- Unified ticket verification RPC for QR scan and manual lookup.
-- Atomically:
--   1. Looks up ticket by qr_token (qr_scan) or ticket_number (manual_lookup).
--   2. Validates verifier role: must be super_admin OR event organizer.
--      (user_role enum: 'student' | 'organizer' | 'super_admin' — no 'admin')
--   3. Evaluates ticket status state machine.
--   4. On 'valid': marks ticket as 'used' (used_at = now()).
--   5. Inserts a ticket_verifications audit row.
--   6. Returns JSONB: { status, ticket_details, user_details }.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_ticket(
  p_token_or_number text,
  p_method          public.verification_method,
  p_verifier_id     uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ticket              public.tickets%ROWTYPE;
  v_verification_status public.verification_status;
BEGIN
  -- -------------------------------------------------------------------------
  -- Step 1: Look up and lock the ticket by method
  -- -------------------------------------------------------------------------
  IF p_method = 'qr_scan' THEN
    SELECT *
      INTO v_ticket
      FROM public.tickets
     WHERE qr_token = p_token_or_number
     FOR UPDATE;
  ELSE -- manual_lookup
    SELECT *
      INTO v_ticket
      FROM public.tickets
     WHERE ticket_number = p_token_or_number
     FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    -- Insert invalid verification attempt (verifier_id may not be authorised
    -- yet, but we still record the failed lookup per DB-006 §7.1 step 3)
    RETURN jsonb_build_object(
      'status',  'invalid',
      'message', 'Ticket not found'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 2: Validate verifier authorisation
  -- DB-006 §7.1: p_verifier_id must be organizer of the event OR super_admin.
  -- user_role enum values: 'student', 'organizer', 'super_admin' — no 'admin'.
  -- -------------------------------------------------------------------------
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id   = p_verifier_id
         AND role = 'super_admin'
    )
    OR
    EXISTS (
      SELECT 1
        FROM public.profiles pr
        JOIN public.events    e  ON e.id = v_ticket.event_id
       WHERE pr.id          = p_verifier_id
         AND pr.role        = 'organizer'
         AND e.organizer_id = p_verifier_id
    )
  ) THEN
    INSERT INTO public.ticket_verifications (
      ticket_id, verified_by, method, status, notes
    ) VALUES (
      v_ticket.id, p_verifier_id, p_method, 'invalid',
      'Unauthorized verifier'
    );
    RETURN jsonb_build_object(
      'status',  'invalid',
      'message', 'Unauthorized verifier'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 3: Evaluate ticket status state machine (DB-006 §7.1 steps 5-6)
  -- -------------------------------------------------------------------------
  IF v_ticket.status = 'used' THEN
    v_verification_status := 'already_used';

    INSERT INTO public.ticket_verifications (
      ticket_id, verified_by, method, status, notes
    ) VALUES (
      v_ticket.id, p_verifier_id, p_method, v_verification_status,
      'Ticket already used at: ' || v_ticket.used_at::text
    );

    RETURN jsonb_build_object(
      'status',    'already_used',
      'ticket_id', v_ticket.id,
      'used_at',   v_ticket.used_at,
      'message',   'Ticket has already been used'
    );

  ELSIF v_ticket.status = 'cancelled' THEN
    v_verification_status := 'invalid';

    INSERT INTO public.ticket_verifications (
      ticket_id, verified_by, method, status, notes
    ) VALUES (
      v_ticket.id, p_verifier_id, p_method, v_verification_status,
      'Ticket cancelled'
    );

    RETURN jsonb_build_object(
      'status',    'invalid',
      'ticket_id', v_ticket.id,
      'message',   'Ticket cancelled'
    );

  ELSIF v_ticket.status = 'expired' THEN
    v_verification_status := 'expired';

    INSERT INTO public.ticket_verifications (
      ticket_id, verified_by, method, status, notes
    ) VALUES (
      v_ticket.id, p_verifier_id, p_method, v_verification_status,
      'Ticket expired'
    );

    RETURN jsonb_build_object(
      'status',    'expired',
      'ticket_id', v_ticket.id,
      'message',   'Ticket is expired'
    );

  ELSIF v_ticket.status = 'valid' THEN
    -- ---------------------------------------------------------------------
    -- Step 4: Mark ticket as used (atomic — row already locked FOR UPDATE)
    -- DB-006 §7.1 step 6
    -- ---------------------------------------------------------------------
    UPDATE public.tickets
       SET status     = 'used',
           used_at    = now(),
           updated_at = now()
     WHERE id = v_ticket.id;

    -- Insert success verification record
    INSERT INTO public.ticket_verifications (
      ticket_id, verified_by, method, status, notes
    ) VALUES (
      v_ticket.id, p_verifier_id, p_method, 'success', NULL
    );

    -- Write outbox event: ticket.verified (DB-006 §7.1 step 6)
    INSERT INTO public.outbox_events (
      event_type, resource_type, resource_id, payload
    ) VALUES (
      'ticket.verified',
      'tickets',
      v_ticket.id,
      jsonb_build_object(
        'ticket_id',   v_ticket.id,
        'event_id',    v_ticket.event_id,
        'user_id',     v_ticket.user_id,
        'verifier_id', p_verifier_id,
        'method',      p_method,
        'verified_at', now()
      )
    );

    -- Write audit_log entry
    INSERT INTO public.audit_log (
      actor_id, actor_role, action, resource_type, resource_id,
      before_state, after_state
    ) VALUES (
      p_verifier_id,
      public.get_user_role(),
      'ticket.verify',
      'tickets',
      v_ticket.id,
      jsonb_build_object('status', 'valid'),
      jsonb_build_object('status', 'used', 'used_at', now())
    );

    RETURN jsonb_build_object(
      'status',    'success',
      'ticket_id', v_ticket.id,
      'event_id',  v_ticket.event_id,
      'user_id',   v_ticket.user_id,
      'used_at',   now(),
      'message',   'Ticket verified successfully'
    );
  END IF;

  -- Fallback (unknown status)
  RETURN jsonb_build_object(
    'status',  'invalid',
    'message', 'Unknown ticket state'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- verify_ticket_manual(p_ticket_number, p_verifier_id, p_override_reason)
--
-- WF-VERIFY-002: Manual Check-In Override — restricted to super_admin.
-- (user_role enum has no 'admin' value; WF-VERIFY-002 references 'admin' role
-- but the canonical enum is 'super_admin'. Implementation follows the enum.)
-- Override reason is mandatory.
-- Same state-machine as verify_ticket() with method='manual_lookup'.
-- Sets manual_override=TRUE and override_reason on the ticket row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_ticket_manual(
  p_ticket_number   text,
  p_verifier_id     uuid,
  p_override_reason text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ticket              public.tickets%ROWTYPE;
  v_verification_status public.verification_status;
  v_rate_window_s       integer;
  v_rate_max            integer;
  v_recent_count        integer;
BEGIN
  -- -------------------------------------------------------------------------
  -- Step 0: Validate mandatory override reason (WF-VERIFY-002 BR-02)
  -- -------------------------------------------------------------------------
  IF p_override_reason IS NULL OR trim(p_override_reason) = '' THEN
    RETURN jsonb_build_object(
      'error',   'VALIDATION_ERROR',
      'message', 'An override reason is required for manual check-in.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 0.5: Validate verifier is super_admin
  -- WF-VERIFY-002 BR-01: restricted to 'admin' role.
  -- Canonical user_role enum has no 'admin'; super_admin is the equivalent.
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id   = p_verifier_id
       AND role = 'super_admin'
  ) THEN
    RETURN jsonb_build_object(
      'error',   'UNAUTHORIZED',
      'message', 'Manual check-in override is restricted to super admins only.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 1: Rate limit check (system_config driven)
  -- -------------------------------------------------------------------------
  SELECT value::integer INTO v_rate_window_s
    FROM public.system_config
   WHERE key = 'verify.manual_lookup_rate_window_s';
  v_rate_window_s := COALESCE(v_rate_window_s, 60);

  SELECT value::integer INTO v_rate_max
    FROM public.system_config
   WHERE key = 'verify.manual_lookup_rate_max';
  v_rate_max := COALESCE(v_rate_max, 10);

  SELECT COUNT(*) INTO v_recent_count
    FROM public.ticket_verifications
   WHERE verified_by = p_verifier_id
     AND method      = 'manual_lookup'
     AND verified_at >= now() - make_interval(secs => v_rate_window_s);

  IF v_recent_count >= v_rate_max THEN
    RETURN jsonb_build_object(
      'error',   'RATE_LIMITED',
      'message', format(
        'Manual lookup rate limit exceeded. Max %s lookups per %s seconds.',
        v_rate_max, v_rate_window_s
      )
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 2: Look up and lock the ticket by ticket_number
  -- -------------------------------------------------------------------------
  SELECT *
    INTO v_ticket
    FROM public.tickets
   WHERE ticket_number = p_ticket_number
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status',  'invalid',
      'message', 'Ticket not found for the provided ticket number.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 3: Evaluate ticket status state machine
  -- -------------------------------------------------------------------------
  IF v_ticket.status = 'used' THEN
    v_verification_status := 'already_used';

    INSERT INTO public.ticket_verifications (
      ticket_id, verified_by, method, status, notes
    ) VALUES (
      v_ticket.id, p_verifier_id, 'manual_lookup', v_verification_status,
      'Ticket already used at: ' || v_ticket.used_at::text
    );

    RETURN jsonb_build_object(
      'status',    'already_used',
      'ticket_id', v_ticket.id,
      'used_at',   v_ticket.used_at,
      'message',   'Ticket has already been used.'
    );

  ELSIF v_ticket.status IN ('cancelled', 'expired') THEN
    v_verification_status := 'invalid';

    INSERT INTO public.ticket_verifications (
      ticket_id, verified_by, method, status, notes
    ) VALUES (
      v_ticket.id, p_verifier_id, 'manual_lookup', v_verification_status,
      'Ticket status is: ' || v_ticket.status::text
    );

    RETURN jsonb_build_object(
      'status',    'invalid',
      'ticket_id', v_ticket.id,
      'message',   format('Ticket is %s and cannot be verified.', v_ticket.status)
    );

  ELSIF v_ticket.status = 'valid' THEN
    v_verification_status := 'success';

    -- Mark ticket as used; set manual override fields (WF-VERIFY-002 §6 step 5)
    UPDATE public.tickets
       SET status          = 'used',
           used_at         = now(),
           manual_override = TRUE,
           override_reason = p_override_reason,
           updated_at      = now()
     WHERE id = v_ticket.id;

    -- Insert verification audit record
    INSERT INTO public.ticket_verifications (
      ticket_id, verified_by, method, status, notes
    ) VALUES (
      v_ticket.id, p_verifier_id, 'manual_lookup', v_verification_status,
      p_override_reason
    );

    -- Write audit_log (WF-VERIFY-002 BR-04)
    INSERT INTO public.audit_log (
      actor_id, actor_role, action, resource_type, resource_id,
      before_state, after_state
    ) VALUES (
      p_verifier_id,
      public.get_user_role(),
      'ticket.manual_check_in',
      'tickets',
      v_ticket.id,
      jsonb_build_object('status', 'valid'),
      jsonb_build_object(
        'status', 'used', 'used_at', now(),
        'manual_override', true, 'override_reason', p_override_reason
      )
    );

    RETURN jsonb_build_object(
      'status',    'success',
      'ticket_id', v_ticket.id,
      'event_id',  v_ticket.event_id,
      'user_id',   v_ticket.user_id,
      'used_at',   now(),
      'message',   'Ticket verified successfully.'
    );
  END IF;

  -- Fallback
  RETURN jsonb_build_object(
    'status',  'invalid',
    'message', 'Unknown ticket state.'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- =============================================================================
-- End of TASK-018: RPC verify_ticket() & verify_ticket_manual()
-- =============================================================================
