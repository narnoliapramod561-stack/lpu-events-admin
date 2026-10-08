# Operations Resilience Architecture (Phase 10)

## 1. Architectural Overview & Objective

Phase 10 validates the LPU Events Operations Control Plane as a **failure-resilient operational platform**.
Rather than adding another UI or operational dashboard, Phase 10 establishes a rigorous, controlled resilience test layer to prove that the operational chain:

```text
FAILURE
   ↓
DETECTION
   ↓
ALERT
   ↓
INCIDENT
   ↓
NOTIFICATION
   ↓
SAFE REMEDIATION
   ↓
RECOVERY
   ↓
VERIFICATION
   ↓
AUDIT
```

functions truthfully, safely, and deterministically under realistic failure conditions across all platform subsystems.

---

## 2. Core Safety Guardrails & Principles

### A. Non-Destructive Isolation Principle
Failure injection **must never target production destructively**. The resilience harness is strictly isolated from real infrastructure. The platform prohibits:
- Dropping production tables or schemas
- Deleting production application or audit data
- Disabling production security boundaries, RLS, or JWT validation
- Breaking production DNS or external networking
- Rotating or exposing production provider credentials
- Destroying production hosting or container infrastructure

### B. Fail-Closed Environment Guardrail
1. **UNKNOWN Environment**: Automatically fails closed with `ENVIRONMENT_UNSAFE`. All active failure injection is blocked immediately.
2. **PRODUCTION Environment**: Only `OBSERVE_ONLY` and non-destructive synthetic tests are permitted. Any destructive or intrusive scenario execution is blocked with `PRODUCTION_DESTRUCTIVE_BLOCKED`.
3. **DEVELOPMENT / STAGING**: Controlled scenario executions are permitted within an isolated execution boundary.

### C. Zero Arbitrary Code or Dynamic Injection
Scenarios in `ops_resilience_scenarios` store zero executable scripts or dynamic queries. Every scenario maps directly to a deterministic, allowlisted server-side simulation or verification procedure.

---

## 3. Subsystem Failure Containment & Isolation

A primary requirement of the resilience architecture is that a failure in one subsystem must never cascade uncontrollably into another:

```text
Telemetry failure           ≠  Alert engine failure
Notification failure        ≠  Incident lifecycle failure
Remediation failure         ≠  Alert engine failure
Historical analytics rollup ≠  Current health telemetry
Gateway timeout             ≠  UI blanking or state corruption
```

### Subsystem Isolation Matrix

| Subsystem | Failure Injected | Containment Boundary | Expected Behavior |
|---|---|---|---|
| **Provider Telemetry** | Cloudflare / Resend / Sentry unavailable or timeout | Provider adapter isolated via bounded timeouts (5s) | Returns `UNAVAILABLE` or `TIMEOUT`. Does not fail the collection run or crash the router. Distinguishes `NOT_CONFIGURED` from actual outage. |
| **Telemetry Ingestion** | Missing observations or delayed ingestion | Evaluator window comparison | Observations older than threshold marked `STALE`. Missing observations marked `INSUFFICIENT_DATA`. Never fabricates health or false critical outages. |
| **Maintenance Jobs** | Job worker crash, exception, or timeout | `ops_job_runs` status transitions | Records `FAILED` with sanitized error message. Generates `JOB_FAILURE` incident. Single-flight locks expire or are released safely. Next run retries cleanly. |
| **Alert Evaluator** | Evaluator interruption during execution | `alert_rule_evaluation` job lease | Next execution safely resumes without generating duplicate alerts or incidents. Dynamic severity and correlation keys prevent alert storms. |
| **Notifications** | Provider unavailable or worker crash | Outbox queue (`ops_notification_outbox`) | Messages remain in `PENDING` or `FAILED` retry queue with exponential backoff. Incident processing is unaffected. Strict anti-recursion prevents notification storms. |
| **Safe Remediation** | Worker crash, timeout, or verification failure | Execution lifecycle & state verification | Remediation transitions to `FAILED` with explicit code. Unknown outcomes require post-action verification. Exceeding max attempts triggers `AUTOMATION_EXHAUSTED`. |
| **Historical Rollup** | Aggregation job failure or slow query | Background worker | Live operations dashboard and current incident state remain 100% operational. Rollup retries on next scheduled window. |
| **Operations Gateway** | Network timeout or temporary 5xx | Client SDK & React UI | OCC UI catches timeout, displays localized error banner, and preserves last known good telemetry with `isStale` indicator. No dashboard wipeout. |

---

## 4. Failure Scenario Registry & Mandatory Scenarios

The system maintains a centralized, controlled scenario registry in `ops_resilience_scenarios`:

```sql
CREATE TABLE ops_resilience_scenarios (
  scenario_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category ops_resilience_category NOT NULL,
  risk_level ops_resilience_risk NOT NULL,
  allowed_environments TEXT[] NOT NULL,
  is_destructive BOOLEAN NOT NULL DEFAULT FALSE,
  expected_detection TEXT NOT NULL,
  expected_recovery TEXT NOT NULL,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE
);
```

### The 22 Mandatory Scenarios (Section 50)

