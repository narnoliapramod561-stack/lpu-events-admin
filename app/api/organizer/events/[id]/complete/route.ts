import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/services/event/EventService';
import { validateOrganizer } from '@/lib/auth/organizer-guard';

/**
 * POST /api/organizer/events/[id]/complete
 *
 * CANONICAL complete endpoint.
 * Delegates to EventService.completeEvent → complete_event RPC which:
 *   1. Validates caller is the event organizer or super_admin
 *   2. Validates current status is 'published' or 'ongoing'
 *   3. Transitions status → 'completed'
 *   4. Writes event.completed outbox event
 *
 * The organizer NEVER sends the status — it is computed server-side.
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await context.params;
        const supabase = await createClient();
        const { data: { user }, error: sessionError } = await supabase.auth.getUser();

        if (sessionError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const organizerValidation = await validateOrganizer(user.id);
        if (organizerValidation.status !== 200) {
            return NextResponse.json(
                { error: organizerValidation.message },
                { status: organizerValidation.status }
            );
        }

        const service = new EventService(supabase);
        const result = await service.completeEvent(eventId, user.id);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        const data = result.data as any;
        if (data && data.error) {
            return NextResponse.json(
                { message: data.message || data.error },
                { status: 400 }
            );
        }

        return NextResponse.json(data, { status: 200 });
    } catch (error) {
        console.error('Error completing event:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred while completing the event' },
            { status: 500 }
        );
    }
}
