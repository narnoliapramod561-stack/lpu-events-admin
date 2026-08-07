-- =============================================================================
-- Domain 3: Student Event Discovery & Synchronization Fixes
-- =============================================================================
-- Purpose:
-- 1. Ensure version is bumped on INSERT for synchronized discovery tables
--    (categories, subcategories, advertisements) so that INSERT-only rows are
--    discoverable by incremental sync. Events/ticket_types/inventory already
--    receive an UPDATE (e.g., publish_event) after insert.
-- 2. Change get_sync_changes to SECURITY DEFINER with explicit data projection
--    and visibility filtering that mirrors existing RLS SELECT policies. This
--    allows deletion tombstones (is_deleted=true) to be returned to anon users
--    while never exposing unpublished/private data as full rows.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. INSERT-version bump for synchronized discovery tables
-- =============================================================================
-- Tables that can be INSERTed as already-visible without any subsequent UPDATE:
--   categories, subcategories, advertisements
-- This ensures new rows are returned by get_sync_changes since version > since.
-- =============================================================================

-- Why this is needed (scoped to INSERT-only discovery rows):
--   * Row `version` is a per-row counter starting at 1, bumped ONLY on UPDATE
--     by trigger_set_updated_at.
--   * `get_sync_changes` returns rows with `version > p_since_version`. A client
--     that already cached `version >= 1` will send `since >= 1`, so a NEW row
--     inserted with the default `version = 1` is skipped (never > since).
--   * events/ticket_types/event_inventory are always followed by an UPDATE
--     (e.g., publish_event) that bumps their version, so they are safe.
--   * categories/subcategories/advertisements can be INSERTed in an already
--     visible state with no subsequent UPDATE, so they are the only tables at
--     risk. We therefore scope the INSERT alignment to these tables only.
--
-- Strategy (minimal, canonical-preserving): on INSERT, align the new row's
-- `version` to the resource's monotonic sync counter so it always exceeds any
-- previously delivered `since`. This does NOT change UPDATE semantics and does
-- NOT alter any publish/workflow RPC. It only makes new INSERT-only rows
-- discoverable by the existing incremental delta query.
CREATE OR REPLACE FUNCTION public.trigger_align_insert_version()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  -- Atomically bump this resource's global counter and read the new value.
  INSERT INTO public.sync_versions (resource_type, current_version, updated_at)
  VALUES (TG_TABLE_NAME, 1, now())
  ON CONFLICT (resource_type)
  DO UPDATE SET
    current_version = sync_versions.current_version + 1,
    updated_at      = now()
  RETURNING current_version INTO v_next;

  NEW.version := COALESCE(v_next, 1);
  RETURN NEW;
END;
$$;

-- Attach INSERT alignment ONLY to the discovery tables that lack a guaranteed
-- post-insert UPDATE. bumping the counter here replaces the job that
-- trigger_bump_sync_version would otherwise double-count for these tables.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['categories', 'subcategories', 'advertisements'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      $f$
        DROP TRIGGER IF EXISTS align_insert_version ON public.%I;
        CREATE TRIGGER align_insert_version
          BEFORE INSERT ON public.%I
          FOR EACH ROW EXECUTE FUNCTION public.trigger_align_insert_version();
      $f$,
      t, t
    );
  END LOOP;
END;
$$;

-- Prevent double-counting: for the tables above, the AFTER INSERT
-- bump_sync_version trigger must not also increment the counter (the BEFORE
-- trigger already advanced it). Recreate bump_sync_version to skip INSERTs on
-- these aligned tables, keeping UPDATE/DELETE bumps intact.
CREATE OR REPLACE FUNCTION public.trigger_bump_sync_version()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- INSERTs on aligned tables are already counted by trigger_align_insert_version.
  IF TG_OP = 'INSERT'
     AND TG_TABLE_NAME IN ('categories', 'subcategories', 'advertisements') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.sync_versions (resource_type, current_version, updated_at)
  VALUES (TG_TABLE_NAME, 1, now())
  ON CONFLICT (resource_type)
  DO UPDATE SET
    current_version = sync_versions.current_version + 1,
    updated_at      = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;


