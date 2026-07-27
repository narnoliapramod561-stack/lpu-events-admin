-- Migration: 20260722000003_seed_super_admin.sql
-- Description: Authorize subhamkumar16072006@gmail.com as Super Admin in system_config whitelist and public.profiles
-- Depends on: 20260722000001_canonical_schema.sql, 20260722000002_auth_user_trigger.sql
--
-- NOTE: system_config table is defined in 20260722000001_canonical_schema.sql.
-- This migration only seeds data into it; no DDL is repeated here.

-- 1. Seed admin_whitelist in system_config with Super Admin email
INSERT INTO public.system_config (key, value, description, updated_at)
VALUES (
  'admin_whitelist',
  '["subhamkumar16072006@gmail.com", "subhamkumar16072006@gmil.com"]',
  'Whitelisted Google accounts authorized for Super Admin login',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

-- 3. Upgrade role to super_admin in public.profiles if user profile exists
UPDATE public.profiles
SET role = 'super_admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE LOWER(TRIM(email)) IN ('subhamkumar16072006@gmail.com', 'subhamkumar16072006@gmil.com')
);
