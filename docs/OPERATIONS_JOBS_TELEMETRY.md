# LPU Events — Operations Jobs & Maintenance Telemetry (Phase 4)
## Authoritative Background & Maintenance Job Observability Architecture

---

## 1. Executive Summary

Phase 4 establishes authoritative operational observability for all scheduled and background maintenance operations across the LPU Events platform. Prior to this phase, maintenance routines (such as the 6-hour database size guardrail, physical Cloudflare R2 orphan purges, and telemetry history prunes) executed silently without persisting structured execution records or cadence metrics.

With Phase 4, every production maintenance operation is registered in a canonical job registry (`ops_jobs`), protected with single-flight concurrency locking, and tracked through structured execution runs (`ops_job_runs`).

```text
                     SCHEDULED / BACKGROUND MAINTENANCE
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
       Database Size            Cloudflare R2          Telemetry
      Guardrail / Cleanup      Physical Orphan Purge   Prune & Collect
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     ↓
                          Job Start & Single Flight
                     (start_operations_job_run)
                                     ↓
                               ops_job_runs
                                     ↓
                            Maintenance Work
                                     ↓
                        Job Complete & Metrics
                    (finish_operations_job_run)
                                     ↓
                         Operations Gateway
                  (/superadmin-operations?action=jobs)
                                     ↓
                         SUPER ADMINISTRATOR
```

---

## 2. Canonical Job Registry (`ops_jobs`)

The platform defines four canonical, machine-readable production maintenance jobs:

| Job Key | Display Name | Type | Criticality | Cadence / Schedule | Execution Source | Primary Responsibilities |
|---|---|---|:---:|---|---|---|
| `database_cleanup` | Database Size Guardrail & Cleanup | `DATABASE` | **HIGH** | Every 6 hours (`0 */6 * * *`) | GitHub Actions (`database_cleanup.yml`) | Purges audit logs (>15d), access requests (>30d), transitions past events, and flags unreferenced media. |
| `r2_orphan_cleanup` | Cloudflare R2 Physical Orphan Purge | `STORAGE` | **HIGH** | Periodic / On-demand | Maintenance Worker / SRE | Claims `PENDING_DELETE` media assets and physically purges R2 objects across all responsive variants. |
| `operations_telemetry_prune` | Operational Telemetry Retention Prune | `TELEMETRY` | **MEDIUM** | Daily / Retention Sweep | Supabase RPC (`prune_stale_operations_telemetry`) | Deletes metric snapshots, health probes, collection runs, and job runs beyond 30–60 day retention. |
| `provider_telemetry_collection` | Provider Telemetry Collection | `TELEMETRY` | **MEDIUM** | Hourly / On-demand | Operations Gateway (`collector.ts`) | Collects metrics & health probes across Supabase, Cloudflare Workers/R2, Resend, and Sentry. |

---

## 3. Job Execution Lifecycle & State Machine

Each maintenance job execution transitions through a strict, validated lifecycle:

```text
                ┌──────────────┐
                │    START     │
                └──────┬───────┘
                       │ start_operations_job_run()
                       ▼
                ┌──────────────┐
       ┌───────►│   RUNNING    │◄────── heartbeat_operations_job_run()
       │        └──────┬───────┘
       │               │
       │    ┌──────────┼──────────┬──────────┐
       │    │          │          │          │
       │    ▼          ▼          ▼          ▼
       │ ┌──────┐ ┌─────────┐ ┌────────┐ ┌───────────┐
       │ │COMPL.│ │ PARTIAL │ │ FAILED │ │ CANCELLED │
       │ └──────┘ └─────────┘ └────────┘ └───────────┘
       │    ▲          ▲          ▲          ▲
       │    └──────────┴──────────┴──────────┘
       │               finish_operations_job_run()
       │
  Single-Flight Lock Active:
  Rejects duplicate run with ACTIVE_RUN_IN_PROGRESS
```

### Lifecycle Rules:
1. **Single-Flight Concurrency Protection**: If a job is currently `RUNNING` within its active execution window (default 30 minutes) and has a valid heartbeat, subsequent start attempts are rejected with `acquired: false, reason: 'ACTIVE_RUN_IN_PROGRESS'`.
2. **Terminal Status Transitions**: Only `RUNNING` jobs can transition to terminal statuses (`COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED`).
3. **Idempotent Resolution**: Invoking `finish_operations_job_run` on an already-terminal execution is safe, returning `already_finalized: true` without corrupting history.
4. **Calculated Duration**: Server-side duration is calculated as `duration_ms = EXTRACT(MILLISECONDS FROM (clock_timestamp() - started_at))::integer`.

---

