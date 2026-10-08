# Operations Remediation & Runbooks Architecture (Phase 9)

## 1. Architectural Overview & Core Principles

Phase 9 implements a **controlled, allowlisted operational remediation layer** for predefined, safe, and reversible operational recovery procedures within the LPU Events Operations Control Plane.

The system is designed with a fundamental safety boundary:
> **AUTOMATION MUST NEVER BE MORE POWERFUL THAN ITS SAFETY CONTRACT.**

### Strict Capabilities Boundary
The system completely prohibits:
- Arbitrary shell or bash command execution
- Arbitrary SQL execution or dynamic query construction
- Arbitrary HTTP requests or outbound webhooks to user-provided URLs
- Arbitrary JavaScript / Node / Deno evaluation (`eval`, `Function`, `child_process`, `exec`, `spawn`)
- User-supplied executable scripts or configurations

Every remediation action is:
- **Predefined**: Code-implemented, immutable backend functions.
- **Allowlisted**: Only registered actions in `ops_remediation_actions` can be invoked.
- **Parameter-Bounded**: All inputs conform to strict schemas with bounds checks.
- **Authorization-Controlled**: Strictly restricted to authenticated Super Admin roles.
- **Auditable**: Every transition is appended to authoritative audit trails.
- **Reversible Where Possible**: Explicit rollback actions with verification.

```
DETECT (Alert / Incident)
   ↓
UNDERSTAND (Incident Correlation & Metric Context)
   ↓
SELECT APPROVED RUNBOOK (Authoritative Registry & Correlation Rules)
   ↓
VALIDATE SAFETY CONDITIONS (Environment, Rate Limits, Cooldown, Single-Flight)
   ↓
APPROVAL / EXECUTION POLICY (Observe Only vs Auto Level 1 vs Super Admin Level 2)
   ↓
EXECUTE CONTROLLED ACTION (Allowlisted Internal Server Function)
   ↓
VERIFY AUTHORITATIVE STATE (Post-Action Verification Query)
   ↓
AUDIT & NOTIFY (Timeline Event, Phase 8 Notifications, Telemetry)
```

---

## 2. Remediation Tiers & Philosophy

| Level | Classification | Description | Execution Mechanism |
|---|---|---|---|
| **Level 0** | **Observe Only** | Remediation is unsafe, external, or requires human judgment. | Operator instructions in Markdown. Zero automated mutation. |
| **Level 1** | **Safe Automatic** | Actions are demonstrably idempotent, safe, and internally bounded. | Automatic execution upon incident correlation and precondition validation. |
| **Level 2** | **Approval Required** | Actions with potential operational impact or resource reclamation. | Requires explicit Super Admin proposal, review, and cryptographic signoff. |

---

## 3. Allowlisted Action Registry & Canonical Catalog

| Action Key | Runbook Key | Level | Risk | Handler Implementation | Supports Rollback |
|---|---|---|---|---|---|
| `notification.retry_delivery` | `notification.flush_queue` | Level 1 | LOW | `executeNotificationFlush` | No |
| `job.retry_safe_run` | `job.retry_safe_run` | Level 1 | LOW | `executeJobRetry` | No |
| `analytics.rebuild_rollup` | `analytics.rebuild_rollup` | Level 1 | LOW | `executeAnalyticsRebuildRollup` | No |
| `telemetry.recollect` | `telemetry.recollect` | Level 1 | LOW | `executeTelemetryRecollect` | No |
| `operations.cache_refresh` | `operations.cache_refresh` | Level 1 | LOW | `executeCacheRefresh` | No |
| `database.size_guardrail` | `database.size_guardrail` | Level 2 | HIGH | `executeDatabaseSizeGuardrail` | Yes |

---

## 4. Safety Preconditions & Guardrails

Before any dry run or execution occurs, the server-side engine validates all preconditions:

1. **Allowlist Verification**: Action key and associated runbook must be present and enabled in the catalog.
2. **Environment Guardrails**:
   - Explicitly checks current environment: `DEVELOPMENT`, `STAGING`, `PRODUCTION`.
   - `UNKNOWN` environment automatically **BLOCKS** execution of all Medium, High, and Critical actions.
   - Every action explicitly declares its allowed environments.
