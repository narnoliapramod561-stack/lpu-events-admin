import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/services/event/EventService';

/**
 * POST /api/admin/events/[id]/archive
 *
 * CANONICAL archive endpoint (Super Admin only).
 * Delegates to EventService.archiveEvent → archive_event RPC which:
 *   1. Validates caller is a super_admin or admin
 *   2. Validates current status is 'completed' or 'cancelled'
 *   3. Transitions status → 'archived'
 *   4. Writes event.archived outbox event
 *
 * Only admins can archive events. Organizers cannot.
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

        // Verify Super Admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || (profile.role !== 'super_admin' && profile.role !== 'admin')) {
            return NextResponse.json(
                { error: 'Only super admins can archive events' },
                { status: 403 }
            );
        }

        const service = new EventService(supabase);
        const result = await service.archiveEvent(eventId, user.id);

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
        console.error('Error archiving event:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred while archiving the event' },
            { status: 500 }
        );
    }
}
