import { EventState } from "./types";

/**
 * Event State Transitions
 * Defines valid transitions between event states.
 * Aligned with database schema (event_status enum).
 *
 * NOTE: This is a simplified view. The full lifecycle engine
 * with permission validation is in lifecycle-engine.ts
 *
 * Key: 'rejected' is a first-class FSM state. Organizers re-publish from
 * 'rejected' → server re-evaluates approval → pending_approval or published.
 */
export const EventStateTransitions: Record<EventState, EventState[]> = {
    draft: ["pending_approval", "published", "cancelled"],
    pending_approval: ["published", "rejected", "cancelled"],
    rejected: ["pending_approval"],  // organizer re-submits; server decides outcome
    published: ["ongoing", "cancelled"],
    ongoing: ["completed", "cancelled"],
    completed: ["archived"],
    cancelled: ["archived"],
    archived: [], // Terminal state
};

/**
 * Validates whether a state transition is structurally allowed.
 * @param currentState - The current state of the event.
 * @param newState - The desired new state.
 * @returns True if the transition is valid, otherwise false.
 * 
 * NOTE: This only checks structural validity. For full validation
 * including permissions and business rules, use lifecycle-engine.ts
 */
export function validateStateTransition(
    currentState: EventState,
    newState: EventState
): boolean {
    return EventStateTransitions[currentState]?.includes(newState) || false;
}
