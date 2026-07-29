# Service Layer

## Overview
This module provides the service layer for the LPU Events Admin Website. It handles business logic and data access for different domains.

## Directory Structure

- **base/** - Base service class and common functionality
  - BaseService.ts - Abstract base class for all services
  - types.ts - Service result types
- **booking/** - Booking-related services
  - BookingService.ts - Booking operations
- **event/** - Event-related services
  - EventService.ts - Event operations
- **media/** - Media management services
  - MediaService.ts - Media operations
- **organizer/** - Organizer-related services
  - OrganizerService.ts - Organizer operations

## Architecture

All services extend the `BaseService` class which provides:
- Error handling
- Result wrapping
- Common service patterns

## Usage

```typescript
import { EventService } from '@/lib/services/event/EventService';
import { OrganizerService } from '@/lib/services/organizer/OrganizerService';

// Get event service instance
const eventService = new EventService();

// Use service methods
const result = await eventService.getAllEvents();
if (result.success) {
  console.log('Events:', result.data);
}
```

---

Last updated: 2026-07-28
