-- =============================================================================
-- TASK-021: RPC get_sync_changes() Resource Delta Fetcher
-- Migration: 20260722000013_rpc_get_sync_changes.sql
-- Depends on: 20260722000001_canonical_schema.sql (TASK-001)
-- References: REQ-SYNC-001, WF-SYNC-001, DB-006 §8.1, IMP-007
-- =============================================================================

-- ---------------------------------------------------------------------------
-- get_sync_changes(p_resource_type, p_since_version)
--
-- Returns all records of a given resource type whose row version > p_since_version.
-- Designed for mobile offline sync delta fetching.
--
-- Supported resource types:
--   'events', 'categories', 'subcategories', 'ticket_types',
--   'event_inventory', 'profiles', 'advertisements'
--
-- Security: SECURITY INVOKER — RLS applies; client sees only permitted rows.
--
-- Returns TABLE:
--   id         UUID    — row primary key
--   version    BIGINT  — row sync version
--   data       JSONB   — full row serialised as JSON
--   is_deleted BOOLEAN — TRUE if deleted_at IS NOT NULL (soft-deleted)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_sync_changes(
  p_resource_type  text,
  p_since_version  bigint
)
  RETURNS TABLE (
    id         uuid,
    version    bigint,
    data       jsonb,
    is_deleted boolean
  )
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
AS $$
BEGIN
  -- Validate resource type
  IF p_resource_type NOT IN (
    'events',
    'categories',
    'subcategories',
    'ticket_types',
    'event_inventory',
    'profiles',
    'advertisements'
  ) THEN
    RAISE EXCEPTION
      USING ERRCODE = 'P0001',
            MESSAGE = 'INVALID_RESOURCE_TYPE',
            DETAIL  = format(
              'Resource type "%s" is not a tracked sync resource.',
              p_resource_type
            );
  END IF;

  -- Return delta rows for the requested resource type
  -- Each RETURN QUERY branch filters WHERE version > p_since_version

  IF p_resource_type = 'events' THEN
    RETURN QUERY
      SELECT
        e.id,
        e.version,
        to_jsonb(e) AS data,
        (e.deleted_at IS NOT NULL) AS is_deleted
      FROM public.events e
      WHERE e.version > p_since_version
      ORDER BY e.version ASC;

  ELSIF p_resource_type = 'categories' THEN
    RETURN QUERY
      SELECT
        c.id,
        c.version,
        to_jsonb(c) AS data,
        (c.deleted_at IS NOT NULL) AS is_deleted
      FROM public.categories c
      WHERE c.version > p_since_version
      ORDER BY c.version ASC;

  ELSIF p_resource_type = 'subcategories' THEN
    RETURN QUERY
      SELECT
        s.id,
        s.version,
        to_jsonb(s) AS data,
        (s.deleted_at IS NOT NULL) AS is_deleted
      FROM public.subcategories s
      WHERE s.version > p_since_version
      ORDER BY s.version ASC;

  ELSIF p_resource_type = 'ticket_types' THEN
    RETURN QUERY
      SELECT
        tt.id,
        tt.version,
        to_jsonb(tt) AS data,
        (tt.deleted_at IS NOT NULL) AS is_deleted
      FROM public.ticket_types tt
      WHERE tt.version > p_since_version
      ORDER BY tt.version ASC;

  ELSIF p_resource_type = 'event_inventory' THEN
    RETURN QUERY
      SELECT
        ei.id,
        ei.version,
        to_jsonb(ei) AS data,
        FALSE AS is_deleted   -- event_inventory has no soft-delete
      FROM public.event_inventory ei
      WHERE ei.version > p_since_version
      ORDER BY ei.version ASC;

  ELSIF p_resource_type = 'profiles' THEN
    RETURN QUERY
      SELECT
        p.id,
        p.version,
        to_jsonb(p) AS data,
        (p.deleted_at IS NOT NULL) AS is_deleted
      FROM public.profiles p
      WHERE p.version > p_since_version
      ORDER BY p.version ASC;

  ELSIF p_resource_type = 'advertisements' THEN
    RETURN QUERY
      SELECT
        a.id,
        a.version,
        to_jsonb(a) AS data,
        (a.deleted_at IS NOT NULL) AS is_deleted
      FROM public.advertisements a
      WHERE a.version > p_since_version
      ORDER BY a.version ASC;

  END IF;

END;
$$;

-- =============================================================================
-- End of TASK-021: RPC get_sync_changes()
-- =============================================================================
