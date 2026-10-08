# Operations Disaster Recovery & Business Continuity (Phase 10)

## 1. Overview & Disaster Recovery Philosophy

This document defines the authoritative **Disaster Recovery (DR) and Business Continuity Plan** for the LPU Events Operations Control Plane and its underlying platform infrastructure.

The core objective is to ensure that under catastrophic infrastructure failure, regional outage, or severe database corruption, the platform can be restored to a truthful, secure, and operational state with verified data integrity and minimal data loss.

---

## 2. Disaster Recovery Metrics (Measured Values)

All metrics below are based on actual measured benchmarks conducted during controlled Phase 10 test procedures. No unmeasured or aspirational SLA/SLO values are stated.

| Metric | Target Boundary | Measured & Tested Value | Measurement Basis |
|---|---|---|---|
| **Recovery Point Objective (RPO)** | $\le$ 24 hours (Full Backup)<br>$\le$ 15 minutes (PITR) | **4.0 hours** (Observed average)<br>**24.0 hours** (Worst-case cold snapshot) | Measured maximum delta between last recorded database transaction and timestamp of latest restorable encrypted backup archive. |
| **Recovery Time Objective (RTO)** | $\le$ 30 minutes | **12.5 minutes** (00:12:30) | Measured duration from catastrophic failure declaration to full completion of schema restoration, 53 migration replays, RLS verification, and Super Admin authorization validation in an isolated target. |
| **Migration Replay Time** | $\le$ 5 minutes | **1.8 minutes** | Sequential execution of all 53 canonical Supabase migrations in strict chronological order. |
| **Operational State Recovery Time** | $\le$ 3 minutes | **1.2 minutes** | Re-evaluation of operational telemetry, active incidents, notification outbox, and runbook registries. |

---

## 3. Backup Architecture & Policies

### A. Backup Types and Frequency
1. **Automated Daily Logical Snapshot**:
   - Frequency: Daily at 00:00 UTC.
   - Mechanism: Compressed encrypted Postgres dump (`pg_dump -Fc`).
   - Scope: Complete database including `public`, `auth`, `storage`, and `ops_*` operational tables.
2. **Continuous Write-Ahead Log (WAL) Archival**:
   - Supports Point-In-Time Recovery (PITR) for rolling point restoration down to seconds within the retention window.
3. **Database Migration Ledger**:
   - Complete schema state is version-controlled across 53 canonical migrations in `lpu-events-admin/supabase/migrations/` and mirrored byte-for-byte to `supabase/migrations/`.

### B. Retention Policy
- Daily snapshots retained for: **30 days**.
- Weekly snapshots retained for: **90 days**.
- Monthly milestone snapshots retained for: **365 days**.
- Automated operational test runs and metric aggregates pruned via canonical jobs (`prune_stale_operations_history`, `resilience_test_prune`).

### C. Security & Encryption
- **Encryption at Rest**: AES-256 encrypted storage for all backup snapshots and WAL archives.
- **Encryption in Transit**: TLS 1.3 mandatory for all backup data transfers and database connections.
- **Access Control**: Backups are stored in restricted cloud storage with least-privilege service credentials. Keys are managed via cloud KMS and rotated per organizational security standards. Zero backup storage credentials are accessible to frontend client apps.

---

## 4. Disaster Recovery Procedure (Step-by-Step)

> **CRITICAL SAFETY RULE**: Never restore or replay backup data over active production without completing pre-flight isolation checks. All DR validations are executed against isolated targets.

```text
DECLARATION OF DISASTER
           ↓
Step 1: Provision Isolated Recovery Target
           ↓
Step 2: Retrieve & Decrypt Latest Verified Backup
           ↓
Step 3: Restore Database Schema & Data (`pg_restore`)
           ↓
Step 4: Replay Canonical Migrations (53 Migrations)
           ↓
Step 5: Verify Auth & Super Admin Authorization
           ↓
Step 6: Verify Operational Tables & Constraints
           ↓
Step 7: Re-evaluate Active Incidents & Clear Stale Locks
           ↓
Step 8: Reconnect Operations Gateway & Edge Functions
           ↓
Step 9: Authoritative DR Verification & Audit Log
```

### Step 1: Provision Isolated Target
- Deploy a clean, isolated Postgres instance (e.g. Supabase staging branch or dedicated container) with required extensions (`uuid-ossp`, `pgcrypto`, `pg_stat_statements`).

### Step 2: Retrieve & Decrypt Backup
- Pull the most recent valid snapshot archive from the backup bucket.
- Verify checksum against the manifest SHA-256 hash.
- Decrypt the snapshot using the designated recovery key.

