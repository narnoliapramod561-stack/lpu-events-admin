import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { adminApiGuard } from '@/lib/auth/admin-api-guard';
import { createClient } from '@/lib/supabase/server';

const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    search: z.string().optional(),
});

export async function GET(request: NextRequest) {
    try {
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
                    message: 'Access denied. Only Super Admin can view organizer requests.',
                },
                { status: 403 }
            );
        }

        const supabase = await createClient();

        // Parse and validate query parameters
        const { searchParams } = new URL(request.url);
        const statusParam = searchParams.get('status');
        const searchParam = searchParams.get('search');

        const parseResult = querySchema.safeParse({
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '20',
            status: (statusParam === 'all' || !statusParam) ? undefined : statusParam,
            search: !searchParam ? undefined : searchParam,
        });

        if (!parseResult.success) {
            return NextResponse.json(
                {
                    error: 'VALIDATION_ERROR',
                    message: 'Invalid query parameters',
                    details: parseResult.error.issues,
                },
                { status: 400 }
            );
        }

        const { page, limit, status, search } = parseResult.data;
        const offset = (page - 1) * limit;

        // Build query
        let query = supabase
            .from('organizer_applications')
            .select(
                `
        id,
        user_id,
        organization_name,
        description,
        supporting_documents,
        status,
        reviewed_by,
        review_notes,
        reviewed_at,
        created_at,
        updated_at,
        profiles:user_id (
          id,
          email,
          full_name,
          registration_number
        )
      `,
                { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (status) {
            query = query.eq('status', status);
        }

        if (search) {
            query = query.or(
                `organization_name.ilike.%${search}%,description.ilike.%${search}%`
            );
        }

        const { data: applications, error: queryError, count } = await query;

        if (queryError) {
            console.error('Database query error:', queryError);
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to fetch organizer applications',
                    details: process.env.NODE_ENV === 'development' ? {
                        code: queryError.code,
                        message: queryError.message,
                        details: queryError.details,
                        hint: queryError.hint,
                    } : undefined,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                data: applications,
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limit),
                },
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