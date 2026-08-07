-- Migration: Add automatic paid event approval workflow
-- This implements the automatic approval logic for paid events using LPU Events registration

-- 1. Add new columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS registration_required boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS registration_type text CHECK (registration_type IN ('free', 'paid')),
ADD COLUMN IF NOT EXISTS registration_platform text CHECK (registration_platform IN ('lpu_events', 'external_link')),
ADD COLUMN IF NOT EXISTS approval_status text CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS submitted_for_approval_at timestamptz,
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2. Update existing events to have default values
UPDATE public.events 
SET 
    registration_required = CASE 
        WHEN is_free = true THEN false 
        ELSE true 
    END,
    registration_type = CASE 
        WHEN is_free = true THEN 'free' 
        ELSE 'paid' 
    END,
    registration_platform = 'lpu_events',
    approval_status = CASE 
        WHEN status = 'published' THEN 'approved'
        WHEN status = 'pending_approval' THEN 'pending'
        ELSE 'pending'
    END
WHERE registration_required IS NULL;

-- 3. Create function to determine if approval is required
CREATE OR REPLACE FUNCTION public.requires_super_admin_approval(
    p_registration_required boolean,
    p_registration_type text,
    p_registration_platform text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Business rule: Only paid events using LPU Events registration require approval
    RETURN p_registration_required 
        AND p_registration_platform = 'lpu_events' 
        AND p_registration_type = 'paid';
END;
$$;