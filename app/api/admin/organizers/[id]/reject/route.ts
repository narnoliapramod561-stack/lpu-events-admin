import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { adminApiGuard } from '@/lib/auth/admin-api-guard';
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
        
        // Use admin API guard for authentication and authorization
        const guardResult = await adminApiGuard(request);
        if (guardResult.error) {
            return guardResult.response;
        }

        // Check if user is Super Admin
        if (!guardResult.isSuperAdmin) {
            return NextResponse.json(
                {
                    error: 'FORBIDDEN',
                    message: 'Access denied. Only Super Admin can reject organizer requests.',
                },
                { status: 403 }
            );
        }

        const supabase = await createClient();

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
                p_admin_id: guardResult.user.id,
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