// lifecycle-engine.ts
// Event Lifecycle Engine - Single Source of Truth for Event State Transitions
// =============================================================================

export type EventState =
    | "draft"
    | "pending_approval"
    | "published"
    | "ongoing"
    | "completed"
    | "cancelled"
    | "archived";

/**
 * User Roles for Permission Validation
 */
export type UserRole = "student" | "organizer" | "super_admin" | "admin";

/**
 * Transition Context
 * Contains information needed to validate a state transition
 */
export interface TransitionContext {
    currentState: EventState;
    newState: EventState;
    userRole: UserRole;
    isOwner: boolean;
    hasPaidBookings?: boolean;
    eventEndDate?: Date;
    currentDate?: Date;
}

/**
 * Transition Result
 */
export interface TransitionResult {
    allowed: boolean;
    reason?: string;
    requiresApproval?: boolean;
    triggersRefund?: boolean;
}

/**
 * Event State Transition Matrix
 * Defines all valid state transitions based on database schema
 */
export const EVENT_STATE_TRANSITIONS: Record<EventState, EventState[]> = {
    draft: ["pending_approval", "published", "cancelled"],
    pending_approval: ["published", "draft", "cancelled"],
    published: ["ongoing", "cancelled"],
    ongoing: ["completed", "cancelled"],
    completed: ["archived"],
    cancelled: ["archived"],
    archived: [], // Terminal state
};

/**
 * Role-Based Transition Permissions
 */
export const ROLE_TRANSITION_PERMISSIONS: Record<
    UserRole,
    Record<EventState, EventState[]>
> = {
    student: {
        draft: [],
        pending_approval: [],
        published: [],
        ongoing: [],
        completed: [],
        cancelled: [],
        archived: [],
    },
    organizer: {
        draft: ["pending_approval", "published", "cancelled"],
        pending_approval: ["draft"],
        published: ["ongoing", "cancelled"],
        ongoing: ["completed"],
        completed: [],
        cancelled: [],
        archived: [],
    },
    super_admin: {
        draft: ["pending_approval", "published", "cancelled"],
        pending_approval: ["published", "draft", "cancelled"],
        published: ["ongoing", "cancelled"],
        ongoing: ["completed", "cancelled"],
        completed: ["archived"],
        cancelled: ["archived"],
        archived: [],
    },
    admin: {
        draft: ["pending_approval", "published", "cancelled"],
        pending_approval: ["published", "draft", "cancelled"],
        published: ["ongoing", "cancelled"],
        ongoing: ["completed", "cancelled"],
        completed: ["archived"],
        cancelled: ["archived"],
        archived: [],
    },
};

/**
 * State Descriptions
 */
export const STATE_DESCRIPTIONS: Record<EventState, string> = {
    draft: "This event is still being prepared and is not visible to attendees.",
    pending_approval: "This event is awaiting approval from a Super Admin before it can be published.",
    published: "This event is live and accepting registrations. It is visible in the event discovery system.",
    ongoing: "This event is currently in progress. Registration is closed but attendees can check in.",
    completed: "This event has concluded. No further registrations or check-ins are permitted.",
    cancelled: "This event has been cancelled and is no longer active. Refunds have been initiated if applicable.",
    archived: "This event has been archived and moved to cold storage. It is no longer visible in the system.",
};

/**
 * Validates if a state transition is structurally valid
 */
export function isValidTransition(
    currentState: EventState,
    newState: EventState
): boolean {
    return EVENT_STATE_TRANSITIONS[currentState]?.includes(newState) || false;
}

/**
 * Validates if a user has permission to perform a state transition
 */
export function hasTransitionPermission(
    currentState: EventState,
    newState: EventState,
    userRole: UserRole,
    isOwner: boolean = false
): boolean {
    if (userRole === "organizer" && !isOwner) {
        return false;
    }

    const allowedTransitions = ROLE_TRANSITION_PERMISSIONS[userRole][currentState] || [];
    return allowedTransitions.includes(newState);
}

/**
 * Validates cancellation business rules
 */
