// constants.ts
// Shared Constants for Event Domain
// =================================

/**
 * Default Event Constants
 * These constants define the default configurations for new events.
 */
export const DEFAULT_EVENT_PRICE = 0; // Default price for free events
export const DEFAULT_PARTICIPANT_LIMIT = 100; // Default max participants if not specified

/**
 * State Descriptions
 * Additional metadata for each event state.
 * Aligned with database schema (event_status enum).
 * 
 * NOTE: Full state descriptions with lifecycle logic are in lifecycle-engine.ts
 */
export const STATE_DESCRIPTIONS: Record<string, string> = {
    draft: "This event is still being prepared and is not visible to attendees.",
    pending_approval: "This event is awaiting approval from a Super Admin before it can be published.",
    published: "This event is live and accepting registrations.",
    ongoing: "This event is currently in progress. Registration is closed but attendees can check in.",
    completed: "This event has concluded and is no longer accepting registrations.",
    cancelled: "This event has been cancelled and is no longer active.",
    archived: "This event has been archived and moved to cold storage.",
};
