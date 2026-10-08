# LPU Events — Operational Incident Response Runbook

**Document Version**: 1.0.0 (Production Release)  
**Date**: 2026-10-08  
**Scope**: Production Incident Response & Runbook Execution  
**Standard**: ISO/IEC 27035 & Google SRE Incident Management Principles

---

## 1. Incident Lifecycle Workflow

```text
[1. DETECT]  ──►  [2. TRIAGE]  ──►  [3. NOTIFY]  ──►  [4. INVESTIGATE]
                                                              │
[8. CLOSURE] ◄──  [7. VERIFY]  ◄──  [6. RECOVER] ◄──  [5. REMEDIATE]
      │
      ▼
[9. POST-MORTEM & REVIEW]
```

---

## 2. Step-by-Step Incident Response Procedures

### Step 1: Incident Detection & Ingestion
- **Automated**: The server-side alert engine evaluates rules against real-time health probes and metric snapshots. If a condition matches for $\ge 2$ consecutive cycles, an alert is triggered and linked to an incident in `ops_incidents`.
- **Manual**: Operators who discover anomalies during live events can review `ops_health_probes` in the Control Center to inspect latency or error codes.

### Step 2: Triage & Severity Classification
When an incident enters `OPEN` status, classify according to operational severity:

```text
====================================================================================================
Severity    Impact Definition                                                Response SLA
====================================================================================================
CRITICAL    Total platform outage, database unreachable, or data loss risk.  15 minutes
HIGH        Degraded service (e.g. image uploads failing, email outbox stuck) 30 minutes
WARNING     Transient spike in latency or minor telemetry staleness (>300s). 2 hours
INFO        Diagnostic notification or scheduled job completion note.        Next business day
====================================================================================================
```

### Step 3: Acknowledgement & Notification
1. Open the **Operations Control Center** $\to$ **Incidents** section.
2. Select the incident and click **Acknowledge Incident**.
   - *Security Invariant*: The server authoritative operator ID is automatically assigned to `acknowledged_by`.
3. The notification dispatcher automatically issues email alerts to active Super Admin recipients in `ops_notification_recipients` according to the escalation policy.

### Step 4: Root Cause Investigation
1. Navigate to the incident details modal.
2. Inspect the **Contributing Alerts** and **Event Timeline** tabs.
3. Review related service health in **Section 3: Service Health Matrix**.
4. Check **Section 4: Infrastructure Metrics** for resource pressure (connections, storage, quota exhaustion).

### Step 5: Safe Remediation Selection
1. Review the **Recommended Runbooks** attached to the incident:
   - For telemetry staleness $\to$ `telemetry.recollect` (Level 1 Safe Action).
   - For failed maintenance jobs $\to$ `job.retry_safe_run` (Level 1 Safe Action).
   - For database bloat $\to$ `database.size_guardrail` (Level 2 High-Risk Action; requires approval).
2. Execute a **Dry Run** simulation to preview effects before applying changes.
3. If executing a Level 2 action:
   - Super Admin 1 proposes the action with parameters.
   - Super Admin 2 reviews and confirms approval in **Remediation Center $\to$ Pending Approvals**.

### Step 6: Recovery & State Verification
1. Allow the remediation execution worker to transition through `EXECUTING` $\to$ `COMPLETED`.
2. Verify post-conditions:
   - Check that subsequent health probes return `HEALTHY`.
   - Confirm error budget burn rates have stabilized.

### Step 7: Incident Closure & Provenance
- **Automatic Recovery**: If the system detects healthy probe responses for 2 consecutive cycles, the incident status transitions to `RESOLVED` with `resolution_type = AUTO_RECOVERY`.
- **Manual Resolution**:
  1. Click **Resolve Incident** in the Control Center.
  2. Input a detailed operational justification ($\ge 3$ characters).
  3. The gateway authoritatively records `resolved_by = ctx.adminUserId` and sets `resolution_type = MANUAL`.

### Step 8: Post-Mortem & Review (PIR)
For all `CRITICAL` and `HIGH` incidents:
1. Conduct a blameless post-incident review within 48 hours.
2. Document timeline, root causes, remediation efficacy, and action items in `docs/incidents/`.
3. Update SLO governance definitions or alert thresholds if legitimate operational drift occurred.
