import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EventService } from '@/lib/services/event/EventService';
import { createClient } from '@/lib/supabase/server';
import { validateOrganizer } from '@/lib/auth/organizer-guard';
import { createEventValidator } from '@/lib/validators/EventValidator';

// Domain 2 lock: single canonical validator imported from EventValidator.ts.
// No inline createEventSchema here anymore (removed as duplicate).

/**
 * GET /api/organizer/events
 * Fetch all events for the authenticated organizer
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !user) {
      return NextResponse.json({ success: false, error: 'AUTH_FAILED', message: 'Authentication required' }, { status: 401 });
    }

    const organizerValidation = await validateOrganizer(user.id);
    if (organizerValidation.status !== 200) {
      return NextResponse.json({
        success: false,
        error: organizerValidation.error ?? 'FORBIDDEN',
        message: organizerValidation.message,
      }, { status: organizerValidation.status ?? 403 });
    }

    // Resolve role so we can scope the query. Organizers see ONLY their own
    // events (unchanged behaviour). Super Admins see ALL published events
    // across every organizer, enriched with organizer details.
    const validatedRole = (organizerValidation.user as { role?: string } | null)?.role;
    const { data: roleProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const role = validatedRole ?? roleProfile?.role ?? 'organizer';
    const isSuperAdmin = role === 'super_admin' || role === 'admin';

    if (isSuperAdmin) {
      return await fetchAllPublishedEventsWithOrganizers(supabase);
    }

    // Fetch events for this organizer
    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json({ success: false, error: 'FETCH_ERROR', message: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: events }, { status: 200 });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * Fetch ALL published events across every organizer, enriched with organizer
 * details (name, email, club/organization). Used exclusively for Super Admin.
 */
async function fetchAllPublishedEventsWithOrganizers(supabase: any) {
  const { data: events, error: fetchError } = await supabase
    .from('events')
    .select('*, profiles!events_organizer_id_fk(full_name, email)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (fetchError) {
    return NextResponse.json({ success: false, error: 'FETCH_ERROR', message: fetchError.message }, { status: 500 });
  }

  // Enrich with club/organization name from organizer_profiles (keyed by user_id).
  const organizerIds = Array.from(new Set((events ?? []).map((e: any) => e.organizer_id).filter(Boolean)));
  const clubByUserId: Record<string, string | null> = {};

  if (organizerIds.length > 0) {
    const { data: orgProfiles } = await supabase
      .from('organizer_profiles')
      .select('user_id, club_name')
      .in('user_id', organizerIds);

    for (const op of orgProfiles ?? []) {
      clubByUserId[op.user_id] = op.club_name ?? null;
    }
  }

  const enriched = (events ?? []).map((evt: any) => {
    const profile = Array.isArray(evt.profiles) ? evt.profiles[0] : evt.profiles;
    const organizerEmail = profile?.email ?? null;
    const organizerName = profile?.full_name && String(profile.full_name).trim().length > 0
      ? String(profile.full_name)
      : organizerEmail;
    const clubName = clubByUserId[evt.organizer_id] ?? null;

    const { profiles, ...rest } = evt;
    return {
      ...rest,
      organizer_name: organizerName,
      organizer_email: organizerEmail,
      organizer_club: clubName,
    };
  });

  return NextResponse.json({ success: true, data: enriched }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !user) {
      return NextResponse.json({ success: false, error: 'AUTH_FAILED', message: 'Authentication required' }, { status: 401 });
    }

    const organizerValidation = await validateOrganizer(user.id);
    if (organizerValidation.status !== 200) {
      return NextResponse.json({
        success: false,
        error: organizerValidation.error ?? 'FORBIDDEN',
        message: organizerValidation.message,
      }, { status: organizerValidation.status ?? 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON' }, { status: 400 });
    }

    // Separate transport-only flag before validation.
    const rawBody = body as Record<string, unknown>;
    const publishRequested = rawBody.publish === true;
    delete rawBody.publish;

    const validationResult = createEventValidator.safeParse(rawBody);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid event data',
        details: validationResult.error.issues,
      }, { status: 400 });
    }

    const validatedData = validationResult.data;
    const eventService = new EventService(supabase);

    // Events are always created in draft; publishEvent RPC will determine
    // automatically whether the event is published immediately or submitted
    // for Super Admin approval based on registration configuration.
    const initialStatus = 'draft';

    const eventData: any = {
      organizer_id: user.id,
      title: validatedData.title,
      slug: validatedData.slug,
      description: validatedData.description,
      short_description: validatedData.short_description ?? null,
      venue: validatedData.venue,
      venue_address: validatedData.venue_address ?? null,
      starts_at: validatedData.starts_at,
      ends_at: validatedData.ends_at,
      registration_opens_at: validatedData.registration_opens_at ?? null,
      registration_closes_at: validatedData.registration_closes_at ?? null,
      category_id: validatedData.category_id,
      is_free: validatedData.is_free,
      registration_required: validatedData.registration_required ?? true,
      registration_type: validatedData.registration_type ?? 'free',
      registration_platform: validatedData.registration_platform ?? 'lpu_events',
      registration_mode: validatedData.registration_mode,
      team_min_size: validatedData.team_min_size ?? null,
      team_max_size: validatedData.team_max_size ?? null,
      team_pricing: validatedData.team_pricing ?? null,
      max_tickets: validatedData.max_tickets ?? null,
      terms_and_conditions: validatedData.terms_and_conditions ?? null,
      contact_email: validatedData.contact_email ?? null,
      contact_phone: validatedData.contact_phone ?? null,
      is_featured: validatedData.is_featured ?? false,
      is_hidden: validatedData.is_hidden ?? false,
      status: initialStatus,
    };

    const createResult = await eventService.createEvent({
      ...eventData,
      ticket_tiers: validatedData.ticket_tiers,
    });

    if (!createResult.success) {
      return NextResponse.json({ success: false, error: 'CREATE_FAILED', message: createResult.error }, { status: 500 });
    }

    const createdEvent = createResult.data!;

    // If publish was requested, go through the canonical RPC path only.
    if (publishRequested) {
      const publishResult = await eventService.publishEvent(createdEvent.id, user.id);
      if (!publishResult.success) {
        return NextResponse.json({
          success: false,
          error: 'PUBLISH_FAILED',
          message: publishResult.error,
          data: { event_id: createdEvent.id },
        }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: publishResult.data, message: 'Event created and published successfully' }, { status: 201 });
    }

    return NextResponse.json({ success: true, data: createdEvent, message: 'Event created successfully' }, { status: 201 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to create event',
    }, { status: 500 });
  }
}
