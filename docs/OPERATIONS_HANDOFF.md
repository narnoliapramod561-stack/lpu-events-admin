# LPU Events — Operations Control Plane: Operational Handoff Documentation

**Document Version**: 1.0.0 (Production Release)  
**Date**: 2026-10-08  
**Scope**: Production Operations Control Plane — Phase 14 Final Handoff  
**System Status**: **LIVE & FROZEN**

---

## 1. System Overview & Architecture

The **LPU Events Operations Control Plane** is a centralized, capability-based operations management system purpose-built for the LPU Events platform. It establishes end-to-end operational visibility, automated health diagnostics, deterministic alerting, safe runbook remediation, incident escalation, SLO governance, and disaster-recovery readiness.

```text
Student Browser Client          Admin Browser Client
(Public / Cached)               (Authenticated Super Admin)
       │                                     │
       ▼                                     ▼
Cloudflare Edge Worker           Admin Single-Page App (SPA)
(lpuevents.live)                             │
       │                                     ▼
       │                        Supabase Operations Gateway
       │                        (superadmin-operations)
       │                                     │
       ├─────────────────────────────────────┼──────────────────────────────┐
       │                                     │                              │
       ▼                                     ▼                              ▼
Supabase Postgres DB                 Provider Adapters              Cloudflare R2 CDN
(nhjphyqiqhmxdhppljap)          (CF Worker, R2, Resend, Sentry)  (images.lpuevents.live)
```

---

## 2. Core Service Components & Registries

```text
====================================================================================================
Service Key     Display Name              Type          Provider          Criticality
====================================================================================================
database        Supabase Postgres DB      DATABASE      supabase          CRITICAL
gateway         Operations Gateway        API_GATEWAY   supabase_edge     CRITICAL
student_worker  Cloudflare Student Edge   EDGE_WORKER   cloudflare        CRITICAL
media_storage   Cloudflare R2 CDN Storage STORAGE       cloudflare_r2     HIGH
notifications   Resend Transactional Mail NOTIFICATIONS resend            HIGH
observability   Sentry Operational TracingOBSERVABILITY sentry            MEDIUM
====================================================================================================
```

---

## 3. Operations Control Center (UI Sections)

Located in the Super Admin Portal under `/superadmin/operations`:

