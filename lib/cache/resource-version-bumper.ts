// resource-version-bumper.ts
// Resource Version Bumper — bumps sync_versions for affected resources
// =============================================================================
//
// Called by the outbox processor after processing each outbox event.
// Delegates to the bump_sync_resource_versions RPC which atomically
// increments current_version for each resource type.
//
// Uses the service-role client to bypass RLS (the outbox processor runs
// as a system process, not an authenticated user).
// =============================================================================

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ResourceType } from "./dependency-engine";

/**
 * Bumps sync_versions.current_version for each resource type.
 *
 * @param resourceTypes - Array of resource types to bump (deduplicated internally)
 * @returns Promise that resolves when the bump is complete
 */
export async function bumpResourceVersions(
    resourceTypes: ResourceType[]
): Promise<{ success: boolean; bumped: ResourceType[]; error?: string }> {
    // Deduplicate
    const unique = Array.from(new Set(resourceTypes));

    if (unique.length === 0) {
        return { success: true, bumped: [] };
    }

    try {
        const supabase = createServiceRoleClient();
        const { error } = await supabase.rpc("bump_sync_resource_versions", {
            p_resource_types: unique,
        });

        if (error) {
            console.error("[resource-version-bumper] RPC error:", error.message);
            return {
                success: false,
                bumped: [],
                error: error.message,
            };
        }

        return { success: true, bumped: unique };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[resource-version-bumper] Unexpected error:", message);
        return {
            success: false,
            bumped: [],
            error: message,
        };
    }
}

/**
 * Bumps a single resource version.
 * Convenience wrapper around bumpResourceVersions for single-resource cases.
 */
export async function bumpResourceVersion(
    resourceType: ResourceType
): Promise<{ success: boolean; error?: string }> {
    const result = await bumpResourceVersions([resourceType]);
    return { success: result.success, error: result.error };
}

/**
 * Bumps the schedule_sections version.
 * Called by the scheduled-cache-refresh edge function at midnight.
 */
export async function bumpScheduleSections(): Promise<{ success: boolean; error?: string }> {
    return bumpResourceVersion("schedule_sections");
}

/**
 * Bumps the featured_events version.
 * Called when featured event set changes.
 */
export async function bumpFeaturedEvents(): Promise<{ success: boolean; error?: string }> {
    return bumpResourceVersion("featured_events");
}
