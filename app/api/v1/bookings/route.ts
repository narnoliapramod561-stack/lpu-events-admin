import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BookingService } from '@/lib/services/booking/BookingService';
import { filterRegistrationsSchema, createRegistrationSchema } from '@/lib/validators/BookingValidator';

const bookingService = new BookingService(null);

/**
 * GET /api/v1/bookings
 *
 * List all registrations with filtering and pagination
 *
 * Query Parameters:
 * - event_id: Filter by event ID
 * - user_id: Filter by user ID
 * - status: Filter by status (confirmed, cancelled, attended)
 * - start_date: Filter by start date (ISO format)
 * - end_date: Filter by end date (ISO format)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * Response:
 * - success: boolean
 * - data: {
 *     registrations: Registration[],
 *     total: number,
 *     page: number,
 *     limit: number,
 *     totalPages: number
 *   }
 * - error: string (if failed)
 * - message: string (if successful)
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const event_id = searchParams.get('event_id');
    const user_id = searchParams.get('user_id');
    const status = searchParams.get('status');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';

    // Validate query parameters
    const validation = filterRegistrationsSchema.safeParse({
      event_id: event_id || undefined,
      user_id: user_id || undefined,
      status: status || undefined,
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: validation.error?.issues[0]?.message || 'Validation failed',
          details: validation.error?.issues || []
        },
        { status: 400 }
      );
    }

    const params = validation.data;

    // Fetch bookings using BookingService
    const result = await bookingService.getAllRegistrations(params);

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          error: 'FETCH_FAILED',
          message: 'Unable to fetch bookings'
        },
        { status: 500 }
      );
    }

    const { registrations, total, page: resultPage, limit: resultLimit, totalPages } = result.data;

    return NextResponse.json({
      success: true,
      data: {
        registrations: registrations || [],
        total,
        page: resultPage,
        limit: resultLimit,
        totalPages
      },
      message: 'Bookings fetched successfully'
    }, { status: 200 });

  } catch (error) {
    // Booking fetch error handled
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Unable to fetch bookings'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bookings
 *
 * Create a new registration (booking)
 *
 * Request Body:
 * - event_id: UUID (required)
 * - ticket_type_id: UUID (required)
 * - registration_mode: 'individual' | 'team' (required)
 * - team_name: string (required for team mode)
 * - quantity: number (default: 1, max: 50)
 * - metadata: object (optional)
 *
 * Response:
 * - success: boolean
 * - data: Registration
 * - error: string (if failed)
 * - message: string (if successful)
 */
export async function POST(request: NextRequest) {
  try {
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

    // Validate request data
    const parsed = createRegistrationSchema.parse(body);
    const {
      event_id,
      ticket_type_id,
      registration_mode,
      quantity = 1,
      team_name,
      metadata
    } = parsed;

    // Fetch event data to check status and registration window
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        status,
        title,
        registration_opens_at,
        registration_closes_at,
        is_published
      `)
      .eq('id', event_id)
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

    // Check if event is published
    const validStatuses = ['published', 'ongoing', 'completed'];
    if (!validStatuses.includes(event.status)) {
      return NextResponse.json(
        {
          error: 'EVENT_NOT_PUBLISHED',
          message: 'Event is not published'
        },
        { status: 400 }
      );
    }

    // Check registration window
    const now = new Date();
    if (event.registration_opens_at) {
      const opensAt = new Date(event.registration_opens_at);
      if (now < opensAt) {
        return NextResponse.json(
          {
            error: 'REGISTRATION_STARTED',
            message: 'Registration has not started yet',
            details: {
              registration_opens_at: event.registration_opens_at
            }
          },
          { status: 400 }
        );
      }
    }

    if (event.registration_closes_at) {
      const closesAt = new Date(event.registration_closes_at);
      if (now > closesAt) {
        return NextResponse.json(
          {
            error: 'REGISTRATION_CLOSED',
            message: 'Registration is not open',
            details: {
              registration_closes_at: event.registration_closes_at
            }
          },
          { status: 400 }
        );
      }
    }

    // Fetch ticket type data
    const { data: ticketType, error: ticketTypeError } = await supabase
      .from('ticket_types')
      .select(`
        id,
        price,
        is_active
      `)
      .eq('id', ticket_type_id)
      .single();

    if (ticketTypeError || !ticketType) {
      return NextResponse.json(
        {
          error: 'TICKET_TYPE_NOT_FOUND',
          message: 'Ticket type not found'
        },
        { status: 404 }
      );
    }

    if (!ticketType.is_active) {
      return NextResponse.json(
        {
          error: 'TICKET_TYPE_NOT_ACTIVE',
          message: 'Ticket type is not active'
        },
        { status: 400 }
      );
    }

    // Fetch event inventory to check capacity
    const { data: inventory, error: inventoryError } = await supabase
      .from('event_inventory')
      .select('available_tickets, sold_tickets, total_tickets')
      .eq('event_id', event_id)
      .eq('ticket_type_id', ticket_type_id)
      .single();

    let availableTickets = 0;
    if (inventory) {
      availableTickets = inventory.available_tickets;
    } else {
      // If no inventory record, check if event is free
      if (event.is_published) {
        // For free events, check if ticket exists
        const { count: ticketCount } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event_id)
          .eq('status', 'valid');

        if (ticketCount && ticketCount > 0) {
          availableTickets = ticketCount;
        }
      }
    }

    // Check capacity
    if (availableTickets > 0 && quantity > availableTickets) {
      return NextResponse.json(
        {
          error: 'CAPACITY_EXCEEDED',
          message: 'Event capacity exceeded',
          details: {
            requested: quantity,
            available: availableTickets
          }
        },
        { status: 400 }
      );
    }

    // Check if user already has a confirmed registration for this event
    const { count: existingCount } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('event_id', event_id)
      .eq('status', 'confirmed');

    if (existingCount && existingCount > 0) {
      return NextResponse.json(
        {
          error: 'DUPLICATE_REGISTRATION',
          message: 'You already have a confirmed registration for this event'
        },
        { status: 400 }
      );
    }

    // Create registration (booking)
    const { data: registration, error: registrationError } = await bookingService.createRegistration({
      user_id: user.id,
      event_id,
      ticket_type_id,
      registration_mode,
      team_name: team_name || null,
      quantity,
      total_amount: ticketType.price * quantity
    });

    if (registrationError || !registration) {
      return NextResponse.json(
        {
          error: 'REGISTRATION_FAILED',
          message: 'Unable to create registration',
          details: registrationError && typeof registrationError === 'object' && 'message' in registrationError
            ? (registrationError as any).message
            : 'Unknown error'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: registration,
      message: 'Registration created successfully'
    }, { status: 201 });

  } catch (error) {
    // Error handling: Cast error to unknown before type checking
    const err = error as unknown;
    console.error('[BOOKINGS][POST] Error:', err);

    if (err instanceof Error && err.name === 'ZodError') {
      const zodError = err as any;
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: err.message,
          details: zodError.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Unable to create registration'
      },
      { status: 500 }
    );
  }
}
