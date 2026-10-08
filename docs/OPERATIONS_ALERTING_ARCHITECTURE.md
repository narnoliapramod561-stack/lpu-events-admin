# Operations Alert & Incident Architecture (Phase 5)

## 1. Primary Architecture Overview

The Super Admin Operations Control Plane Phase 5 implements the authoritative server-side decision and state-management layer for operational problem tracking.

The end-to-end architecture is strictly unidirectional:

```text
REAL SERVICE STATE / PROVIDER API
                ↓
    REAL TELEMETRY / PROBES / JOBS
                ↓
     RULE EVALUATION ENGINE (SERVER)
                ↓
       MACHINE-DETECTED ALERT
                ↓
      CORRELATED INCIDENT
                ↓
   ACKNOWLEDGED / RESOLVED STATE MACHINE
```

### Invariants:
1. **Decision and state changes occur strictly server-side**:
   - The browser never evaluates alert rules.
   - The browser never creates alerts or incidents.
   - The browser cannot arbitrarily change incident severity or toggle states without authenticated Super Admin RPCs.
2. **Telemetry tells us what happened**:
   - Alerts tell us that a defined operational condition has been detected.
   - Incidents tell us that one or more related alerts represent an active operational problem.
3. **No circular dependencies**:
   - Telemetry remains authoritative. Alerts consume telemetry; incidents consume alerts.

---

## 2. Alert vs. Incident Model

| Concept | Entity | Purpose | Cardinality |
|---|---|---|---|
| **Alert** | `ops_alerts` | Machine-detected condition breach at a specific point in time (e.g., `worker.error_rate >= 2.0%`). | Many per incident |
| **Incident** | `ops_incidents` | Human-tracked operational issue representing real service impact (e.g., `INC-2026-0042` Cloudflare Edge Worker degraded). | 1 per problem group |

An incident correlates one or more active contributing alerts. For example, if database storage is high, connection utilization is high, and query latency spikes, they all correlate to a single active database incident rather than creating 3 fragmented incidents.

---

## 3. Database Schema

### 3.1 `ops_alert_rules`
Defines operational conditions that warrant alert generation:
- `id` (uuid, PK)
- `rule_key` (text, UNIQUE) — stable identifier
- `name` (text), `description` (text)
- `service_id` (text) — targeted service (e.g. `supabase_database`, `cloudflare_worker`)
- `metric_key` (text, nullable) — metric snapshot key or maintenance job key
- `condition_type` (text CHECK: `THRESHOLD`, `RATE`, `HEALTH_FAILURE`, `JOB_FAILURE`, `JOB_STALE`, `TELEMETRY_STALE`, `PROVIDER_UNAVAILABLE`)
- `operator` (text CHECK: `GT`, `GTE`, `LT`, `LTE`, `EQ`, `NEQ`)
- `threshold_value` (numeric), `secondary_threshold_value` (numeric)
- `window_minutes` (integer, DEFAULT 15) — query time window
- `evaluation_interval_minutes` (integer, DEFAULT 5)
- `severity` (text CHECK: `INFO`, `WARNING`, `HIGH`, `CRITICAL`)
- `enabled` (boolean, DEFAULT true)
- `cooldown_minutes` (integer, DEFAULT 15)
- `recovery_enabled` (boolean, DEFAULT true)
- `consecutive_count_threshold` (integer, DEFAULT 1) — flapping protection trigger count
- `recovery_consecutive_threshold` (integer, DEFAULT 1) — flapping protection recovery count
- `incident_group_key` (text) — deterministic correlation group (e.g. `supabase:database`, `cloudflare:worker`)
- `metadata` (jsonb)

