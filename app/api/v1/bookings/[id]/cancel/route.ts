import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BookingService } from '@/lib/services/booking/BookingService';
import { cancelRegistrationSchema } from '@/lib/validators/BookingValidator';

/**
 * PUT /api/v1/bookings/[id]/cancel
 *
 * Cancel a registration (booking)
 *
 * URL Parameters:
 * - id: Registration ID
 *
 * Request Body:
 * - cancellation_reason: string (required, min 10 characters)
 *
 * Response:
 * - success: boolean
 * - data: Registration
 * - error: string (if failed)
 * - message: string (if successful)
 */
export async function PUT(
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

    // Get user from session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'User not authenticated'
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));

    // Validate cancellation reason
    const parsed = cancelRegistrationSchema.parse(body);
    const { cancellation_reason } = parsed;

    // Instantiate BookingService with the Supabase client
    const bookingService = new BookingService(supabase);

    // Check if user is authorized to cancel this registration
    const { data: registration, error: registrationError } = await bookingService.getRegistrationById(registrationId);

    if (registrationError || !registration) {
      return NextResponse.json(
        {
          error: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found'
        },
        { status: 404 }
      );
    }

    // Check if registration belongs to the authenticated user
    if (registration.user_id !== user.id) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'You are not authorized to cancel this registration'
        },
        { status: 403 }
      );
    }

    // Check if registration is already cancelled
    if (registration.status === 'cancelled') {
      return NextResponse.json(
        {
          error: 'ALREADY_CANCELLED',
          message: 'Registration is already cancelled'
        },
        { status: 400 }
      );
    }

    // Check if registration is already confirmed (only confirmed registrations can be cancelled)
    if (registration.status !== 'confirmed') {
      return NextResponse.json(
        {
          error: 'INVALID_STATUS',
          message: 'Only confirmed registrations can be cancelled'
        },
        { status: 400 }
      );
    }

    // Check if event has already started
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('starts_at')
      .eq('id', registration.event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        {
          error: 'EVENT_NOT_FOUND',
          message: 'Event not found'
        },
        { status: 404 }
      );
    }

    const eventStartsAt = new Date(event.starts_at);
    const now = new Date();

    // Only allow cancellation if event hasn't started yet
    if (now >= eventStartsAt) {
      return NextResponse.json(
        {
          error: 'EVENT_STARTED',
          message: 'Cannot cancel registration as the event has already started'
        },
        { status: 400 }
      );
    }

    // Check if user has payment pending
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('status')
      .eq('registration_id', registrationId)
      .single();

    if (!paymentError && payment && payment.status === 'processing') {
      return NextResponse.json(
        {
          error: 'PAYMENT_PENDING',
          message: 'Cannot cancel registration as payment is still processing'
        },
        { status: 400 }
      );
    }

    // Cancel the registration
    const { data: updatedRegistration, error: cancelError } = await bookingService.cancelRegistration(
      registrationId,
      cancellation_reason
    );

    if (cancelError || !updatedRegistration) {
      return NextResponse.json(
        {
          error: 'CANCEL_FAILED',
          message: 'Unable to cancel registration',
          details: cancelError && typeof cancelError === 'object' && 'message' in cancelError
            ? String((cancelError as Record<string, unknown>).message)
            : 'Unknown error'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedRegistration,
      message: 'Registration cancelled successfully'
    }, { status: 200 });

  } catch (error) {
    // Booking cancellation error handled

    if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: error.message,
          details: (error as unknown as { errors?: unknown }).errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Unable to cancel registration'
      },
      { status: 500 }
    );
  }
}
