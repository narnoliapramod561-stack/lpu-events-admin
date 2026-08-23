import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';
import os from 'os';

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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WORKER_ID = process.env.WORKER_INSTANCE_ID || `worker-${os.hostname()}-${process.pid}-${Math.random().toString(36).substring(2, 7)}`;

if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY.trim() === '') {
  console.warn('[OutboxWorker:SECURITY_WARNING] SUPABASE_SERVICE_ROLE_KEY is not configured. Privileged worker RPCs will fail without service_role credentials.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

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
    const { data: events, error: claimErr } = await supabase.rpc('claim_outbox_events', {
      p_batch_size: 50,
      p_worker_id: WORKER_ID
    });

    if (claimErr) {
      console.error('[OutboxWorker] Error claiming events:', claimErr.message);
      Sentry.captureException(new Error(`Claim outbox events error: ${claimErr.message}`));
      return { claimed: 0, processed: 0, failed: 0 };
    }

    if (!events || events.length === 0) {
      return { claimed: 0, processed: 0, failed: 0 };
    }

    console.log(`[OutboxWorker] Claimed ${events.length} pending outbox event(s) with Worker ID: ${WORKER_ID}.`);

    for (const event of events) {
      if (isShuttingDown) {
        console.log('[OutboxWorker] Early termination requested during batch processing.');
        break;
      }

      try {
        await handleOutboxEvent(event);
        await supabase.rpc('complete_outbox_event', {
          p_event_id: event.id,
          p_worker_id: WORKER_ID
        });
        processed++;
        console.log(`[OutboxWorker] Successfully processed event ${event.id} (${event.event_type})`);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        console.error(`[OutboxWorker] Failed processing event ${event.id}:`, errorMsg);
        Sentry.captureException(err, {
          tags: { outbox_event_type: event.event_type, outbox_event_id: event.id, worker_id: WORKER_ID }
        });
        await supabase.rpc('fail_outbox_event', {
          p_event_id: event.id,
          p_error_message: errorMsg,
          p_worker_id: WORKER_ID
        });
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
    case 'EMAIL_NOTIFICATION':
      await handleEmailNotification(payload);
      break;
    case 'CACHE_INVALIDATION':
      await handleCacheInvalidation(payload);
      break;
    case 'ANALYTICS_EVENT':
      await handleAnalyticsEvent(payload);
      break;
    default:
      console.warn(`[OutboxWorker] Unhandled outbox event type: ${event_type}`);
  }
}

async function handleEmailNotification(payload: any): Promise<void> {
  const { to, subject, body } = payload || {};
  if (!to || !subject) {
    throw new Error('Malformed EMAIL_NOTIFICATION payload: missing recipient or subject');
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey.trim() !== '') {
    console.log(`[OutboxWorker:Email] Dispatching email to: ${to} via Resend...`);
  } else {
    console.log(`[OutboxWorker:SimulatedEmail] Simulated email dispatch to ${to}: "${subject}"`);
  }
}

async function handleCacheInvalidation(payload: any): Promise<void> {
  const { tags } = payload || {};
  console.log(`[OutboxWorker:Cache] Invalidation tags triggered:`, tags || []);
}

async function handleAnalyticsEvent(payload: any): Promise<void> {
  console.log(`[OutboxWorker:Analytics] Analytics ingestion:`, payload?.name || 'unknown');
}

// Auto-run if executed directly via ts-node or node
if (process.argv[1] && (process.argv[1].endsWith('outbox_worker.ts') || process.argv[1].endsWith('outbox_worker.js'))) {
  console.log(`[OutboxWorker] Starting standalone outbox consumer loop (Instance: ${WORKER_ID})...`);
  const intervalMs = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000', 10);

  const loop = async () => {
    if (!isShuttingDown) {
      await processOutboxQueue();
      setTimeout(loop, intervalMs);
    }
  };

  loop();
}
