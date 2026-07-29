# Validation Module

## Overview
This module provides validation utilities for the LPU Events Admin Website. It includes domain-specific validators and shared validation functions.

## Directory Structure

- **BookingValidator.ts** - Validators for booking-related data
- **EventValidator.ts** - Validators for event-related data
- **validators.ts** - Shared validator functions

## Usage

```typescript
import { BookingValidator } from '@/lib/validators/BookingValidator';
import { EventValidator } from '@/lib/validators/EventValidator';
import { validatePassword } from '@/lib/validators/validators';

// Validate booking data
const result = BookingValidator.validateBooking(bookingData);
if (!result.success) {
  console.error('Validation failed:', result.error);
}
```

## Functions

See individual validator files for detailed documentation.

---

Last updated: 2026-07-28
