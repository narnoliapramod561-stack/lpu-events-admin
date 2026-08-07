-- =============================================================================
-- Migration: FSM Rejected State + Outbox Events for All Transitions
-- =============================================================================
-- Changes:
--   1. Add 'rejected' to event_status enum (first-class FSM state)
--   2. Update publish_event_v2 RPC: allow 'rejected' as source state
--   3. Update process_event_approval RPC: set status='rejected' on reject
--   4. Add cancel_event, complete_event, archive_event RPCs
--   5. Add outbox events for all state transitions with changed_fields payload
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add 'rejected' to event_status enum
-- ---------------------------------------------------------------------------
-- PostgreSQL requires ALTER TYPE ... ADD VALUE outside a transaction block,
-- but we can use a DO block to check first and avoid errors on re-run.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'rejected'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE public.event_status ADD VALUE 'rejected' AFTER 'pending_approval';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in older PG.
-- The rest of the migration runs in a new transaction after the enum change.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- 2. Update publish_event_v2 RPC
--    Allow 'rejected' as a valid source state (re-publish from rejected).
--    The server re-evaluates approval — organizer never chooses the outcome.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_event_v2(
  p_event_id          uuid,
  p_organizer_user_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event             public.events%ROWTYPE;
  v_caller_profile    public.profiles%ROWTYPE;
  v_requires_approval boolean;
BEGIN
  -- Load caller profile
  SELECT * INTO v_caller_profile
    FROM public.profiles
   WHERE id = p_organizer_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED', 'message', 'Caller profile not found.');
  END IF;

  -- Load and lock event row
  SELECT * INTO v_event
    FROM public.events
   WHERE id = p_event_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'message', 'Event not found or deleted.');
  END IF;

  -- Ownership check
  IF v_event.organizer_id != p_organizer_user_id
     AND v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN', 'message', 'Only the event organizer or a super admin can publish this event.');
  END IF;

  -- Valid source states: draft, pending_approval, rejected
  -- 'rejected' allows organizer to re-submit after addressing feedback
  IF v_event.status NOT IN ('draft', 'pending_approval', 'rejected') THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_TRANSITION',
      'message', format('Cannot publish event from status: %s. Must be draft, pending_approval, or rejected.', v_event.status)
    );
  END IF;

  -- Server-side approval decision — organizer never controls this
  v_requires_approval := public.requires_super_admin_approval(
    v_event.registration_required,
    v_event.registration_type,
    v_event.registration_platform
  );

  IF v_requires_approval THEN
    -- Submit for approval (pending_approval)
    UPDATE public.events
       SET status                   = 'pending_approval',
           approval_status          = 'pending',
           submitted_for_approval_at = NOW(),
           rejection_reason         = NULL,
           updated_at               = NOW()
     WHERE id = p_event_id;

    -- Outbox: event submitted for approval
    INSERT INTO public.outbox_events (event_type, resource_type, resource_id, payload)
    VALUES (
      'event.submitted_for_approval',
      'event',
      p_event_id,
      jsonb_build_object(
        'event_id',       p_event_id,
        'organizer_id',   v_event.organizer_id,
        'title',          v_event.title,
        'is_featured',    v_event.is_featured,
        'category_id',    v_event.category_id,
        'starts_at',      v_event.starts_at,
        'previous_status', v_event.status,
        'changed_fields', jsonb_build_array('status', 'approval_status', 'submitted_for_approval_at'),
        'submitted_at',   NOW()
      )
    );

    RETURN jsonb_build_object(
      'success',          true,
      'requires_approval', true,
      'message',          'Event submitted for Super Admin approval.',
      'event_id',         p_event_id,
      'status',           'pending_approval'
    );

  ELSE
    -- Validate required fields before publishing
    IF v_event.title IS NULL OR v_event.title = '' THEN
      RETURN jsonb_build_object('error', 'VALIDATION_FAILED', 'message', 'Event title is required.');
    END IF;
    IF v_event.starts_at IS NULL THEN
      RETURN jsonb_build_object('error', 'VALIDATION_FAILED', 'message', 'Event start date is required.');
    END IF;
    IF v_event.venue IS NULL OR v_event.venue = '' THEN
      RETURN jsonb_build_object('error', 'VALIDATION_FAILED', 'message', 'Event venue is required.');
    END IF;

    -- Bypass the direct-publish trigger (RPC is the canonical publisher)
    PERFORM set_config('app.allow_publish', 'rpc', true);

    UPDATE public.events
       SET status          = 'published',
           approval_status = 'approved',
           approved_at     = NOW(),
           rejection_reason = NULL,
           updated_at      = NOW()
     WHERE id = p_event_id;

    -- Outbox: event published
    INSERT INTO public.outbox_events (event_type, resource_type, resource_id, payload)
    VALUES (
      'event.published',
      'event',
      p_event_id,
      jsonb_build_object(
        'event_id',        p_event_id,
        'organizer_id',    v_event.organizer_id,
        'title',           v_event.title,
        'is_featured',     v_event.is_featured,
        'category_id',     v_event.category_id,
        'starts_at',       v_event.starts_at,
        'previous_status', v_event.status,
        'changed_fields',  jsonb_build_array('status', 'approval_status', 'approved_at'),
        'published_at',    NOW()
      )
    );

    RETURN jsonb_build_object(
      'success',           true,
      'requires_approval', false,
      'message',           'Event published successfully.',
      'event_id',          p_event_id,
      'status',            'published'
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Update process_event_approval RPC
--    On reject: set status='rejected' (first-class FSM state, not 'draft').
--    On approve: set status='published' (unchanged).
--    Both actions write outbox events.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_event_approval(
  p_event_id        uuid,
  p_admin_user_id   uuid,
  p_action          text,
  p_rejection_reason text DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event         public.events%ROWTYPE;
  v_admin_profile public.profiles%ROWTYPE;
BEGIN
  -- Verify admin role
  SELECT * INTO v_admin_profile
    FROM public.profiles
   WHERE id = p_admin_user_id
     AND role IN ('super_admin', 'admin');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED', 'message', 'Only super admins can approve/reject events.');
  END IF;

  -- Load and lock event
  SELECT * INTO v_event
    FROM public.events
   WHERE id = p_event_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'message', 'Event not found or deleted.');
  END IF;

  -- Must be pending_approval to process
  IF v_event.status != 'pending_approval' THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_STATE',
      'message', format('Event must be in pending_approval status to approve/reject. Current status: %s', v_event.status)
    );
  END IF;

  IF p_action = 'approve' THEN
    -- Bypass direct-publish trigger
    PERFORM set_config('app.allow_publish', 'rpc', true);

    UPDATE public.events
       SET status          = 'published',
           approval_status = 'approved',
           approved_at     = NOW(),
           approved_by     = p_admin_user_id,
           rejection_reason = NULL,
           updated_at      = NOW()
     WHERE id = p_event_id;

    -- Outbox: event approved
    INSERT INTO public.outbox_events (event_type, resource_type, resource_id, payload)
    VALUES (
      'event.approved',
      'event',
      p_event_id,
      jsonb_build_object(
        'event_id',       p_event_id,
        'organizer_id',   v_event.organizer_id,
        'title',          v_event.title,
        'is_featured',    v_event.is_featured,
        'category_id',    v_event.category_id,
        'starts_at',      v_event.starts_at,
        'approved_by',    p_admin_user_id,
        'changed_fields', jsonb_build_array('status', 'approval_status', 'approved_at', 'approved_by'),
        'approved_at',    NOW()
      )
    );

    RETURN jsonb_build_object(
      'success',  true,
      'message',  'Event approved and published successfully.',
      'event_id', p_event_id,
      'status',   'published'
    );

  ELSIF p_action = 'reject' THEN
    IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
      RETURN jsonb_build_object('error', 'REASON_REQUIRED', 'message', 'Rejection reason is required.');
    END IF;

    -- Set status='rejected' — first-class FSM state
    -- Organizer can re-publish from 'rejected' (publish_event_v2 allows it)
    UPDATE public.events
       SET status           = 'rejected',
           approval_status  = 'rejected',
           rejection_reason = p_rejection_reason,
           updated_at       = NOW()
     WHERE id = p_event_id;

    -- Outbox: event rejected
    INSERT INTO public.outbox_events (event_type, resource_type, resource_id, payload)
    VALUES (
      'event.rejected',
      'event',
      p_event_id,
      jsonb_build_object(
        'event_id',         p_event_id,
        'organizer_id',     v_event.organizer_id,
        'title',            v_event.title,
        'is_featured',      v_event.is_featured,
        'category_id',      v_event.category_id,
        'starts_at',        v_event.starts_at,
        'rejected_by',      p_admin_user_id,
        'rejection_reason', p_rejection_reason,
        'changed_fields',   jsonb_build_array('status', 'approval_status', 'rejection_reason'),
        'rejected_at',      NOW()
      )
    );

    RETURN jsonb_build_object(
      'success',          true,
      'message',          'Event rejected. Organizer can edit and re-submit.',
      'event_id',         p_event_id,
      'status',           'rejected',
      'rejection_reason', p_rejection_reason
    );

  ELSE
    RETURN jsonb_build_object('error', 'INVALID_ACTION', 'message', 'Action must be "approve" or "reject".');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. cancel_event RPC
