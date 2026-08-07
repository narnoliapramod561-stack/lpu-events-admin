import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/services/event/EventService';

/**
 * GET /api/admin/events/pending
 * Fetch all pending paid event requests for Super Admin
 */
export async function GET() {
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
      return NextResponse.json({ error: 'Only super admins can view pending event requests' }, { status: 403 });
    }

    const service = new EventService(supabase);
    const result = await service.getPendingPaidEventRequests();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result.data }, { status: 200 });
  } catch (error) {
    console.error('Error fetching pending events:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}