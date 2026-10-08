# Operations Reliability, SLO, Capacity & Production Readiness Governance (Phase 11)

## 1. Architectural Overview & Objective

Phase 11 establishes the **formal reliability, service-level, capacity, and production-readiness governance layer** for the LPU Events Operations Control Plane. Operating on top of certified operational measurements (Phases 1–10), Phase 11 answers critical operational questions with mathematical rigor and authoritative telemetry:

- Are platform services meeting their reliability objectives?
- What proportion of the error budget has been consumed?
- Which services are approaching SLO breaches?
- Do we have sufficient headroom across databases, storage, and queues?
- Are production dependencies properly configured?
- Is the platform operationally certified for release?

```text
OPERATIONAL MEASUREMENTS (Probes, Runs, Metrics, Incidents)
                   ↓
            SLI CALCULATION
                   ↓
            SLO EVALUATION
                   ↓
         ERROR BUDGET CONSUMPTION
                   ↓
       CAPACITY & HEADROOM ANALYSIS
                   ↓
        PRODUCTION READINESS GATES
                   ↓
       GOVERNANCE AUDIT & EVIDENCE
```

---

## 2. Core Governance Principles

1. **Authoritative Lineage**: Every SLI, SLO, and readiness check derives from authoritative server-side telemetry. Zero fabricated uptime, guessed availability, or hardcoded reliability percentages.
2. **Deterministic Evaluation**: Mathematical boundaries are explicit and documented. Division by zero and missing samples produce `INSUFFICIENT_DATA` rather than assumed health or false outages.
3. **Configuration Versioning**: SLO targets and capacity thresholds are version-controlled with explicit `effective_from` and `effective_to` timestamps. Historical evaluations remain linked to the target that was active at evaluation time.
4. **Fail-Closed Environment Gate**: `UNKNOWN` environments default to `UNKNOWN` and block release certification.
5. **No Green Dashboard Theater**: Production readiness requires verifiable evidence across every blocking check. A single critical incident or unverified backup immediately sets readiness to `NOT_READY`.

---

## 3. Service Level Indicator (SLI) Definitions

The system defines 6 canonical SLIs in `ops_sli_definitions`:

| SLI Key | Service | Type | Unit | Aggregation | Description | Source |
|---|---|---|---|---|---|---|
| `platform.availability` | `platform` | `AVAILABILITY` | `PERCENT` | `RATIO` | Ratio of successful health probes to eligible probe checks | `ops_health_probes` |
| `worker.error_rate` | `cloudflare` | `ERROR_RATE` | `PERCENT` | `RATIO` | Worker HTTP 5xx error percentage over total request volume | `ops_metric_snapshots` |
| `maintenance_jobs.success_rate` | `supabase` | `SUCCESS_RATE` | `PERCENT` | `RATIO` | Ratio of `COMPLETED` runs to eligible terminal runs (`PARTIAL` excluded) | `ops_job_runs` |
| `telemetry.freshness` | `telemetry` | `FRESHNESS` | `SECONDS` | `LATEST` | Elapsed seconds since the most recent collection run | `ops_collection_runs` |
| `incidents.mttr` | `platform` | `RECOVERY_TIME` | `SECONDS` | `AVERAGE` | Average duration from incident opened to verified resolution | `ops_incidents` |
| `database.query_latency` | `database` | `LATENCY` | `MILLISECONDS` | `P95` | P95 latency of database diagnostics checks | `ops_health_probes` |

---

## 4. Service Level Objective (SLO) Definitions & Target Semantics

Canonical SLOs in `ops_slo_definitions`:

| SLO Key | SLI Key | Target | Window | Direction | Warning Threshold | Description |
|---|---|---|---|---|---|---|
| `slo.platform.availability` | `platform.availability` | 99.90% | `30d` | `GREATER_EQUAL` | 99.95% | Core Platform $\ge 99.9\%$ Availability over rolling 30 days |
| `slo.worker.error_rate` | `worker.error_rate` | 1.00% | `24h` | `LESS_EQUAL` | 0.50% | Edge Worker Error Rate $\le 1.0\%$ over rolling 24 hours |
| `slo.maintenance.success_rate` | `maintenance_jobs.success_rate` | 95.00% | `7d` | `GREATER_EQUAL` | 97.00% | Scheduled Maintenance Jobs $\ge 95.0\%$ Completion over 7 days |
| `slo.telemetry.freshness` | `telemetry.freshness` | 300.0s | `24h` | `LESS_EQUAL` | 240.0s | Telemetry Collection Latency $\le 300$ seconds (5 minutes) |
| `slo.incidents.mttr` | `incidents.mttr` | 3600.0s | `30d` | `LESS_EQUAL` | 2700.0s | Mean Time to Recovery $\le 3600$ seconds (1 hour) |

### SLO Status Vocabulary
- `MEETING`: Observed value satisfies target and is above/below the warning threshold.
- `AT_RISK`: Target is met, but observed value has crossed the warning threshold.
- `BREACHED`: Observed value violates target boundary.
- `INSUFFICIENT_DATA`: Telemetry observations are absent or sample count is below minimum threshold.
- `NOT_CONFIGURED`: Target is disabled or unconfigured.

---

## 5. Mathematical Models: Error Budget & Burn Rate

### A. GREATER_EQUAL Direction (Availability / Success Rate)
Given Target $T$ and Observed Value $A$:
$$\text{Total Budget} = 100 - T$$
$$\text{Consumed Budget} = \max(0, 100 - A)$$
$$\text{Remaining Budget} = \max(0, \text{Total Budget} - \text{Consumed Budget})$$
$$\text{Consumption Percentage} = \frac{\text{Consumed Budget}}{\text{Total Budget}} \times 100\%$$

