-- =============================================================================
-- TASK-019: RPC approve_organizer() & reject_organizer()
-- Migration: 20260722000011_rpc_approve_reject_organizer.sql
-- Depends on: 20260722000001_canonical_schema.sql (TASK-011)
-- References: DB-006 §4.1-4.2, WF-ORG-002, API-004, IMP-002A
-- =============================================================================

-- -----------------------------------------------------------------------------
-- approve_organizer(p_application_id, p_admin_id, p_notes)
--
-- Super Admin approves a pending organizer application. Atomically:
--   1. Validates caller has super_admin role
--   2. Loads and locks organizer_applications row by p_application_id
--   3. Validates application status is 'pending'
--   4. Updates application: status='approved', reviewed_by, reviewed_at, review_notes
--   5. Updates profiles: role='organizer' for application.user_id
--   6. Writes audit_log entry
--   7. Emits organizer.approved outbox event
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_organizer(
  p_application_id uuid,
  p_admin_id       uuid,
  p_notes          text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_admin       public.profiles%ROWTYPE;
  v_application public.organizer_applications%ROWTYPE;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Step 1: Validate caller is super_admin
  -- ---------------------------------------------------------------------------
  SELECT *
    INTO v_admin
    FROM public.profiles
   WHERE id = p_admin_id;

  IF NOT FOUND OR v_admin.role <> 'super_admin' THEN
    RETURN jsonb_build_object(
      'error',   'UNAUTHORIZED',
      'message', 'Only super_admin can approve organizer applications.'
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 2: Load and lock organizer_applications row
  -- ---------------------------------------------------------------------------
  SELECT *
    INTO v_application
    FROM public.organizer_applications
   WHERE id = p_application_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error',   'APPLICATION_NOT_FOUND',
      'message', 'Organizer application not found.'
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 3: Validate application status is 'pending'
  -- ---------------------------------------------------------------------------
  IF v_application.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_STATUS',
      'message', format(
        'Application must be in pending status. Current status: %s',
        v_application.status
      )
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 4: Update organizer_applications table
  -- ---------------------------------------------------------------------------
  UPDATE public.organizer_applications
     SET status       = 'approved',
         reviewed_by  = p_admin_id,
         reviewed_at  = now(),
         review_notes = p_notes,
         updated_at   = now()
   WHERE id = p_application_id;

  -- ---------------------------------------------------------------------------
  -- Step 5: Update profiles.role to 'organizer' using application.user_id
  -- ---------------------------------------------------------------------------
  UPDATE public.profiles
     SET role       = 'organizer',
         updated_at = now()
   WHERE id = v_application.user_id;

  -- ---------------------------------------------------------------------------
  -- Step 6: Write audit_log entry
  -- ---------------------------------------------------------------------------
  INSERT INTO public.audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    p_admin_id,
    'organizer.approve',
    'organizer_application',
    p_application_id,
    jsonb_build_object(
      'application_id',   p_application_id,
      'user_id',          v_application.user_id,
      'organization_name', v_application.organization_name,
      'review_notes',     p_notes
    )
  );

  -- ---------------------------------------------------------------------------
  -- Step 7: Emit organizer.approved outbox event
  -- ---------------------------------------------------------------------------
  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload
  )
  VALUES (
    'organizer.approved',
    'organizer_application',
    p_application_id,
    jsonb_build_object(
      'application_id',    p_application_id,
      'user_id',           v_application.user_id,
      'admin_id',          p_admin_id,
      'organization_name', v_application.organization_name,
      'approved_at',       now()
    )
  );

  RETURN jsonb_build_object(
    'application_id',    p_application_id,
    'user_id',           v_application.user_id,
    'status',            'approved',
    'approved_by',       p_admin_id,
    'organization_name', v_application.organization_name
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- reject_organizer(p_application_id, p_admin_id, p_notes)
--
-- Super Admin rejects a pending organizer application. Atomically:
--   1. Validates caller has super_admin role
--   2. Loads and locks organizer_applications row by p_application_id
--   3. Validates application status is 'pending'
--   4. Updates application: status='rejected', reviewed_by, reviewed_at, review_notes
--   5. Does NOT modify profiles.role (user remains 'student')
--   6. Writes audit_log entry
--   7. Emits organizer.rejected outbox event
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_organizer(
  p_application_id uuid,
  p_admin_id       uuid,
  p_notes          text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_admin       public.profiles%ROWTYPE;
  v_application public.organizer_applications%ROWTYPE;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Step 1: Validate caller is super_admin
  -- ---------------------------------------------------------------------------
  SELECT *
    INTO v_admin
    FROM public.profiles
   WHERE id = p_admin_id;

  IF NOT FOUND OR v_admin.role <> 'super_admin' THEN
    RETURN jsonb_build_object(
      'error',   'UNAUTHORIZED',
      'message', 'Only super_admin can reject organizer applications.'
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 2: Load and lock organizer_applications row
  -- ---------------------------------------------------------------------------
  SELECT *
    INTO v_application
    FROM public.organizer_applications
   WHERE id = p_application_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error',   'APPLICATION_NOT_FOUND',
      'message', 'Organizer application not found.'
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 3: Validate application status is 'pending'
  -- ---------------------------------------------------------------------------
  IF v_application.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_STATUS',
      'message', format(
        'Application must be in pending status. Current status: %s',
        v_application.status
      )
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 4: Update organizer_applications table (NO profile role change)
  -- ---------------------------------------------------------------------------
  UPDATE public.organizer_applications
     SET status       = 'rejected',
         reviewed_by  = p_admin_id,
         reviewed_at  = now(),
         review_notes = p_notes,
         updated_at   = now()
   WHERE id = p_application_id;

  -- ---------------------------------------------------------------------------
  -- Step 5: Write audit_log entry
  -- ---------------------------------------------------------------------------
  INSERT INTO public.audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    p_admin_id,
    'organizer.reject',
    'organizer_application',
    p_application_id,
    jsonb_build_object(
      'application_id',    p_application_id,
      'user_id',           v_application.user_id,
      'organization_name', v_application.organization_name,
      'review_notes',      p_notes
    )
  );

  -- ---------------------------------------------------------------------------
  -- Step 6: Emit organizer.rejected outbox event
  -- ---------------------------------------------------------------------------
  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload
  )
  VALUES (
    'organizer.rejected',
    'organizer_application',
    p_application_id,
    jsonb_build_object(
      'application_id',    p_application_id,
      'user_id',           v_application.user_id,
      'admin_id',          p_admin_id,
      'organization_name', v_application.organization_name,
      'review_notes',      p_notes,
      'rejected_at',       now()
    )
  );

  RETURN jsonb_build_object(
    'application_id',    p_application_id,
    'user_id',           v_application.user_id,
    'status',            'rejected',
    'rejected_by',       p_admin_id,
    'organization_name', v_application.organization_name,
    'review_notes',      p_notes
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- =============================================================================
-- End of TASK-019: RPC approve_organizer() & reject_organizer()
-- =============================================================================
