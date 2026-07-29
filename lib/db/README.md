# Database Layer

## Overview
This module provides database access layer for the LPU Events Admin Website. It handles database queries and data retrieval.

## Directory Structure

- **events.ts** - Event-related database operations
- **categories.ts** - Category-related database operations

## Usage

```typescript
import { getAllPublishedEvents } from '@/lib/db/events';
import { getAllCategories } from '@/lib/db/categories';

// Fetch published events
const events = await getAllPublishedEvents();

// Fetch all categories
const categories = await getAllCategories();
```

## Functions

### Events
- `getAllPublishedEvents()` - Get all published events
- `getAllCategorySlugsForBuild()` - Get category slugs for static generation
- `getEventById(eventId)` - Get event by ID

### Categories
- `getAllCategories()` - Get all categories
- `getAllCategorySlugsForBuild()` - Get category slugs for static generation

---

Last updated: 2026-07-28