1. `provider.unavailable`: Provider unreachable; returns `UNAVAILABLE` health probe; alert fires; auto-recovers on reachability.
2. `provider.timeout`: Provider exceeds response timeout; marked `TIMEOUT`; latency recorded; next probe healthy.
3. `telemetry.stale`: Ingestion lags beyond expected window; telemetry flagged `STALE`; recollect restores freshness.
4. `telemetry.missing`: Metric observations absent; flagged `INSUFFICIENT_DATA` without false alarm or alert creation.
5. `job.failure`: Maintenance job throws exception; run marked `FAILED`; `JOB_FAILURE` alert opens; retry succeeds.
6. `job.stale`: Maintenance job exceeds 2x scheduled cadence; flagged `STALE` by evaluator.
7. `alert.evaluator_interruption`: Worker crashes mid-evaluation; subsequent run acquires lease cleanly with zero duplicates.
8. `notification.provider_outage`: External delivery API down; outbox message retained for bounded retry; no alert storm.
9. `notification.worker_crash`: Worker crashes mid-delivery; unacknowledged message remains recoverable in outbox.
10. `remediation.worker_crash`: Remediation process crashes; execution stays bounded; single-flight lock maintained.
11. `remediation.timeout`: External action hangs; aborted at timeout boundary and marked `FAILED` with `TIMEOUT`.
12. `remediation.verification_failure`: Remediation action executes but post-condition fails; strictly recorded as `FAILED`.
13. `remediation.rollback_failure`: Rollback step fails; status marked `ROLLBACK_FAILED`; incident remains active and escalates.
14. `remediation.duplicate_prevention`: 100 concurrent requests submitted; exactly 1 effective execution permitted.
15. `analytics.rollup_failure`: Rollup worker fails; historical view falls back to snapshots; live telemetry unharmed.
16. `gateway.timeout`: Operations Gateway RPC times out; UI shows non-destructive stale warning; prior state intact.
17. `system.combined_failure`: Simultaneous provider outage + notification delay + stale telemetry fail independently.
18. `recovery.provider_outage`: Provider recovers; probe returns `HEALTHY`; alert auto-resolves with `AUTO_RECOVERY` provenance.
19. `recovery.job_failure`: Next scheduled job run completes successfully; active `JOB_FAILURE` incident auto-resolves.
20. `recovery.remediation_assisted`: Remediation runbook executes, verified by authoritative query, incident resolves.
21. `dr.backup_validation`: Validates daily encrypted backup existence, recency (<24h), checksum, and RPO/RTO bounds.
22. `dr.migration_replay`: Replays 53 canonical migrations in an isolated target to confirm migration order and mirror parity.

---

## 5. Single-Flight, Idempotency & Concurrency Protection

To guarantee that duplicate workers or retry storms never corrupt operational state:

1. **Evaluator Single-Flight**: `alert_rule_evaluation` runs with a single-flight lease via `ops_job_runs`. Concurrent triggers receive `ALREADY_RUNNING` and exit gracefully.
2. **Notification Delivery Single-Flight**: Outbox processing claims candidate rows using atomic row updates (`status = 'DELIVERING', claimed_at = now()`), ensuring multiple workers never double-deliver notifications.
3. **Remediation Idempotency**: Each remediation proposal requires an `idempotency_key` unique per incident, action, and attempt generation. Concurrent executions on the same active incident are rejected with `Single-flight conflict`.
4. **Idempotent Recovery**: Recovery evaluations can run continuously without producing duplicate `RESOLVED` events, duplicate notifications, or re-opening closed incidents.

---

## 6. Retry Storm & Queue Backlog Protection

- **Bounded Retries**: All retryable queues (notifications, jobs, remediations) have a hard ceiling on attempts (maximum 3 to 5 attempts).
- **Exponential Backoff with Jitter**: Notification retry uses `initial_interval * 2^(attempt - 1)` up to a max interval of 1 hour to prevent hammering degraded providers.
- **Circuit Breaking**: If an external provider (e.g. Resend) fails repeatedly across consecutive deliveries, the provider is marked `DEGRADED`, notifications are held in queue, and recursive alert loops are blocked.
- **Queue Backlog Recovery**: During an outbox backlog recovery, messages are processed in FIFO order by priority (`CRITICAL` > `HIGH` > `WARNING` > `INFO`) with bounded batch sizes (50 items per cycle) to prevent CPU and memory spikes.

---

## 7. Audit & Provenance Preservation

During failures, remediations, and disaster recovery exercises, the system preserves complete audit history:
- **Actor Attribution**: All state transitions (`ACKNOWLEDGED`, `MANUALLY_RESOLVED`, `APPROVED`, `EXECUTED`, `ROLLED_BACK`) record the authoritative actor (`adminUserId`) extracted directly from the verified JWT.
- **Resolution Provenance**: Incidents unambiguously record `resolution_type = 'AUTO_RECOVERY'` vs `resolution_type = 'MANUAL'`.
- **Correlation IDs**: All requests generate and propagate `ops_req_${uuid}` or preserve client correlation IDs through the full failure, notification, and remediation lifecycle.
- **Secret Redaction**: Provider tokens (`Bearer ***`, `re_***`, `resend_***`), JWTs, and database connection strings are scrubbed before persistence in logs, error summaries, or timeline evidence.

---

## 8. Test Data Isolation & Residual Fault Cleanup

To prevent resilience test runs from corrupting production analytics or leaving lingering faults:
- **Test Tagging**: Every resilience test execution is tagged with `test_run_id`, `environment`, and `is_test = true`.
- **Analytics Exclusion**: Production aggregation jobs and historical rollup views filter out test executions.
- **Mandatory Teardown**: The test runner enforces an unconditional `finally` block:
  1. Clears simulated overrides or in-memory faults.
  2. Marks open test runs as completed or cancelled.
  3. Cancels any test notifications or pending remediations.
  4. Verifies zero active injected faults remain.
