// dependency-engine.ts
// Centralized Dependency-Based Cache Invalidation Engine
// =============================================================================
//
// ARCHITECTURE:
//   Database Commit → Outbox Event → Dependency Engine → Affected Resources
//   → Bump sync_versions → Clients detect version change → Pull delta
//
// The student site is a Vite + React SPA. There are no Next.js cache APIs.
// "Cache invalidation" = bumping the affected resource's sync_versions.
// current_version. Clients detect the bump on next poll and pull only the
// delta via get_sync_changes.
//
// This module maps outbox event types + changed fields → affected resource
// types. It is called by the outbox processor edge function.
// =============================================================================

/**
 * Resource types tracked in sync_versions.
 * Real resources have corresponding tables with trigger_bump_sync_version.
 * Virtual resources are version-only counters (no table).
 */
export type ResourceType =
    | "events"
    | "categories"
    | "subcategories"
    | "ticket_types"
    | "event_inventory"
    | "profiles"
    | "advertisements"
    // Virtual resources (version-only counters)
    | "featured_events"
    | "schedule_sections"
    | "search_index";

/**
 * Outbox event payload shape (matches what the RPCs write).
 */
export interface OutboxEventPayload {
    event_id?: string;
    organizer_id?: string;
    title?: string;
    is_featured?: boolean;
    category_id?: string;
    starts_at?: string;
    previous_status?: string;
    changed_fields?: string[];
    [key: string]: unknown;
}

/**
 * A parsed outbox event ready for dependency analysis.
 */
export interface OutboxEvent {
    event_type: string;
    resource_type: string;
    resource_id: string;
    payload: OutboxEventPayload;
}

/**
 * Fields that affect the featured events section.
 * If any of these change, the featured_events virtual resource must be bumped.
 */
const FEATURED_AFFECTING_FIELDS: ReadonlySet<string> = new Set([
    "title",
    "cover_image_url",
    "is_featured",
    "status",
]);

/**
 * Fields that affect schedule sections (today/tomorrow/this-week).
 * If any of these change, the schedule_sections virtual resource must be bumped.
 */
const SCHEDULE_AFFECTING_FIELDS: ReadonlySet<string> = new Set([
    "starts_at",
    "ends_at",
    "status",
]);

/**
 * Fields that affect the search index.
 * If any of these change, the search_index virtual resource must be bumped.
 */
const SEARCH_AFFECTING_FIELDS: ReadonlySet<string> = new Set([
    "title",
    "description",
    "short_description",
    "venue",
    "status",
]);

/**
 * Fields that affect the categories resource.
 * If category_id changes, categories version is already bumped by the
 * trigger on the categories table. But we also bump it here for safety.
 */
const CATEGORY_AFFECTING_FIELDS: ReadonlySet<string> = new Set([
    "category_id",
]);

/**
 * Determines which resource versions need to be bumped based on an outbox event.
 *
 * Rules:
 * - event.published: event becomes visible → bump events + featured_events + schedule_sections + search_index
 * - event.approved: same as published
 * - event.submitted_for_approval: event not yet visible → bump events only (no featured/schedule)
 * - event.rejected: event was visible if it was published before → bump events + featured_events + schedule_sections
 * - event.cancelled: event was visible → bump events + featured_events + schedule_sections + search_index
 * - event.completed: event no longer visible as active → bump events + featured_events + schedule_sections
 * - event.archived: event removed from discovery → bump events
 * - event.edited: field-level analysis determines which sections are affected
 *
 * @param event - The outbox event to analyze
 * @returns Array of resource types whose versions should be bumped
 */
export function getAffectedResources(event: OutboxEvent): ResourceType[] {
    const { event_type, payload } = event;
    const changedFields = payload.changed_fields ?? [];
    const changedSet = new Set(changedFields);

    const resources = new Set<ResourceType>();

    // All event transitions bump the events resource
    // (trigger_bump_sync_version already does this automatically, but we
    // include it here so the outbox processor can batch-bump virtual resources
    // in the same call)
    resources.add("events");

    switch (event_type) {
        case "event.published":
        case "event.approved":
            // Event becomes visible to students
            resources.add("featured_events");
            resources.add("schedule_sections");
            resources.add("search_index");
            break;

        case "event.submitted_for_approval":
            // Event is NOT yet visible (pending_approval) — no need to bump
            // featured/schedule/search since students can't see it yet.
            // Only events version is bumped (already added above).
            break;

        case "event.rejected":
            // If the event was previously published (visible to students),
            // it's now hidden. If it was pending_approval, it was never visible.
            // We bump featured/schedule/search to be safe — clients will
            // remove it from their local cache on next sync.
            resources.add("featured_events");
            resources.add("schedule_sections");
            resources.add("search_index");
            break;

        case "event.cancelled":
            // Event was visible, now removed from active lists
            resources.add("featured_events");
            resources.add("schedule_sections");
            resources.add("search_index");
            break;

        case "event.completed":
            // Event no longer shows as "active" but may still be visible
            // in past events. Bump featured (if it was featured) and schedule.
            resources.add("featured_events");
            resources.add("schedule_sections");
            break;

        case "event.archived":
            // Event removed from discovery entirely. Only events version
            // needs bumping (already added). Clients will tombstone it.
            break;

        case "event.edited":
            // Field-level analysis — only bump what's actually affected
            bumpIfAnyMatch(changedSet, FEATURED_AFFECTING_FIELDS, resources, "featured_events");
            bumpIfAnyMatch(changedSet, SCHEDULE_AFFECTING_FIELDS, resources, "schedule_sections");
            bumpIfAnyMatch(changedSet, SEARCH_AFFECTING_FIELDS, resources, "search_index");
            bumpIfAnyMatch(changedSet, CATEGORY_AFFECTING_FIELDS, resources, "categories");
            break;

        case "event.deleted":
            // Soft delete — event removed from all sections
            resources.add("featured_events");
            resources.add("schedule_sections");
            resources.add("search_index");
            break;

        default:
            // Unknown event type — bump events only (already added)
            break;
    }

    return Array.from(resources);
}

/**
 * Helper: if any field in `fields` is present in `changedSet`, add `resource` to `resources`.
 */
function bumpIfAnyMatch(
    changedSet: Set<string>,
    fields: ReadonlySet<string>,
    resources: Set<ResourceType>,
    resource: ResourceType
): void {
    for (const field of fields) {
        if (changedSet.has(field)) {
            resources.add(resource);
            return;
        }
    }
}

/**
 * Batch version of getAffectedResources for multiple outbox events.
 * Deduplicates resource types across all events.
 *
 * @param events - Array of outbox events to analyze
 * @returns Deduplicated array of resource types to bump
 */
export function getAffectedResourcesBatch(events: OutboxEvent[]): ResourceType[] {
    const allResources = new Set<ResourceType>();
    for (const event of events) {
        const affected = getAffectedResources(event);
        for (const r of affected) {
            allResources.add(r);
        }
    }
    return Array.from(allResources);
}
