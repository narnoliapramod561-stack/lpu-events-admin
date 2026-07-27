# Event Domain Foundation - P4-T01 & P4-T02

This directory contains the complete Event Domain Foundation including the Event Lifecycle Engine.

## Overview

The Event Domain Foundation provides:

- **Shared Types** (`types.ts`) - Core event types aligned with database schema
- **Shared Validators** (`validators.ts`) - Zod validators for event data
- **Shared DTOs** (`dto.ts`) - Data Transfer Objects for API operations
- **State Model** (`state-model.ts`) - Basic state transition rules
- **Constants** (`constants.ts`) - Shared constants and descriptions
- **Lifecycle Engine** (`lifecycle-engine.ts`) - **Single source of truth** for event lifecycle management

## Event Lifecycle Engine (P4-T02)

### States

The system uses a **7-state model** aligned with the database `event_status` enum:

1. **draft** - Under creation by organizer
2. **pending_approval** - Awaiting Super Admin review
3. **published** - Live and accepting registrations
4. **ongoing** - Event in progress
5. **completed** - Event concluded
6. **cancelled** - Event cancelled
7. **archived** - Terminal state, moved to cold storage

### State Transitions

Valid transitions defined in `EVENT_STATE_TRANSITIONS`:

- `draft` → `pending_approval`, `published`, `cancelled`
- `pending_approval` → `published`, `draft`, `cancelled`
- `published` → `ongoing`, `cancelled`
- `ongoing` → `completed`, `cancelled`
- `completed` → `archived`
- `cancelled` → `archived`
- `archived` → (terminal state, no transitions)

### Role-Based Permissions

#### Students
- Cannot perform any state transitions
- Can only view published/ongoing events

#### Organizers
- Can manage their own events (must be owner)
- **draft** → `pending_approval`, `published`, `cancelled`
- **pending_approval** → `draft` (withdrawal)
- **published** → `ongoing`, `cancelled` (with restrictions)
- **ongoing** → `completed`
- Cannot manually archive events
- Cannot approve pending_approval → published

#### Super Admins
- Full control over all events
- Can perform any structurally valid transition
- Can approve events (pending_approval → published)
- Can manually archive events

### Business Rules

#### Cancellation Rules

**Free Events:**
- Owner organizer or super admin can cancel directly

**Paid Events:**
- Organizers cannot cancel directly (requires Super Admin approval)
- Super Admin can cancel and triggers automatic refund processing
- Cancellation from paid events sets `triggersRefund: true`

#### Automatic Transitions

- **ongoing → completed**: Triggered when event end date is reached

### Core Functions

#### `isValidTransition(currentState, newState): boolean`
Validates if a transition is structurally valid (ignores permissions).

#### `hasTransitionPermission(currentState, newState, userRole, isOwner): boolean`
Checks if a user has permission to perform a transition.

#### `validateTransition(context: TransitionContext): TransitionResult`
Complete validation including structure, permissions, and business rules.

#### `validateCancellation(context: TransitionContext): TransitionResult`
Special validation for cancellation with paid booking checks.

#### `getAutomaticTransition(currentState, eventEndDate, currentDate): EventState | null`
Determines if automatic transition should occur based on time.

#### `getValidNextStates(currentState, userRole, isOwner): EventState[]`
Returns all valid next states for a user in a given context.

### Helper Functions

- `isTerminalState(state)` - Check if state is terminal
- `canAcceptRegistrations(state)` - Check if registrations are allowed
- `isDiscoverable(state)` - Check if event should appear in discovery
- `canEditEvent(state, userRole)` - Check if event can be edited
- `getLifecycleStage(state)` - Get lifecycle category for analytics

### Error Classes

- `LifecycleError` - Base error class
- `InvalidTransitionError` - Invalid state transition attempted
- `PermissionDeniedError` - User lacks permission
- `BusinessRuleViolationError` - Business rule violated

## Usage Examples

### Validate a Transition

```typescript
import { validateTransition } from './lifecycle-engine';

const result = validateTransition({
  currentState: 'draft',
  newState: 'published',
  userRole: 'organizer',
  isOwner: true,
});

if (result.allowed) {
  // Perform transition
} else {
  console.error(result.reason);
}
```

### Check Cancellation

```typescript
import { validateCancellation } from './lifecycle-engine';

const result = validateCancellation({
  currentState: 'published',
  newState: 'cancelled',
  userRole: 'organizer',
  isOwner: true,
  hasPaidBookings: true,
});

if (!result.allowed && result.requiresApproval) {
  // Show "Contact Super Admin" message
}
```

### Get Valid Actions

```typescript
import { getValidNextStates } from './lifecycle-engine';

const validStates = getValidNextStates('draft', 'organizer', true);
// Returns: ['pending_approval', 'published', 'cancelled']
```

## Testing

Comprehensive tests are located in `__tests__/domain/lifecycle-engine.test.ts`.

Tests cover:
- All valid transitions
- All invalid transitions
- Permission enforcement for all roles
- Cancellation business rules
- Automatic transitions
- Helper functions
- Error classes

## Integration

The lifecycle engine is framework-independent and can be used by:

- Next.js API routes
- Supabase Edge Functions
- Supabase RPC functions
- Frontend state management
- Backend services

Always use the lifecycle engine for state transitions to ensure consistency across the application.

## Architecture Alignment

This implementation aligns with:

- Database schema (`event_status` enum in DB-009)
- Event requirements (REQ-EVENT-002, REQ-EVENT-003)
- Canonical LPU Events architecture
- Phase 4 implementation roadmap

## Version

- **P4-T01**: Event Domain Foundation - Completed
- **P4-T02**: Event Lifecycle Engine - Completed
- **Updated**: 2026-07-26
- **Status**: Production Ready (Pending Test Execution)