import { NextRequest, NextResponse } from 'next/server';
import { validateOrganizer } from '@/lib/auth/organizer-guard';
import { createClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/services/event/EventService';
import { z } from 'zod';

const createEventSchema = z.object({
    title: z.string().min(3, 'Title is required').max(300, 'Title must not exceed 300 characters'),
    slug: z.string().min(3, 'Slug is required').max(300, 'Slug must not exceed 300 characters').regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
    description: z.string().min(10, 'Description is required').max(50000, 'Description must not exceed 50000 characters'),
    short_description: z.string().max(500, 'Short description must not exceed 500 characters').optional(),
    venue: z.string().min(1, 'Venue is required').max(500, 'Venue must not exceed 500 characters'),
    venue_address: z.string().optional(),
    starts_at: z.string().datetime('Invalid start date format'),
    ends_at: z.string().datetime('Invalid end date format'),
    category_id: z.string().uuid('Invalid category ID format'),
    registration_opens_at: z.string().datetime().optional(),
    registration_closes_at: z.string().datetime().optional(),
    is_free: z.boolean().default(true),
    registration_mode: z.enum(['individual', 'team']).default('individual'),
    team_min_size: z.number().int().min(2).optional(),
    team_max_size: z.number().int().min(2).optional(),
    team_pricing: z.enum(['fixed', 'per_member']).optional(),
    max_tickets: z.number().int().min(1).max(10000).optional(),
    terms_and_conditions: z.string().optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().optional(),
    cover_image_url: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        }

        const authResult = await validateOrganizer(user.id);
        if (authResult.status !== 200) {
            return NextResponse.json({ error: authResult.error || authResult.message }, { status: authResult.status });
        }

        const body = await request.json();
        const parseResult = createEventSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', details: parseResult.error.issues }, { status: 400 });
        }

        const data = parseResult.data;

        if (new Date(data.ends_at) <= new Date(data.starts_at)) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'End date must be later than start date' }, { status: 400 });
        }

        if (data.registration_opens_at && data.registration_closes_at) {
            if (new Date(data.registration_closes_at) <= new Date(data.registration_opens_at)) {
                return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Registration close time must be later than open time' }, { status: 400 });
            }
        }

        if (data.team_min_size !== undefined && data.team_max_size !== undefined && data.team_max_size < data.team_min_size) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Team maximum size must be greater than or equal to minimum size' }, { status: 400 });
        }

        const eventService = new EventService(supabase);
        const result = await eventService.createEvent({
            title: data.title,
            slug: data.slug,
            description: data.description,
            short_description: data.short_description,
            venue: data.venue,
            venue_address: data.venue_address,
            starts_at: data.starts_at,
            ends_at: data.ends_at,
            category_id: data.category_id,
            registration_opens_at: data.registration_opens_at,
            registration_closes_at: data.registration_closes_at,
            is_free: data.is_free,
            registration_mode: data.registration_mode,
            team_min_size: data.team_min_size,
            team_max_size: data.team_max_size,
            team_pricing: data.team_pricing,
            max_tickets: data.max_tickets,
            terms_and_conditions: data.terms_and_conditions,
            contact_email: data.contact_email,
            contact_phone: data.contact_phone,
            cover_image_url: data.cover_image_url,
            organizer_id: user.id,
            status: 'draft',
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json(result.data, { status: 201 });
    } catch {
        // Organizer events error handled
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        }

        const authResult = await validateOrganizer(user.id);
        if (authResult.status !== 200) {
            return NextResponse.json({ error: authResult.error || authResult.message }, { status: authResult.status });
        }

        const { data: events, error } = await supabase
            .from('events')
            .select('*')
            .eq('organizer_id', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
        }

        return NextResponse.json(events, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
