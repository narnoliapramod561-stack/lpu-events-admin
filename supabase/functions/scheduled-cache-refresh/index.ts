// scheduled-cache-refresh/index.ts
// Scheduled Cache Refresh Edge Function
// =============================================================================
//
// Triggered by Supabase Cron at midnight daily.
//
// Responsibilities:
//   1. Bump schedule_sections sync version → signals clients to re-filter
//      today/tomorrow/this-week from their local cache (no re-fetch needed).
//   2. Auto-complete events past their end date (published|ongoing → completed).
//   3. Auto-archive completed/cancelled events older than 30 days.
//
// Each auto-transition writes an outbox event → outbox processor bumps versions
// → clients sync on next poll.
// =============================================================================

import { success } from '../_shared/response.ts';
import { createServiceClient } from '../_shared/auth.ts';
import { handleUnexpectedError } from '../_shared/errors.ts';
import { handleCors } from '../_shared/cors.ts';
import { withSentry } from '../_shared/sentry.ts';

Deno.serve(withSentry('scheduled-cache-refresh', async (req: Request) => {
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
    const results = {
      schedule_sections_bumped: false,
      auto_completed: null as unknown | null,
      auto_archived: null as unknown | null,
    };

    // ─── 1. Bump schedule_sections version ─────────────────────────────
    // Signals all clients that today/tomorrow/this-week filters need
    // re-evaluation. Clients re-apply date filters on their local cache
    // without needing to re-fetch all events.
    const { error: bumpError } = await supabase.rpc('bump_schedule_sections');

    if (bumpError) {
      console.error('[scheduled-cache-refresh] Error bumping schedule_sections:', bumpError.message);
    } else {
      results.schedule_sections_bumped = true;
    }

    // ─── 2. Auto-complete past events ──────────────────────────────────
    // Events whose ends_at has passed and are still published/ongoing → completed
    const { data: completedResult, error: completeError } = await supabase.rpc(
      'auto_complete_past_events'
    );

    if (completeError) {
      console.error('[scheduled-cache-refresh] Error auto-completing events:', completeError.message);
    } else {
      results.auto_completed = completedResult;
    }

    // ─── 3. Auto-archive old events ─────────────────────────────────────
    // Completed/cancelled events older than 30 days → archived
    const { data: archivedResult, error: archiveError } = await supabase.rpc(
      'auto_archive_old_events',
      { p_days_after_completion: 30 }
    );

    if (archiveError) {
      console.error('[scheduled-cache-refresh] Error auto-archiving events:', archiveError.message);
    } else {
      results.auto_archived = archivedResult;
    }

    return success('Scheduled cache refresh completed', results);
  } catch (err) {
    return handleUnexpectedError(err);
  }
}));