-- =============================================================================
-- 2. get_sync_changes with deletion tombstones and explicit secure projection
-- =============================================================================
-- SECURITY DEFINER allows us to return soft-deleted rows as is_deleted=true
-- tombstones so anon clients can purge them from cache. Full data rows are
-- ONLY returned if the row would also be visible under the equivalent anon RLS
-- SELECT policy. No unpublished/draft/archived/completed/non-active rows are
-- exposed as data.
-- =============================================================================

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
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
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

  -- Events: anon RLS = deleted_at IS NULL AND status = 'published'
  -- Deletions are tombstoned; drafts/pending/archived are NOT returned.
  IF p_resource_type = 'events' THEN
    RETURN QUERY
      SELECT
        e.id,
        e.version,
        CASE WHEN e.deleted_at IS NOT NULL
          THEN jsonb_build_object('id', e.id, 'version', e.version, 'deleted_at', e.deleted_at)
          ELSE to_jsonb(e)
        END AS data,
        (e.deleted_at IS NOT NULL) AS is_deleted
      FROM public.events e
      WHERE e.version > p_since_version
        AND (
          (e.deleted_at IS NULL AND e.status = 'published')
          OR e.deleted_at IS NOT NULL
        )
      ORDER BY e.version ASC;

  -- Categories: anon RLS = deleted_at IS NULL AND is_active = TRUE
  ELSIF p_resource_type = 'categories' THEN
    RETURN QUERY
      SELECT
        c.id,
        c.version,
        CASE WHEN c.deleted_at IS NOT NULL
          THEN jsonb_build_object('id', c.id, 'version', c.version, 'deleted_at', c.deleted_at)
          ELSE to_jsonb(c)
        END AS data,
        (c.deleted_at IS NOT NULL) AS is_deleted
      FROM public.categories c
      WHERE c.version > p_since_version
        AND (
          (c.deleted_at IS NULL AND c.is_active = TRUE)
          OR c.deleted_at IS NOT NULL
        )
      ORDER BY c.version ASC;

  -- Subcategories: anon RLS = deleted_at IS NULL AND is_active = TRUE
  ELSIF p_resource_type = 'subcategories' THEN
    RETURN QUERY
      SELECT
        s.id,
        s.version,
        CASE WHEN s.deleted_at IS NOT NULL
          THEN jsonb_build_object('id', s.id, 'version', s.version, 'deleted_at', s.deleted_at)
          ELSE to_jsonb(s)
        END AS data,
        (s.deleted_at IS NOT NULL) AS is_deleted
      FROM public.subcategories s
      WHERE s.version > p_since_version
        AND (
          (s.deleted_at IS NULL AND s.is_active = TRUE)
          OR s.deleted_at IS NOT NULL
        )
      ORDER BY s.version ASC;

  -- Ticket Types: anon RLS = visible only when parent event is published and not deleted
  ELSIF p_resource_type = 'ticket_types' THEN
    RETURN QUERY
      SELECT
        tt.id,
        tt.version,
        CASE WHEN tt.deleted_at IS NOT NULL
          THEN jsonb_build_object('id', tt.id, 'version', tt.version, 'deleted_at', tt.deleted_at)
          ELSE to_jsonb(tt)
        END AS data,
        (tt.deleted_at IS NOT NULL) AS is_deleted
      FROM public.ticket_types tt
      WHERE tt.version > p_since_version
        AND (
          (tt.deleted_at IS NULL
            AND EXISTS (
              SELECT 1 FROM public.events ev
              WHERE ev.id = tt.event_id
                AND ev.status = 'published'
                AND ev.deleted_at IS NULL
            ))
          OR tt.deleted_at IS NOT NULL
        )
      ORDER BY tt.version ASC;

  -- Event Inventory: anon RLS = visible only when parent event is published and not deleted
  ELSIF p_resource_type = 'event_inventory' THEN
    RETURN QUERY
      SELECT
        ei.id,
        ei.version,
        CASE WHEN ei.deleted_at IS NOT NULL
          THEN jsonb_build_object('id', ei.id, 'version', ei.version, 'deleted_at', ei.deleted_at)
          ELSE to_jsonb(ei)
        END AS data,
        (ei.deleted_at IS NOT NULL) AS is_deleted
      FROM public.event_inventory ei
      WHERE ei.version > p_since_version
        AND (
          (ei.deleted_at IS NULL
            AND EXISTS (
              SELECT 1 FROM public.events ev
              WHERE ev.id = ei.event_id
                AND ev.status = 'published'
                AND ev.deleted_at IS NULL
            ))
          OR ei.deleted_at IS NOT NULL
        )
      ORDER BY ei.version ASC;

  -- Profiles: only id + full_name are returned (no PII). Deletions tombstoned.
  ELSIF p_resource_type = 'profiles' THEN
    RETURN QUERY
      SELECT
        p.id,
        p.version,
        CASE WHEN p.deleted_at IS NOT NULL
          THEN jsonb_build_object('id', p.id, 'version', p.version, 'deleted_at', p.deleted_at)
          ELSE jsonb_build_object('id', p.id, 'full_name', p.full_name)
        END AS data,
        (p.deleted_at IS NOT NULL) AS is_deleted
      FROM public.profiles p
      WHERE p.version > p_since_version
      ORDER BY p.version ASC;

  -- Advertisements: anon RLS = deleted_at IS NULL AND status = 'active'
  ELSIF p_resource_type = 'advertisements' THEN
    RETURN QUERY
      SELECT
        a.id,
        a.version,
        CASE WHEN a.deleted_at IS NOT NULL
          THEN jsonb_build_object('id', a.id, 'version', a.version, 'deleted_at', a.deleted_at)
          ELSE to_jsonb(a)
        END AS data,
        (a.deleted_at IS NOT NULL) AS is_deleted
      FROM public.advertisements a
      WHERE a.version > p_since_version
        AND (
          (a.deleted_at IS NULL AND a.status = 'active')
          OR a.deleted_at IS NOT NULL
        )
      ORDER BY a.version ASC;

  END IF;

END;
$$;

COMMIT;

-- =============================================================================
-- End of Domain 3: Student Event Discovery & Synchronization Fixes
-- =============================================================================
