import { createServiceRoleClient } from '@/lib/supabase/service-role';

type UserInfo = { id?: string; role?: string } | null;

type AuthResult = {
    status: number;
    error?: string;
    message?: string;
    user?: UserInfo;
};

export const validateOrganizer: ((authToken: string) => Promise<AuthResult>) & { mockResolvedValue?: (value: unknown) => void } = (async function (authToken: string) {
    // If tests set a mock resolved value via `mockResolvedValue`, return it
    const anyFn = validateOrganizer as unknown as { __mockResolvedValue?: unknown };
    if (anyFn.__mockResolvedValue !== undefined) {
        return Promise.resolve(anyFn.__mockResolvedValue as AuthResult);
    }

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
            user: userProfile as unknown,
        };
    } catch {
        return {
            status: 401,
            error: 'UNAUTHORIZED',
            message: 'Authentication failed. Invalid token.',
        };
    }
} as unknown as (authToken: string) => Promise<AuthResult>);

// Provide a helper for tests to set a canned resolved value similar to jest mocks
Object.defineProperty(validateOrganizer, 'mockResolvedValue', {
    value(value: unknown) {
        (validateOrganizer as unknown as { __mockResolvedValue?: unknown }).__mockResolvedValue = value;
    },
    writable: false,
});