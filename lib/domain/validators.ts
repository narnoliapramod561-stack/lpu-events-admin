// validators.ts
// Shared Validators for Event Domain
// ===================================

import * as z from "zod";

// Validator: Event State (aligned with database schema)
export const EventStateValidator = z.enum([
    "draft",
    "pending_approval",
    "published",
    "ongoing",
    "completed",
    "cancelled",
    "archived",
]);

// Validator: Event Title
export const EventTitleValidator = z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title cannot exceed 100 characters");

// Validator: Event Description
export const EventDescriptionValidator = z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(2000, "Description cannot exceed 2000 characters");

// Validator: Event Dates
export const EventDatesValidator = z.object({
    start: z.date(),
    end: z.date(),
}).refine((data) => data.start < data.end, {
    message: "Start date must be before end date",
});

// Validator: Event Price
export const EventPriceValidator = z.number().min(0, "Price must be non-negative");

export default {
    EventStateValidator,
    EventTitleValidator,
    EventDescriptionValidator,
    EventDatesValidator,
    EventPriceValidator,
};