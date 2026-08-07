import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateSuperAdmin } from '@/lib/auth/admin-guard';
import { validateOrganizer } from '@/lib/auth/organizer-guard';
import { createClient } from '@/lib/supabase/server';

const createSubcategorySchema = z.object({
    category_id: z.string().uuid(),
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    description: z.string().optional(),
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

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get('category_id');
        const search = searchParams.get('search');

        let query = supabase
            .from('subcategories')
            .select(`
                id,
                name,
                slug,
                category_id,
                categories(name)
            `)
            .eq('is_active', true)
            .is('deleted_at', null)
            .order('display_order', { ascending: true });

        // Filter by category if provided
        if (categoryId) {
            query = query.eq('category_id', categoryId);
        }

        // Search by subcategory name
        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const { data: subcategories, error: queryError } = await query;

        if (queryError) {
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to fetch subcategories',
                },
                { status: 500 }
            );
        }

        const transformedData = subcategories?.map((sub: any) => {
            let catName = '';
            if (sub.categories) {
                if (Array.isArray(sub.categories)) {
                    catName = sub.categories[0]?.name || '';
                } else {
                    catName = sub.categories.name || '';
                }
            }
            return {
                id: sub.id,
                name: sub.name,
                slug: sub.slug,
                category_id: sub.category_id,
                category_name: catName,
            };
        });

        return NextResponse.json(
            {
                data: transformedData,
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

/**
 * POST /api/admin/subcategories
 * Create a new subcategory
 */
export async function POST(request: NextRequest) {
    try {
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

        const body = await request.json();

        // Validate request body
        const validation = createSubcategorySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    error: 'VALIDATION_ERROR',
                    message: 'Invalid request data',
                    details: validation.error.issues,
                },
                { status: 400 }
            );
        }

        const newSubcategory = validation.data;

        // Check if category exists
        const { data: category, error: catError } = await supabase
            .from('categories')
            .select('id')
            .eq('id', newSubcategory.category_id)
            .is('deleted_at', null)
            .single();

        if (catError || !category) {
            return NextResponse.json(
                {
                    error: 'NOT_FOUND',
                    message: 'Category not found',
                },
                { status: 404 }
            );
        }

        // Check for slug uniqueness within the category
        const { data: existing } = await supabase
            .from('subcategories')
            .select('id')
            .eq('category_id', newSubcategory.category_id)
            .eq('slug', newSubcategory.slug)
            .is('deleted_at', null)
            .single();

        if (existing) {
            return NextResponse.json(
                {
                    error: 'CONFLICT',
                    message: 'A subcategory with this slug already exists in this category',
                },
                { status: 409 }
            );
        }

        // Insert the new subcategory
        const { data: inserted, error: insertError } = await supabase
            .from('subcategories')
            .insert({
                ...newSubcategory,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (insertError) {
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to create subcategory',
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                data: inserted,
                message: 'Subcategory created successfully',
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
