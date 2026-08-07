import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';

import { validateSuperAdmin } from '@/lib/auth/admin-guard';
import { createClient } from '@/lib/supabase/server';

const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    action: z.string().optional(),
    actor_id: z.string().uuid().optional(),
    resource_type: z.string().optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
    try {
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

        // Parse and validate query parameters
        const { searchParams } = new URL(request.url);
        const actionParam = searchParams.get('action');
        const actorIdParam = searchParams.get('actor_id');
        const resourceTypeParam = searchParams.get('resource_type');
        const fromDateParam = searchParams.get('from_date');
        const toDateParam = searchParams.get('to_date');

        const parseResult = querySchema.safeParse({
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '50',
            action: !actionParam ? undefined : actionParam,
            actor_id: !actorIdParam ? undefined : actorIdParam,
            resource_type: !resourceTypeParam ? undefined : resourceTypeParam,
            from_date: !fromDateParam ? undefined : fromDateParam,
            to_date: !toDateParam ? undefined : toDateParam,
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

        const { page, limit, action, actor_id, resource_type, from_date, to_date } =
            parseResult.data;
        const offset = (page - 1) * limit;

        // Build query with actor profile information
        let query = supabase
            .from('audit_log')
            .select(
                `
        id,
        actor_id,
        actor_role,
        action,
        resource_type,
        resource_id,
        before_state,
        after_state,
        ip_address,
        user_agent,
        created_at,
        profiles:actor_id (
          id,
          email,
          full_name,
          role
        )
      `,
                { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (action) {
            query = query.eq('action', action);
        }

        if (actor_id) {
            query = query.eq('actor_id', actor_id);
        }

        if (resource_type) {
            query = query.eq('resource_type', resource_type);
        }

        if (from_date) {
            query = query.gte('created_at', from_date);
        }

        if (to_date) {
            query = query.lte('created_at', to_date);
        }

        const { data: auditLogs, error: queryError, count } = await query;

        if (queryError) {
            Sentry.captureException(queryError);
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to fetch audit logs',
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                data: auditLogs,
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
        Sentry.captureException(error);
        return NextResponse.json(
            {
                error: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
            },
            { status: 500 }
        );
    }
}