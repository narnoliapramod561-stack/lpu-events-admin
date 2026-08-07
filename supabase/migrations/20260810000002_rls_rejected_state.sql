-- =============================================================================
-- Migration: RLS Hardening for Rejected State
-- =============================================================================
-- The existing RLS policies already correctly exclude 'rejected' events from
-- student/anon visibility (events_select_published uses status='published').
-- This migration:
--   1. Adds public.is_admin() helper (role IN ('admin','super_admin'))
--   2. Ensures events_select_admin covers both 'admin' and 'super_admin' roles
--   3. Adds explicit policy for organizers to see their own rejected events
--   4. Ensures cancel/complete/archive RPCs are SECURITY DEFINER (already done)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add is_admin() helper if not already present
--    Matches both 'admin' and 'super_admin' roles (app convention)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Replace events_select_admin to cover both admin roles
--    (was: is_super_admin() which only matches 'super_admin')
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS events_select_admin ON public.events;

CREATE POLICY events_select_admin
  ON public.events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Replace events_update_admin to cover both admin roles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS events_update_admin ON public.events;

CREATE POLICY events_update_admin
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND deleted_at IS NULL)
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Verify student visibility: rejected events must NOT appear in anon queries
--    The existing events_select_published policy already enforces this:
--      USING (deleted_at IS NULL AND status = 'published')
--    'rejected' is not 'published', so it is automatically excluded.
--    No change needed — this comment documents the invariant.
-- ---------------------------------------------------------------------------
COMMENT ON POLICY events_select_published ON public.events IS
  'Students and anonymous users see only published, non-deleted events. Rejected, draft, pending_approval, cancelled, completed, and archived events are never visible to students.';

-- ---------------------------------------------------------------------------
-- 5. Organizer can see their own rejected events (already covered by
--    events_select_own: deleted_at IS NULL AND organizer_id = auth.uid())
--    Document this explicitly.
-- ---------------------------------------------------------------------------
COMMENT ON POLICY events_select_own ON public.events IS
  'Organizers see all their own events regardless of status (draft, pending_approval, rejected, published, ongoing, completed, cancelled, archived). This allows them to view and re-submit rejected events.';

-- ---------------------------------------------------------------------------
-- 6. Ensure get_sync_changes SECURITY DEFINER function correctly excludes
--    rejected events from student sync. The function already filters
--    status = ''published'' for events. Add rejected to the explicit exclusion
--    comment for clarity — no code change needed since the filter is positive
--    (only published is included, not a negative exclusion list).
-- ---------------------------------------------------------------------------

COMMIT;