### 3.2 `ops_incidents`
Authoritative problem tracking:
- `id` (uuid, PK)
- `incident_key` (text, UNIQUE) — e.g. `INC-2026-A1B2`
- `title` (text), `description` (text)
- `severity` (text CHECK: `INFO`, `WARNING`, `HIGH`, `CRITICAL`) — dynamic, reflects highest active contributing alert
- `status` (text CHECK: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`)
- `service_id` (text), `group_key` (text)
- `opened_at` (timestamptz), `last_activity_at` (timestamptz)
- `acknowledged_at` (timestamptz), `acknowledged_by` (text)
- `resolved_at` (timestamptz), `resolved_by` (text), `resolution_reason` (text)
- `primary_alert_id` (uuid, FK `ops_alerts`)
- `correlation_id` (text), `metadata` (jsonb)

### 3.3 `ops_alerts`
Machine-detected alert instances:
- `id` (uuid, PK)
- `rule_id` (uuid, FK `ops_alert_rules`)
- `service_id` (text)
- `incident_id` (uuid, FK `ops_incidents`)
- `severity` (text CHECK: `INFO`, `WARNING`, `HIGH`, `CRITICAL`)
- `status` (text CHECK: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`)
- `title` (text), `message` (text)
- `first_detected_at` (timestamptz), `last_detected_at` (timestamptz), `resolved_at` (timestamptz)
- `occurrence_count` (integer, DEFAULT 1) — increments on duplicate evaluations
- `last_value` (numeric), `threshold_value` (numeric)
- `evidence` (jsonb) — sanitized triggering context
- `consecutive_failures` (integer), `consecutive_successes` (integer)

### 3.4 `ops_incident_events`
Compact, append-only incident timeline:
- `id` (uuid, PK)
- `incident_id` (uuid, FK `ops_incidents`)
- `event_type` (text CHECK: `INCIDENT_OPENED`, `ALERT_CREATED`, `ALERT_OCCURRED_AGAIN`, `SEVERITY_CHANGED`, `INCIDENT_ACKNOWLEDGED`, `INCIDENT_RESOLVED`, `ALERT_RESOLVED`)
- `actor_type` (text CHECK: `SYSTEM`, `SUPER_ADMIN`)
- `actor_id` (text)
- `occurred_at` (timestamptz)
- `alert_id` (uuid, FK `ops_alerts`)
- `metadata` (jsonb)

---

## 4. Canonical Initial Alert Rules

| Rule Key | Condition Type | Operator | Threshold | Severity | Target Service | Incident Group |
|---|---|---|---|---|---|---|
| `database_storage_warning` | `THRESHOLD` | `GTE` | 85% | `WARNING` | `supabase_database` | `supabase:database` |
| `worker_error_rate_high` | `RATE` | `GTE` | 2.0% | `HIGH` | `cloudflare_worker` | `cloudflare:worker` |
| `cloudflare_provider_unavailable` | `PROVIDER_UNAVAILABLE` | `EQ` | 1 | `CRITICAL` | `cloudflare_worker` | `cloudflare:provider` |
| `database_cleanup_failed` | `JOB_FAILURE` | `EQ` | 1 | `HIGH` | `internal_maintenance` | `maintenance:database_cleanup` |
| `r2_orphan_cleanup_failed` | `JOB_FAILURE` | `EQ` | 1 | `HIGH` | `cloudflare_r2` | `maintenance:r2_cleanup` |
| `database_cleanup_stale` | `JOB_STALE` | `EQ` | 1 | `WARNING` | `internal_maintenance` | `maintenance:database_cleanup` |
| `provider_telemetry_stale` | `TELEMETRY_STALE` | `EQ` | 1 | `WARNING` | `observability_engine` | `telemetry:freshness` |

---

## 5. State Machine & Lifecycle Transitions

### 5.1 Alert State Transitions
```text
           [Condition Detected]
                   │
                   ▼
                ┌──────┐
                │ OPEN │
                └──────┘
                 │    │
  [Super Admin]  │    │  [Automatic Recovery]
[Acknowledge]    │    │
                 ▼    │
         ┌──────────────┐│
         │ ACKNOWLEDGED ││
         └──────────────┘│
                 │       │
                 ▼       ▼
               ┌──────────┐
               │ RESOLVED │
               └──────────┘
```

### 5.2 Incident State Transitions
```text
          [First Contributing Alert]
                      │
                      ▼
                   ┌──────┐
                   │ OPEN │
                   └──────┘
                    │    │
     [Super Admin]  │    │  [All alerts auto-recovered]
   [Acknowledge]    │    │
                    ▼    │
            ┌──────────────┐│
            │ ACKNOWLEDGED ││
            └──────────────┘│
                    │       │
      [Manual Res]  │       │
   [or Auto-Recover]│       │
                    ▼       ▼
                  ┌──────────┐
                  │ RESOLVED │
                  └──────────┘
```

---

## 6. Deduplication & Flapping Protection

