// dto.ts
// Shared Data Transfer Objects (DTOs) for Event Domain
// ==================================================

import { EventDateRange, EventState, Organizer, EventMetadata } from "./types";

/**
 * Create Event DTO
 */
export interface CreateEventDTO {
    title: string;
    description: string;
    dates: EventDateRange;
    price: number;
    organizerId: string;
    metadata?: EventMetadata;
}

/**
 * Update Event DTO
 */
export interface UpdateEventDTO {
    title?: string;
    description?: string;
    dates?: Partial<EventDateRange>;
    price?: number;
    state?: EventState;
    metadata?: EventMetadata;
}

/**
 * Event Response DTO
 */
export interface EventResponseDTO {
    id: string;
    title: string;
    description: string;
    state: EventState;
    dates: EventDateRange;
    price: number;
    organizer: Organizer;
    metadata?: EventMetadata;
}