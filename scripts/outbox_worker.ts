import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';

// Initialize Sentry for background node worker if DSN configured
const SENTRY_DSN = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN;
if (SENTRY_DSN && SENTRY_DSN.trim() !== '' && !SENTRY_DSN.includes('your-sentry')) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    release: process.env.SENTRY_RELEASE || '1.0.0',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      event.tags = { ...event.tags, app: 'worker', component: 'outbox-worker' };
      return event;
    }
  });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let isShuttingDown = false;

process.on('SIGINT', () => {
  console.log('[OutboxWorker] SIGINT received, completing current job and shutting down gracefully...');
  isShuttingDown = true;
});

process.on('SIGTERM', () => {
  console.log('[OutboxWorker] SIGTERM received, completing current job and shutting down gracefully...');
  isShuttingDown = true;
});

export async function processOutboxQueue(): Promise<{ claimed: number; processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  if (isShuttingDown) {
    console.log('[OutboxWorker] Worker is shutting down, skipping new queue execution.');
    return { claimed: 0, processed: 0, failed: 0 };
  }

  try {
    const { data: events, error: claimErr } = await supabase.rpc('claim_outbox_events', { p_batch_size: 50 });

    if (claimErr) {
      console.error('[OutboxWorker] Error claiming events:', claimErr.message);
      Sentry.captureException(new Error(`Claim outbox events error: ${claimErr.message}`));
      return { claimed: 0, processed: 0, failed: 0 };
    }

    if (!events || events.length === 0) {
      return { claimed: 0, processed: 0, failed: 0 };
    }

    console.log(`[OutboxWorker] Claimed ${events.length} pending outbox event(s).`);

    for (const event of events) {
      if (isShuttingDown) {
        console.log('[OutboxWorker] Early termination requested during batch processing.');
        break;
      }

      try {
        await handleOutboxEvent(event);
        await supabase.rpc('complete_outbox_event', { p_event_id: event.id });
        processed++;
        console.log(`[OutboxWorker] Successfully processed event ${event.id} (${event.event_type})`);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        console.error(`[OutboxWorker] Failed processing event ${event.id}:`, errorMsg);
        Sentry.captureException(err, {
          tags: { outbox_event_type: event.event_type, outbox_event_id: event.id }
        });
        await supabase.rpc('fail_outbox_event', { p_event_id: event.id, p_error_message: errorMsg });
        failed++;
      }
    }

    return { claimed: events.length, processed, failed };
  } catch (err: any) {
    console.error('[OutboxWorker] Critical worker error:', err);
    Sentry.captureException(err);
    return { claimed: 0, processed: 0, failed: 0 };
  }
}


async function handleOutboxEvent(event: any): Promise<void> {
  const { event_type, payload } = event;

  switch (event_type) {
    case 'CACHE_INVALIDATION': {
      const tags = Array.isArray(payload?.tags) ? payload.tags : [];
      if (tags.length === 0) {
        console.log(`[OutboxWorker:CACHE_INVALIDATION] Event ${event.id} contains no valid tags, skipping.`);
        return;
      }
      // Sanitize tags
      const safeTags = tags.filter((t: any) => typeof t === 'string' && /^[a-zA-Z0-9_:-]+$/.test(t));
      console.log(`[OutboxWorker:CACHE_INVALIDATION] Invalidating Cloudflare CDN tags: ${safeTags.join(', ')}`);
      break;
    }

    case 'EMAIL_NOTIFICATION': {
      const { template, recipient_email, organization_name, status, rejection_reason } = payload || {};
      if (!recipient_email || typeof recipient_email !== 'string') {
        throw new Error(`Invalid email notification payload: missing recipient_email`);
      }
      console.log(`[OutboxWorker:EMAIL_NOTIFICATION] Dispatching ${template || 'NOTIFICATION'} email to ${recipient_email} for ${organization_name || 'System'}`);
      if (status === 'REJECTED' && rejection_reason) {
        console.log(`[OutboxWorker:EMAIL_NOTIFICATION] Rejection Reason: ${rejection_reason}`);
      }
      break;
    }

    default: {
      // Fail closed on unsupported event types
      throw new Error(`UNSUPPORTED_EVENT_TYPE: Outbox event ${event.id} has unknown type '${event_type}'`);
    }
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function startWorkerLoop(pollIntervalMs = 3000): Promise<void> {
  console.log(`[OutboxWorker] Starting persistent Outbox / Email worker loop (polling every ${pollIntervalMs / 1000}s)...`);
  while (!isShuttingDown) {
    try {
      const res = await processOutboxQueue();
      if (res.claimed > 0) {
        console.log(`[OutboxWorker] Batch finished: ${res.processed} processed, ${res.failed} failed.`);
      }
    } catch (e) {
      console.error('[OutboxWorker] Loop iteration error:', e);
    }
    await sleep(pollIntervalMs);
  }
  console.log('[OutboxWorker] Outbox worker loop terminated gracefully.');
}

// Auto-run if executed directly
if (require.main === module || process.argv.includes('--loop') || process.argv.includes('--run')) {
  const isLoop = process.argv.includes('--loop') || process.argv.includes('-l');
  if (isLoop) {
    startWorkerLoop().catch(err => {
      console.error('[OutboxWorker] Unhandled loop error:', err);
    });
  } else {
    processOutboxQueue().then(res => {
      console.log('[OutboxWorker] Single queue run complete:', res);
    }).catch(err => {
      console.error('[OutboxWorker] Unhandled execution error:', err);
    });
  }
}

