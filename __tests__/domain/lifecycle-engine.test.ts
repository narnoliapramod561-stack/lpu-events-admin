// lifecycle-engine.test.ts
// Comprehensive tests for Event Lifecycle Engine
// ==============================================

import {
    isValidTransition,
    hasTransitionPermission,
    validateCancellation,
    validateTransition,
    getAutomaticTransition,
    getValidNextStates,
    isTerminalState,
    canAcceptRegistrations,
    isDiscoverable,
    canEditEvent,
    getLifecycleStage,
    EVENT_STATE_TRANSITIONS,
    InvalidTransitionError,
    PermissionDeniedError,
    BusinessRuleViolationError,
    type TransitionContext,
} from "../../lib/domain/lifecycle-engine";


describe("Event Lifecycle Engine", () => {
    describe("EVENT_STATE_TRANSITIONS", () => {
        test("should define all valid transitions", () => {
            expect(EVENT_STATE_TRANSITIONS.draft).toContain("pending_approval");
            expect(EVENT_STATE_TRANSITIONS.draft).toContain("published");
            expect(EVENT_STATE_TRANSITIONS.draft).toContain("cancelled");

            expect(EVENT_STATE_TRANSITIONS.pending_approval).toContain("published");
            expect(EVENT_STATE_TRANSITIONS.pending_approval).toContain("draft");
            expect(EVENT_STATE_TRANSITIONS.pending_approval).toContain("cancelled");

            expect(EVENT_STATE_TRANSITIONS.published).toContain("ongoing");
            expect(EVENT_STATE_TRANSITIONS.published).toContain("cancelled");

            expect(EVENT_STATE_TRANSITIONS.ongoing).toContain("completed");
            expect(EVENT_STATE_TRANSITIONS.ongoing).toContain("cancelled");

            expect(EVENT_STATE_TRANSITIONS.completed).toContain("archived");

            expect(EVENT_STATE_TRANSITIONS.cancelled).toContain("archived");

            expect(EVENT_STATE_TRANSITIONS.archived).toEqual([]);
        });
    });

    describe("isValidTransition", () => {
        test("should allow valid draft transitions", () => {
            expect(isValidTransition("draft", "pending_approval")).toBe(true);
            expect(isValidTransition("draft", "published")).toBe(true);
            expect(isValidTransition("draft", "cancelled")).toBe(true);
        });

        test("should reject invalid draft transitions", () => {
            expect(isValidTransition("draft", "ongoing")).toBe(false);
            expect(isValidTransition("draft", "completed")).toBe(false);
            expect(isValidTransition("draft", "archived")).toBe(false);
        });

        test("should allow valid pending_approval transitions", () => {
            expect(isValidTransition("pending_approval", "published")).toBe(true);
            expect(isValidTransition("pending_approval", "draft")).toBe(true);
            expect(isValidTransition("pending_approval", "cancelled")).toBe(true);
        });

        test("should allow valid published transitions", () => {
            expect(isValidTransition("published", "ongoing")).toBe(true);
            expect(isValidTransition("published", "cancelled")).toBe(true);
        });

        test("should reject invalid published transitions", () => {
            expect(isValidTransition("published", "draft")).toBe(false);
            expect(isValidTransition("published", "pending_approval")).toBe(false);
            expect(isValidTransition("published", "completed")).toBe(false);
        });

        test("should allow valid ongoing transitions", () => {
            expect(isValidTransition("ongoing", "completed")).toBe(true);
            expect(isValidTransition("ongoing", "cancelled")).toBe(true);
        });

        test("should allow valid completed transitions", () => {
            expect(isValidTransition("completed", "archived")).toBe(true);
        });

        test("should reject transitions from completed to other states", () => {
            expect(isValidTransition("completed", "draft")).toBe(false);
            expect(isValidTransition("completed", "published")).toBe(false);
            expect(isValidTransition("completed", "cancelled")).toBe(false);
        });

        test("should allow cancelled to archived", () => {
            expect(isValidTransition("cancelled", "archived")).toBe(true);
        });

        test("should reject all transitions from archived", () => {
            expect(isValidTransition("archived", "draft")).toBe(false);
            expect(isValidTransition("archived", "published")).toBe(false);
            expect(isValidTransition("archived", "cancelled")).toBe(false);
        });
    });

    describe("hasTransitionPermission", () => {
        describe("student role", () => {
            test("should not allow any transitions", () => {
                expect(hasTransitionPermission("draft", "published", "student", true)).toBe(false);
                expect(hasTransitionPermission("published", "ongoing", "student", true)).toBe(false);
            });
        });

        describe("organizer role", () => {
            test("should allow draft transitions when owner", () => {
                expect(hasTransitionPermission("draft", "pending_approval", "organizer", true)).toBe(true);
                expect(hasTransitionPermission("draft", "published", "organizer", true)).toBe(true);
                expect(hasTransitionPermission("draft", "cancelled", "organizer", true)).toBe(true);
            });

            test("should not allow transitions when not owner", () => {
                expect(hasTransitionPermission("draft", "published", "organizer", false)).toBe(false);
                expect(hasTransitionPermission("published", "ongoing", "organizer", false)).toBe(false);
            });

            test("should allow withdrawal from pending_approval", () => {
                expect(hasTransitionPermission("pending_approval", "draft", "organizer", true)).toBe(true);
            });

            test("should not allow approval of pending events", () => {
                expect(hasTransitionPermission("pending_approval", "published", "organizer", true)).toBe(false);
            });

            test("should allow published to ongoing when owner", () => {
                expect(hasTransitionPermission("published", "ongoing", "organizer", true)).toBe(true);
            });

            test("should allow ongoing to completed when owner", () => {
                expect(hasTransitionPermission("ongoing", "completed", "organizer", true)).toBe(true);
            });

            test("should not allow manual archival", () => {
                expect(hasTransitionPermission("completed", "archived", "organizer", true)).toBe(false);
                expect(hasTransitionPermission("cancelled", "archived", "organizer", true)).toBe(false);
            });
        });

        describe("super_admin role", () => {
            test("should allow all valid transitions", () => {
                expect(hasTransitionPermission("draft", "published", "super_admin", false)).toBe(true);
                expect(hasTransitionPermission("pending_approval", "published", "super_admin", false)).toBe(true);
                expect(hasTransitionPermission("published", "ongoing", "super_admin", false)).toBe(true);
                expect(hasTransitionPermission("ongoing", "completed", "super_admin", false)).toBe(true);
                expect(hasTransitionPermission("completed", "archived", "super_admin", false)).toBe(true);
                expect(hasTransitionPermission("cancelled", "archived", "super_admin", false)).toBe(true);
            });
        });
    });

    describe("validateCancellation", () => {
        test("should allow super_admin to cancel any event", () => {
            const context: TransitionContext = {
                currentState: "published",
                newState: "cancelled",
                userRole: "super_admin",
                isOwner: false,
                hasPaidBookings: true,
            };

            const result = validateCancellation(context);
            expect(result.allowed).toBe(true);
            expect(result.triggersRefund).toBe(true);
        });

        test("should allow organizer to cancel free event when owner", () => {
            const context: TransitionContext = {
                currentState: "published",
                newState: "cancelled",
                userRole: "organizer",
                isOwner: true,
                hasPaidBookings: false,
            };

            const result = validateCancellation(context);
            expect(result.allowed).toBe(true);
            expect(result.triggersRefund).toBe(false);
        });

        test("should reject organizer cancellation of paid event", () => {
            const context: TransitionContext = {
                currentState: "published",
                newState: "cancelled",
                userRole: "organizer",
                isOwner: true,
                hasPaidBookings: true,
            };

            const result = validateCancellation(context);
            expect(result.allowed).toBe(false);
            expect(result.requiresApproval).toBe(true);
            expect(result.reason).toContain("Super Admin approval");
        });

        test("should reject organizer cancellation when not owner", () => {
            const context: TransitionContext = {
                currentState: "published",
                newState: "cancelled",
                userRole: "organizer",
                isOwner: false,
                hasPaidBookings: false,
            };

            const result = validateCancellation(context);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("do not have permission");
        });

        test("should reject cancellation from invalid states", () => {
            const context: TransitionContext = {
                currentState: "archived",
                newState: "cancelled",
                userRole: "super_admin",
                isOwner: true,
            };

            const result = validateCancellation(context);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("Cannot cancel event from state");
        });
    });

    describe("validateTransition", () => {
        test("should validate a valid transition with permission", () => {
            const context: TransitionContext = {
                currentState: "draft",
                newState: "published",
                userRole: "organizer",
                isOwner: true,
            };

            const result = validateTransition(context);
            expect(result.allowed).toBe(true);
        });

        test("should reject invalid structural transition", () => {
            const context: TransitionContext = {
                currentState: "draft",
                newState: "ongoing",
                userRole: "super_admin",
                isOwner: true,
            };

            const result = validateTransition(context);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("Invalid state transition");
        });

        test("should reject transition without permission", () => {
            const context: TransitionContext = {
                currentState: "draft",
                newState: "published",
                userRole: "student",
                isOwner: false,
            };

            const result = validateTransition(context);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("do not have permission");
        });

        test("should apply cancellation rules", () => {
            const context: TransitionContext = {
                currentState: "published",
                newState: "cancelled",
                userRole: "organizer",
                isOwner: true,
                hasPaidBookings: true,
            };

            const result = validateTransition(context);
            expect(result.allowed).toBe(false);
            expect(result.requiresApproval).toBe(true);
        });
    });

    describe("getAutomaticTransition", () => {
        test("should return completed when ongoing event ends", () => {
            const eventEndDate = new Date("2026-07-20T18:00:00Z");
            const currentDate = new Date("2026-07-20T19:00:00Z");

            const result = getAutomaticTransition("ongoing", eventEndDate, currentDate);
            expect(result).toBe("completed");
        });

        test("should return null when ongoing event has not ended", () => {
            const eventEndDate = new Date("2026-07-20T18:00:00Z");
            const currentDate = new Date("2026-07-20T17:00:00Z");

            const result = getAutomaticTransition("ongoing", eventEndDate, currentDate);
            expect(result).toBe(null);
        });

        test("should return null for non-ongoing states", () => {
            const eventEndDate = new Date("2026-07-20T18:00:00Z");
            const currentDate = new Date("2026-07-20T19:00:00Z");

            expect(getAutomaticTransition("draft", eventEndDate, currentDate)).toBe(null);
            expect(getAutomaticTransition("published", eventEndDate, currentDate)).toBe(null);
            expect(getAutomaticTransition("completed", eventEndDate, currentDate)).toBe(null);
        });

        test("should return null when no event end date provided", () => {
            const currentDate = new Date("2026-07-20T19:00:00Z");
            expect(getAutomaticTransition("ongoing", undefined, currentDate)).toBe(null);
        });
    });

    describe("getValidNextStates", () => {
        test("should return valid next states for organizer owner", () => {
            const states = getValidNextStates("draft", "organizer", true);
            expect(states).toContain("pending_approval");
            expect(states).toContain("published");
            expect(states).toContain("cancelled");
            expect(states).toHaveLength(3);
        });

        test("should return empty array for organizer non-owner", () => {
            const states = getValidNextStates("draft", "organizer", false);
            expect(states).toEqual([]);
        });

        test("should return empty array for students", () => {
            const states = getValidNextStates("draft", "student", false);
            expect(states).toEqual([]);
        });

        test("should return all structurally valid states for super_admin", () => {
            const states = getValidNextStates("draft", "super_admin", false);
            expect(states).toContain("pending_approval");
            expect(states).toContain("published");
            expect(states).toContain("cancelled");
        });
    });

    describe("isTerminalState", () => {
        test("should identify archived as terminal", () => {
            expect(isTerminalState("archived")).toBe(true);
        });

        test("should identify non-terminal states", () => {
            expect(isTerminalState("draft")).toBe(false);
            expect(isTerminalState("pending_approval")).toBe(false);
            expect(isTerminalState("published")).toBe(false);
            expect(isTerminalState("ongoing")).toBe(false);
            expect(isTerminalState("completed")).toBe(false);
            expect(isTerminalState("cancelled")).toBe(false);
        });
    });

    describe("canAcceptRegistrations", () => {
        test("should allow registrations only for published events", () => {
            expect(canAcceptRegistrations("published")).toBe(true);
        });

        test("should not allow registrations for other states", () => {
            expect(canAcceptRegistrations("draft")).toBe(false);
            expect(canAcceptRegistrations("pending_approval")).toBe(false);
            expect(canAcceptRegistrations("ongoing")).toBe(false);
            expect(canAcceptRegistrations("completed")).toBe(false);
            expect(canAcceptRegistrations("cancelled")).toBe(false);
            expect(canAcceptRegistrations("archived")).toBe(false);
        });
    });

    describe("isDiscoverable", () => {
        test("should make published and ongoing events discoverable", () => {
            expect(isDiscoverable("published")).toBe(true);
            expect(isDiscoverable("ongoing")).toBe(true);
        });

        test("should hide other states from discovery", () => {
            expect(isDiscoverable("draft")).toBe(false);
            expect(isDiscoverable("pending_approval")).toBe(false);
            expect(isDiscoverable("completed")).toBe(false);
            expect(isDiscoverable("cancelled")).toBe(false);
            expect(isDiscoverable("archived")).toBe(false);
        });
    });

    describe("canEditEvent", () => {
        test("should allow super_admin to edit non-archived events", () => {
            expect(canEditEvent("draft", "super_admin")).toBe(true);
            expect(canEditEvent("pending_approval", "super_admin")).toBe(true);
            expect(canEditEvent("published", "super_admin")).toBe(true);
            expect(canEditEvent("ongoing", "super_admin")).toBe(true);
            expect(canEditEvent("completed", "super_admin")).toBe(true);
            expect(canEditEvent("cancelled", "super_admin")).toBe(true);
            expect(canEditEvent("archived", "super_admin")).toBe(false);
        });

        test("should allow organizer to edit draft and pending_approval", () => {
            expect(canEditEvent("draft", "organizer")).toBe(true);
            expect(canEditEvent("pending_approval", "organizer")).toBe(true);
        });

        test("should not allow organizer to edit other states", () => {
            expect(canEditEvent("published", "organizer")).toBe(false);
            expect(canEditEvent("ongoing", "organizer")).toBe(false);
            expect(canEditEvent("completed", "organizer")).toBe(false);
            expect(canEditEvent("cancelled", "organizer")).toBe(false);
            expect(canEditEvent("archived", "organizer")).toBe(false);
        });

        test("should not allow students to edit", () => {
            expect(canEditEvent("draft", "student")).toBe(false);
            expect(canEditEvent("published", "student")).toBe(false);
        });
    });

    describe("getLifecycleStage", () => {
        test("should categorize preparation states", () => {
            expect(getLifecycleStage("draft")).toBe("preparation");
            expect(getLifecycleStage("pending_approval")).toBe("preparation");
        });

        test("should categorize active state", () => {
            expect(getLifecycleStage("published")).toBe("active");
        });

        test("should categorize in_progress state", () => {
            expect(getLifecycleStage("ongoing")).toBe("in_progress");
        });

        test("should categorize concluded state", () => {
            expect(getLifecycleStage("completed")).toBe("concluded");
        });

        test("should categorize cancelled state", () => {
            expect(getLifecycleStage("cancelled")).toBe("cancelled");
        });

        test("should categorize archived state", () => {
            expect(getLifecycleStage("archived")).toBe("archived");
        });
    });

    describe("Error Classes", () => {
        test("should create InvalidTransitionError", () => {
            const error = new InvalidTransitionError("draft", "ongoing");
            expect(error.name).toBe("InvalidTransitionError");
            expect(error.message).toContain("draft");
            expect(error.message).toContain("ongoing");
        });

        test("should create PermissionDeniedError", () => {
            const error = new PermissionDeniedError("Access denied");
            expect(error.name).toBe("PermissionDeniedError");
            expect(error.message).toBe("Access denied");
        });

        test("should create BusinessRuleViolationError", () => {
            const error = new BusinessRuleViolationError("Rule violated");
            expect(error.name).toBe("BusinessRuleViolationError");
            expect(error.message).toBe("Rule violated");
        });
    });
});