1. **Deduplication**:
   - Repeated rule evaluations while a condition persists do **not** spawn multiple alerts or multiple incidents.
   - If an active alert exists for `(rule_id, service_id)`, the evaluator increments `occurrence_count`, updates `last_detected_at`, `last_value`, and refreshes `evidence`.
   - An `ALERT_OCCURRED_AGAIN` timeline event is logged.
2. **Flapping Protection**:
   - Rules configure `consecutive_count_threshold` (failures required before firing) and `recovery_consecutive_threshold` (successes required before resolving).
   - Prevents rapid oscillation (e.g. healthy → unhealthy → healthy) from spamming state changes.
3. **Provider Unconfigured Policy**:
   - Health probe status `NOT_CONFIGURED` represents an intentional administrative deployment state, **never** an outage or failure incident.

---

## 7. Incident Correlation & Dynamic Severity

1. **Correlation Key**:
   - Alerts with the same `incident_group_key` (e.g. `supabase:database`) attach to the currently open incident for that group.
2. **Dynamic Severity Aggregation**:
   - Incident severity is always the maximum severity among its currently active contributing alerts:
     `CRITICAL > HIGH > WARNING > INFO`.
   - When a `CRITICAL` alert resolves while a `WARNING` alert remains active:
     - The incident remains `OPEN` or `ACKNOWLEDGED`.
     - Incident severity steps down to `WARNING`.
     - A `SEVERITY_CHANGED` timeline event is recorded.
3. **Automatic Incident Resolution**:
   - An incident automatically resolves if and only if **all** contributing alerts have resolved.

---

## 8. Server-Side RPCs & Security Model

All operations tables enforce strict PostgreSQL Row-Level Security (RLS):
- Anonymous, Student, Organizer, and Normal Admin roles are strictly **DENIED** all access (SELECT, INSERT, UPDATE, DELETE).
- Super Admins (`public.is_super_admin()`) have **READ** access via authenticated queries.
- State-changing mutations occur through privileged, audited `SECURITY DEFINER` RPCs with internal actor derivation:

| RPC | Permissions | Description |
|---|---|---|
| `acknowledge_operations_incident(p_incident_id)` | Super Admin / Service Role | Internally derives actor identity from authenticated Super Admin session; transitions incident and open alerts to `ACKNOWLEDGED`. Emits timeline event. |
| `resolve_operations_incident(p_incident_id, p_reason)` | Super Admin / Service Role | Requires non-empty reason ($\ge 3$ characters). Derives actor identity internally; sets `resolution_type = 'MANUAL'`; transitions incident and contributing alerts to `RESOLVED`. Emits timeline event with manual resolution provenance. |
| `prune_stale_operations_alerts_and_incidents(p_alert_retention_days, p_incident_retention_days)` | Super Admin / Service Role | Prunes `RESOLVED` alerts and incidents older than retention window. Active records are strictly preserved. |

### 8.1 Resolution Provenance
Incidents track explicit resolution provenance:
- **`AUTO_RECOVERY`**: Applied when all contributing alerts recover naturally via server-side evaluation. Actor is recorded as `alert_rule_evaluation`.
- **`MANUAL`**: Applied when a Super Admin explicitly resolves the incident with mandatory resolution reason. Actor is derived from the authenticated Super Admin.

---

## 9. Retention Policy

- **Alerts Retention**: 90 days for `RESOLVED` alerts.
- **Incidents Retention**: 180 days for `RESOLVED` incidents and their timeline events.
- **Active Record Protection**: Open and Acknowledged alerts/incidents are never deleted by retention sweeps.

---

## 10. Operational Single-Flight Execution

The alert evaluator reuses the Phase 4 job infrastructure:
- Job key: `alert_rule_evaluation` in `ops_jobs`.
- Runs via single-flight lease: `start_operations_job_run` / `finish_operations_job_run`.
- Evaluator execution duration, rules evaluated, rules matched, alerts created/updated/resolved, and incident counts are recorded on `ops_job_runs`.

---

## 11. Phase Boundaries & Deferred Items

The following features are **explicitly NOT implemented** in Phase 5:
- ❌ **External Notifications**: No email alerts, SMS, Slack webhooks, PagerDuty, or push notifications (Phase 6 boundary).
- ❌ **Predictive ML / Forecasting**: No machine learning or capacity predictions.
- ❌ **Final Operations Control Center UI**: Only minimal typed verification client SDK methods exist; the complete Operations Center UI is a future phase.
