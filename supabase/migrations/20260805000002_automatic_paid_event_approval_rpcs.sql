-- Migration: Add publish_event_v2 RPC, process_event_approval RPC, and pending_paid_event_requests view
-- Part 2 of automatic paid event approval workflow

-- 1. Create or replace publish_event_v2 RPC
CREATE OR REPLACE FUNCTION public.publish_event_v2(
  p_event_id         uuid,
  p_organizer_user_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event           public.events%ROWTYPE;
  v_caller_profile  public.profiles%ROWTYPE;
  v_requires_approval boolean;
BEGIN
  -- Load caller's profile for role check
  SELECT *
    INTO v_caller_profile
    FROM public.profiles
   WHERE id = p_organizer_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error',   'UNAUTHORIZED',
      'message', 'Caller profile not found.'
    );
  END IF;

  -- Load and lock the event row
  SELECT *
    INTO v_event
    FROM public.events
   WHERE id = p_event_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error',   'NOT_FOUND',
      'message', 'Event not found or deleted.'
    );
  END IF;

  -- Check ownership (organizer or super_admin)
  IF v_event.organizer_id != p_organizer_user_id 
     AND v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'error',   'FORBIDDEN',
      'message', 'Only the event organizer or a super admin can publish this event.'
    );
  END IF;

  -- Validate current status
  IF v_event.status NOT IN ('draft', 'pending_approval') THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_TRANSITION',
      'message', 'Event must be in draft or pending_approval status.'
    );
  END IF;

  -- Check if approval is required based on registration configuration
  v_requires_approval := public.requires_super_admin_approval(
    v_event.registration_required,
    v_event.registration_type,
    v_event.registration_platform
  );

  IF v_requires_approval THEN
    -- For paid events using LPU Events, set to pending_approval
    UPDATE public.events
    SET 
        status = 'pending_approval',
        approval_status = 'pending',
        submitted_for_approval_at = NOW(),
        updated_at = NOW()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'requires_approval', true,
      'message', 'Paid event submitted for Super Admin approval.',
      'event_id', p_event_id,
      'status', 'pending_approval'
    );
  ELSE
    -- For all other events, publish immediately
    -- Validate required fields
    IF v_event.title IS NULL OR v_event.title = '' THEN
      RETURN jsonb_build_object(
        'error',   'VALIDATION_FAILED',
        'message', 'Event title is required.'
      );
    END IF;

    IF v_event.starts_at IS NULL THEN
      RETURN jsonb_build_object(
        'error',   'VALIDATION_FAILED',
        'message', 'Event start date is required.'
      );
    END IF;

    IF v_event.venue IS NULL OR v_event.venue = '' THEN
      RETURN jsonb_build_object(
        'error',   'VALIDATION_FAILED',
        'message', 'Event venue is required.'
      );
    END IF;

    -- Set the GUC to bypass the _events_block_direct_publish trigger
    PERFORM set_config('app.allow_publish', 'rpc', true);

    -- Update event to published
    UPDATE public.events
    SET
        status = 'published',
        approval_status = 'approved',
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'requires_approval', false,
      'message', 'Event published successfully.',
      'event_id', p_event_id,
      'status', 'published'
    );
  END IF;
END;
$$;

-- 2. Create process_event_approval RPC for Super Admin
CREATE OR REPLACE FUNCTION public.process_event_approval(
  p_event_id uuid,
  p_admin_user_id uuid,
  p_action text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_admin_profile public.profiles%ROWTYPE;
BEGIN
  -- Verify admin user
  SELECT *
    INTO v_admin_profile
    FROM public.profiles
   WHERE id = p_admin_user_id
     AND role IN ('super_admin', 'admin');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'UNAUTHORIZED',
      'message', 'Only super admins can approve/reject events.'
    );
  END IF;

  -- Load event
  SELECT *
    INTO v_event
    FROM public.events
   WHERE id = p_event_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'NOT_FOUND',
      'message', 'Event not found or deleted.'
    );
  END IF;

  -- Validate event is pending approval
  IF v_event.status != 'pending_approval' OR v_event.approval_status != 'pending' THEN
    RETURN jsonb_build_object(
      'error', 'INVALID_STATE',
      'message', 'Event is not pending approval.'
    );
  END IF;

  -- Validate it's a paid event using LPU Events
  IF NOT public.requires_super_admin_approval(
    v_event.registration_required,
    v_event.registration_type,
    v_event.registration_platform
  ) THEN
    RETURN jsonb_build_object(
      'error', 'INVALID_EVENT_TYPE',
      'message', 'Only paid events using LPU Events registration require approval.'
    );
  END IF;

  IF p_action = 'approve' THEN
    -- Set the GUC to bypass the _events_block_direct_publish trigger
    PERFORM set_config('app.allow_publish', 'rpc', true);

    UPDATE public.events
    SET 
        status = 'published',
        approval_status = 'approved',
        approved_at = NOW(),
        approved_by = p_admin_user_id,
        updated_at = NOW()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Event approved and published successfully.',
      'event_id', p_event_id,
      'status', 'published'
    );
  ELSIF p_action = 'reject' THEN
    -- Validate rejection reason
    IF p_rejection_reason IS NULL OR p_rejection_reason = '' THEN
      RETURN jsonb_build_object(
        'error', 'REASON_REQUIRED',
        'message', 'Rejection reason is required.'
      );
    END IF;

    -- Reject the event
    UPDATE public.events
    SET 
        status = 'draft',
        approval_status = 'rejected',
        rejection_reason = p_rejection_reason,
        updated_at = NOW()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Event rejected successfully.',
      'event_id', p_event_id,
      'status', 'draft',
      'rejection_reason', p_rejection_reason
    );
  ELSE
    RETURN jsonb_build_object(
      'error', 'INVALID_ACTION',
      'message', 'Action must be either "approve" or "reject".'
    );
  END IF;
END;
$$;