export function validateCancellation(
    context: TransitionContext
): TransitionResult {
    const { userRole, isOwner, hasPaidBookings = false } = context;

    if (!isValidTransition(context.currentState, "cancelled")) {
        return {
            allowed: false,
            reason: `Cannot cancel event from state: ${context.currentState}`,
        };
    }

    if (userRole === "super_admin") {
        return {
            allowed: true,
            triggersRefund: hasPaidBookings,
        };
    }

    if (userRole === "organizer" && !isOwner) {
        return {
            allowed: false,
            reason: "You do not have permission to cancel this event.",
        };
    }

    if (hasPaidBookings && userRole === "organizer") {
        return {
            allowed: false,
            reason: "Events with paid bookings require Super Admin approval for cancellation.",
            requiresApproval: true,
        };
    }

    return {
        allowed: true,
        triggersRefund: false,
    };
}

/**
 * Validates a complete state transition
 */
export function validateTransition(
    context: TransitionContext
): TransitionResult {
    const { currentState, newState, userRole, isOwner } = context;

    if (!isValidTransition(currentState, newState)) {
        return {
            allowed: false,
            reason: `Invalid state transition: ${currentState} → ${newState}`,
        };
    }

    if (!hasTransitionPermission(currentState, newState, userRole, isOwner)) {
        return {
            allowed: false,
            reason: `You do not have permission to transition from ${currentState} to ${newState}`,
        };
    }

    if (newState === "cancelled") {
        return validateCancellation(context);
    }

    return {
        allowed: true,
    };
}

/**
 * Determines if a state transition should happen automatically
 */
export function getAutomaticTransition(
    currentState: EventState,
    eventEndDate?: Date,
    currentDate: Date = new Date()
): EventState | null {
    if (!eventEndDate) {
        return null;
    }

    if (currentState === "ongoing" && currentDate >= eventEndDate) {
        return "completed";
    }

    return null;
}

/**
 * Gets all valid next states for a given current state and user context
 */
export function getValidNextStates(
    currentState: EventState,
    userRole: UserRole,
    isOwner: boolean = false
): EventState[] {
    const structurallyValid = EVENT_STATE_TRANSITIONS[currentState] || [];

    return structurallyValid.filter((nextState) =>
        hasTransitionPermission(currentState, nextState, userRole, isOwner)
    );
}

/**
 * Checks if an event is in a terminal state
 */
export function isTerminalState(state: EventState): boolean {
    return EVENT_STATE_TRANSITIONS[state].length === 0;
}

/**
 * Checks if an event can accept registrations in its current state
 */
export function canAcceptRegistrations(state: EventState): boolean {
    return state === "published";
}

/**
 * Checks if an event is visible in discovery/search
 */
export function isDiscoverable(state: EventState): boolean {
    return state === "published" || state === "ongoing";
}

/**
 * Checks if an event can be edited
 */
export function canEditEvent(state: EventState, userRole: UserRole): boolean {
  if ((userRole === 'super_admin' || userRole === 'admin') && state !== 'archived') {
    return true;
  }

  if (userRole === 'organizer') {
    return state === 'draft' || state === 'pending_approval';
  }

  return false;
}

/**
 * Gets the lifecycle stage category for reporting/analytics
 */
export function getLifecycleStage(state: EventState): string {
    switch (state) {
        case "draft":
        case "pending_approval":
            return "preparation";
        case "published":
            return "active";
        case "ongoing":
            return "in_progress";
        case "completed":
            return "concluded";
        case "cancelled":
            return "cancelled";
        case "archived":
            return "archived";
        default:
            return "unknown";
    }
}

/**
 * Lifecycle Engine Error Types
 */
export class LifecycleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LifecycleError";
    }
}

export class InvalidTransitionError extends LifecycleError {
    constructor(from: EventState, to: EventState) {
        super(`Invalid transition: ${from} → ${to}`);
        this.name = "InvalidTransitionError";
    }
}

export class PermissionDeniedError extends LifecycleError {
    constructor(message: string) {
        super(message);
        this.name = "PermissionDeniedError";
    }
}

export class BusinessRuleViolationError extends LifecycleError {
    constructor(message: string) {
        super(message);
        this.name = "BusinessRuleViolationError";
    }
}