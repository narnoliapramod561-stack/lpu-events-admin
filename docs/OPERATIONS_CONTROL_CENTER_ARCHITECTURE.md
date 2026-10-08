# LPU Events — Super Admin Operations Control Center Architecture (Phase 7)

## 1. Executive Summary

Phase 7 establishes the **Super Admin Operations Control Center**, delivering a production-grade operational control plane user interface integrated into the existing `lpu-events-admin` portal.

The Control Center interface consumes the authoritative operational backend established and certified across Phases 1–6:
- Phase 1: Telemetry Truthfulness
- Phase 2: Super Admin Operations Gateway
- Phase 3: Provider & Infrastructure Operational Telemetry
- Phase 4: Operations Jobs & Maintenance Telemetry
- Phase 5: Alert & Incident Engine
- Phase 6: Historical Operations Analytics & Forecasting

```
┌─────────────────────────────────────────────────────────────┐
│                 OPERATIONAL TRUTH (SERVER-SIDE)             │
│                                                             │
│   Production Telemetry → Normalization → Alert Evaluation    │
│   → Correlation Engine → State Machine → Analytics Rollup   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPER ADMIN OPERATIONS GATEWAY                 │
│              (Edge Function: superadmin-operations)         │
│   - JWT & Role Verification (Strict Super Admin)            │
│   - Capability Whitelist & Envelope Sanitization            │
│   - Request & Correlation ID Tracing                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 TYPED CLIENT SDK (BROWSER)                  │
│                 (src/shared/operations/client.ts)           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            OPERATIONS CONTROL CENTER UI (PHASE 7)           │
│                                                             │
│  The browser is strictly a presentation & interaction layer.│
│  All authoritative decisions remain server-side.            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Fundamental Architectural Constraint

> **The browser is a presentation and interaction layer.**  
> **Operational truth remains server-side.**

The Control Center UI strictly adheres to the following rules:
1. **Zero Client-Side Business Logic**: Severity, incident status, overall system health, trend direction, threshold crossings, and MTTR are calculated on the backend. The UI never calculates `if (criticalAlerts > 0) ...` as the authoritative system health state.
2. **Zero Direct Provider API Calls**: The browser never makes requests to `api.resend.com`, `api.cloudflare.com`, `sentry.io`, or `api.supabase.com`.
3. **Zero Direct Operations Table Queries**: The UI never calls `supabase.from('ops_*')` directly. All mutations and queries route through the certified `OperationsClient` SDK and Gateway.
4. **Zero Simulated Data**: Production components contain zero `Math.random()`, fake animation increments, or placeholder mocked values.

---

## 3. Super Admin Boundary & Fail-Closed Protection

Access to the Operations Control Center is protected by a triple-layer fail-closed defense-in-depth architecture:

1. **Navigation & Route Level (`SuperAdminSidebar.tsx` & `SuperAdminApp.tsx`)**:
   - The navigation item `Operations Center` is exposed exclusively within `SuperAdminSidebar`.
   - Organizers and unapproved users render disjoint navigation trees and have zero exposure to operational routes.
2. **Component Guard Level (`OperationsControlCenter.tsx`)**:
   - Checks `profile?.is_super_admin` from `useAuth()`.
   - If not verified, fails closed immediately with an explicit "Access Denied: Super Admin Boundary" screen.
3. **Gateway Enforcement Level (`superadmin-operations` Edge Function)**:
   - Authenticates the caller's JWT using Supabase Auth.
   - Queries `admin_users` table to verify `is_super_admin === true` and `is_active === true`.
   - Unauthenticated callers receive HTTP 401 (`UNAUTHENTICATED`).
   - Organizers or unauthorized users receive HTTP 403 (`FORBIDDEN`).

---

## 4. Component Hierarchy & Modular Structure

The UI is modularized in `lpu-events-admin/src/components/superadmin/operations/`:

```
OperationsControlCenter (Coordinator & Stage Orchestration)
  │
  ├── OperationsRefreshIndicator (Sync bar, freshness label, stale alert, action buttons)
  │
  ├── OperationsSummaryCards (Authoritative overall status, incident counts, jobs health)
  │
  ├── ActiveIncidentsList (Prioritized critical/high incidents table, inline acknowledge)
  │     └── IncidentDetailModal (Drawer: timeline, alerts, evidence, manual resolve dialog)
  │
  ├── ServiceHealthGrid (Registered services, probe health, latency, NOT_CONFIGURED semantics)
  │
  ├── KeyMetricsPanel (Metrics, RISING/FALLING trends, threshold projection estimates, SVG sparklines)
  │
  ├── OperationsJobTable (Maintenance jobs, schedule health, failed/stale priority, run details)
  │
  └── HistoricalAnalyticsPanel (1h/6h/24h/7d/30d/90d bounded windows, backend MTTR, recurring rules)
