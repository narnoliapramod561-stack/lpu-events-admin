// batch-invalidator.ts
// Batch Invalidation — collects version bump requests within a debounce window
// =============================================================================
//
// When many events are edited together (e.g., bulk operations, scheduled jobs),
// we don't want to bump sync_versions after every single edit. Instead, we
// collect all resource types within a 100ms window, deduplicate them, and
// fire a single bump_sync_resource_versions RPC call.
//
// This prevents cache stampedes and minimizes database round-trips.
// =============================================================================

import { bumpResourceVersions } from "./resource-version-bumper";
import type { ResourceType } from "./dependency-engine";

/** Debounce window in milliseconds. */
const BATCH_WINDOW_MS = 100;

/** Maximum batch size before forcing a flush. */
const MAX_BATCH_SIZE = 50;

/** Pending resource types waiting to be bumped. */
const pendingResources = new Set<ResourceType>();

/** Timer reference for the debounce window. */
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Whether a flush is currently in progress. */
let flushing = false;

/**
 * Schedules a resource version bump. Multiple calls within the debounce
 * window are batched into a single RPC call.
 *
 * @param resourceTypes - Resource types to bump
 */
export function scheduleVersionBump(resourceTypes: ResourceType[]): void {
    for (const rt of resourceTypes) {
        pendingResources.add(rt);
    }

    // If batch is getting large, flush immediately
    if (pendingResources.size >= MAX_BATCH_SIZE) {
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }
        void flushPending();
        return;
    }

    // Schedule a flush if not already scheduled
    if (!flushTimer && !flushing) {
        flushTimer = setTimeout(() => {
            flushTimer = null;
            void flushPending();
        }, BATCH_WINDOW_MS);
    }
}

/**
 * Flushes all pending resource version bumps immediately.
 * Called automatically by the debounce timer, or manually for testing.
 */
export async function flushPending(): Promise<{
    success: boolean;
    bumped: ResourceType[];
    error?: string;
}> {
    if (flushing) {
        return { success: true, bumped: [] };
    }

    if (pendingResources.size === 0) {
        return { success: true, bumped: [] };
    }

    flushing = true;

    // Snapshot and clear the pending set
    const toBump = Array.from(pendingResources);
    pendingResources.clear();

    try {
        const result = await bumpResourceVersions(toBump);
        return result;
    } finally {
        flushing = false;
    }
}

/**
 * Waits for all pending bumps to complete.
 * Useful for tests and graceful shutdown.
 */
export async function drainPending(): Promise<void> {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    await flushPending();
}

/**
 * Clears all pending bumps without executing them.
 * Useful for cleanup in tests.
 */
export function clearPending(): void {
    pendingResources.clear();
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    flushing = false;
}
