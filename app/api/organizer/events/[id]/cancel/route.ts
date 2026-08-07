import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/services/event/EventService';
import { validateOrganizer } from '@/lib/auth/organizer-guard';

/**
 * POST /api/organizer/events/[id]/cancel
 *
 * CANONICAL cancel endpoint.
 * Delegates to EventService.cancelEvent → cancel_event RPC which:
 *   1. Validates caller is the event organizer or super_admin
 *   2. Validates current status allows cancellation
 *   3. Checks for confirmed paid bookings (organizer cannot cancel if any exist)
 *   4. Transitions status → 'cancelled'
 *   5. Writes event.cancelled outbox event
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

        // Optional cancel reason from request body
        let cancelReason: string | undefined;
        try {
            const body = await req.json();
            cancelReason = body?.cancelReason ?? body?.cancel_reason ?? undefined;
        } catch {
            // No body or invalid JSON — cancel reason is optional
        }

        const service = new EventService(supabase);
        const result = await service.cancelEvent(eventId, user.id, cancelReason);

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
        console.error('Error cancelling event:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred while cancelling the event' },
            { status: 500 }
        );
    }
}
