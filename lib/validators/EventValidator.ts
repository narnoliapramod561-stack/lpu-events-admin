import { z } from 'zod';

/**
 * SINGLE SOURCE OF TRUTH for event validation (Domain 2 lock).
 *
 * Every create/update entry point — API routes and UI submits — must use
 * these validators. No inline Zod schemas elsewhere.
 *
 * Design notes:
 * - This file is imported by SERVER route handlers — do NOT add "use client".
 * - `is_free` / `registration_mode` have defaults so partial clients work.
 * - Date fields validate FORMAT only. "Must be in the future" is a UX concern,
 *   not enforced here, so that editing an existing (possibly past) event is
 *   never blocked by validation.
 * - Cross-field rules (end > start, reg close > reg open, team max >= min) are
 *   expressed once in `withEventCrossFieldRules` and shared by create + update.
 */

// A ticket tier supplied at creation time. Drives ticket_types + event_inventory.
export const ticketTierValidator = z.object({
    name: z.string().min(1, 'Tier name is required').max(200),
    description: z.string().max(1000).optional().nullable(),
    price: z.number().min(0, 'Price cannot be negative'),
    total_tickets: z.number().int().min(1, 'Tier capacity must be at least 1'),
});

// Base shape shared by create and update.
const eventBaseSchema = z.object({
    category_id: z.string().uuid('Invalid category ID format'),
    title: z.string()
        .min(1, 'Title must be at least 1 character')
        .max(300, 'Title must not exceed 300 characters'),
    slug: z.string()
        .min(1, 'Slug must be at least 1 character')
        .max(300, 'Slug must not exceed 300 characters')
        .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
    description: z.string()
        .min(1, 'Description must be at least 1 character')
        .max(50000, 'Description must not exceed 50000 characters'),
    short_description: z.string().max(500, 'Short description must not exceed 500 characters').optional().nullable(),
    cover_image_url: z.string().url('Invalid image URL').optional().nullable(),
    venue: z.string()
        .min(1, 'Venue is required')
        .max(500, 'Venue must not exceed 500 characters'),
    venue_address: z.string().max(500).optional().nullable(),
    // Date FORMAT only — past dates allowed so edits to existing events never break.
    starts_at: z.string().refine((val) => !isNaN(new Date(val).getTime()), 'Invalid start date format'),
    ends_at: z.string().refine((val) => !isNaN(new Date(val).getTime()), 'Invalid end date format'),
    registration_opens_at: z.string().refine((val) => !isNaN(new Date(val).getTime()), 'Invalid registration open date format').optional().nullable(),
    registration_closes_at: z.string().refine((val) => !isNaN(new Date(val).getTime()), 'Invalid registration close date format').optional().nullable(),
    is_free: z.boolean().default(true),
    registration_required: z.boolean().default(true),
    registration_type: z.enum(['free', 'paid']).default('free'),
    registration_platform: z.enum(['lpu_events', 'external_link']).default('lpu_events'),
    registration_mode: z.enum(['individual', 'team']).default('individual'),
    is_featured: z.boolean().optional(),
    is_hidden: z.boolean().optional(),
    team_min_size: z.number().int().min(2, 'Team minimum size must be at least 2').optional().nullable(),
    team_max_size: z.number().int().min(2, 'Team maximum size must be at least 2').optional().nullable(),
    team_pricing: z.enum(['fixed', 'per_member']).optional().nullable(),
    max_tickets: z.number()
        .int()
        .min(1, 'Max tickets must be at least 1')
        .max(10000, 'Max tickets must not exceed 10000')
        .optional()
        .nullable(),
    terms_and_conditions: z.string().optional().nullable(),
    contact_email: z.string().email('Invalid email format').optional().nullable()
        .or(z.literal('')).transform(val => (val === '' ? null : val)),
    contact_phone: z.string().optional().nullable(),
    status: z.enum(['draft', 'pending_approval', 'published', 'cancelled']).optional(),
});

// Shared cross-field business rules. Applied to both create and update.
function withEventCrossFieldRules<T extends z.ZodTypeAny>(schema: T) {
    return schema
        .refine((data: any) => {
            if (data.starts_at && data.ends_at) {
                return new Date(data.ends_at) > new Date(data.starts_at);
            }
            return true;
        }, { message: 'Event end time must be later than start time', path: ['ends_at'] })
        .refine((data: any) => {
            if (data.registration_opens_at && data.registration_closes_at) {
                return new Date(data.registration_closes_at) > new Date(data.registration_opens_at);
            }
            return true;
        }, { message: 'Registration close time must be later than registration open time', path: ['registration_closes_at'] })
        .refine((data: any) => {
            if (data.team_min_size != null && data.team_max_size != null) {
                return data.team_max_size >= data.team_min_size;
            }
            return true;
        }, { message: 'Team maximum size must be greater than or equal to team minimum size', path: ['team_max_size'] });
}

// CREATE: full payload. Optionally carries ticket tiers for inventory init.
export const createEventValidator = withEventCrossFieldRules(
    eventBaseSchema.extend({
        ticket_tiers: z.array(ticketTierValidator).optional(),
    })
);

// Backwards-compatible alias (was createEventDraftValidator).
export const createEventDraftValidator = createEventValidator;

// UPDATE: partial — any subset of fields, same cross-field rules.
export const updateEventDraftValidator = withEventCrossFieldRules(eventBaseSchema.partial());

// Event submission (organizer note when submitting for approval).
export const submitEventValidator = z.object({
    reason: z.string()
        .min(10, 'Submission reason must be at least 10 characters')
        .max(1000, 'Submission reason must not exceed 1000 characters')
        .optional(),
});

// Event ID for path parameters.
export const eventIdValidator = z.string().uuid('Invalid event ID format');
