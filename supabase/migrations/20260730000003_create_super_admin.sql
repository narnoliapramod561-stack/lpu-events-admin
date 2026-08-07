-- Migration: 20260730000003_create_super_admin.sql
-- Description: Create the initial super admin user for the admin website
--              This user will have immediate access without approval

-- Find the user with the specified email and create an admin_users record for them
DO $$
DECLARE
    v_user_id UUID;
    v_admin_user_id UUID;
BEGIN
    -- Find the user with the super admin email
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'subhamkumar16072006@gmail.com';
    
    -- If the user exists, create an admin_users record for them
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.admin_users (
            user_id,
            email,
            full_name,
            role,
            status,
            is_active,
            approved_at,
            approved_by
        )
        VALUES (
            v_user_id,
            'subhamkumar16072006@gmail.com',
            'Subham Kumar',
            'super_admin',
            'approved',
            true,
            NOW(),
            NULL  -- Self-approved as the initial super admin
        )
        ON CONFLICT (user_id) DO NOTHING;
        
        RAISE NOTICE 'Super admin user created for subhamkumar16072006@gmail.com';
    ELSE
        RAISE NOTICE 'User with email subhamkumar16072006@gmail.com not found in auth.users';
        RAISE NOTICE 'Please ensure this user exists before running this migration';
    END IF;
END $$;