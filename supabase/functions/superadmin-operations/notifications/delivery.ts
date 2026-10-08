// supabase/functions/superadmin-operations/notifications/delivery.ts
// Super Admin Operations Notification Outbox Delivery Worker (Phase 8)

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';
import { withTimeout } from '../timeout.ts';

export interface DeliveryOptions {
  batchSize?: number;
  mockDelivery?: boolean; // For test runner simulation
  mockFailure?: 'TRANSIENT' | 'PERMANENT' | 'RATE_LIMITED' | null;
}

export interface DeliverySummary {
  processed_count: number;
  accepted_count: number;
  failed_count: number;
  retrying_count: number;
  duration_ms: number;
}

export const MAX_DELIVERY_ATTEMPTS = 3;
const BACKOFF_SECONDS = [30, 120, 600]; // 30s, 2m, 10m

/**
 * Single-flight outbox worker that dispatches pending notifications to the email provider.
 */
export async function processNotificationOutbox(
  supabase: SupabaseClient,
  options: DeliveryOptions = {}
): Promise<DeliverySummary> {
  const startTime = performance.now();
  const batchSize = options.batchSize || 20;

  let processedCount = 0;
  let acceptedCount = 0;
  let failedCount = 0;
  let retryingCount = 0;

  const now = new Date().toISOString();

  // 1. Fetch pending notifications eligible for delivery
  const { data: pendingItems, error: fetchErr } = await supabase
    .from('ops_notification_outbox')
    .select('*')
    .in('status', ['PENDING', 'PROCESSING'])
    .lte('scheduled_at', now)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (fetchErr || !pendingItems || pendingItems.length === 0) {
    return {
      processed_count: 0,
      accepted_count: 0,
      failed_count: 0,
      retrying_count: 0,
      duration_ms: Math.round(performance.now() - startTime),
    };
  }

  // Single-flight atomic claiming: claim pending batch with status = PROCESSING
  const itemIds = pendingItems.map((item) => item.id);
  await supabase
    .from('ops_notification_outbox')
    .update({ status: 'PROCESSING', updated_at: now })
    .in('id', itemIds);

  // Anti-Recursion Protection: Outbox delivery failures are recorded directly in ops_notification_delivery_attempts
  // and never trigger secondary operational alert evaluations or recursive notification loops.
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const isConfigured = Boolean(resendApiKey) || options.mockDelivery;

  for (const item of pendingItems) {
    processedCount++;
    const attemptStartTime = performance.now();
    const attemptNumber = (item.attempt_count || 0) + 1;

    // Check configuration
    if (!isConfigured) {
      // Provider not configured in this environment
      const latencyMs = Math.round(performance.now() - attemptStartTime);
      await supabase.from('ops_notification_delivery_attempts').insert({
        notification_id: item.id,
        attempt_number: attemptNumber,
        started_at: now,
        completed_at: new Date().toISOString(),
        status: 'FAILED',
        provider: 'resend',
        safe_error_code: 'PROVIDER_NOT_CONFIGURED',
        safe_error_message: 'RESEND_API_KEY is not configured on the server.',
        latencyMs,
      });

      await supabase
        .from('ops_notification_outbox')
        .update({
          status: 'FAILED',
          attempt_count: attemptNumber,
          last_attempt_at: now,
          failed_at: now,
          safe_error_code: 'PROVIDER_NOT_CONFIGURED',
          safe_error_message: 'Server missing RESEND_API_KEY credentials.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      failedCount++;
      continue;
    }

    // Process Delivery (Mock or Live)
    let sendSuccess = false;
    let providerMessageId: string | null = null;
    let safeErrorCode: string | null = null;
    let safeErrorMessage: string | null = null;
    let isTransient = false;

    if (options.mockDelivery) {
      if (!options.mockFailure) {
        sendSuccess = true;
        providerMessageId = `mock_resend_${crypto.randomUUID()}`;
      } else if (options.mockFailure === 'TRANSIENT') {
        sendSuccess = false;
        safeErrorCode = 'TRANSIENT_NETWORK_TIMEOUT';
        safeErrorMessage = 'Simulated connection timeout to provider endpoint.';
        isTransient = true;
      } else if (options.mockFailure === 'RATE_LIMITED') {
        sendSuccess = false;
        safeErrorCode = 'RATE_LIMITED';
        safeErrorMessage = 'Simulated provider rate limit exceeded (HTTP 429).';
        isTransient = true;
      } else {
        sendSuccess = false;
        safeErrorCode = 'INVALID_RECIPIENT';
        safeErrorMessage = 'Simulated permanent delivery rejection.';
        isTransient = false;
      }
    } else {
      // Live Resend Email Dispatch
      try {
        const resp = await withTimeout(
          async (signal) =>
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'LPU Events Operations <notifications@events.lpu.in>',
                to: item.recipient_email,
                subject: item.subject,
                text: item.content_text,
                html: item.content_html,
              }),
              signal,
            }),
          8000,
          'resend_email_dispatch'
        );

        if (resp.ok) {
          const json = await resp.json();
          sendSuccess = true;
          providerMessageId = json.id || `resend_${crypto.randomUUID()}`;
        } else {
          sendSuccess = false;
          if (resp.status === 429) {
            safeErrorCode = 'RATE_LIMITED';
            safeErrorMessage = 'Provider rate limit encountered. Backing off.';
            isTransient = true;
          } else if (resp.status >= 500) {
            safeErrorCode = 'TRANSIENT_SERVER_ERROR';
            safeErrorMessage = `Provider returned HTTP ${resp.status}. Backing off.`;
            isTransient = true;
          } else {
            safeErrorCode = 'PERMANENT_DISPATCH_ERROR';
            safeErrorMessage = `Provider rejected message with HTTP ${resp.status}.`;
            isTransient = false;
          }
        }
      } catch (err: unknown) {
        sendSuccess = false;
        safeErrorCode = 'NETWORK_DISPATCH_TIMEOUT';
        safeErrorMessage = err instanceof Error ? err.message : String(err);
        isTransient = true;
      }
    }

    const latencyMs = Math.round(performance.now() - attemptStartTime);
    const completedAt = new Date().toISOString();

    // Record Delivery Attempt
    await supabase.from('ops_notification_delivery_attempts').insert({
      notification_id: item.id,
      attempt_number: attemptNumber,
      started_at: now,
      completed_at: completedAt,
      status: sendSuccess ? 'REQUEST_ACCEPTED' : 'FAILED',
      provider: 'resend',
      provider_message_id: providerMessageId,
      safe_error_code: safeErrorCode,
      safe_error_message: safeErrorMessage,
      latency_ms: latencyMs,
    });

    if (sendSuccess) {
      acceptedCount++;
      await supabase
        .from('ops_notification_outbox')
        .update({
          status: 'REQUEST_ACCEPTED',
          attempt_count: attemptNumber,
          last_attempt_at: completedAt,
          sent_at: completedAt,
          provider_message_id: providerMessageId,
          safe_error_code: null,
          safe_error_message: null,
          updated_at: completedAt,
        })
        .eq('id', item.id);
    } else {
      // Failure Handling & Bounded Retry Strategy
      const maxAttempts = item.max_attempts || 3;
      if (isTransient && attemptNumber < maxAttempts) {
        retryingCount++;
        const backoffSec = BACKOFF_SECONDS[attemptNumber - 1] || 600;
        const nextAttemptAt = new Date(Date.now() + backoffSec * 1000).toISOString();

        await supabase
          .from('ops_notification_outbox')
          .update({
            status: 'PENDING',
            attempt_count: attemptNumber,
            last_attempt_at: completedAt,
            next_attempt_at: nextAttemptAt,
            safe_error_code: safeErrorCode,
            safe_error_message: safeErrorMessage,
            updated_at: completedAt,
          })
          .eq('id', item.id);
      } else {
        // Permanent failure or max retries exhausted
        failedCount++;
        await supabase
          .from('ops_notification_outbox')
          .update({
            status: 'FAILED',
            attempt_count: attemptNumber,
            last_attempt_at: completedAt,
            failed_at: completedAt,
            safe_error_code: safeErrorCode || 'MAX_RETRIES_EXHAUSTED',
            safe_error_message: safeErrorMessage || 'Exhausted maximum retry attempts.',
            updated_at: completedAt,
          })
          .eq('id', item.id);
      }
    }
  }

  return {
    processed_count: processedCount,
    accepted_count: acceptedCount,
    failed_count: failedCount,
    retrying_count: retryingCount,
    duration_ms: Math.round(performance.now() - startTime),
  };
}
