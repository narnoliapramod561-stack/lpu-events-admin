-- Migration: 20260722000015_fix_handle_new_user_admin_check.sql
-- Description: Update handle_new_user to check admin_whitelist and assign super_admin role
-- Depends on: 20260722000002_auth_user_trigger.sql, 20260722000003_seed_super_admin.sql
-- 
-- PROBLEM: The original handle_new_user() always assigns 'student' role.
--          Migration 003 added admin_whitelist to system_config but didn't update the function.
-- 
-- SOLUTION: Replace handle_new_user() to check admin_whitelist in system_config
--           and assign 'super_admin' role if email is whitelisted.

-- Drop and recreate handle_new_user function with admin whitelist check
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
    v_user_role := 'student';
  END IF;

  -- Insert profile with appropriate role
  INSERT INTO public.profiles (id, email, full_name, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    v_user_role,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger already exists from migration 002, no need to recreate

-- Comment explaining the change
COMMENT ON FUNCTION public.handle_new_user() IS 
'Automatically creates a profile when a new user signs up via auth.users. 
Checks admin_whitelist in system_config to determine if user should be super_admin or student.
Updated in migration 20260722000015 to support admin whitelist checking.';