--    Transitions: published → cancelled, ongoing → cancelled, pending_approval → cancelled
--    Organizer can cancel own events (without paid bookings).
--    Super admin can cancel any event.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_event(
  p_event_id      uuid,
  p_user_id       uuid,
  p_cancel_reason text DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event   public.events%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_paid_bookings_count integer;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED', 'message', 'User profile not found.');
  END IF;

  SELECT * INTO v_event
    FROM public.events
   WHERE id = p_event_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'message', 'Event not found.');
  END IF;

  -- Ownership check (organizer must own; admin bypasses)
  IF v_profile.role NOT IN ('super_admin', 'admin') AND v_event.organizer_id != p_user_id THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN', 'message', 'You do not own this event.');
  END IF;

  -- Valid source states for cancellation
  IF v_event.status NOT IN ('draft', 'pending_approval', 'published', 'ongoing', 'rejected') THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_TRANSITION',
      'message', format('Cannot cancel event from status: %s', v_event.status)
    );
  END IF;

  -- Organizers cannot cancel events with confirmed paid bookings
  IF v_profile.role NOT IN ('super_admin', 'admin') THEN
    SELECT COUNT(*) INTO v_paid_bookings_count
      FROM public.registrations r
      JOIN public.payments p ON p.registration_id = r.id
     WHERE r.event_id = p_event_id
       AND r.status = 'confirmed'
       AND p.status = 'captured';

    IF v_paid_bookings_count > 0 THEN
      RETURN jsonb_build_object(
        'error',   'PAID_BOOKINGS_EXIST',
        'message', 'Events with confirmed paid bookings require Super Admin approval for cancellation.',
        'requires_admin', true
      );
    END IF;
  END IF;

  UPDATE public.events
     SET status     = 'cancelled',
         updated_at = NOW()
   WHERE id = p_event_id;

  -- Outbox: event cancelled
  INSERT INTO public.outbox_events (event_type, resource_type, resource_id, payload)
  VALUES (
    'event.cancelled',
    'event',
    p_event_id,
    jsonb_build_object(
      'event_id',        p_event_id,
      'organizer_id',    v_event.organizer_id,
      'title',           v_event.title,
      'is_featured',     v_event.is_featured,
      'category_id',     v_event.category_id,
      'starts_at',       v_event.starts_at,
      'cancelled_by',    p_user_id,
      'cancel_reason',   p_cancel_reason,
      'previous_status', v_event.status,
      'changed_fields',  jsonb_build_array('status'),
      'cancelled_at',    NOW()
    )
  );

  RETURN jsonb_build_object(
    'success',  true,
    'message',  'Event cancelled successfully.',
    'event_id', p_event_id,
    'status',   'cancelled'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. complete_event RPC
--    Transitions: published → completed, ongoing → completed
--    Organizer or admin only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_event(
  p_event_id uuid,
  p_user_id  uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event   public.events%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED', 'message', 'User profile not found.');
  END IF;

  SELECT * INTO v_event
    FROM public.events
   WHERE id = p_event_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'message', 'Event not found.');
  END IF;

  IF v_profile.role NOT IN ('super_admin', 'admin') AND v_event.organizer_id != p_user_id THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN', 'message', 'You do not own this event.');
  END IF;

  IF v_event.status NOT IN ('published', 'ongoing') THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_TRANSITION',
      'message', format('Cannot complete event from status: %s. Must be published or ongoing.', v_event.status)
    );
  END IF;

  UPDATE public.events
     SET status     = 'completed',
         updated_at = NOW()
   WHERE id = p_event_id;

  -- Outbox: event completed
  INSERT INTO public.outbox_events (event_type, resource_type, resource_id, payload)
  VALUES (
    'event.completed',
    'event',
    p_event_id,
    jsonb_build_object(
      'event_id',        p_event_id,
      'organizer_id',    v_event.organizer_id,
      'title',           v_event.title,
      'is_featured',     v_event.is_featured,
      'category_id',     v_event.category_id,
      'starts_at',       v_event.starts_at,
      'completed_by',    p_user_id,
      'previous_status', v_event.status,
      'changed_fields',  jsonb_build_array('status'),
      'completed_at',    NOW()
    )
  );

  RETURN jsonb_build_object(
    'success',  true,
    'message',  'Event marked as completed.',
    'event_id', p_event_id,
    'status',   'completed'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. archive_event RPC
--    Transitions: completed → archived, cancelled → archived
--    Admin only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_event(
  p_event_id uuid,
  p_user_id  uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event   public.events%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED', 'message', 'User profile not found.');
  END IF;

  IF v_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN', 'message', 'Only admins can archive events.');
  END IF;

  SELECT * INTO v_event
    FROM public.events
   WHERE id = p_event_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'message', 'Event not found.');
  END IF;

  IF v_event.status NOT IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'error',   'INVALID_TRANSITION',
      'message', format('Cannot archive event from status: %s. Must be completed or cancelled.', v_event.status)
    );
  END IF;

  UPDATE public.events
     SET status     = 'archived',
         updated_at = NOW()
   WHERE id = p_event_id;

  -- Outbox: event archived
  INSERT INTO public.outbox_events (event_type, resource_type, resource_id, payload)
  VALUES (
    'event.archived',
    'event',
    p_event_id,
    jsonb_build_object(
      'event_id',        p_event_id,
      'organizer_id',    v_event.organizer_id,
      'title',           v_event.title,
      'is_featured',     v_event.is_featured,
      'category_id',     v_event.category_id,
      'archived_by',     p_user_id,
      'previous_status', v_event.status,
      'changed_fields',  jsonb_build_array('status'),
      'archived_at',     NOW()
    )
  );

  RETURN jsonb_build_object(
    'success',  true,
    'message',  'Event archived successfully.',
    'event_id', p_event_id,
    'status',   'archived'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Performance index: composite on (status, deleted_at)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_events_status_deleted_at
  ON public.events (status, deleted_at)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 8. Update get_sync_changes to treat 'rejected' events as non-visible
--    (same as draft/pending_approval — not returned as data rows to students)
--    The existing SECURITY DEFINER version already filters by status='published',
--    so 'rejected' is automatically excluded. No change needed there.
--    But we add a comment for clarity.
-- ---------------------------------------------------------------------------
COMMENT ON FUNCTION public.get_sync_changes(text, bigint) IS
  'Returns delta rows for incremental client sync. Events are filtered to status=published only. Rejected/draft/pending/cancelled/archived events are never returned as data rows to anonymous clients. Soft-deleted rows are returned as tombstones (is_deleted=true).';

COMMIT;
