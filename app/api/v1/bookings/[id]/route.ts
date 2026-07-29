import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BookingService } from '@/lib/services/booking/BookingService';

/**
 * GET /api/v1/bookings/[id]
 *
 * Get a single registration (booking) details
 *
 * URL Parameters:
 * - id: Registration ID
 *
 * Response:
 * - success: boolean
 * - data: Registration with related data
 * - error: string (if failed)
 * - message: string (if successful)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const registrationId = id;

    if (!registrationId || registrationId.trim() === '') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Registration ID is required'
        },
        { status: 400 }
      );
    }

    // Instantiate BookingService with Supabase client
    const supabaseClient = await createClient();
    const bookingService = new BookingService(supabaseClient);

    // Fetch registration details
    const { data: registration, error } = await bookingService.getRegistrationById(registrationId);

    if (error || !registration) {
      return NextResponse.json(
        {
          error: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found'
        },
        { status: 404 }
      );
    }

    // Get user profile information (reuse existing client)
    const supabase = supabaseClient;
    const { data: user } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        avatar_url
      `)
      .eq('id', registration.user_id)
      .single();

    const userProfile = user || null;

    // Get event details
    const { data: event } = await supabase
      .from('events')
      .select('id, title, slug, description, cover_image_url, venue, starts_at, ends_at, status')
      .eq('id', registration.event_id)
      .single();

    const eventDetails = event || null;

    // Get ticket type details
    const { data: ticketType } = await supabase
      .from('ticket_types')
      .select('id, name, description, price')
      .eq('id', registration.ticket_type_id)
      .single();

    const ticketTypeDetails = ticketType || null;

    // Get payment information if exists
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('registration_id', registrationId)
      .single();

    const paymentInfo = payment || null;

    // Get related members if it's a team registration
    let members = [];
    if (registration.registration_mode === 'team') {
      const { data: membersData } = await supabase
        .from('registration_members')
        .select('*')
        .eq('registration_id', registrationId)
        .order('created_at', { ascending: true });

      if (membersData) {
        members = membersData;
      }
    }

    // Get QR token for tickets
    let qrToken = null;
    const { data: ticketData } = await supabase
      .from('tickets')
      .select('qr_token, status')
      .eq('registration_id', registrationId)
      .limit(1);

    if (ticketData && ticketData.length > 0) {
      qrToken = ticketData[0].qr_token;
    }

    return NextResponse.json({
      success: true,
      data: {
        registration,
        user: userProfile,
        event: eventDetails,
        ticket_type: ticketTypeDetails,
        payment: paymentInfo,
        members,
        qr_token: qrToken
      },
      message: 'Registration details fetched successfully'
    }, { status: 200 });

  } catch {
    // Booking fetch error handled
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Unable to fetch registration details'
      },
      { status: 500 }
    );
  }
}
