import { NextRequest, NextResponse } from 'next/server';
import { validateOrganizer } from '@/lib/auth/organizer-guard';
import { createClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/services/event/EventService';
import { canEditEvent, isValidTransition, EventState, UserRole } from '@/lib/domain/lifecycle-engine';
import { updateEventDraftValidator } from '@/lib/validators/EventValidator';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        const role = profile?.role || 'student';

        const { data: event, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .single();

        if (error || !event) {
            return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
        }

        const isOwner = event.organizer_id === user.id;
        const isAdmin = role === 'super_admin' || role === 'admin';

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
        }

        return NextResponse.json(event, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        }

        const { data: event, error: fetchError } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .single();

        if (fetchError || !event) {
            return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        const role = profile?.role || 'student';
        const isOwner = event.organizer_id === user.id;
        const isAdmin = role === 'super_admin' || role === 'admin';

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'FORBIDDEN', message: 'You do not have permission to edit this event' }, { status: 403 });
        }

        const updates = await request.json();
        const parseResult = updateEventDraftValidator.safeParse(updates);
        if (!parseResult.success) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', details: parseResult.error.issues }, { status: 400 });
        }

        const data = parseResult.data;

        // Type assertions for event status and role
        const eventStatus = event.status as EventState | null;
        const userRole = role as UserRole | null;

        if (data.status && eventStatus && !isValidTransition(eventStatus, data.status as EventState)) {
            return NextResponse.json({
                error: 'INVALID_TRANSITION',
                message: `Cannot transition event from ${event.status} to ${data.status}`
            }, { status: 400 });
        }

        if (!canEditEvent(eventStatus || 'draft', userRole || 'student') && !isAdmin) {
            return NextResponse.json({ error: 'FORBIDDEN', message: 'Cannot edit event in current state' }, { status: 403 });
        }

        const mappedUpdates: Record<string, unknown> = {};
        if (data.title !== undefined) mappedUpdates.title = data.title;
        if (data.description !== undefined) mappedUpdates.description = data.description;
        if (data.slug !== undefined) mappedUpdates.slug = data.slug;
        if (data.venue !== undefined) mappedUpdates.venue = data.venue;
        if (data.venue_address !== undefined) mappedUpdates.venue_address = data.venue_address;
        if (data.starts_at !== undefined) mappedUpdates.starts_at = data.starts_at;
        if (data.ends_at !== undefined) mappedUpdates.ends_at = data.ends_at;
        if (data.category_id !== undefined) mappedUpdates.category_id = data.category_id;
        if (data.short_description !== undefined) mappedUpdates.short_description = data.short_description;
        if (data.cover_image_url !== undefined) mappedUpdates.cover_image_url = data.cover_image_url;
        if (data.is_free !== undefined) mappedUpdates.is_free = data.is_free;
        if (data.registration_mode !== undefined) mappedUpdates.registration_mode = data.registration_mode;
        if (data.is_featured !== undefined) mappedUpdates.is_featured = data.is_featured;
        if (data.is_hidden !== undefined) mappedUpdates.is_hidden = data.is_hidden;
        if (data.team_min_size !== undefined) mappedUpdates.team_min_size = data.team_min_size;
        if (data.team_max_size !== undefined) mappedUpdates.team_max_size = data.team_max_size;
        if (data.team_pricing !== undefined) mappedUpdates.team_pricing = data.team_pricing;
        if (data.max_tickets !== undefined) mappedUpdates.max_tickets = data.max_tickets;
        if (data.terms_and_conditions !== undefined) mappedUpdates.terms_and_conditions = data.terms_and_conditions;
        if (data.contact_email !== undefined) mappedUpdates.contact_email = data.contact_email;
        if (data.contact_phone !== undefined) mappedUpdates.contact_phone = data.contact_phone;
        if (data.status !== undefined) mappedUpdates.status = data.status;

        if (mappedUpdates.ends_at && mappedUpdates.starts_at && new Date(mappedUpdates.ends_at as string) <= new Date(mappedUpdates.starts_at as string)) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'End date must be later than start date' }, { status: 400 });
        }

        const eventService = new EventService(supabase);
        const result = await eventService.updateEvent(id, mappedUpdates);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json(result.data, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        }

        const authResult = await validateOrganizer(user.id);
        if (authResult.status !== 200) {
            return NextResponse.json({ error: authResult.message }, { status: authResult.status });
        }

        const { data: event, error: fetchError } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .single();

        if (fetchError || !event) {
            return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
        }

        if (event.organizer_id !== user.id) {
            return NextResponse.json({ error: 'FORBIDDEN', message: 'Only the event organizer can delete this event' }, { status: 403 });
        }

        if (event.status !== 'draft') {
            return NextResponse.json({ error: 'FORBIDDEN', message: 'Only draft events can be deleted' }, { status: 403 });
        }

        const eventService = new EventService(supabase);
        const result = await eventService.deleteEvent(id);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
