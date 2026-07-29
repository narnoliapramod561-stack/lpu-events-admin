-- =============================================================================
-- TASK-XXX: Add 'admin' role to user_role enum
-- Migration: 20260722000018_add_admin_role.sql
-- Depends on: 20260722000001_canonical_schema.sql
-- =============================================================================

-- Add 'admin' role to user_role enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'admin'
    AND enumtypid = (
      SELECT oid FROM pg_type WHERE typname = 'user_role' AND typnamespace = 'public'::regnamespace
    )
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'admin';
  END IF;
END $$;

-- Ensure system_config has admin_whitelist entries for any admin users
INSERT INTO public.system_config (key, value, description)
VALUES (
  'admin_whitelist',
  '[]',
  'JSON array of email addresses that should receive super_admin role on signup'
)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- End of TASK-XXX: Add 'admin' role to user_role enum
-- =============================================================================