```

---

## 5. Operational Capabilities

### A. Authoritative Summary & Freshness
- Displays authoritative health (`OPERATIONAL`, `DEGRADED`, `CRITICAL`, `WARNING`, `UNKNOWN`).
- Truthful elapsed time display ("just now", "32 seconds ago", "4m ago").
- Telemetry stale warning banner when collection age exceeds 5 minutes (`isStale`).
- Truthful environment identification taken from `meta.environment` (Dev, Staging, Production).

### B. Active Incidents & Response
- Ordered strictly by operational urgency: `CRITICAL` > `HIGH` > `WARNING` > `INFO`, then newest.
- Inline "Acknowledge" button with non-blocking inline spinner and duplicate-click prevention.
- Detailed drawer dialog with:
  - Contributing machine alerts (rule, threshold vs observed, occurrence count).
  - Safe evidence (correlation ID, primary alert ID, timestamps, sanitized metadata).
  - Chronological event timeline (`INCIDENT_OPENED`, `ALERT_CREATED`, `SEVERITY_CHANGED`, `INCIDENT_ACKNOWLEDGED`, `INCIDENT_RESOLVED`, `ALERT_RESOLVED`) with actor attribution (`SYSTEM` vs `SUPER_ADMIN`).
  - Resolution Provenance display (`MANUAL` with author and reason vs `AUTO_RECOVERY`).
- Manual resolution form requiring mandatory explanation (minimum 3 characters).

### C. Service Health Grid
- Displays canonical service catalog (`supabase_database`, `supabase_auth`, `cloudflare_worker`, `cloudflare_r2`, `resend_email`, `sentry_observability`, `maintenance_jobs`).
- Latency (ms) and checked timestamp from latest machine health probes.
- Semantic preservation: `NOT_CONFIGURED` renders neutral/amber informational badge, never falsely presented as a critical outage.

### D. Operational Metrics & Threshold Projections
- Exposes meaningful metrics (`db_size_bytes`, `worker_subrequests`, `r2_storage_bytes`, etc.).
- Trend badges: `RISING`, `FALLING`, `STABLE`, `INSUFFICIENT_DATA`.
- Threshold projection status: `APPROACHING`, `NOT_APPROACHING`, `ALREADY_EXCEEDED`, `INSUFFICIENT_DATA`.
- Estimated crossing displayed only when backend returned an actual time duration.
- Data quality indicators: `HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT`.
- Lightweight SVG sparkline consuming points directly from server history.

### E. Operations Jobs & Execution Telemetry
- Canonical jobs: `database_cleanup`, `r2_orphan_cleanup`, `operations_telemetry_prune`, `provider_telemetry_collection`, `historical_metrics_rollup`, `historical_metrics_prune`.
- Failed and stale jobs surfaced at the top with warning visual priority.
- Execution history drawer with scanned, processed, deleted, and failed record counters.

### F. Historical Analytics & Rollups
- Bounded time windows: `1h`, `6h`, `24h`, `7d`, `30d`, `90d`.
- Sub-views for Incidents & Backend MTTR, Top Recurring Alert Rules, Maintenance Job Reliability (success/failure rates), and Cross-Service Stability.

---

## 6. Refresh Strategy & Race Condition Protection

- **Staged Loading**: Summary & incidents load first, followed by telemetry probes, metrics, jobs, and historical rollups.
- **Top Sync Progress Bar**: Displays a thin gradient synchronization line during active requests. No full-page blocking spinners on background updates.
- **Controlled Auto-Refresh**: Polls at a 30-second interval with an explicit toggle switch, cleanly cancelled when unmounted.
- **Race Condition Guard**: Uses a monotonic counter `syncCounterRef` to ensure older asynchronous responses never overwrite newer state.

---

## 7. Accessibility & UX Conventions

- **Visual Priority**: Urgent incident states and failed jobs dominate visually; historical and stable metrics maintain calm, low-noise aesthetics.
- **Text Equivalents**: Every status badge displays explicit text (e.g. `CRITICAL`, `DEGRADED`, `HEALTHY`), never color alone.
- **Keyboard Navigation**: Incident items and modal close buttons are fully keyboard navigable with visible focus outlines and ARIA attributes (`role="dialog"`, `aria-modal="true"`).
- **Dark Mode**: Fully compatible with existing Tailwind and CSS custom properties (`--bg-base`, `--bg-card`, `--text-main`, `--border-subtle`).
