-- Migration: 20260730000001_separate_admin_student_auth.sql
-- Description: Separate Admin Website auth from Student Website auth
--              New users get role = 'pending' instead of 'student'
--              Admin authorization is independent of Student authorization
--
-- PROBLEM:
--   - handle_new_user() always assigns 'student' role to new users
--   - This incorrectly assumes every new account is a student
--   - Admin Website and Student Website share Auth but NOT Authorization
--   - A new Admin Website user should be a "pending access request", not a student
--
-- SOLUTION:
--   1. Add 'pending' to user_role enum (represents "no admin permission yet")
--   2. Update handle_new_user() to assign 'pending' instead of 'student'
--   3. Update auth callback to not assume organizer role for new users
--   4. Update middleware and redirect logic accordingly

-- ============================================================
-- STEP 1: Drop existing trigger and function
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================
-- STEP 2: Extend user_role enum to include 'pending'
-- ============================================================

-- Check if 'pending' already exists in the enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending'
      AND enumtypid = 'public.user_role'::regtype
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'pending';
  END IF;
END $$;

-- ============================================================
-- STEP 3: Recreate handle_new_user() with 'pending' role
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_whitelist JSONB;
  v_user_role user_role;
BEGIN
  -- Get admin whitelist from system_config
  SELECT value INTO v_admin_whitelist
  FROM public.system_config
  WHERE key = 'admin_whitelist';

  -- Check if user email is in admin whitelist
  IF v_admin_whitelist IS NOT NULL
     AND v_admin_whitelist ? LOWER(TRIM(NEW.email)) THEN
    v_user_role := 'super_admin';
  ELSE
    -- NEW BEHAVIOR: Default to 'pending' instead of 'student'
    -- This means: authenticated but NOT authorized for Admin Website
    v_user_role := 'pending';
  END IF;

  -- Insert profile with appropriate role
  INSERT INTO public.profiles (id, email, full_name, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    v_user_role,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Automatically creates a profile when a new user signs up via auth.users.
Admin Website behavior:
- If email is in admin_whitelist: role = super_admin (immediate access)
- Otherwise: role = pending (must request and be approved for admin access)
Student Website behavior:
- Any authenticated user can use the Student Website independently
- Student Website does NOT check admin roles or approval_status
Updated in migration 20260730000001 to separate Admin/Student authorization.';

-- ============================================================
-- STEP 4: Re-create the trigger
-- ============================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STEP 5: Update existing profiles from 'student' to 'pending'
-- ============================================================
-- Only update profiles that are truly unauthorized (not approved organizers/admins)
-- This ensures existing users who were auto-assigned 'student' are now 'pending'
-- BUT we preserve existing organizers, admins, and super_admins

UPDATE public.profiles
SET role = 'pending'
WHERE role = 'student'
  AND id NOT IN (
    SELECT user_id
    FROM public.organizer_applications
    WHERE status = 'approved'
  );

-- ============================================================
-- STEP 6: Update RLS policies if needed
-- ============================================================
-- Ensure 'pending' users cannot access admin-only tables
-- (This is handled by checking role != 'pending' in API routes)
