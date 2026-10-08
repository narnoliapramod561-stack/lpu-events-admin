# LPU Events — Operational Notifications & Escalation Architecture (Phase 8)

## 1. Overview & Certified Foundation

Phase 8 extends the certified LPU Events Operations Control Plane (Phases 1–7) by adding an asynchronous, deterministic, auditable, and idempotent **Notification and Escalation Layer** for Super Admin operational incidents and alerts.

Phases 1–7 remain frozen:
- **Phase 1**: Telemetry Truthfulness & Quota Transparency
- **Phase 2**: Super Admin Operations Gateway Foundation
- **Phase 3**: Provider & Infrastructure Telemetry Normalization
- **Phase 4**: Operations Jobs & Maintenance Telemetry
- **Phase 5**: Alert & Incident Engine
- **Phase 6**: Historical Operations Analytics & Forecasting
- **Phase 7**: Super Admin Operations Control Center UI

Phase 8 architecture:

```text
Production Telemetry / Probes / Jobs
                 ↓
      Alert & Incident Engine
                 ↓
    Notification Eligibility Check
                 ↓
       Notification Policy
                 ↓
     Asynchronous Outbox Queue
                 ↓
      Atomic Delivery Worker
                 ↓
       Email Provider (Resend)
                 ↓
       Delivery Audit & History
                 ↓
      Operational Telemetry
```

For unresolved incidents:

```text
Incident remains OPEN / ACKNOWLEDGED
                 ↓
       Escalation Policy Check
                 ↓
   Incident Age > Escalation Delay
                 ↓
    Level 1 Escalation Notification
                 ↓
  Target: Senior Escalation Group
```

---

## 2. Core Architectural Principles

