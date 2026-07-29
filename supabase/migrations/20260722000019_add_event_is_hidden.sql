-- =============================================================================
-- TASK-XXX: Add is_hidden to events table
-- Migration: 20260722000019_add_event_is_hidden.sql
-- Depends on: 20260722000001_canonical_schema.sql
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS events_is_hidden_idx ON public.events (is_hidden) WHERE is_hidden = TRUE;

-- =============================================================================
-- End of TASK-XXX: Add is_hidden to events table
-- =============================================================================