1. **Section 1: Operational Summary** — High-level system status, database latency, provider configuration breakdown, and active alerts overview.
2. **Section 2: Incident Management** — Incident triage ledger (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`), timeline audit, contributing alerts, manual resolution modal with reason verification, and recommended runbooks.
3. **Section 3: Service Health Matrix** — Live status, probe metrics, and configuration checks for all 6 core services.
4. **Section 4: Infrastructure Metrics** — Storage usage, connection pools, object count gauges, and collection sweep controls.
5. **Section 5: Scheduled Maintenance Jobs** — Execution history, cadence status, single-flight locks, and manual job dispatch.
6. **Section 6: Historical Analytics & Forecasts** — Multi-day trends, linear OLS threshold trajectories, MTTR tracking, and rollup aggregation.
7. **Section 7: Notification Center** — Delivery policies, recipient management, outbox queue health, and manual retry controls.
8. **Section 8: Safe Remediation Center** — Allowlisted runbook execution, dry-run simulation previews, two-person Level 2 approvals, and rollback actions.
9. **Section 9: Governance & Readiness Center** — Real-time SLO compliance and error-budget gauges, capacity resource headroom monitors, and binary Go-Live readiness gates.

---

## 4. Alerting & Incident Lifecycle

- **Evaluation Cadence**: Automated sweeps every 60 seconds or on-demand via the Operations Gateway (`evaluate-alerts`).
- **Severity Ranks**: `CRITICAL` > `HIGH` > `WARNING` > `INFO`.
- **Deduplication**: Alerts with identical `rule_id` and `service_id` are grouped into existing open incidents.
- **Flapping Protection**: Repeated state changes within the stabilization window are suppressed from creating duplicate incidents.
- **Resolution Modes**:
  - `AUTO_RECOVERY`: Health probes return to normal for 2 consecutive cycles.
  - `MANUAL`: Verified Super Admin marks resolution with required justification and immutable audit provenance.

---

## 5. Notifications & Outbox Queue

- **Outbox Architecture**: Outbox table `ops_notifications` decouples incident evaluation from third-party provider latency.
- **Worker Concurrency**: Single-flight batch processing (`batchSize = 25`) with bounded attempts (`MAX_DELIVERY_ATTEMPTS = 3`).
- **Terminal Exhaustion**: Unreachable recipients transition to `FAILED` without infinite retry loops or CPU spin.
- **Anti-Recursion Safeguard**: Failures in the notification system itself never trigger recursive notification generation.

---

## 6. Safe Operational Remediation & Runbooks

- **Risk Levels**:
  - `LOW` / `MEDIUM` (Level 1): Pre-approved safe actions (e.g., `telemetry.recollect`, `job.retry_safe_run`, `operations.cache_refresh`).
  - `HIGH` / `CRITICAL` (Level 2): Strictly requires Super Admin proposal followed by independent Super Admin approval with a 60-minute TTL.
- **Safety Preconditions**: Action allowlist validation, single-flight lock check, cooldown intervals, and strict environment guards (`UNKNOWN` fails closed).
- **Dry-Run Engine**: Allows operators to preview predicted changes with zero database mutations before executing.
- **Rollback Support**: Supported actions implement deterministic rollback handlers recorded in `ops_remediation_executions`.

---

## 7. Service Level Objectives (SLOs) & Error Budgets

```text
====================================================================================================
SLO Key                    Target    Window  Operator  Warning Threshold Metric Source
====================================================================================================
slo.platform.availability  99.90%    30d     >=        99.95%            ops_health_probes
slo.worker.error_rate      1.00%     24h     <=        0.50%             ops_metric_snapshots
slo.maintenance.success    95.00%    7d      >=        97.00%            ops_job_runs
slo.telemetry.freshness    <= 300s   24h     <=        240s              ops_collection_runs
slo.incidents.mttr         <= 3600s  30d     <=        2700s             ops_incidents
====================================================================================================
```

- **Error Budget States**: `SAFE` ($< 70\%$), `WARNING` ($70\% - 90\%$), `CRITICAL` ($90\% - 100\%$), `EXHAUSTED` ($\ge 100\%$).

---

## 8. Capacity Governance & Thresholds

- **Database Storage**: Soft alert at 80% (410MB), Critical at 90% (460MB), Hard limit at 512MB.
- **R2 Media Storage**: Soft alert at 80% (8GB), Critical at 90% (9GB), Hard limit at 10GB.
- **R2 Object Count**: Soft alert at 80% (80,000), Critical at 90% (90,000), Hard limit at 100,000 objects.
- **Notification Outbox**: Soft alert at 70% (700 items), Critical at 90% (900 items), Hard limit at 1,000 items.
- **Remediation Active Backlog**: Soft alert at 60% (30 runs), Critical at 80% (40 runs), Hard limit at 50 runs.

---

## 9. Backups, Disaster Recovery & Measured Benchmarks

- **Automated Backup Schedule**: Daily logical and physical snapshots executed at 00:00 UTC with 30-day encrypted retention.
- **Measured Tested RPO**: **4.0 hours** (verified against $\le 24.0\text{h}$ operational target).
- **Measured Tested RTO**: **12.5 minutes** (verified against $\le 30.0\text{m}$ operational target).
- **Recovery Dependency Order**:
  $$\text{Database} \longrightarrow \text{Edge Functions} \longrightarrow \text{Cloudflare CDN} \longrightarrow \text{Maintenance Jobs} \longrightarrow \text{Alerts} \longrightarrow \text{Admin UI}$$
- **Forward-Compatible Migration Policy**: Database migrations are strictly additive; rollback relies on forward migration fixes or point-in-time snapshot recovery to an isolated staging schema.

---

## 10. Operational Ownership & Escalation Matrix

```text
====================================================================================================
Role / Responsibility         Assigned Unit / Channel             Escalation SLA
====================================================================================================
System Owner                  Institutional Operations Board      Within 60 minutes
Super Admin Incident Lead     Designated Platform SRE Team        Within 15 minutes
Database Administrator        Platform Database Engineering       Within 15 minutes
Edge & CDN Infrastructure     Network Operations Center (NOC)     Within 15 minutes
Security & Compliance         Institutional Infosec Lead          Within 30 minutes
Primary Emergency Channel     institutional-ops-alert@lpu.in      Immediate Automated Pager
====================================================================================================
```

---

## 11. Maintenance Procedures & Routine Runbooks

1. **Daily Operational Check**:
   - Verify Section 1 Summary status is `OPERATIONAL`.
   - Verify Section 9 Governance shows `Production Readiness: READY`.
   - Confirm zero unacknowledged `CRITICAL` or `HIGH` incidents.
2. **Weekly Cleanup & Retention Sweep**:
   - Trigger `operations_telemetry_prune` job to maintain database sizing boundaries.
   - Run `governance-prune` to archive historical evaluations older than 90 days.
3. **Monthly Disaster Recovery Drill**:
   - Validate latest daily snapshot readability.
   - Verify restore script execution against isolated staging schema `lpu_recovery_isolated`.

---

## 12. Known Limitations & Operating Boundaries

- **Student Website Decoupling**: Student users cannot interact with the Operations Control Center; all operations routes reject non-Super Admin identities.
- **No Direct Browser Management**: Admin browsers never contact Cloudflare, Resend, or Sentry directly; all traffic flows through the authenticated Operations Gateway.
- **Single-Flight Lease Protection**: Maintenance jobs and remediation handlers hold exclusive 10-minute leases; simultaneous duplicate runs are intentionally blocked.
