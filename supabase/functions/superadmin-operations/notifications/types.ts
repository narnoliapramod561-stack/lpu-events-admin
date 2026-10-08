// supabase/functions/superadmin-operations/notifications/types.ts
// Super Admin Operations Notifications & Escalation Types (Phase 8)

export type NotificationChannel = 'EMAIL';

export type NotificationEventType =
  | 'INCIDENT_CREATED'
  | 'INCIDENT_ESCALATED'
  | 'INCIDENT_RESOLVED'
  | 'INCIDENT_MANUALLY_RESOLVED'
  | 'ALERT_TRIGGERED';

export type NotificationOutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'REQUEST_ACCEPTED'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED';

export type NotificationAttemptStatus =
  | 'REQUEST_ACCEPTED'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED';

export interface NotificationRecipient {
  id: string;
  display_name: string;
  email: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationGroup {
  id: string;
  group_key: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  members?: NotificationRecipient[];
}

export interface NotificationPolicy {
  id: string;
  policy_key: string;
  name: string;
  description?: string;
  event_type: NotificationEventType;
  min_severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
  group_id: string;
  channel: NotificationChannel;
  cooldown_minutes: number;
  enabled: boolean;
  escalation_delay_minutes?: number | null;
  escalation_group_id?: string | null;
  repeat_interval_minutes?: number | null;
  created_at: string;
  updated_at: string;
  group?: NotificationGroup;
}

export interface NotificationOutboxItem {
  id: string;
  policy_id?: string | null;
  incident_id?: string | null;
  alert_id?: string | null;
  group_id?: string | null;
  recipient_id?: string | null;
  recipient_email: string;
  recipient_name?: string | null;
  channel: NotificationChannel;
  subject: string;
  content_text: string;
  content_html?: string | null;
  status: NotificationOutboxStatus;
  attempt_count: number;
  max_attempts: number;
  scheduled_at: string;
  last_attempt_at?: string | null;
  next_attempt_at?: string | null;
  provider: string;
  provider_message_id?: string | null;
  safe_error_code?: string | null;
  safe_error_message?: string | null;
  idempotency_key: string;
  escalation_level: number;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
  failed_at?: string | null;
}

export interface NotificationDeliveryAttempt {
  id: string;
  notification_id: string;
  attempt_number: number;
  started_at: string;
  completed_at: string;
  status: NotificationAttemptStatus;
  provider: string;
  provider_message_id?: string | null;
  safe_error_code?: string | null;
  safe_error_message?: string | null;
  latency_ms: number;
  created_at: string;
}

export interface NotificationsOverviewSummary {
  provider_status: 'CONFIGURED' | 'NOT_CONFIGURED';
  provider_name: string;
  outbox_counts: {
    pending: number;
    processing: number;
    request_accepted: number;
    sent: number;
    failed: number;
    cancelled: number;
    total: number;
  };
  policy_counts: {
    total: number;
    enabled: number;
  };
  recipient_counts: {
    total: number;
    enabled: number;
  };
  last_delivery_attempt?: NotificationDeliveryAttempt | null;
}
