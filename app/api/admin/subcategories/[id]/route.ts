import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateSuperAdmin } from '@/lib/auth/admin-guard';
import { createClient } from '@/lib/supabase/server';

const updateSubcategorySchema = z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
    description: z.string().optional(),
    display_order: z.number().int().nonnegative().optional(),
    is_active: z.boolean().optional(),
});

/**
 * GET /api/admin/subcategories/:id
 * Get a single subcategory by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        // Fetch the subcategory
        const { data: subcategory, error: queryError } = await supabase
            .from('subcategories')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .single();

        if (queryError || !subcategory) {
            return NextResponse.json(
                {
                    error: 'NOT_FOUND',
                    message: 'Subcategory not found',
                },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: subcategory }, { status: 200 });
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
 * PATCH /api/admin/subcategories/:id
 * Update a subcategory
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
        const validation = updateSubcategorySchema.safeParse(body);
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

        const updateData = validation.data;

        // Check if subcategory exists
        const { data: existing, error: fetchError } = await supabase
            .from('subcategories')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json(
                {
                    error: 'NOT_FOUND',
                    message: 'Subcategory not found',
                },
                { status: 404 }
            );
        }

        // Check for slug uniqueness if slug is being updated
        if (updateData.slug && updateData.slug !== existing.slug) {
            const { data: duplicate } = await supabase
                .from('subcategories')
                .select('id')
                .eq('category_id', existing.category_id)
                .eq('slug', updateData.slug)
                .is('deleted_at', null)
                .neq('id', id)
                .single();

            if (duplicate) {
                return NextResponse.json(
                    {
                        error: 'CONFLICT',
                        message: 'A subcategory with this slug already exists in this category',
                    },
                    { status: 409 }
                );
            }
        }

        // Update the subcategory
        const { data: updated, error: updateError } = await supabase
            .from('subcategories')
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to update subcategory',
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                data: updated,
                message: 'Subcategory updated successfully',
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
 * DELETE /api/admin/subcategories/:id
 * Soft delete a subcategory
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        // Check if subcategory exists
        const { data: existing, error: fetchError } = await supabase
            .from('subcategories')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json(
                {
                    error: 'NOT_FOUND',
                    message: 'Subcategory not found',
                },
                { status: 404 }
            );
        }

        // Check if there are events using this subcategory
        const { count: eventCount } = await supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('subcategory_id', id)
            .is('deleted_at', null);

        if (eventCount && eventCount > 0) {
            return NextResponse.json(
                {
                    error: 'CONFLICT',
                    message: `Cannot delete subcategory. ${eventCount} event(s) are using this subcategory.`,
                },
                { status: 409 }
            );
        }

        // Soft delete the subcategory
        const { error: deleteError } = await supabase
            .from('subcategories')
            .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (deleteError) {
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to delete subcategory',
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { message: 'Subcategory deleted successfully' },
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