3. **Single-Flight Concurrency Lock**:
   - Only one remediation may execute for a given `(incident_id, action_key)` at a time.
   - Any concurrent attempt while status is `PROPOSED`, `PENDING_APPROVAL`, `APPROVED`, or `EXECUTING` is rejected with `Single-flight conflict`.
4. **Cooldown Enforcement**:
   - After a remediation execution completes, a mandatory cooldown window (5–60 minutes depending on action) suppresses duplicate actions.
5. **Maximum Attempt Quota (`AUTOMATION_EXHAUSTED`)**:
   - Each action has an explicit `max_attempts` ceiling (default: 3).
   - If repeated attempts fail, the engine enters `AUTOMATION_EXHAUSTED` state and escalates to the on-call team via Phase 8 notifications.

---

## 5. Safe Dry Run Simulation

The safe dry-run simulator executes with a **Zero State Mutation Guarantee**:
- Evaluates all preconditions against real database state.
- Predicts duration, impact, and rollback availability.
- Surfaces explicit `WHAT WILL HAPPEN` and `WHAT WILL NOT HAPPEN` boundaries.
- **Mutates zero database rows** and triggers zero handlers.

---

## 6. Level 2 Super Admin Approval Workflow

Actions requiring approval follow a deterministic state machine:

```
PROPOSED
   ↓
PENDING_APPROVAL (24-hour expiration window)
   ↓
APPROVED (Authorized Super Admin signoff)
   ↓
EXECUTING (Single-flight lock acquired)
   ↓
COMPLETED (Only after post-action state verification succeeds)
   [or FAILED if verification fails]
```

- **Approval Expiry**: Approvals expire after 24 hours. Attempting to execute an expired approval fails with `APPROVAL_EXPIRED`.
- **Cancellation**: If an incident is manually resolved while remediations are pending, all pending/approved remediations are automatically transitioned to `CANCELLED` with `INCIDENT_RESOLVED`.

---

## 7. Post-Action Authoritative Verification

A remediation execution is **never** declared successful simply because an HTTP endpoint returned 200 or an internal function finished without throwing.

After handler execution:
1. Engine waits for the bounded completion window.
2. Queries authoritative system state (e.g., checks `ops_job_runs` status, queries probe health, verifies metric delta).
3. If the expected operational state is verified:
   - Sets status to `COMPLETED`.
   - Records `postcondition_verification.verified = true`.
4. If the state is not verified:
   - Sets status to `FAILED`.
   - Records safe error code `POST_VERIFICATION_FAILED`.
   - Triggers operational failure alert.

---

## 8. Rollback Engine

For actions with `supports_rollback: true` (e.g., `database.size_guardrail`):
- Rollbacks require explicit Super Admin invocation.
- Updates execution record to `ROLLED_BACK`.
- Persists timeline audit event `REMEDIATION_ROLLED_BACK`.
- Never uses generic "undo" logic.

---

## 9. Integration with Prior Certified Phases

- **Phase 4 (Operations Jobs)**: Remediation background workers (`remediation_worker`, `remediation_history_prune`) are registered in `ops_jobs`.
- **Phase 5 (Alerts & Incidents)**: Incident timeline receives `REMEDIATION_SUCCEEDED`, `REMEDIATION_FAILED`, `REMEDIATION_ROLLED_BACK` events while preserving resolution provenance (`AUTO_RECOVERY` vs `MANUAL`).
- **Phase 6 (Analytics)**: Remediation execution metrics feed into operations aggregates.
- **Phase 7 (Control Center)**: Rendered as Section 8 (`RemediationCenterPanel`) in `OperationsControlCenter`.
- **Phase 8 (Notifications)**: Important lifecycle events (`REMEDIATION_SUCCEEDED`, `REMEDIATION_FAILED`) automatically enqueue to `ops_notification_outbox`.

---

## 10. Security & Secret Isolation

- **Actor Attribution**: Authoritatively derived server-side from authenticated Super Admin JWT or `SYSTEM_REMEDIATION`. Client-supplied user IDs are strictly rejected.
- **Row-Level Security (RLS)**: Enforced across `ops_runbooks`, `ops_remediation_actions`, and `ops_remediation_executions`.
- **Secret Isolation**: Evidence and parameters scrub all JWTs, bearer tokens, API keys, and connection strings.