**Boundary Example ($T = 99.90\%$, Total Budget = $0.10\%$):**
- $A = 99.95\% \implies \text{Consumed} = 0.05\% \implies 50.0\% \text{ consumed} \implies \text{SAFE}$
- $A = 99.90\% \implies \text{Consumed} = 0.10\% \implies 100.0\% \text{ consumed} \implies \text{EXHAUSTED}$
- $A = 99.89\% \implies \text{Consumed} = 0.11\% \implies 110.0\% \text{ consumed} \implies \text{EXHAUSTED (BREACHED)}$

### B. LESS_EQUAL Direction (Error Rate / Latency / Freshness)
Given Target $T$ and Observed Value $A$:
$$\text{Total Budget} = T$$
$$\text{Consumed Budget} = \max(0, A)$$
$$\text{Remaining Budget} = \max(0, T - A)$$
$$\text{Consumption Percentage} = \frac{A}{T} \times 100\%$$

### C. Error Budget Status Classification
- **SAFE**: Consumption $< 70\%$
- **WARNING**: $70\% \le \text{Consumption} < 90\%$
- **CRITICAL**: $90\% \le \text{Consumption} < 100\%$
- **EXHAUSTED**: $\text{Consumption} \ge 100\%$

---

## 6. Capacity Governance & Headroom Model

The platform monitors physical and logical resource ceilings via `ops_capacity_definitions`:

| Resource Key | Category | Unit | Hard Limit | Soft Threshold | Critical Threshold | Source |
|---|---|---|---|---|---|---|
| `capacity.database.storage` | `DATABASE` | `BYTES` | 536,870,912 (512MB) | 80.0% | 90.0% | `ops_metric_snapshots:database_size_bytes` |
| `capacity.r2.storage` | `STORAGE` | `BYTES` | 10,737,418,240 (10GB) | 80.0% | 90.0% | `ops_metric_snapshots:r2_storage_bytes` |
| `capacity.r2.objects` | `STORAGE` | `COUNT` | 100,000 | 80.0% | 90.0% | `ops_metric_snapshots:r2_object_count` |
| `capacity.notifications.outbox_queue` | `QUEUE` | `COUNT` | 1,000 | 70.0% | 90.0% | `ops_notification_outbox:pending_count` |
| `capacity.remediation.queue` | `QUEUE` | `COUNT` | 50 | 60.0% | 80.0% | `ops_remediation_executions:executing_count` |
| `capacity.resend.daily_emails` | `EMAIL` | `COUNT` | 3,000 | 80.0% | 95.0% | `ops_metric_snapshots:resend_emails_sent` |

### Headroom & Utilization Formulas
$$\text{Headroom} = \max(0, \text{Hard Limit} - \text{Current Usage})$$
$$\text{Utilization Percentage} = \frac{\text{Current Usage}}{\text{Hard Limit}} \times 100\%$$

### Capacity States
- `HEALTHY`: Utilization $<$ Soft Threshold ($< 80\%$)
- `WATCH`: Soft Threshold $\le$ Utilization $<$ Critical Threshold ($80\% - 90\%$)
- `CRITICAL`: Critical Threshold $\le$ Utilization $< 100\%$ ($90\% - 100\%$)
- `EXHAUSTED`: Utilization $\ge 100\%$
- `NOT_CONFIGURED`: Resource has no authoritative hard limit.

---

## 7. Production Readiness Governance Model

Release readiness is evaluated deterministically against 6 primary governance criteria:

1. **`active_critical_incidents`** (BLOCKING): Must have 0 active `CRITICAL` incidents.
2. **`active_high_incidents`** (WARNING): Recommends 0 active `HIGH` incidents.
3. **`backup_freshness`** (BLOCKING): Verified encrypted backup snapshot must exist and be $< 24.0$ hours old.
4. **`migration_parity`** (BLOCKING): All 54 canonical database migrations must match byte-for-byte.
5. **`operations_gateway`** (BLOCKING): Edge function operations router must report `OPERATIONAL`.
6. **`telemetry_freshness`** (WARNING): Latest collection run must have occurred within 600 seconds (10 minutes).

### Readiness Status Determination
- **`READY`**: All checks pass (`0` blocking failures, `0` warnings).
- **`READY_WITH_WARNINGS`**: All blocking checks pass, but non-blocking warnings exist.
- **`NOT_READY`**: One or more blocking checks fail.
- **`UNKNOWN`**: Evaluated environment is `UNKNOWN` (fails closed).

---

## 8. Integration with Prior Operational Phases

- **Phase 5 Alerting**: SLO breaches and critical capacity exhaustion trigger alerts via canonical alert evaluation.
- **Phase 8 Notifications**: Error budget exhaustion and readiness failures enqueue notifications to on-call teams.
- **Phase 9 Safe Remediation**: High capacity states (e.g. database table bloat) recommend approved runbooks (`database.size_guardrail`) without unrestricted auto-execution.
- **Phase 10 Disaster Recovery**: RPO/RTO verification feeds directly into the readiness backup freshness gate.

---

## 9. Security & Access Control

- **Super Admin Boundary**: All governance mutations and evaluations require authenticated JWT with verified `public.is_super_admin()` role. Non-admin roles (organizers, students) receive HTTP 403 `FORBIDDEN`.
- **Secret Isolation**: Evidence payloads, error logs, and audit trails scrub bearer tokens, JWTs, and provider API credentials prior to persistence.
