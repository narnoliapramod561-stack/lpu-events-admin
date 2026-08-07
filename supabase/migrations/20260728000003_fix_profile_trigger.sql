-- Migration: 20260728000003_fix_profile_trigger.sql
-- Description: Fix profile creation trigger to use email prefix as fallback name
-- Fix for: profiles_full_name_length constraint violation during OTP signup
-- Related Issue: "new row for relation \"profiles\" violates check constraint \"profiles_full_name_length\""

-- 1. Drop the existing trigger first (it depends on the function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 1b. Drop the existing trigger function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Recreate the function with corrected fallback using email prefix
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    'student',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Re-create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