## 4. Cadence-Aware Freshness & Health Evaluation

Operational health is dynamically derived from execution records without overwriting historical run statuses:

```text
Freshness Evaluation Formula:
  age_minutes = (now - last_success_at) / 60000
  is_stale = (expected_interval_minutes != null) AND (age_minutes > 2 * expected_interval_minutes)
```

### Health Status Taxonomy:
- `HEALTHY`: Job enabled, last run was `COMPLETED`, and executed within 2x expected interval.
- `RUNNING`: Job is actively executing.
- `PARTIAL`: Job finished with partial success (some operations succeeded, some failed).
- `FAILED`: Job finished with failure or unhandled exception.
- `STALE`: Job has exceeded 2x its expected cadence without a successful completion.
- `DISABLED`: Job is explicitly disabled in `ops_jobs`.
- `UNKNOWN`: No execution history or unknown cadence (Rule 6: Never mark unknown jobs as stale).

---

## 5. Maintenance Processes Instrumentation

### 5.1 Database Size Guardrail (`scripts/database_size_guardrail.mjs`)
- **Single-Flight Lock**: Obtains `start_operations_job_run('database_cleanup')` before executing sweep.
- **Counters**:
  - `records_scanned`: Sum of audit logs, access requests, events, and orphan media evaluated.
  - `records_deleted`: Sum of audit logs and access requests purged.
  - `records_processed`: Past events transitioned + orphan media flagged.
  - `records_failed`: Count of subroutine errors.
- **Fault Isolation**: If telemetry recording encounters a database error, cleanup routines continue unaffected (Rule 4).

### 5.2 Cloudflare R2 Orphan Purge (`src/shared/images/cleanup.ts`)
- **Database vs. Physical Separation**:
  - Unreferenced media rows are flagged `PENDING_DELETE` by Postgres.
  - S3 `deleteMany` physically purges objects from Cloudflare R2 across all responsive variants (`_desktop`, `_tablet`, `_mobile`, `presentations`, `master`).
  - **ONLY on confirmed physical deletion** does database state transition to `DELETED`.
  - On physical failure, status rolls back to `PENDING_DELETE` with error logging.
  - Job records `status: 'PARTIAL'` if some physical deletes fail, preventing false-healthy claims.

### 5.3 Operational History Pruning (`prune_stale_operations_telemetry`)
- Bounded retention: Prunes metric snapshots, health probes, and collection runs (>30 days).
- Prunes terminal job runs (>60 days via `prune_stale_operations_job_runs`).
- **Safety**: Running executions (`status = 'RUNNING'`) are **never deleted**.

### 5.4 Provider Collection Run (`superadmin-operations/collector.ts`)
- Linked to `ops_job_runs` with `p_job_key: 'provider_telemetry_collection'`.
- Carries `collection_run_id` in metadata, eliminating duplicate event tracking.

---

## 6. GitHub Actions Integration & Workflow Reconciliation

- **Workflow Configuration**: `.github/workflows/database_cleanup.yml` schedules maintenance every 6 hours (`0 */6 * * *`) on `ubuntu-latest`.
- **Server-Side Reconciliation**: Operations Gateway exposes `github_actions_reconciliation` in the `maintenance` action.
- **Credential Isolation**: If `GITHUB_TOKEN` is present in server environment, the gateway queries GitHub REST API `GET /repos/{owner}/{repo}/actions/workflows/database_cleanup.yml/runs` to inspect workflow conclusion and duration. If missing, reports `NOT_CONFIGURED` without leaking credentials.

---

## 7. Security & Authorization Boundary

- **Super Admin Only**: Read access to `ops_jobs` and `ops_job_runs` is strictly restricted to authenticated Super Administrators via Postgres RLS (`public.is_super_admin()`).
- **Service Role Control**: Job lifecycle mutations (`start_operations_job_run`, `finish_operations_job_run`, `heartbeat_operations_job_run`) require `service_role` or Super Admin privileges.
- **Zero Browser Mutation**: The client SDK contains zero methods to start, complete, or delete job runs.
- **Secret Sanitization**: Error messages and metadata are sanitized to redact Bearer tokens, JWT payloads, and database connection strings.

---

## 8. Phase Boundary Clarification

The following systems are **strictly excluded** from Phase 4 and reserved for subsequent canonical phases:
- **No Alert Engine**: Failed jobs do not generate alert rows or trigger incident workflows.
- **No Notifications**: No emails, SMS, Slack, PagerDuty, or webhooks are dispatched.
- **No Predictive Forecasting**: No ML duration predictions or quota exhaustion regressions.
- **No Final Operations Dashboard**: The full Operations Control Center UI belongs to Phase 5.
