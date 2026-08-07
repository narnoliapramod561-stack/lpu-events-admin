-- ============================================================================
-- Domain 2 — Event Management Migration (EVENT_MANAGEMENT_MIGRATION.md)
-- ============================================================================
-- Why: EventService.deleteEvent now performs a SOFT delete (deleted_at).
-- This migration adds the missing column so soft delete works, re-tightens
-- the public-organizer visibility policy, and clearly documents the lifecycle:
--
--   CREATE  : application layer (POST /api/organizer/events → EventService.
--             createEvent) — validation (EventValidator) + atomic inventory init.
--   UPDATE  : application layer (PUT /api/organizer/events/[id]), EXCEPT that
--             a transition INTO status='published' is REJECTED there.
--   PUBLISH : RPC ONLY (publish_event via POST /api/organizer/events/:id/publish
--             → EventService.publishEvent). Never a raw update, never client side.
--   DELETE  : SOFT (deleted_at). Hard delete is service_role/admin only.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Soft-delete column for events (used by EventService.deleteEvent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_events_deleted_at
  ON public.events (deleted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.events.deleted_at IS
  'Soft-delete timestamp. Non-null = deleted. Application reads should exclude it. Hard delete reserved for service_role/admin maintenance.';

-- ---------------------------------------------------------------------------
-- 2) Public-organizer event creation is client-fired in the legacy stack.
--    Under Domain 2 the ONLY writers into `events` from the app are the
--    organizer/authenticated server routes (organizer creating own event) or
--    the publish RPC. Keep the authenticated INSERT policy tight so a client
--    can never self-publish via insert.
--
--    We (re)create the organizer INSERT policy to (a) require organizer_id =
--    auth.uid() and (b) forbid inserting directly into 'published'.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS events_insert_organizer_own ON public.events;
CREATE POLICY events_insert_organizer_own ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organizer_id = auth.uid()
    AND status IN ('draft', 'pending_approval')   -- NEVER 'published' at insert
    AND deleted_at IS NULL
  );

-- Status guard trigger: any direct INSERT/UPDATE attempt to set status
-- 'published' outside the publish_event RPC is rejected at the DB layer.
-- publish_event() runs as SECURITY DEFINER and sets a session GUC to bypass.
CREATE OR REPLACE FUNCTION public._events_block_direct_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow the publish_event RPC (it sets this GUC) and service_role.
  IF NEW.status = 'published'
     AND (OLD.status IS DISTINCT FROM 'published')
     -- publish_event RPC intentionally sets this GUC (same transaction) to bypass.
     AND coalesce(current_setting('app.allow_publish', true), '') <> 'rpc'
     AND (auth.role() IS DISTINCT FROM 'service_role') THEN
    RAISE EXCEPTION
      'Direct publish to status=published is forbidden. Use publish_event RPC.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_block_direct_publish ON public.events;
CREATE TRIGGER trg_events_block_direct_publish
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public._events_block_direct_publish();

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='events' AND column_name='deleted_at';
-- SELECT polname FROM pg_policies WHERE tablename='events';
-- SELECT tgname FROM pg_trigger WHERE tgname='trg_events_block_direct_publish';
--
-- Manual: as authenticated organizer, run
--   UPDATE events SET status='published' WHERE id='<draft>';  -- expect P0001 error
--   SELECT publish_event('<draft>');                          -- should succeed
-- ============================================================================
