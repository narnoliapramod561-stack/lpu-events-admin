import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function validateOrganizer(authToken: string) {
    if (!authToken) {
        return {
            status: 401,
            error: 'UNAUTHORIZED',
            message: 'Authentication failed. No token provided.',
        };
    }

    try {
        const supabase = createServiceRoleClient();
        const { data: userProfile, error } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', authToken)
            .single();

        if (error || !userProfile) {
            return {
                status: 401,
                error: 'UNAUTHORIZED',
                message: 'Authentication failed. User profile not found.',
            };
        }

        if (userProfile.role !== 'organizer' && userProfile.role !== 'super_admin' && userProfile.role !== 'admin') {
            return {
                status: 403,
                error: 'FORBIDDEN',
                message: 'Access denied. Only Organizers and Super Admins are allowed here.',
            };
        }

        return {
            status: 200,
            message: 'Authorized',
            user: userProfile,
        };
    } catch (error) {
        return {
            status: 401,
            error: 'UNAUTHORIZED',
            message: 'Authentication failed. Invalid token.',
        };
    }
}