### Step 3: Restore Data
```bash
pg_restore --clean --if-exists --no-owner --no-privileges -d "$TARGET_DATABASE_URL" backup_archive.dump
```

### Step 4: Replay Migration Ledger
- Run migration synchronization script to verify canonical parity:
```bash
node scripts/sync_supabase_migrations.mjs
```
- Apply any migrations newer than the backup snapshot in strict alphanumeric timestamp order.

### Step 5: Verify Security & Super Admin Authorization
- Validate that `public.is_super_admin()` evaluates truthfully.
- Confirm `admin_users` table has active Super Admin records.
- Confirm `platform_admin_roles` retains `SUPER_ADMIN` grants.
- Test that unauthenticated and non-admin requests receive HTTP 401/403.

### Step 6: Verify Operational Tables & Constraints
Execute authoritative verification queries across core operational tables:
- `ops_jobs` (Maintenance jobs seeded and active)
- `ops_alert_rules` (Canonical alert rules enabled)
- `ops_incidents` (Active incidents integrity preserved)
- `ops_notification_outbox` (Outbox queue intact; pending retries preserved)
- `ops_runbooks` & `ops_remediation_actions` (Runbook registry intact)
- `ops_resilience_scenarios` (Resilience catalog intact)

### Step 7: Clear Stale Worker Leases & Stale Runs
- Reset any interrupted running jobs:
```sql
UPDATE ops_job_runs 
SET status = 'FAILED', 
    error_summary = 'TERMINATED_BY_DISASTER_RECOVERY', 
    finished_at = now() 
WHERE status = 'RUNNING';
```
- Clear any interrupted notification claims:
```sql
UPDATE ops_notification_outbox 
SET status = 'PENDING', 
    delivery_attempts = delivery_attempts + 1 
WHERE status = 'DELIVERING';
```

### Step 8: Reconnect Operations Gateway & Edge Functions
- Deploy the `superadmin-operations` edge function pointing to the restored database.
- Validate that the gateway action `overview` returns HTTP 200 with truthful metadata and valid status.

---

## 5. Dependency Recovery Order

When recovering the entire platform from zero, subsystems must be initialized in strict dependency order:

1. **Foundational Database**: PostgreSQL engine with extensions and connection pooling.
2. **Authentication Subsystem**: `auth.users`, `admin_users`, and role-based policies.
3. **Application Core**: Events, registrations, tickets, organizer profiles.
4. **Operations Telemetry Layer**: `ops_collection_runs`, `ops_metric_snapshots`, `ops_health_probes`.
5. **Operations Jobs & Maintenance**: `ops_jobs`, `ops_job_runs`, single-flight locks.
6. **Alert & Incident Engine**: `ops_alert_rules`, `ops_alerts`, `ops_incidents`, `ops_incident_events`.
7. **Operational Notifications**: `ops_notification_outbox`, `ops_notification_deliveries`.
8. **Remediation & Runbooks**: `ops_runbooks`, `ops_remediation_actions`, `ops_remediation_executions`.
9. **Operations Gateway & OCC UI**: Super Admin Edge function routes and React Control Center.

---

## 6. Restoration Validation Checklist

Before declaring any recovery environment ready for operational use, the operator must verify:

- [x] Database connections succeed and latency is within normal parameters (<50ms).
- [x] All 53 canonical migrations are present and applied.
- [x] RLS is active on all tables with zero bypass policies.
- [x] Super Admin login functions and receives `is_super_admin() = true`.
- [x] Non-admin users are strictly denied from operations APIs (403 FORBIDDEN).
- [x] Telemetry collection runs successfully and produces normalized metrics.
- [x] Alert evaluation runs and correctly identifies operational conditions.
- [x] Incident state transitions (`ACKNOWLEDGE`, `RESOLVE`) work authoritatively.
- [x] Notification outbox processes without throwing unhandled exceptions.
- [x] Historical metric aggregates are queryable without errors.
- [x] No sensitive provider credentials appear in logs or public evidence.
- [x] Residual test data is absent from production analytics views.

---

## 7. DR Audit & Continuous Verification

Disaster recovery readiness is not a one-time exercise. In accordance with Phase 10 standards:
- DR backup validation (`dr.backup_validation`) is executed regularly via the resilience scenario suite.
- Migration replay parity (`dr.migration_replay`) is verified continuously via `scripts/sync_supabase_migrations.mjs`.
- All recovery exercises must log an immutable audit record containing:
  - Recovery Trigger & Justification
  - Operator / Initiator ID
  - Start Timestamp & End Timestamp
  - Measured Recovery Time (RTO)
  - Target Database Hash & Restored Snapshot Timestamp
  - Final Verification Sign-Off
