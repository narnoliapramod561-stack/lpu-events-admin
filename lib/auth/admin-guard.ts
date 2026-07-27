import { createServiceRoleClient } from '../supabase/service-role';

export async function validateSuperAdmin(authToken: string) {
    const supabase = createServiceRoleClient();

    const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', authToken)
        .single();

    if (error) {
        return {
            status: 401,
            error: 'UNAUTHORIZED',
            message: 'Authentication failed. User profile not found.',
        };
    }

    if (userProfile.role !== 'super_admin' && userProfile.role !== 'admin') {
        return {
            status: 403,
            error: 'FORBIDDEN',
            message: 'Access denied. Only Super Admins and Admins are allowed here.',
        };
    }

    return {
        status: 200,
        message: 'Authorized',
        user: userProfile,
    };
}