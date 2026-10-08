// supabase/functions/superadmin-operations/notifications/dispatcher.ts
// Super Admin Operations Notification Policy Evaluator & Dispatcher (Phase 8)

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';
import {
  NotificationEventType,
  NotificationPolicy,
  NotificationRecipient,
  NotificationOutboxItem,
} from './types.ts';
import { renderNotificationTemplate, IncidentTemplateContext } from './templates.ts';

const severityRank: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  WARNING: 2,
  INFO: 3,
};

export interface IncidentDispatchInput {
  id: string;
  incident_key: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
  service_id: string;
  status: string;
  opened_at: string;
  resolution_type?: string | null;
  resolution_reason?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
}

export interface DispatchResult {
  enqueued_count: number;
  suppressed_count: number;
  policies_evaluated: number;
  recipients_targeted: number;
}

/**
 * Evaluates enabled notification policies against an operational incident and enqueues notifications.
 */
export async function evaluateIncidentNotifications(
  supabase: SupabaseClient,
  incident: IncidentDispatchInput,
  eventType: NotificationEventType
): Promise<DispatchResult> {
  let enqueuedCount = 0;
  let suppressedCount = 0;
  let recipientsTargeted = 0;

  // 1. Query enabled policies matching this eventType
  const { data: policies, error: polErr } = await supabase
    .from('ops_notification_policies')
    .select('*, group:group_id(*)')
    .eq('enabled', true)
    .eq('event_type', eventType);

  if (polErr || !policies || policies.length === 0) {
    return { enqueued_count: 0, suppressed_count: 0, policies_evaluated: 0, recipients_targeted: 0 };
  }

  const incSevRank = severityRank[incident.severity] ?? 99;

  for (const policy of policies as NotificationPolicy[]) {
    const policyMinRank = severityRank[policy.min_severity] ?? 99;

    // Severity eligibility check
    if (incSevRank > policyMinRank) {
      continue; // Incident severity is lower than policy minimum threshold
    }

    // Cooldown check
    if (policy.cooldown_minutes > 0) {
      const cooldownCutoff = new Date(Date.now() - policy.cooldown_minutes * 60 * 1000).toISOString();
      const { data: recentNotifs } = await supabase
        .from('ops_notification_outbox')
        .select('id')
        .eq('incident_id', incident.id)
        .eq('policy_id', policy.id)
        .gte('created_at', cooldownCutoff)
        .limit(1);

      if (recentNotifs && recentNotifs.length > 0) {
        suppressedCount++;
        continue; // Suppressed by policy cooldown
      }
    }

    // Query active members of the targeted recipient group
    const { data: members, error: memErr } = await supabase
      .from('ops_notification_group_members')
      .select('recipient:recipient_id(*)')
      .eq('group_id', policy.group_id);

    if (memErr || !members || members.length === 0) {
      continue;
    }

    const eligibleRecipients: NotificationRecipient[] = members
      .map((m: any) => m.recipient)
      .filter((r: any) => r && r.enabled === true);

    recipientsTargeted += eligibleRecipients.length;

    // Template rendering context
    const durationMs = incident.resolved_at
      ? new Date(incident.resolved_at).getTime() - new Date(incident.opened_at).getTime()
      : Date.now() - new Date(incident.opened_at).getTime();
    const durationMin = Math.max(1, Math.round(durationMs / (60 * 1000)));

    const templateCtx: IncidentTemplateContext = {
      incidentId: incident.id,
      incidentKey: incident.incident_key,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      serviceId: incident.service_id,
      openedAt: new Date(incident.opened_at).toLocaleString(),
      durationString: `${durationMin}m`,
      escalationLevel: 0,
      resolutionType: incident.resolution_type,
      resolutionReason: incident.resolution_reason,
      resolvedBy: incident.resolved_by,
      resolvedAt: incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : undefined,
    };

    const rendered = renderNotificationTemplate(eventType, templateCtx);

    // Enqueue an outbox record for each recipient
    for (const recipient of eligibleRecipients) {
      const idempotencyKey = `${incident.id}_${eventType}_${policy.id}_${recipient.id}_lvl0`;

      const { data: inserted, error: insertErr } = await supabase
        .from('ops_notification_outbox')
        .insert({
          policy_id: policy.id,
          incident_id: incident.id,
          group_id: policy.group_id,
          recipient_id: recipient.id,
          recipient_email: recipient.email,
          recipient_name: recipient.display_name,
          channel: policy.channel || 'EMAIL',
          subject: rendered.subject,
          content_text: rendered.text,
          content_html: rendered.html,
          status: 'PENDING',
          scheduled_at: new Date().toISOString(),
          idempotency_key: idempotencyKey,
          escalation_level: 0,
        })
        .select('id')
        .maybeSingle();

      if (!insertErr && inserted) {
        enqueuedCount++;
      } else if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('duplicate key'))) {
        suppressedCount++; // Idempotent suppression
      }
    }
  }

  return {
    enqueued_count: enqueuedCount,
    suppressed_count: suppressedCount,
    policies_evaluated: policies.length,
    recipients_targeted: recipientsTargeted,
  };
}

