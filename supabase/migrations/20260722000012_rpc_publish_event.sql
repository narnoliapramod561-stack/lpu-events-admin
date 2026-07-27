-- =============================================================================
-- TASK-020: RPC publish_event()
-- Migration: 20260722000012_rpc_publish_event.sql
-- Depends on: 20260722000001_canonical_schema.sql (TASK-001)
-- References: REQ-EVENT-003, WF-EVENT-003, DB-006, IMP-007
-- =============================================================================

-- ---------------------------------------------------------------------------
-- publish_event(p_event_id, p_organizer_user_id)
--
-- Transitions an event from 'draft' or 'review' to 'published'. Atomically:
--   1. Validates calller is the event's organizer (or super_admin).
--   2. Loads and locks the event row.
--   3. Validates event status is 'draft' or 'review'.
--   4. Validates required fields are complete (title, start_date, venue).
--   5. Validates event_inventory row exists with total_tickets > 0.
--   6. Updates event status to 'published', sets published_at.
--   7. Emits event.published outbox event.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.publish_event(
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
  v_inventory_count integer;
BEGIN
  -- -------------------------------------------------------------------------
  -- Step 1: Load caller's profile for role check
  -- -------------------------------------------------------------------------
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

  -- -------------------------------------------------------------------------
  -- Step 2: Load and lock the event row
  -- -------------------------------------------------------------------------
  SELECT *
    INTO v_event
    FROM public.events
   WHERE id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error',   'EVENT_NOT_FOUND',
      'message', 'Event not found.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 3: Validate caller is owner or super_admin
  -- -------------------------------------------------------------------------
  IF v_event.organizer_id <> p_organizer_user_id
     AND v_caller_profile.role <> 'super_admin' THEN
    RETURN jsonb_build_object(
      'error',   'UNAUTHORIZED',
      'message', 'Only the event organizer or super_admin can publish this event.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 4: Validate event status allows publishing
  -- -------------------------------------------------------------------------
  IF v_event.status NOT IN ('draft', 'review') THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_STATUS',
      'message', format(
        'Event must be in draft or review status to publish. Current status: %s',
        v_event.status
      )
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 5: Validate required fields are present
  -- -------------------------------------------------------------------------
  IF v_event.title IS NULL OR trim(v_event.title) = '' THEN
    RETURN jsonb_build_object(
      'error',   'VALIDATION_ERROR',
      'message', 'Event title is required before publishing.'
    );
  END IF;

  IF v_event.start_date IS NULL THEN
    RETURN jsonb_build_object(
      'error',   'VALIDATION_ERROR',
      'message', 'Event start_date is required before publishing.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 6: Validate inventory exists with tickets allocated
  -- -------------------------------------------------------------------------
  SELECT COUNT(*)
    INTO v_inventory_count
    FROM public.event_inventory
   WHERE event_id      = p_event_id
     AND total_tickets > 0;

  IF v_inventory_count = 0 THEN
    RETURN jsonb_build_object(
      'error',   'VALIDATION_ERROR',
      'message', 'Event must have at least one inventory record with total_tickets > 0 before publishing.'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 7: Publish the event
  -- -------------------------------------------------------------------------
  UPDATE public.events
     SET status       = 'published',
         published_at = now(),
         updated_at   = now()
   WHERE id = p_event_id;

  -- -------------------------------------------------------------------------
  -- Step 8: Emit event.published outbox event
  -- -------------------------------------------------------------------------
  INSERT INTO public.outbox_events (
    event_type,
    resource_type,
    resource_id,
    payload
  )
  VALUES (
    'event.published',
    'event',
    p_event_id,
    jsonb_build_object(
      'event_id',      p_event_id,
      'organizer_id',  v_event.organizer_id,
      'title',         v_event.title,
      'published_at',  now()
    )
  );

  RETURN jsonb_build_object(
    'event_id',     p_event_id,
    'status',       'published',
    'published_at', now()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- =============================================================================
-- End of TASK-020: RPC publish_event()
-- =============================================================================