1. **Server-Side Only**: Provider credentials (`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) exist exclusively on the server. The browser client never contacts email providers directly.
2. **Deterministic & Bounded**: No arbitrary executable scripts or uncontrolled webhook endpoints. All triggers map deterministically to verified Phase 5 incident lifecycle events.
3. **Idempotent & Deduplicated**: Every outbox item enforces an idempotency key:
   ```text
   ${incident_id}_${event_type}_${policy_id}_${recipient_id}_lvl${escalation_level}
   ```
   Ensured by database-level `UNIQUE (idempotency_key)` constraint.
4. **Cooldown-Protected**: Configurable cooldown minutes prevent alert storms across rapid evaluator cycles.
5. **Single-Flight Delivery**: Outbox worker atomically claims batches transitioning status from `PENDING` to `PROCESSING`. Concurrent workers cannot duplicate effective delivery.
6. **Anti-Recursion Guaranteed**: Provider delivery failure records an audit attempt and transitions to `FAILED` or exponential backoff retry. It never triggers secondary alert evaluation that could cause an infinite notification loop.
7. **Truthful Delivery Semantics**: The system records `REQUEST_ACCEPTED`, acknowledging that provider API acceptance does not guarantee physical inbox delivery.

---

## 3. Data Model & Schema

All Phase 8 tables live in schema `public` with strict Super Admin and `service_role` Row-Level Security:

### 3.1. `ops_notification_recipients`
Controlled administrative directory of authorized operational responders:
- `id`: UUID Primary Key
- `email`: Validated operational email address (UNIQUE)
- `display_name`: Human-readable name / role title
- `role_name`: Operational role (e.g., `OPERATIONS_ADMIN`, `ON_CALL_ENGINEER`, `INCIDENT_COMMANDER`)
- `enabled`: Boolean active flag
- Timestamps (`created_at`, `updated_at`)

### 3.2. `ops_notification_groups`
Controlled operational recipient groups:
- `id`: UUID Primary Key
- `group_key`: Unique string identifier (`OPERATIONS_PRIMARY`, `OPERATIONS_SECONDARY`, `CRITICAL_ESCALATION`)
- `name`: Display name
- `description`: Operational responsibilities description

### 3.3. `ops_notification_group_members`
Many-to-many relationship linking recipients to operational groups:
- `group_id`: Foreign key to `ops_notification_groups`
- `recipient_id`: Foreign key to `ops_notification_recipients`
- Compound primary key `(group_id, recipient_id)`

### 3.4. `ops_notification_policies`
Deterministic routing rules governing when and how notifications are enqueued:
- `id`: UUID Primary Key
- `policy_key`: Unique policy identifier
- `event_type`: Lifecycle trigger (`INCIDENT_CREATED`, `INCIDENT_ESCALATED`, `INCIDENT_RESOLVED`, `INCIDENT_MANUALLY_RESOLVED`)
- `min_severity`: Severity threshold (`CRITICAL`, `HIGH`, `WARNING`, `INFO`)
- `group_id`: Target recipient group
- `channel`: Delivery channel (`EMAIL`)
- `cooldown_minutes`: Minimum delay before re-notifying for the same incident
- `escalation_delay_minutes`: Time before unacknowledged/unresolved incidents escalate (nullable)
- `escalation_group_id`: Target group for escalation (nullable)
- `enabled`: Boolean active flag

### 3.5. `ops_notification_outbox`
Asynchronous persistent outbox queue:
- `id`: UUID Primary Key
- `policy_id`: Referenced policy
- `incident_id`: Referenced operational incident
- `recipient_id`, `recipient_email`, `recipient_name`: Target responder details
- `channel`: `EMAIL`
- `subject`, `content_text`, `content_html`: Pre-rendered safe operational notification
- `status`: Controlled lifecycle status (`PENDING`, `PROCESSING`, `REQUEST_ACCEPTED`, `SENT`, `FAILED`, `CANCELLED`)
- `attempt_count`, `max_attempts` (default 3)
- `scheduled_at`, `last_attempt_at`, `next_attempt_at`
- `provider`: Default `'resend'`
- `provider_message_id`: Provider receipt ID
- `safe_error_code`, `safe_error_message`: Sanitized error attribution
- `idempotency_key`: Unique deduplication key
- `escalation_level`: Integer level (0 = Initial, 1 = Escalated)

### 3.6. `ops_notification_delivery_attempts`
Append-only audit trail recording every delivery dispatch:
- `id`: UUID Primary Key
- `notification_id`: Foreign key to `ops_notification_outbox`
- `attempt_number`: 1, 2, or 3
- `started_at`, `completed_at`, `latency_ms`
- `status`: `REQUEST_ACCEPTED`, `FAILED`, `CANCELLED`
- `provider_message_id`, `safe_error_code`, `safe_error_message`

---

## 4. Delivery Worker & Retry Strategy

### 4.1. Single-Flight Atomic Claiming
The delivery worker runs every minute via the registered `notification_delivery` maintenance job or on-demand:
1. Queries records with `status = 'PENDING'` where `scheduled_at <= now()` and `(next_attempt_at IS NULL OR next_attempt_at <= now())`.
2. Atomically marks the batch as `PROCESSING`.

### 4.2. Bounded Exponential Backoff
For transient failures (HTTP 429, HTTP 500, HTTP 502, HTTP 503, Network Timeout):
- **Attempt 1 Failure**: Backoff 30 seconds (`next_attempt_at = now() + 30s`), resets to `PENDING`.
- **Attempt 2 Failure**: Backoff 2 minutes (`next_attempt_at = now() + 120s`), resets to `PENDING`.
- **Attempt 3 Failure**: Maximum attempts exhausted (`MAX_DELIVERY_ATTEMPTS = 3`). Transitions permanently to `FAILED` with `safe_error_code = 'MAX_RETRIES_EXHAUSTED'`.

Permanent failures (e.g., Invalid email, unauthorized 401) fail immediately without retry.

### 4.3. Fail-Closed Provider Configuration
When `RESEND_API_KEY` is not configured:
- The system logs status as `NOT_CONFIGURED` / `PROVIDER_NOT_CONFIGURED`.
- Does NOT crash, does NOT throw unhandled exceptions, and does NOT generate false alert flapping.

---

## 5. Escalation & Recovery Semantics

### 5.1. Multi-Level Escalation
- Evaluated during every alert evaluation cycle (`evaluateEscalations`).
- An incident escalates only if:
  1. Status is `OPEN` or `ACKNOWLEDGED`.
  2. Incident age (`now - opened_at`) exceeds `policy.escalation_delay_minutes`.
  3. Escalation Level 1 has not already been enqueued (`idempotency_key` check).
- When triggered, enqueues Level 1 notification targeting `escalation_group_id`.

### 5.2. Resolution Provenance & Pending Cancellation
- **Automatic Recovery (`AUTO_RECOVERY`)**: Triggered when all underlying probe alerts naturally recover. Dispatches `INCIDENT_RESOLVED` template.
- **Manual Resolution (`MANUAL`)**: Triggered when a Super Admin manually resolves an incident with a required reason. Dispatches `INCIDENT_MANUALLY_RESOLVED` template displaying the operator attribution and resolution reason.
- **Pending Cancellation**: In either resolution flow, any pending outbox items that were not yet dispatched are immediately cancelled with `safe_error_code = 'INCIDENT_RESOLVED_BEFORE_DELIVERY'`.

---

## 6. Retention & Maintenance

- Stored procedure `prune_stale_operations_notifications(p_retention_days)` executes daily via canonical job `notification_outbox_prune`.
- Terminal statuses (`REQUEST_ACCEPTED`, `SENT`, `FAILED`, `CANCELLED`) older than the retention threshold (default 14 days) are deleted along with their delivery attempts.
- Active records (`PENDING`, `PROCESSING`) are strictly protected from deletion.

---

## 7. Operations Control Center Integration

Super Admin Operations Control Center integrates Section 7: **Operations Notifications & Escalation Control**:
- **Summary Cards**: Queue Pending, Accepted Deliveries, Delivery Failures, Provider Status.
- **Outbox Queue**: Filterable by status and searchable by incident/email, with manual retry and cancellation buttons.
- **Policies Tab**: Configure event triggers, minimum severities, cooldowns, and escalation paths.
- **Recipients Tab**: Manage operational on-call responders and group memberships.
- **Safe Preview Tab**: Non-sending, offline operational template renderer.
