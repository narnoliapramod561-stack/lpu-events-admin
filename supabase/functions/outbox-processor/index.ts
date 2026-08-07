import { success } from '../_shared/response.ts';
import { createServiceClient } from '../_shared/auth.ts';
import { handleRpcError, handleUnexpectedError } from '../_shared/errors.ts';
import { handleCors } from '../_shared/cors.ts';
import { withSentry } from '../_shared/sentry.ts';

// ─── Dependency Engine (inline for Edge Function) ─────────────────────────
// Maps outbox event types + changed fields → affected sync resource types.
// Mirrors lib/cache/dependency-engine.ts but inlined for Deno compatibility.

interface OutboxEventPayload {
  event_id?: string;
  is_featured?: boolean;
  category_id?: string;
  starts_at?: string;
  changed_fields?: string[];
  [key: string]: unknown;
}

interface OutboxEventRow {
  id: string;
  event_type: string;
  resource_type: string;
  resource_id: string;
  payload: OutboxEventPayload;
  retry_count: number;
}

const FEATURED_FIELDS = new Set(['title', 'cover_image_url', 'is_featured', 'status']);
const SCHEDULE_FIELDS = new Set(['starts_at', 'ends_at', 'status']);
const SEARCH_FIELDS = new Set(['title', 'description', 'short_description', 'venue', 'status']);
const CATEGORY_FIELDS = new Set(['category_id']);

function getAffectedResources(eventType: string, payload: OutboxEventPayload): string[] {
  const resources = new Set<string>(['events']);
  const changed = payload.changed_fields ?? [];
  const changedSet = new Set(changed);

  switch (eventType) {
    case 'event.published':
    case 'event.approved':
      resources.add('featured_events');
      resources.add('schedule_sections');
      resources.add('search_index');
      break;
    case 'event.submitted_for_approval':
      break;
    case 'event.rejected':
    case 'event.cancelled':
    case 'event.deleted':
      resources.add('featured_events');
      resources.add('schedule_sections');
      resources.add('search_index');
      break;
    case 'event.completed':
      resources.add('featured_events');
      resources.add('schedule_sections');
      break;
    case 'event.archived':
      break;
    case 'event.edited':
      for (const f of FEATURED_FIELDS) { if (changedSet.has(f)) { resources.add('featured_events'); break; } }
      for (const f of SCHEDULE_FIELDS) { if (changedSet.has(f)) { resources.add('schedule_sections'); break; } }
      for (const f of SEARCH_FIELDS) { if (changedSet.has(f)) { resources.add('search_index'); break; } }
      for (const f of CATEGORY_FIELDS) { if (changedSet.has(f)) { resources.add('categories'); break; } }
      break;
    default:
      break;
  }

  return Array.from(resources);
}

function hasAnyMatch(changedSet: Set<string>, fields: Set<string>): boolean {
  for (const f of fields) { if (changedSet.has(f)) return true; }
  return false;
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(withSentry('outbox-processor', async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST',
      },
    });
  }

  try {
    const supabase = createServiceClient();

    // ─── 1. Expire stale reservations (existing logic) ──────────────────
    const expireResult = await supabase.rpc('expire_reservations_batch', {
      p_batch_size: 100,
    });

    if (expireResult.error) {
      return handleRpcError({
        message: String((expireResult.error as unknown as { message?: string }).message || ''),
        code: (expireResult.error as unknown as { code?: string }).code,
        details: (expireResult.error as unknown as { details?: string }).details,
      });
    }

    // ─── 2. Process unprocessed outbox events ───────────────────────────
    // Poll for events that are ready to process (processed=false, process_after <= now)
    const { data: outboxRows, error: outboxError } = await supabase
      .from('outbox_events')
      .select('id, event_type, resource_type, resource_id, payload, retry_count')
      .eq('processed', false)
      .lte('process_after', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50);

    if (outboxError) {
      console.error('[outbox-processor] Error fetching outbox events:', outboxError.message);
      // Don't fail the whole request — reservation expiry still succeeded
      return success('Outbox processor completed with outbox fetch error', {
        expired_reservations: expireResult.data?.expired_count || 0,
        outbox_processed: 0,
        outbox_error: outboxError.message,
      });
    }

    let outboxProcessed = 0;
    let outboxFailed = 0;
    const allResourcesToBump = new Set<string>();

    if (outboxRows && outboxRows.length > 0) {
      for (const row of outboxRows as OutboxEventRow[]) {
        try {
          // Determine affected resources via dependency engine
          const affected = getAffectedResources(row.event_type, row.payload);
          for (const r of affected) {
            allResourcesToBump.add(r);
          }

          // Mark as processed
          const { error: markError } = await supabase
            .from('outbox_events')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
            })
            .eq('id', row.id);

          if (markError) {
            console.error(`[outbox-processor] Error marking event ${row.id} as processed:`, markError.message);
            outboxFailed++;
          } else {
            outboxProcessed++;
          }
        } catch (err) {
          console.error(`[outbox-processor] Error processing outbox event ${row.id}:`, err);
          // Increment retry count, set error message
          const maxRetries = 5;
          const newRetryCount = (row.retry_count || 0) + 1;
          const shouldRetry = newRetryCount < maxRetries;

          await supabase
            .from('outbox_events')
            .update({
              retry_count: newRetryCount,
              error_message: err instanceof Error ? err.message : String(err),
              process_after: shouldRetry
                ? new Date(Date.now() + 1000 * Math.pow(2, newRetryCount)).toISOString() // Exponential backoff
                : new Date().toISOString(), // No more retries
            })
            .eq('id', row.id);

          outboxFailed++;
        }
      }

      // ─── 3. Bump sync_versions for all affected resources ─────────────
      if (allResourcesToBump.size > 0) {
        const resourceTypes = Array.from(allResourcesToBump);
        const { error: bumpError } = await supabase.rpc('bump_sync_resource_versions', {
          p_resource_types: resourceTypes,
        });

        if (bumpError) {
          console.error('[outbox-processor] Error bumping resource versions:', bumpError.message);
        }
      }
    }

    return success('Outbox processor executed successfully', {
      expired_reservations: expireResult.data?.expired_count || 0,
      outbox_processed: outboxProcessed,
      outbox_failed: outboxFailed,
      resources_bumped: Array.from(allResourcesToBump),
    });
  } catch (err) {
    return handleUnexpectedError(err);
  }
}));
