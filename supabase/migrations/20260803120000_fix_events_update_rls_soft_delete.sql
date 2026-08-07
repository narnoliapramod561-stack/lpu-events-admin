-- =============================================================================
-- FIX: "new row violates row-level security policy for table \"events\"" on Delete
-- =============================================================================
-- Symptom
--   Clicking "Delete event" returns:
--     new row violates row-level security policy for table "events"
--
-- Root cause
--   Deleting an event is a SOFT delete implemented in EventService.deleteEvent()
--   as an UPDATE that sets deleted_at = now():
--       UPDATE public.events SET deleted_at = now() WHERE id = ... AND deleted_at IS NULL
--   This UPDATE runs under the deleting user's JWT (anon-key/cookie client in
--   app/api/organizer/events/[id]/route.ts → createClient()), so RLS applies and
--   Postgres evaluates every UPDATE policy's WITH CHECK against the NEW row.
--   When NO policy's WITH CHECK passes, Postgres raises exactly:
--       new row violates row-level security policy
--
--   The app and the DB disagreed about WHO may perform this UPDATE:
--     * The DELETE route + validateOrganizer() authorize:
--         organizer (owner), 'admin', 'super_admin'
--     * The existing UPDATE policies authorized only:
--         - events_update_own   : organizer_id = auth.uid()          (owner only)
--         - events_update_admin : public.is_super_admin()            (role='super_admin' ONLY)
--   is_super_admin() matches role='super_admin' but NOT role='admin' (they are
--   distinct enum values). Consequently a non-super 'admin' — or anyone authorized
--   by the app but matched by no UPDATE policy — fails every WITH CHECK, producing
--   the RLS error even though the request was legitimately authorized upstream.
--
-- Fix (minimal, invariant-preserving)
--   1) Add public.is_admin()  → role IN ('admin','super_admin')  (app convention).
--   2) Replace the two narrow UPDATE policies with ONE permissive policy that
--      authorizes the SAME set of actors as the DELETE route:
--         owner (organizer_id = auth.uid())  OR  any admin (is_admin()).
--      USING  : read pre-image (existing row must be visible/owner-or-admin)
--      WITH CHECK : NEW row must still belong to the owner-or-admin actor. The
--      soft-delete transition (deleted_at NULL → timestamp) is permitted because
--      organizer_id/ownership is unchanged by the delete.
--
--   Invariants kept intact:
--     * _events_block_direct_publish trigger still forbids direct status='published'.
--     * No hard DELETE is introduced (events_delete_none stays FORCE-deny).
--     * Students/non-privileged users still cannot UPDATE events.
--     * Publish path is unchanged (publish_event RPC only).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Admin helper matching the application's definition of "admin"
--    (validateOrganizer + AdminGuard treat 'admin' and 'super_admin' as admins).
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
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when the current user has role admin or super_admin. Mirrors the app-level authorization used by organizer/admin event routes.';

-- ---------------------------------------------------------------------------
-- 2) Replace the two narrow UPDATE policies with a single permissive policy
--    that authorizes owner-or-admin, with a matching WITH CHECK.
--    (Permissive policies are OR'ed; one correct policy avoids the
--     all-policies-fail collision that produced the RLS error.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS events_update_own   ON public.events;
DROP POLICY IF EXISTS events_update_admin ON public.events;

CREATE POLICY events_update_owner_or_admin
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    -- Row must be readable/updatable by this actor:
    --   the owning organizer, or any admin (admin / super_admin).
    (organizer_id = auth.uid() AND deleted_at IS NULL)
    OR public.is_admin()
  )
  WITH CHECK (
    -- The NEW row must remain owned by (or manageable by) this actor.
    -- Soft delete (deleted_at being set) does not change organizer_id, so an
    -- owner can still satisfy organizer_id = auth.uid(); admins satisfy is_admin().
    organizer_id = auth.uid()
    OR public.is_admin()
  );

COMMENT ON POLICY events_update_owner_or_admin ON public.events IS
  'Allows an event owner (organizer) or any admin/admin-super to UPDATE the event, including the soft-delete (deleted_at) transition used by EventService.deleteEvent. Aligns DB RLS with the app-level authorization in the organizer events DELETE/PUT routes.';

COMMIT;

-- =============================================================================
-- Verification
-- =============================================================================
-- SELECT polname, polcmd, pg_get_expr(polqual,'public.events'::regclass) AS using,
--        pg_get_expr(polwithcheck,'public.events'::regclass) AS with_check
--   FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
--  WHERE c.relname='events';
--
-- Manual (as an authenticated admin who is NOT the event organizer):
--   UPDATE public.events SET deleted_at = now() WHERE id='<draft-event-id>';
--   -- expect: success (row soft-deleted), no RLS error
-- =============================================================================
