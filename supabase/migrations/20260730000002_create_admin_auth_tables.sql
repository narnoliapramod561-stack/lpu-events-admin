-- Migration: 20260730000002_create_admin_auth_tables.sql
-- Description: Create dedicated tables for admin website authentication and authorization
--              Separates admin authorization from student authorization completely
--
-- NOTE: Migration 20260730000001 already created admin_users, admin_access_requests,
-- and audit_logs with IF NOT EXISTS guards.  This migration adds any *missing* objects
-- only — it is written to be fully idempotent so it can be safely re-applied.

-- ============================================================
-- STEP 1: admin_users table (created by 20260730000001 – skip if exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('organizer', 'admin', 'super_admin')),
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'disabled')),
    is_active BOOLEAN DEFAULT true,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by UUID,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints (add only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_user_id_unique' AND conrelid = 'public.admin_users'::regclass
  ) THEN
    ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_user_id_unique UNIQUE (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_approved_by_fkey' AND conrelid = 'public.admin_users'::regclass
  ) THEN
    ALTER TABLE public.admin_users
        ADD CONSTRAINT admin_users_approved_by_fkey
        FOREIGN KEY (approved_by) REFERENCES public.admin_users(user_id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users (email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users (role);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON public.admin_users (status);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON public.admin_users (is_active);

-- ============================================================
-- STEP 2: admin_access_requests table (created by 20260730000001 – skip if exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    organisation TEXT,
    custom_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.admin_users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_user_id ON public.admin_access_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_email ON public.admin_access_requests (email);
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_status ON public.admin_access_requests (status);
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_requested_at ON public.admin_access_requests (requested_at);

-- ============================================================
-- STEP 3: audit_logs table (created by 20260730000001 – skip if exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    admin_user_id UUID REFERENCES public.admin_users(user_id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON public.audit_logs (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at);

-- ============================================================
-- STEP 4: Enable Row Level Security (idempotent)
-- ============================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: RLS Policies for admin_users
-- ============================================================
DROP POLICY IF EXISTS admin_users_select_own ON public.admin_users;
CREATE POLICY admin_users_select_own ON public.admin_users
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_users_modify_admin ON public.admin_users;
CREATE POLICY admin_users_modify_admin ON public.admin_users
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid() 
            AND au.role IN ('super_admin')
            AND au.status = 'approved'
            AND au.is_active = true
        )
        OR auth.role() = 'service_role'
    );

-- ============================================================
-- STEP 6: RLS Policies for admin_access_requests
-- ============================================================
DROP POLICY IF EXISTS admin_access_requests_select_own ON public.admin_access_requests;
CREATE POLICY admin_access_requests_select_own ON public.admin_access_requests
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_access_requests_insert_own ON public.admin_access_requests;
CREATE POLICY admin_access_requests_insert_own ON public.admin_access_requests
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_access_requests_modify_admin ON public.admin_access_requests;
CREATE POLICY admin_access_requests_modify_admin ON public.admin_access_requests
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid() 
            AND au.role IN ('super_admin')
            AND au.status = 'approved'
            AND au.is_active = true
        )
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS admin_access_requests_delete_admin ON public.admin_access_requests;
CREATE POLICY admin_access_requests_delete_admin ON public.admin_access_requests
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid() 
            AND au.role IN ('super_admin')
            AND au.status = 'approved'
            AND au.is_active = true
        )
        OR auth.role() = 'service_role'
    );

-- ============================================================
-- STEP 7: RLS Policies for audit_logs
-- ============================================================
DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid() 
            AND au.role IN ('super_admin')
            AND au.status = 'approved'
            AND au.is_active = true
        )
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS audit_logs_insert_service ON public.audit_logs;
CREATE POLICY audit_logs_insert_service ON public.audit_logs
    FOR INSERT TO service_role
    WITH CHECK (true);

-- ============================================================
-- STEP 8: updated_at trigger (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER update_admin_users_updated_at 
    BEFORE UPDATE ON public.admin_users 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_access_requests_updated_at ON public.admin_access_requests;
CREATE TRIGGER update_admin_access_requests_updated_at 
    BEFORE UPDATE ON public.admin_access_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- STEP 9: log_admin_action helper function (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_user_id UUID,
    p_admin_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        admin_user_id,
        action,
        resource_type,
        resource_id,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        p_user_id,
        p_admin_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_ip_address,
        p_user_agent,
        p_metadata
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;