-- =====================================================================
-- Migration: Admin authorization tables
-- Creates admin_users, admin_access_requests, and audit_logs tables
-- required by the admin portal auth flow (callback, verify-otp,
-- middleware, admin-guard, access-request submission).
--
-- The application code (lib/services/admin-auth/admin-authorizer.ts,
-- app/auth/callback/route.ts, app/api/v1/auth/verify-otp/route.ts,
-- app/api/auth/access-request/route.ts, app/middleware.ts) queries these
-- tables, but they were never created in the canonical schema. This
-- migration adds them so organizer-request loading, OTP login and access
-- requests work correctly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_user_role') THEN
    CREATE TYPE public.admin_user_role AS ENUM ('organizer', 'admin', 'super_admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_user_status') THEN
    CREATE TYPE public.admin_user_status AS ENUM ('approved', 'disabled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_access_request_status') THEN
    CREATE TYPE public.admin_access_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- Table: admin_users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  id            UUID          NOT NULL DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL,
  email         TEXT          NOT NULL,
  full_name     TEXT          NULL,
  role          public.admin_user_role   NOT NULL DEFAULT 'organizer',
  status        public.admin_user_status NOT NULL DEFAULT 'approved',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  approved_at   TIMESTAMPTZ   NULL,
  approved_by   UUID          NULL,
  last_login_at TIMESTAMPTZ   NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT admin_users_pkey PRIMARY KEY (id),
  CONSTRAINT admin_users_user_id_unique UNIQUE (user_id),
  CONSTRAINT admin_users_user_id_fk FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT admin_users_approved_by_fk FOREIGN KEY (approved_by)
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS admin_users_user_id_idx ON public.admin_users (user_id);
CREATE INDEX IF NOT EXISTS admin_users_role_idx ON public.admin_users (role);

-- ---------------------------------------------------------------------
-- Table: admin_access_requests
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_access_requests (
  id             UUID          NOT NULL DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL,
  email          TEXT          NOT NULL,
  full_name      TEXT          NULL,
  organisation   TEXT          NOT NULL,
  custom_message TEXT          NULL,
  status         public.admin_access_request_status NOT NULL DEFAULT 'pending',
  requested_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ   NULL,
  reviewed_by    UUID          NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT admin_access_requests_pkey PRIMARY KEY (id),
  CONSTRAINT admin_access_requests_user_id_fk FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT admin_access_requests_reviewed_by_fk FOREIGN KEY (reviewed_by)
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS admin_access_requests_user_id_idx
  ON public.admin_access_requests (user_id);
CREATE INDEX IF NOT EXISTS admin_access_requests_status_idx
  ON public.admin_access_requests (status);

-- Only one pending request per user
CREATE UNIQUE INDEX IF NOT EXISTS admin_access_requests_one_pending_per_user
  ON public.admin_access_requests (user_id)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------
-- Table: audit_logs (used by admin-authorizer + rate-limiter)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID          NOT NULL DEFAULT gen_random_uuid(),
  user_id       UUID          NULL,
  admin_user_id UUID          NULL,
  action        TEXT          NOT NULL,
  resource_type TEXT          NULL,
  resource_id   TEXT          NULL,
  ip_address    TEXT          NULL,
  user_agent    TEXT          NULL,
  metadata      JSONB         NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- ---------------------------------------------------------------------
-- updated_at trigger helper (reuse existing set_updated_at if present)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_users_set_updated_at ON public.admin_users;
CREATE TRIGGER admin_users_set_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.admin_set_updated_at();

DROP TRIGGER IF EXISTS admin_access_requests_set_updated_at ON public.admin_access_requests;
CREATE TRIGGER admin_access_requests_set_updated_at
  BEFORE UPDATE ON public.admin_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.admin_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: these tables are only accessed via the service-role client on the
-- server (createServiceRoleClient) and server-side supabase client. Enable
-- RLS and rely on service role bypass; add a self-read policy for the
-- server client (anon/authenticated) so callback/verify checks work.
-- ---------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own admin_users row (used by
-- server-side auth checks that run as the logged-in user).
DROP POLICY IF EXISTS admin_users_self_read ON public.admin_users;
CREATE POLICY admin_users_self_read ON public.admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can read + insert their own access requests.
DROP POLICY IF EXISTS admin_access_requests_self_read ON public.admin_access_requests;
CREATE POLICY admin_access_requests_self_read ON public.admin_access_requests
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_access_requests_self_insert ON public.admin_access_requests;
CREATE POLICY admin_access_requests_self_insert ON public.admin_access_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Seed: mirror existing privileged profiles into admin_users so current
-- super admins / admins / organizers keep their access after this change.
-- ---------------------------------------------------------------------
INSERT INTO public.admin_users (user_id, email, full_name, role, status, is_active, approved_at)
SELECT
  p.id,
  p.email,
  p.full_name,
  CASE
    WHEN p.role = 'super_admin' THEN 'super_admin'::public.admin_user_role
    WHEN p.role = 'admin' THEN 'admin'::public.admin_user_role
    ELSE 'organizer'::public.admin_user_role
  END,
  'approved'::public.admin_user_status,
  TRUE,
  now()
FROM public.profiles p
WHERE p.role IN ('super_admin', 'admin', 'organizer')
ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role,
      status = 'approved',
      is_active = TRUE,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;
