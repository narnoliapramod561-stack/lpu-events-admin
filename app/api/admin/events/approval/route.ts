import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/services/event/EventService';

/**
 * POST /api/admin/events/approval
 * Super Admin approves or rejects a paid event request
 * Body: { eventId: string, action: 'approve' | 'reject', rejectionReason?: string }
 */
export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'Only super admins can approve/reject events' }, { status: 403 });
    }

    const body = await req.json();
    const { eventId, action, rejectionReason } = body;

    if (!eventId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request. eventId and action (approve/reject) are required.' }, { status: 400 });
    }

    if (action === 'reject' && (!rejectionReason || !rejectionReason.trim())) {
      return NextResponse.json({ error: 'Rejection reason is required when rejecting an event.' }, { status: 400 });
    }

    const service = new EventService(supabase);
    const result = await service.processEventApproval(eventId, user.id, action, rejectionReason);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    console.error('Error processing event approval:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}