/**
 * Checks unresolved incidents against escalation policies and enqueues escalation notifications.
 */
export async function evaluateEscalations(supabase: SupabaseClient): Promise<{ escalated_count: number }> {
  let escalatedCount = 0;

  // 1. Query policies with active escalation configuration
  const { data: policies } = await supabase
    .from('ops_notification_policies')
    .select('*')
    .eq('enabled', true)
    .not('escalation_delay_minutes', 'is', null)
    .not('escalation_group_id', 'is', null);

  if (!policies || policies.length === 0) {
    return { escalated_count: 0 };
  }

  // 2. Query open / un-resolved incidents
  const { data: activeIncidents } = await supabase
    .from('ops_incidents')
    .select('*')
    .in('status', ['OPEN', 'ACKNOWLEDGED']);

  if (!activeIncidents || activeIncidents.length === 0) {
    return { escalated_count: 0 };
  }

  const now = Date.now();

  for (const policy of policies as NotificationPolicy[]) {
    if (!policy.escalation_delay_minutes || !policy.escalation_group_id) continue;

    const delayMs = policy.escalation_delay_minutes * 60 * 1000;
    const policyMinRank = severityRank[policy.min_severity] ?? 99;

    for (const inc of activeIncidents) {
      const incSevRank = severityRank[inc.severity] ?? 99;
      if (incSevRank > policyMinRank) continue;

      const incAgeMs = now - new Date(inc.opened_at).getTime();
      if (incAgeMs < delayMs) continue; // Not yet reached escalation delay

      // Check if escalation level 1 has already been enqueued for this incident + policy
      const { data: existingEsc } = await supabase
        .from('ops_notification_outbox')
        .select('id')
        .eq('incident_id', inc.id)
        .eq('policy_id', policy.id)
        .eq('escalation_level', 1)
        .limit(1);

      if (existingEsc && existingEsc.length > 0) {
        continue; // Escalation level 1 already fired
      }

      // Query recipients in escalation group
      const { data: escMembers } = await supabase
        .from('ops_notification_group_members')
        .select('recipient:recipient_id(*)')
        .eq('group_id', policy.escalation_group_id);

      if (!escMembers || escMembers.length === 0) continue;

      const escRecipients: NotificationRecipient[] = escMembers
        .map((m: any) => m.recipient)
        .filter((r: any) => r && r.enabled === true);

      const durationMin = Math.max(1, Math.round(incAgeMs / (60 * 1000)));
      const templateCtx: IncidentTemplateContext = {
        incidentId: inc.id,
        incidentKey: inc.incident_key,
        title: inc.title,
        description: inc.description,
        severity: inc.severity,
        serviceId: inc.service_id,
        openedAt: new Date(inc.opened_at).toLocaleString(),
        durationString: `${durationMin}m`,
        escalationLevel: 1,
      };

      const rendered = renderNotificationTemplate('INCIDENT_ESCALATED', templateCtx);

      for (const recipient of escRecipients) {
        const idempotencyKey = `${inc.id}_INCIDENT_ESCALATED_${policy.id}_${recipient.id}_lvl1`;

        const { data: inserted, error: insertErr } = await supabase
          .from('ops_notification_outbox')
          .insert({
            policy_id: policy.id,
            incident_id: inc.id,
            group_id: policy.escalation_group_id,
            recipient_id: recipient.id,
            recipient_email: recipient.email,
            recipient_name: recipient.display_name,
            channel: 'EMAIL',
            subject: rendered.subject,
            content_text: rendered.text,
            content_html: rendered.html,
            status: 'PENDING',
            scheduled_at: new Date().toISOString(),
            idempotency_key: idempotencyKey,
            escalation_level: 1,
          })
          .select('id')
          .maybeSingle();

        if (!insertErr && inserted) {
          escalatedCount++;
        }
      }
    }
  }

  return { escalated_count: escalatedCount };
}

/**
 * Cancels pending notifications for an incident that has resolved before delivery occurred.
 */
export async function cancelPendingIncidentNotifications(
  supabase: SupabaseClient,
  incidentId: string
): Promise<{ cancelled_count: number }> {
  const { data: cancelled, error } = await supabase
    .from('ops_notification_outbox')
    .update({
      status: 'CANCELLED',
      safe_error_code: 'INCIDENT_RESOLVED_BEFORE_DELIVERY',
      safe_error_message: 'Notification was cancelled because the incident resolved prior to dispatch.',
      updated_at: new Date().toISOString(),
    })
    .eq('incident_id', incidentId)
    .eq('status', 'PENDING')
    .select('id');

  if (error || !cancelled) {
    return { cancelled_count: 0 };
  }

  return { cancelled_count: cancelled.length };
}
