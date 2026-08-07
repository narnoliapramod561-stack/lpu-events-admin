-- Migration: 20260730000004_create_organizer_profiles.sql
-- Description: Create organizer_profiles table and drop obsolete admin tables

-- 1. Drop existing triggers if they exist
DROP TRIGGER IF EXISTS admin_users_set_updated_at ON public.admin_users;
DROP TRIGGER IF EXISTS admin_access_requests_set_updated_at ON public.admin_access_requests;

-- 2. Drop existing policies if they exist
DROP POLICY IF EXISTS admin_users_select_own ON public.admin_users;
DROP POLICY IF EXISTS admin_users_modify_admin ON public.admin_users;
DROP POLICY IF EXISTS admin_access_requests_select_own ON public.admin_access_requests;
DROP POLICY IF EXISTS admin_access_requests_insert_own ON public.admin_access_requests;
DROP POLICY IF EXISTS admin_access_requests_modify_admin ON public.admin_access_requests;
DROP POLICY IF EXISTS admin_access_requests_delete_admin ON public.admin_access_requests;

-- 3. Drop obsolete tables
DROP TABLE IF EXISTS public.admin_access_requests CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;

-- 4. Create organizer_profiles table (IF NOT EXISTS for idempotency)
CREATE TABLE IF NOT EXISTS public.organizer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    club_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT organizer_profiles_user_id_unique UNIQUE (user_id)
);

-- 5. Create indexes for performance (IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_user_id ON public.organizer_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_status ON public.organizer_profiles (status);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.organizer_profiles ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS Policies (DROP IF EXISTS for idempotency)
DROP POLICY IF EXISTS organizer_profiles_select_own ON public.organizer_profiles;
CREATE POLICY organizer_profiles_select_own ON public.organizer_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS organizer_profiles_insert_own ON public.organizer_profiles;
CREATE POLICY organizer_profiles_insert_own ON public.organizer_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS organizer_profiles_super_admin ON public.organizer_profiles;
CREATE POLICY organizer_profiles_super_admin ON public.organizer_profiles
    FOR ALL TO authenticated
    USING (auth.jwt() ->> 'email' = 'subhamkumar16072006@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'subhamkumar16072006@gmail.com');

-- 8. Create trigger for updated_at (DROP IF EXISTS for idempotency)
DROP TRIGGER IF EXISTS organizer_profiles_set_updated_at ON public.organizer_profiles;
CREATE TRIGGER organizer_profiles_set_updated_at
    BEFORE UPDATE ON public.organizer_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.admin_set_updated_at();
