import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateSuperAdmin } from '@/lib/auth/admin-guard';
import { createClient } from '@/lib/supabase/server';

const updateCategorySchema = z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
    description: z.string().optional(),
    icon_url: z.string().url().optional().nullable(),
    display_order: z.number().int().nonnegative().optional(),
    is_active: z.boolean().optional(),
});

export async function PATCH(
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
        const parseResult = updateCategorySchema.safeParse(body);

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

        const updateData = parseResult.data;
        const categoryId = id;

        // Check if category exists
        const { data: existingCategory, error: fetchError } = await supabase
            .from('categories')
            .select('id, name, slug')
            .eq('id', categoryId)
            .is('deleted_at', null)
            .single();

        if (fetchError || !existingCategory) {
            return NextResponse.json(
                {
                    error: 'NOT_FOUND',
                    message: 'Category not found',
                },
                { status: 404 }
            );
        }

        // Check for duplicate name or slug (excluding current category)
        if (updateData.name || updateData.slug) {
            const orConditions = [];
            if (updateData.name) orConditions.push(`name.eq.${updateData.name}`);
            if (updateData.slug) orConditions.push(`slug.eq.${updateData.slug}`);

            const { data: duplicateCategory } = await supabase
                .from('categories')
                .select('id, name, slug')
                .neq('id', categoryId)
                .is('deleted_at', null)
                .or(orConditions.join(','))
                .limit(1)
                .single();

            if (duplicateCategory) {
                return NextResponse.json(
                    {
                        error: 'DUPLICATE_ERROR',
                        message:
                            duplicateCategory.name === updateData.name
                                ? 'Category name already exists'
                                : 'Category slug already exists',
                    },
                    { status: 409 }
                );
            }
        }

        // Update category
        const { data: updatedCategory, error: updateError } = await supabase
            .from('categories')
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', categoryId)
            .select()
            .single();

        if (updateError) {
            console.error('Update error:', updateError);
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to update category',
                    details: updateError.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: 'Category updated successfully',
                data: updatedCategory,
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

export async function DELETE(
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

        const categoryId = id;

        // Check if category exists
        const { data: existingCategory, error: fetchError } = await supabase
            .from('categories')
            .select('id')
            .eq('id', categoryId)
            .is('deleted_at', null)
            .single();

        if (fetchError || !existingCategory) {
            return NextResponse.json(
                {
                    error: 'NOT_FOUND',
                    message: 'Category not found',
                },
                { status: 404 }
            );
        }

        // Check if category has associated events
        const { count: eventCount } = await supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', categoryId)
            .is('deleted_at', null);

        if (eventCount && eventCount > 0) {
            return NextResponse.json(
                {
                    error: 'CONSTRAINT_ERROR',
                    message: `Cannot delete category with ${eventCount} associated event(s)`,
                },
                { status: 409 }
            );
        }

        // Soft delete category
        const { error: deleteError } = await supabase
            .from('categories')
            .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', categoryId);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return NextResponse.json(
                {
                    error: 'DATABASE_ERROR',
                    message: 'Failed to delete category',
                    details: deleteError.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: 'Category deleted successfully',
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