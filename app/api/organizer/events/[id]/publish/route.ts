import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/services/event/EventService';
import { validateOrganizer } from '@/lib/auth/organizer-guard';

/**
 * CANONICAL publish endpoint (Domain 2 lock).
 * The ONLY way an event reaches status='published' or 'pending_approval'.
 * Delegates to EventService.publishEvent -> publish_event_v2 RPC which
 * automatically determines whether the event should be published immediately
 * or submitted for Super Admin approval based on registration configuration.
 *
 * The organizer NEVER chooses approval manually — it is computed server-side.
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
            return NextResponse.json({ error: organizerValidation.message }, { status: organizerValidation.status });
        }

        const service = new EventService(supabase);
        const result = await service.publishEvent(eventId, user.id);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // The RPC returns a jsonb result object. Inspect it for success/error
        // and the requires_approval flag so the frontend shows the right message.
        const data = result.data as any;
        if (data && data.error) {
            return NextResponse.json({ message: data.message || data.error }, { status: 400 });
        }

        return NextResponse.json(data, { status: 200 });
    } catch {
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}
