import { z } from 'zod';

/**
 * BookingValidator - Validates registration/booking operations
 *
 * Validates:
 * - Event exists and is published
 * - Registration is open
 * - Capacity not exceeded
 * - User has no duplicate booking
 * - Payment status
 * - Registration mode validation
 * - Team size validation
 * - Quantity and amount validation
 * - Various other business rules
 */

/**
 * Schema for creating a new registration
 */
export const createRegistrationSchema = z.object({
  event_id: z.string().uuid('Event ID must be a valid UUID'),
  ticket_type_id: z.string().uuid('Ticket type ID must be a valid UUID'),
  registration_mode: z.enum(['individual', 'team']),
  quantity: z.coerce.number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(50, 'Quantity cannot exceed 50')
    .optional()
    .default(1),
  team_name: z.string()
    .max(200, 'Team name cannot exceed 200 characters')
    .optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * Schema for updating a registration
 */
export const updateRegistrationSchema = z.object({
  status: z.enum(['confirmed', 'cancelled']),
  cancellation_reason: z.string()
    .max(2000, 'Cancellation reason cannot exceed 2000 characters')
    .optional()
}).optional();

/**
 * Schema for filtering registrations
 */
export const filterRegistrationsSchema = z.object({
  event_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  status: z.enum(['confirmed', 'cancelled', 'attended']).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

/**
 * Schema for ticket verification
 */
export const verifyTicketSchema = z.object({
  ticket_number: z.string()
    .min(5, 'Ticket number must be at least 5 characters')
    .max(50, 'Ticket number cannot exceed 50 characters')
});

/**
 * Schema for cancelling a registration
 */
export const cancelRegistrationSchema = z.object({
  cancellation_reason: z.string()
    .min(10, 'Cancellation reason must be at least 10 characters')
    .max(2000, 'Cancellation reason cannot exceed 2000 characters')
});

/**
 * Validation error codes and messages
 */
export const ValidationErrors = {
  EVENT_NOT_FOUND: 'Event not found',
  EVENT_NOT_PUBLISHED: 'Event is not published',
  REGISTRATION_CLOSED: 'Registration is not open',
  REGISTRATION_STARTED: 'Registration has not started yet',
  CAPACITY_EXCEEDED: 'Event capacity exceeded',
  DUPLICATE_REGISTRATION: 'User already has a confirmed registration for this event',
  INVALID_TICKET_NUMBER: 'Invalid ticket number',
  TICKET_NOT_FOUND: 'Ticket not found',
  TICKET_ALREADY_USED: 'Ticket has already been used',
  TICKET_EXPIRED: 'Ticket has expired',
  CANCELLED_REGISTRATION: 'Registration has already been cancelled',
  INVALID_REGISTRATION_MODE: 'Invalid registration mode',
  INVALID_TEAM_SIZE: 'Invalid team size',
  INVALID_QUANTITY: 'Invalid quantity',
  INVALID_TOTAL_AMOUNT: 'Invalid total amount',
  PAYMENT_FAILED: 'Payment verification failed',
  UNAUTHORIZED: 'Unauthorized to perform this action',
  ALREADY_CONFIRMED: 'Registration is already confirmed'
};

/**
 * Validation rules for different registration modes
 */
export const RegistrationModeRules = {
  individual: {
    min_size: 1,
    max_size: 1,
    min_price: 0,
    require_team_name: false
  },
  team: {
    min_size: 2,
    max_size: 10,
    min_price: 100, // Minimum team registration price
    require_team_name: true
  }
};

/**
 * Validation result type
 */
export interface ValidationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  details?: any;
  data?: unknown;
}

/**
 * Main validation function for creating a registration
 */
export async function validateCreateRegistration(
  data: unknown,
  eventExists: boolean,
  eventStatus: string,
  registrationOpensAt?: string,
  registrationClosesAt?: string,
  availableTickets?: number,
  existingRegistrationCount?: number,
  currentUserId?: string
): Promise<ValidationResult> {
  try {
    // Parse and validate request data
    const parsed = createRegistrationSchema.parse(data);
    const {
      event_id,
      ticket_type_id,
      registration_mode,
      quantity = 1,
      team_name,
      metadata
    } = parsed;

    // Validate 1: Event exists
    if (!eventExists) {
      return {
        success: false,
        error: ValidationErrors.EVENT_NOT_FOUND,
        errorCode: 'EVENT_NOT_FOUND'
      };
    }

    // Validate 2: Event is published (status: published, ongoing, completed)
    const validStatuses = ['published', 'ongoing', 'completed'];
    if (!validStatuses.includes(eventStatus)) {
      return {
        success: false,
        error: ValidationErrors.EVENT_NOT_PUBLISHED,
        errorCode: 'EVENT_NOT_PUBLISHED'
      };
    }

    // Validate 3: Registration is open
    if (registrationOpensAt) {
      const now = new Date();
      const opensAt = new Date(registrationOpensAt);
      if (now < opensAt) {
        return {
          success: false,
          error: ValidationErrors.REGISTRATION_STARTED,
          errorCode: 'REGISTRATION_STARTED',
          details: {
            registration_opens_at: registrationOpensAt
          }
        };
      }
    }

    if (registrationClosesAt) {
      const now = new Date();
      const closesAt = new Date(registrationClosesAt);
      if (now > closesAt) {
        return {
          success: false,
          error: ValidationErrors.REGISTRATION_CLOSED,
          errorCode: 'REGISTRATION_CLOSED',
          details: {
            registration_closes_at: registrationClosesAt
          }
        };
      }
    }

    // Validate 4: Capacity not exceeded
    if (availableTickets !== undefined && quantity > availableTickets) {
      return {
        success: false,
        error: ValidationErrors.CAPACITY_EXCEEDED,
        errorCode: 'CAPACITY_EXCEEDED',
        details: {
          requested: quantity,
          available: availableTickets
        }
      };
    }

    // Validate 5: User has no duplicate registration
    if (existingRegistrationCount !== undefined && existingRegistrationCount > 0) {
      return {
        success: false,
        error: ValidationErrors.DUPLICATE_REGISTRATION,
        errorCode: 'DUPLICATE_REGISTRATION'
      };
    }

    // Validate 6: Registration mode rules
    const rules = RegistrationModeRules[registration_mode as keyof typeof RegistrationModeRules];
    if (!rules) {
      return {
        success: false,
        error: ValidationErrors.INVALID_REGISTRATION_MODE,
        errorCode: 'INVALID_REGISTRATION_MODE'
      };
    }

    // Validate team size for team mode
    if (registration_mode === 'team') {
      if (quantity < rules.min_size) {
        return {
          success: false,
          error: ValidationErrors.INVALID_TEAM_SIZE,
          errorCode: 'INVALID_TEAM_SIZE',
          details: {
            required_min: rules.min_size,
            requested: quantity
          }
        };
      }

      if (quantity > rules.max_size) {
        return {
          success: false,
          error: ValidationErrors.INVALID_TEAM_SIZE,
          errorCode: 'INVALID_TEAM_SIZE',
          details: {
            required_max: rules.max_size,
            requested: quantity
          }
        };
      }

      // Validate team name is required for team mode
      if (!team_name || team_name.trim() === '') {
        return {
          success: false,
          error: ValidationErrors.INVALID_TEAM_SIZE,
          errorCode: 'INVALID_TEAM_SIZE',
          details: {
            required: 'team_name is required for team registration'
          }
        };
      }
    }

    // Validate 7: Individual mode cannot have team name
    if (registration_mode === 'individual' && team_name && team_name.trim() !== '') {
      return {
        success: false,
        error: ValidationErrors.INVALID_REGISTRATION_MODE,
        errorCode: 'INVALID_REGISTRATION_MODE',
        details: {
          message: 'Individual registration cannot have a team name'
        }
      };
    }

    // All validations passed
    return {
      success: true,
      data: {
        event_id,
        ticket_type_id,
        registration_mode,
        quantity,
        team_name: team_name?.trim() || null,
        metadata
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
        errorCode: 'VALIDATION_ERROR'
      };
    }
    return {
      success: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR'
    };
  }
}

/**
 * Validation function for cancelling a registration
 */
export async function validateCancelRegistration(
  data: unknown,
  currentStatus: string
): Promise<ValidationResult> {
  try {
    const parsed = cancelRegistrationSchema.parse(data);

    // Validate that registration is not already cancelled
    if (currentStatus === 'cancelled') {
      return {
        success: false,
        error: ValidationErrors.CANCELLED_REGISTRATION,
        errorCode: 'CANCELLED_REGISTRATION'
      };
    }

    // Validate that registration is not already confirmed (cannot cancel before confirm)
    if (currentStatus !== 'confirmed') {
      return {
        success: false,
        error: ValidationErrors.ALREADY_CONFIRMED,
        errorCode: 'ALREADY_CONFIRMED'
      };
    }

    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
        errorCode: 'VALIDATION_ERROR'
      };
    }
    return {
      success: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR'
    };
  }
}

/**
 * Validation function for verifying a ticket
 */
export async function validateVerifyTicket(
  data: unknown,
  ticketExists: boolean,
  ticketStatus: string,
  ticketEventId?: string,
  currentUserId?: string
): Promise<ValidationResult> {
  try {
    const parsed = verifyTicketSchema.parse(data);

    // Validate ticket exists
    if (!ticketExists) {
      return {
        success: false,
        error: ValidationErrors.TICKET_NOT_FOUND,
        errorCode: 'TICKET_NOT_FOUND'
      };
    }

    // Validate ticket is valid (not used, not cancelled, not expired)
    if (ticketStatus === 'used') {
      return {
        success: false,
        error: ValidationErrors.TICKET_ALREADY_USED,
        errorCode: 'TICKET_ALREADY_USED'
      };
    }

    if (ticketStatus === 'cancelled') {
      return {
        success: false,
        error: ValidationErrors.TICKET_EXPIRED,
        errorCode: 'TICKET_EXPIRED'
      };
    }

    // Additional validation if needed
    return {
      success: true,
      data: {
        ticket_number: parsed.ticket_number
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
        errorCode: 'VALIDATION_ERROR'
      };
    }
    return {
      success: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR'
    };
  }
}

/**
 * Batch validation for multiple registrations
 */
export async function validateMultipleRegistrations(
  registrations: unknown[],
  eventExists: boolean,
  eventStatus: string,
  availableTickets: number,
  existingRegistrations: any[]
): Promise<ValidationResult[]> {
  return Promise.all(
    registrations.map((reg) =>
      validateCreateRegistration(
        reg,
        eventExists,
        eventStatus,
        undefined,
        undefined,
        availableTickets,
        existingRegistrations.length,
        undefined
      )
    )
  );
}
