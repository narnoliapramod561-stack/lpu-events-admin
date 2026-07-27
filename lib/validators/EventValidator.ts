"use client";

import { z } from 'zod';

// Event creation base schema for Organizer APIs
const createEventBaseSchema = z.object({
    category_id: z.string().uuid('Invalid category ID format'),
    title: z.string()
        .min(3, 'Title must be at least 3 characters')
        .max(300, 'Title must not exceed 300 characters'),
    slug: z.string()
        .min(3, 'Slug must be at least 3 characters')
        .max(300, 'Slug must not exceed 300 characters')
        .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
    description: z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(50000, 'Description must not exceed 50000 characters'),
    short_description: z.string().max(500, 'Short description must not exceed 500 characters').optional(),
    cover_image_url: z.string().url('Invalid image URL').optional(),
    venue: z.string()
        .min(1, 'Venue is required')
        .max(500, 'Venue must not exceed 500 characters'),
    venue_address: z.string().optional(),
    starts_at: z.string()
        .refine((val) => {
            try {
                return new Date(val) > new Date();
            } catch {
                return false;
            }
        }, 'Start date must be in the future'),
    ends_at: z.string()
        .refine((val) => {
            try {
                return new Date(val) > new Date();
            } catch {
                return false;
            }
        }, 'End date must be in the future'),
    registration_opens_at: z.string()
        .refine((val) => {
            try {
                return new Date(val) > new Date();
            } catch {
                return false;
            }
        }, 'Registration open date must be in the future')
        .optional(),
    registration_closes_at: z.string().optional(),
    is_free: z.boolean(),
    registration_mode: z.enum(['individual', 'team', 'both']),
    team_min_size: z.number().min(2, 'Team minimum size must be at least 2').optional(),
    team_max_size: z.number().min(2, 'Team maximum size must be at least 2').optional(),
    team_pricing: z.enum(['fixed', 'per_member']).optional(),
    max_tickets: z.number()
        .min(1, 'Max tickets must be at least 1')
        .max(10000, 'Max tickets must not exceed 10000')
        .optional(),
    terms_and_conditions: z.string().optional(),
    contact_email: z.string().email('Invalid email format').optional(),
    contact_phone: z.string().optional(),
});

export const createEventDraftValidator = createEventBaseSchema.refine((data) => {
    // Validate date ranges
    try {
        const startDate = new Date(data.starts_at);
        const endDate = new Date(data.ends_at);
        if (endDate <= startDate) {
            return false;
        }
    } catch {
        return false;
    }
    return true;
}, 'Event end time must be later than start time')
    .refine((data) => {
        // Validate registration date ranges if both provided
        if (data.registration_opens_at && data.registration_closes_at) {
            try {
                const opensAt = new Date(data.registration_opens_at);
                const closesAt = new Date(data.registration_closes_at);
                if (closesAt <= opensAt) {
                    return false;
                }
            } catch {
                return false;
            }
        }
        return true;
    }, 'Registration close time must be later than registration open time')
    .refine((data) => {
        // Validate team sizes if team mode is enabled
        if (data.team_min_size !== undefined && data.team_max_size !== undefined) {
            return data.team_max_size >= data.team_min_size;
        }
        return true;
    }, 'Team maximum size must be greater than or equal to team minimum size');

// Partial event update validator for Organizer APIs
export const updateEventDraftValidator = createEventBaseSchema.partial();

// Event submission validator for Organizer APIs
export const submitEventValidator = z.object({
    reason: z.string()
        .min(10, 'Submission reason must be at least 10 characters')
        .max(1000, 'Submission reason must not exceed 1000 characters')
        .optional(),
});

// Event ID validator for path parameters
export const eventIdValidator = z.string().uuid('Invalid event ID format');

// Date range validator for event lifecycle operations
export const eventDateRangeValidator = z.object({
    starts_at: z.string().refine((val) => {
        try {
            return new Date(val) > new Date();
        } catch {
            return false;
        }
    }, 'Start date must be in the future'),
    ends_at: z.string().refine((val) => {
        try {
            return new Date(val) > new Date();
        } catch {
            return false;
        }
    }, 'End date must be in the future'),
}).refine((data) => {
    try {
        const startDate = new Date(data.starts_at);
        const endDate = new Date(data.ends_at);
        return endDate > startDate;
    } catch {
        return false;
    }
}, 'Event end time must be later than start time');