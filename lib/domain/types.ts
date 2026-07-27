// types.ts
// Shared Types for Event Domain
// =============================

/**
 * Event State Types
 * Represents the life cycle stages of an Event.
 * Aligned with database schema (event_status enum)
 */
export type EventState =
    | "draft"
    | "pending_approval"
    | "published"
    | "ongoing"
    | "completed"
    | "cancelled"
    | "archived";

/**
 * Event Date Range Type
 * Represents the start and end dates for an Event.
 */
export interface EventDateRange {
    start: Date;
    end: Date;
}

/**
 * Organizer Details
 * Represents the primary information for the event organizer.
 */
export interface Organizer {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
}

/**
 * Event Metadata
 * Represents the additional metadata for an Event.
 */
export interface EventMetadata {
    isFeatured: boolean;
    participantLimit?: number;
    tags?: string[];
}

/**
 * Event Core Type
 * Represents the core structure for an Event object.
 */
export interface Event {
    id: string;
    title: string;
    description: string;
    state: EventState;
    dates: EventDateRange;
    price: number;
    organizer: Organizer;
    metadata?: EventMetadata;
}