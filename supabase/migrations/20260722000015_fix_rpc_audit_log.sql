-- =============================================================================
-- FIX: approve_organizer() and reject_organizer() audit_log INSERT
-- Migration: 20260722000015_fix_rpc_audit_log.sql
-- Depends on: 20260722000011_rpc_approve_reject_organizer.sql
-- 
-- Issues Fixed:
--   1. Missing actor_role column (NOT NULL constraint violation)
--   2. Using non-existent 'metadata' column instead of before_state/after_state
--   3. Missing ip_address and user_agent columns
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fix approve_organizer() RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_organizer(
  p_application_id UUID,
  p_admin_id       UUID,
  p_notes          TEXT DEFAULT NULL
)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_application    RECORD;
  v_admin_role     public.user_role;
  v_before_state   JSONB;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Step 1: Validate the calling admin is a super_admin
  -- ---------------------------------------------------------------------------
  SELECT role INTO v_admin_role
    FROM public.profiles
   WHERE id = p_admin_id;

  IF v_admin_role IS NULL OR v_admin_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin users can approve organizer applications'
      USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 2: Fetch and lock the application row (SELECT ... FOR UPDATE)
  -- ---------------------------------------------------------------------------
  SELECT *
    INTO v_application
    FROM public.organizer_applications
   WHERE id = p_application_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organizer application not found: %', p_application_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Capture before state for audit
  v_before_state := to_jsonb(v_application);

  -- ---------------------------------------------------------------------------
  -- Step 3: Ensure the application is in 'pending' status
  -- ---------------------------------------------------------------------------
  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'Application is not in pending status (current: %)', v_application.status
      USING ERRCODE = 'P0001';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 4: Update application status to 'approved'
  -- ---------------------------------------------------------------------------
  UPDATE public.organizer_applications
     SET status       = 'approved',
         reviewed_by  = p_admin_id,
         reviewed_at  = now(),
         review_notes = COALESCE(p_notes, review_notes),
         updated_at   = now()
   WHERE id = p_application_id;

  -- ---------------------------------------------------------------------------
  -- Step 5: Promote user role from 'attendee' to 'organizer'
  -- ---------------------------------------------------------------------------
  UPDATE public.profiles
     SET role       = 'organizer',
         updated_at = now()
   WHERE id = v_application.user_id;

  -- ---------------------------------------------------------------------------
  -- Step 6: Write audit_log entry (FIXED: includes actor_role, before/after)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.audit_log (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    before_state,
    after_state,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    p_admin_id,
    v_admin_role::text,
    'organizer.approve',
    'organizer_application',
    p_application_id,
    v_before_state,
    jsonb_build_object(
      'status', 'approved',
      'reviewed_by', p_admin_id,
      'reviewed_at', now(),
      'review_notes', p_notes,
      'user_id', v_application.user_id,
      'organization_name', v_application.organization_name,
      'new_role', 'organizer'
    ),
    NULL,
    NULL,
    now()
  );

  -- ---------------------------------------------------------------------------
  -- Step 7: Emit outbox event for downstream processing
  -- ---------------------------------------------------------------------------
  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload,
    processed,
    process_after,
    created_at
  )
  VALUES (
    'organizer.approved',
    'organizer_application',
    p_application_id,
    jsonb_build_object(
      'application_id',    p_application_id,
      'user_id',           v_application.user_id,
      'organization_name', v_application.organization_name,
      'admin_id',          p_admin_id,
      'review_notes',      p_notes
    ),
    FALSE,
    now(),
    now()
  );

  -- ---------------------------------------------------------------------------
  -- Step 8: Return success response
  -- ---------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'success',           TRUE,
    'application_id',    p_application_id,
    'user_id',           v_application.user_id,
    'organization_name', v_application.organization_name,
    'new_status',        'approved',
    'new_role',          'organizer'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Fix reject_organizer() RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_organizer(
  p_application_id UUID,
  p_admin_id       UUID,
  p_notes          TEXT DEFAULT NULL
)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_application    RECORD;
  v_admin_role     public.user_role;
  v_before_state   JSONB;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Step 1: Validate the calling admin is a super_admin
  -- ---------------------------------------------------------------------------
  SELECT role INTO v_admin_role
    FROM public.profiles
   WHERE id = p_admin_id;

  IF v_admin_role IS NULL OR v_admin_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin users can reject organizer applications'
      USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 2: Fetch and lock the application row (SELECT ... FOR UPDATE)
  -- ---------------------------------------------------------------------------
  SELECT *
    INTO v_application
    FROM public.organizer_applications
   WHERE id = p_application_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organizer application not found: %', p_application_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Capture before state for audit
  v_before_state := to_jsonb(v_application);

  -- ---------------------------------------------------------------------------
  -- Step 3: Ensure the application is in 'pending' status
  -- ---------------------------------------------------------------------------
  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'Application is not in pending status (current: %)', v_application.status
      USING ERRCODE = 'P0001';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 4: Update application status to 'rejected'
  -- ---------------------------------------------------------------------------
  UPDATE public.organizer_applications
     SET status       = 'rejected',
         reviewed_by  = p_admin_id,
         reviewed_at  = now(),
         review_notes = COALESCE(p_notes, review_notes),
         updated_at   = now()
   WHERE id = p_application_id;

  -- ---------------------------------------------------------------------------
  -- Step 5: Write audit_log entry (FIXED: includes actor_role, before/after)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.audit_log (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    before_state,
    after_state,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    p_admin_id,
    v_admin_role::text,
    'organizer.reject',
    'organizer_application',
    p_application_id,
    v_before_state,
    jsonb_build_object(
      'status', 'rejected',
      'reviewed_by', p_admin_id,
      'reviewed_at', now(),
      'review_notes', p_notes,
      'user_id', v_application.user_id,
      'organization_name', v_application.organization_name
    ),
    NULL,
    NULL,
    now()
  );

  -- ---------------------------------------------------------------------------
  -- Step 6: Emit outbox event for downstream processing
  -- ---------------------------------------------------------------------------
  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload,
    processed,
    process_after,
    created_at
  )
  VALUES (
    'organizer.rejected',
    'organizer_application',
    p_application_id,
    jsonb_build_object(
      'application_id',    p_application_id,
      'user_id',           v_application.user_id,
      'organization_name', v_application.organization_name,
      'admin_id',          p_admin_id,
      'review_notes',      p_notes
    ),
    FALSE,
    now(),
    now()
  );

  -- ---------------------------------------------------------------------------
  -- Step 7: Return success response
  -- ---------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'success',           TRUE,
    'application_id',    p_application_id,
    'user_id',           v_application.user_id,
    'organization_name', v_application.organization_name,
    'new_status',        'rejected'
  );
END;
$$;

-- =============================================================================
-- End of FIX: approve_organizer() and reject_organizer() audit_log INSERT
-- =============================================================================