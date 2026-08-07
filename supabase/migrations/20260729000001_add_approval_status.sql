-- Migration: 20260729000001_add_approval_status.sql
-- Description: Add approval_status field to profiles table for admin authorization
-- Depends on: 20260722000001_canonical_schema.sql

-- Add approval_status enum type (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Add approval_status column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approval_status public.approval_status NOT NULL DEFAULT 'approved';

-- Set existing organizers/admins/super_admins to approved
UPDATE public.profiles
SET approval_status = 'approved'
WHERE role IN ('organizer', 'admin', 'super_admin');

-- Set existing students to approved (they don't need approval for student access)
UPDATE public.profiles
SET approval_status = 'approved'
WHERE role = 'student';

-- Add index for faster approval status queries
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status
  ON public.profiles (approval_status)
  WHERE deleted_at IS NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.approval_status IS
  'Authorization status for admin/organizer access. Students are always approved. Organizers/admins require approval.';
