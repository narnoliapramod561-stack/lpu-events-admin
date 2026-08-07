import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateSuperAdmin } from '@/lib/auth/admin-guard';
import { validateOrganizer } from '@/lib/auth/organizer-guard';
import { createClient } from '@/lib/supabase/server';

const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    active: z.coerce.boolean().optional(),
    search: z.string().optional(),
});

const createCategorySchema = z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    description: z.string().optional(),
    icon_url: z.string().url().optional(),
    display_order: z.number().int().nonnegative().default(0),
    is_active: z.boolean().default(true),
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

        // Validate Organizer/Admin/Super Admin role
        const authResult = await validateOrganizer(user.id);
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
        const activeParam = searchParams.get('active');
        const searchParam = searchParams.get('search');

        const parseResult = querySchema.safeParse({
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '20',
            active: (activeParam === null || activeParam === '') ? undefined : activeParam,
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

        const { page, limit, active, search } = parseResult.data;
        const offset = (page - 1) * limit;

        // Build query with event counts
        let query = supabase
            .from('categories')
            .select(
                `
        id,
        name,
        slug,
        description,
        icon_url,
        display_order,
        is_active,
        created_at,
        updated_at,
        events:events(count)
      `,
                { count: 'exact' }
            )
            .is('deleted_at', null)
            .order('display_order', { ascending: true })
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (active !== undefined) {
            query = query.eq('is_active', active);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }

        const { data: categories, error: queryError, count } = await query;

        if (queryError) {
            // Query error handled
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to fetch categories',
                },
                { status: 500 }
            );
        }

        // Transform data to include event count
        const transformedData = categories?.map((cat) => ({
            ...cat,
            event_count: cat.events?.[0]?.count || 0,
            events: undefined,
        }));

        return NextResponse.json(
            {
                data: transformedData,
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

export async function POST(request: NextRequest) {
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

        // Parse and validate request body
        const body = await request.json();
        const parseResult = createCategorySchema.safeParse(body);

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

        const categoryData = parseResult.data;

        // Check for duplicate name or slug
        const { data: existingCategory } = await supabase
            .from('categories')
            .select('id, name, slug')
            .is('deleted_at', null)
            .or(`name.eq.${categoryData.name},slug.eq.${categoryData.slug}`)
            .limit(1)
            .single();

        if (existingCategory) {
            return NextResponse.json(
                {
                    error: 'DUPLICATE_ERROR',
                    message:
                        existingCategory.name === categoryData.name
                            ? 'Category name already exists'
                            : 'Category slug already exists',
                },
                { status: 409 }
            );
        }

        // Insert category
        const { data: newCategory, error: insertError } = await supabase
            .from('categories')
            .insert(categoryData)
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to create category',
                    details: insertError.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: 'Category created successfully',
                data: newCategory,
            },
            { status: 201 }
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