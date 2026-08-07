-- =============================================================================
-- Migration: Virtual Sync Resources + bump_sync_resource_versions RPC
-- =============================================================================
-- Adds virtual resource types to sync_versions for section-level tracking.
-- These are version-only counters — no corresponding table.
-- Clients use them to know when to re-filter their local cache without
-- re-fetching all events.
--
-- Virtual resources:
--   featured_events   — bumped when featured event set changes
--   schedule_sections — bumped when event dates change (today/tomorrow/this-week)
--   search_index      — bumped when event title/description changes
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Seed virtual resource types into sync_versions
-- ---------------------------------------------------------------------------
INSERT INTO public.sync_versions (resource_type, current_version, updated_at)
VALUES
  ('featured_events',   0, now()),
  ('schedule_sections', 0, now()),
  ('search_index',      0, now())
ON CONFLICT (resource_type) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. bump_sync_resource_versions(p_resource_types text[])
--    Atomically increments current_version for each resource type.
--    Called by the outbox processor after processing each outbox event.
--    Uses SECURITY DEFINER so the outbox processor (service role) can call it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_sync_resource_versions(
  p_resource_types text[]
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_resource text;
BEGIN
  FOREACH v_resource IN ARRAY p_resource_types LOOP
    INSERT INTO public.sync_versions (resource_type, current_version, updated_at)
    VALUES (v_resource, 1, now())
    ON CONFLICT (resource_type)
    DO UPDATE SET
      current_version = sync_versions.current_version + 1,
      updated_at      = now();
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.bump_sync_resource_versions(text[]) IS
  'Atomically increments sync_versions.current_version for each resource type in the array. Called by the outbox processor to signal clients that specific resources have changed. Clients detect the version bump on next poll and pull only the delta via get_sync_changes.';

-- ---------------------------------------------------------------------------
-- 3. get_resource_versions()
--    Returns all current resource versions in a single query.
--    Used by clients to check which resources need syncing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_resource_versions()
  RETURNS TABLE (resource_type text, current_version bigint, updated_at timestamptz)
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT resource_type, current_version, updated_at
    FROM public.sync_versions
   ORDER BY resource_type;
$$;

COMMENT ON FUNCTION public.get_resource_versions() IS
  'Returns all resource version counters. Clients call this to determine which resources have changed since their last sync, then request only the changed resources via get_sync_changes.';

-- ---------------------------------------------------------------------------
-- 4. auto_complete_past_events()
--    Transitions published/ongoing events past their end date to 'completed'.
--    Called by the scheduled-cache-refresh edge function at midnight.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_complete_past_events()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event_ids uuid[];
  v_count     integer;
BEGIN
  -- Find events that have ended but are still published or ongoing
  SELECT array_agg(id) INTO v_event_ids
    FROM public.events
   WHERE status IN ('published', 'ongoing')
     AND ends_at IS NOT NULL
     AND ends_at < now()
     AND deleted_at IS NULL;

  IF v_event_ids IS NULL OR array_length(v_event_ids, 1) = 0 THEN
    RETURN jsonb_build_object('completed_count', 0, 'message', 'No events to complete.');
  END IF;

  -- Transition to completed
  UPDATE public.events
     SET status     = 'completed',
         updated_at = NOW()
   WHERE id = ANY(v_event_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Write outbox events for each completed event
  INSERT INTO public.outbox_events (event_type, resource_type, resource_id, payload)
  SELECT
    'event.completed',
    'event',
    e.id,
    jsonb_build_object(
      'event_id',        e.id,
      'organizer_id',    e.organizer_id,
      'title',           e.title,
      'is_featured',     e.is_featured,
      'category_id',     e.category_id,
      'starts_at',       e.starts_at,
      'previous_status', 'auto_completed',
      'changed_fields',  jsonb_build_array('status'),
      'completed_at',    NOW()
    )
  FROM public.events e
  WHERE e.id = ANY(v_event_ids);

  RETURN jsonb_build_object(
    'completed_count', v_count,
    'event_ids',       v_event_ids,
    'message',         format('%s event(s) auto-completed.', v_count)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. auto_archive_old_events(p_days_after_completion int DEFAULT 30)
--    Transitions completed/cancelled events older than N days to 'archived'.
--    Called by the scheduled-cache-refresh edge function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_archive_old_events(
  p_days_after_completion int DEFAULT 30
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event_ids uuid[];
  v_count     integer;
BEGIN
  SELECT array_agg(id) INTO v_event_ids
    FROM public.events
   WHERE status IN ('completed', 'cancelled')
     AND updated_at < now() - (p_days_after_completion || ' days')::interval
     AND deleted_at IS NULL;

  IF v_event_ids IS NULL OR array_length(v_event_ids, 1) = 0 THEN
    RETURN jsonb_build_object('archived_count', 0, 'message', 'No events to archive.');
  END IF;

  UPDATE public.events
     SET status     = 'archived',
         updated_at = NOW()
   WHERE id = ANY(v_event_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.outbox_events (event_type, resource_type, resource_id, payload)
  SELECT
    'event.archived',
    'event',
    e.id,
    jsonb_build_object(
      'event_id',        e.id,
      'organizer_id',    e.organizer_id,
      'title',           e.title,
      'is_featured',     e.is_featured,
      'category_id',     e.category_id,
      'previous_status', e.status,
      'changed_fields',  jsonb_build_array('status'),
      'archived_at',     NOW()
    )
  FROM public.events e
  WHERE e.id = ANY(v_event_ids);

  RETURN jsonb_build_object(
    'archived_count', v_count,
    'event_ids',      v_event_ids,
    'message',        format('%s event(s) auto-archived.', v_count)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. bump_schedule_sections()
--    Bumps schedule_sections version. Called at midnight to signal clients
--    that today/tomorrow/this-week filters need re-evaluation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_schedule_sections()
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  INSERT INTO public.sync_versions (resource_type, current_version, updated_at)
  VALUES ('schedule_sections', 1, now())
  ON CONFLICT (resource_type)
  DO UPDATE SET
    current_version = sync_versions.current_version + 1,
    updated_at      = now();
$$;

COMMIT;
