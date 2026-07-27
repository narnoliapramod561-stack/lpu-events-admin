import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateSuperAdmin } from '@/lib/auth/admin-guard';
import { createClient } from '@/lib/supabase/server';

const rejectSchema = z.object({
    notes: z.string().min(1, 'Rejection reason is required'),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        // Get user session
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                {
                    error: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
                { status: 401 }
            );
        }

        // Validate Super Admin role
        const authResult = await validateSuperAdmin(user.id);
        if (authResult.status !== 200) {
            return NextResponse.json(
                {
                    error: authResult.error,
                    message: authResult.message,
                },
                { status: authResult.status }
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const parseResult = rejectSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                {
                    error: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: parseResult.error.issues,
                },
                { status: 400 }
            );
        }

        const { notes } = parseResult.data;
        const applicationId = id;

        // Call the reject_organizer RPC
        const { data: result, error: rpcError } = await supabase.rpc(
            'reject_organizer',
            {
                p_application_id: applicationId,
                p_admin_id: user.id,
                p_notes: notes,
            }
        );

        if (rpcError) {
            console.error('RPC error:', rpcError);
            return NextResponse.json(
                {
                    error: 'RPC_ERROR',
                    message: 'Failed to reject organizer application',
                    details: rpcError.message,
                },
                { status: 500 }
            );
        }

        // Check if RPC returned an error
        if (result && result.error) {
            const statusMap: Record<string, number> = {
                UNAUTHORIZED: 403,
                APPLICATION_NOT_FOUND: 404,
                INVALID_STATUS: 400,
                INTERNAL_ERROR: 500,
            };

            return NextResponse.json(result, {
                status: statusMap[result.error] || 400,
            });
        }

        return NextResponse.json(
            {
                success: true,
                message: 'Organizer application rejected successfully',
                data: result,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            {
                error: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
            },
            { status: 500 }
        );
    }
}