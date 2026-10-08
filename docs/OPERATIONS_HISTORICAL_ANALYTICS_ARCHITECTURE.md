# Operations Historical Analytics & Forecasting Architecture (Phase 6)

## 1. Primary Architecture Overview

Phase 6 introduces the historical operational intelligence and forecasting layer to the Super Admin Operations Control Plane. It transforms point-in-time telemetry, maintenance execution logs, and incident records into deterministic, explainable, and bounded historical analytics.

The unidirectional operational data flow is:

```text
REAL TELEMETRY / PROBES / JOBS / ALERTS / INCIDENTS
                        ↓
         NORMALIZED HISTORICAL STORAGE
         (ops_metric_snapshots & ops_metric_aggregates)
                        ↓
            AGGREGATION & ROLLUP ENGINE
         (Hourly / Daily Buckets & Multi-Window Aggregation)
                        ↓
      DETERMINISTIC TREND & PROJECTION ENGINE
         (Least-Squares Regression & Bounded Threshold Trajectory)
                        ↓
           DATA QUALITY & SUFFICIENCY AUDITOR
                        ↓
        SUPER ADMIN OPERATIONS GATEWAY ROUTER
                        ↓
            FUTURE OPERATIONS CONTROL CENTER UI
```

### Core Invariants:
1. **Server-Side Determinism**: Every statistical summary, trend direction, and threshold projection is calculated server-side using explicit, verifiable mathematical formulas. Zero client-side computation, zero neural networks, and zero opaque ML models.
2. **Cardinality Control**: Metrics are constrained to a server-controlled registry (`CONTROLLED_METRIC_CATALOG`). Arbitrary user-generated metric keys and unlimited dimensions are strictly forbidden.
3. **Truthfulness Over Completeness**: If historical observations are sparse ($< 3$ points), missing, or stale, the engine outputs `INSUFFICIENT_DATA`. It **never** manufactures synthetic baseline numbers or assumes stability in the absence of observations.
4. **Active State Protection**: Retention pruning of historical measurements and aggregates **never** deletes active alerts, open incidents, running maintenance jobs, or active service health probes.
5. **Super Admin Authorization**: All historical analytics capabilities are strictly restricted to authenticated Super Admins via the Operations Gateway.

---

## 2. Historical Data Model & Rollup Architecture

### 2.1 High-Resolution Storage (`ops_metric_snapshots`)
Stores raw point-in-time measurements captured during telemetry collection runs:
- `id` (uuid, PK)
- `service_id` (text, FK/registered service)
- `metric_key` (text, from controlled catalog)
- `metric_value` (numeric)
- `metric_limit` (numeric, optional)
- `unit` (text: `bytes`, `percent`, `count`, `milliseconds`, `ratio`)
- `status` (text: `HEALTHY`, `WARNING`, `CRITICAL`, `DEGRADED`, `STALE`, `NOT_CONFIGURED`, `UNAVAILABLE`)
- `source` (text)
- `captured_at` (timestamptz)
- `collection_run_id` (uuid)
- `metadata` (jsonb)

### 2.2 Pre-Computed Rollup Aggregates (`ops_metric_aggregates`)
Stores bounded hourly and daily rollups to enable sub-millisecond historical analytics queries across 7d, 30d, and 90d horizons:
- `id` (uuid, PK)
- `bucket_start` (timestamptz)
- `bucket_end` (timestamptz)
- `resolution` (text CHECK: `'HOURLY'`, `'DAILY'`)
- `service_id` (text)
- `metric_key` (text)
- `sample_count` (integer)
- `min_value` (numeric)
- `max_value` (numeric)
- `avg_value` (numeric)
- `first_value` (numeric)
- `last_value` (numeric)
- `unit` (text)
- `metadata` (jsonb)
- **Constraint**: `UNIQUE (bucket_start, resolution, service_id, metric_key)`

### 2.3 Normalized Read View (`ops_metric_history`)
Provides a standardized schema view over `ops_metric_snapshots` for external audit and SQL reporting:
```sql
CREATE OR REPLACE VIEW public.ops_metric_history AS
  SELECT
    id, metric_key, service_id, source,
    'production'::text AS environment,
    metric_value AS value,
    metric_limit AS limit_value,
    unit, status,
    captured_at AS observed_at,
    captured_at AS collected_at,
    collection_run_id, metadata, created_at
  FROM public.ops_metric_snapshots;
```

---

## 3. Server-Controlled Metric Catalog

To prevent unbounded metric cardinality, the platform registers and enforces known metrics in `CONTROLLED_METRIC_CATALOG`:

| Metric Key | Service ID | Unit | Category | Supports Projection | Default Threshold |
|---|---|---|---|---|---|
| `database.storage_percent` | `supabase_database` | `percent` | `STORAGE` | Yes | 85.0% |
| `database.size_bytes` | `supabase_database` | `bytes` | `STORAGE` | Yes | — |
| `database.active_connections` | `supabase_database` | `count` | `COMPUTE` | No | — |
| `database.connection_utilization_ratio` | `supabase_database` | `ratio` | `COMPUTE` | Yes | 0.85 |
| `r2.storage_bytes` | `cloudflare_r2` | `bytes` | `STORAGE` | Yes | — |
| `r2.objects_count` | `cloudflare_r2` | `count` | `STORAGE` | Yes | — |
| `worker.requests_total` | `cloudflare_worker` | `count` | `NETWORK` | No | — |
| `worker.errors_total` | `cloudflare_worker` | `count` | `ERROR` | No | — |
| `worker.error_rate` | `cloudflare_worker` | `percent` | `ERROR` | Yes | 2.0% |
| `worker.duration_avg_ms` | `cloudflare_worker` | `milliseconds` | `COMPUTE` | Yes | 500.0 ms |
| `email.daily_quota_used` | `resend_email` | `count` | `EMAIL` | Yes | — |
| `email.daily_quota_utilization_ratio` | `resend_email` | `ratio` | `EMAIL` | Yes | 0.90 |
| `errors.events_24h_total` | `sentry_error_tracking` | `count` | `ERROR` | Yes | — |
| `job.duration_ms` | `internal_maintenance` | `milliseconds` | `JOB` | Yes | — |
| `job.success_rate` | `internal_maintenance` | `percent` | `JOB` | No | — |
| `alerts.open_count` | `observability_engine` | `count` | `INCIDENT` | No | — |
| `incidents.open_count` | `observability_engine` | `count` | `INCIDENT` | No | — |
| `incidents.duration` | `observability_engine` | `milliseconds` | `INCIDENT` | Yes | — |

---

## 4. Retention Architecture & Pruning Policy

The platform applies a tiered retention architecture:

| Data Tier | Table | Retention Window | Pruning RPC | Active State Safeguard |
|---|---|---|---|---|
| **Raw Snapshots** | `ops_metric_snapshots` | 30 days | `prune_stale_operations_history` | The latest snapshot for each `(service_id, metric_key)` is **exempt** from deletion. |
| **Hourly Aggregates** | `ops_metric_aggregates` (`HOURLY`) | 90 days | `prune_stale_operations_history` | None (historical rollups only). |
| **Daily Aggregates** | `ops_metric_aggregates` (`DAILY`) | 365 days | `prune_stale_operations_history` | None (historical rollups only). |
| **Alerts & Incidents** | `ops_alerts`, `ops_incidents` | 90d / 180d | `prune_stale_operations_alerts_and_incidents` | **Only `RESOLVED` records** older than cutoff are deleted; `OPEN` and `ACKNOWLEDGED` records are never deleted. |

---

## 5. Mathematical Aggregations & Formulas

For any bounded query window $W \in \{1\text{h}, 6\text{h}, 24\text{h}, 7\text{d}, 30\text{d}, 90\text{d}\}$ containing observations $(t_i, y_i)_{i=1}^n$:

### 5.1 Basic Aggregates
- **Minimum**: $\min_{i} y_i$
- **Maximum**: $\max_{i} y_i$
- **Arithmetic Mean**: $\bar{y} = \frac{1}{n} \sum_{i=1}^n y_i$
- **Percentile ($P_{95}$)**: Linear interpolation between ranked samples:
  $$P_{95} = y_{\lfloor k \rfloor} + (k - \lfloor k \rfloor)(y_{\lceil k \rceil} - y_{\lfloor k \rfloor}) \quad \text{where } k = 0.95 \times (n - 1)$$
- **Total Change**: $\Delta y = y_n - y_1$
- **Percentage Change**:
  $$\Delta y_{\%} = \frac{\Delta y}{|y_1|} \times 100 \quad (\text{or } \frac{\Delta y}{|\bar{y}|} \times 100 \text{ if } y_1 = 0)$$
- **Rate of Change**: $\text{rate} = \frac{\Delta y}{(t_n - t_1) / 60} \text{ (units per minute)}$

---

## 6. Deterministic Trend Analysis

Trend classification avoids black-box heuristics by applying **ordinary least-squares (OLS) linear regression** on timestamps normalized to seconds ($t_i' = t_i - t_1$):

### 6.1 Slope Formula ($\beta$)
$$\beta = \frac{\sum_{i=1}^n (t_i' - \bar{t}')(y_i - \bar{y})}{\sum_{i=1}^n (t_i' - \bar{t}')^2} \quad \text{[units per second]}$$

### 6.2 Direction Classification
1. **`INSUFFICIENT_DATA`**:
   - Sample count $n < 3$, or all timestamps identical.
   - Missing data is never treated as stability.
2. **`STABLE`**:
   - $|\Delta y_{\%}| \le 1.0\%$ or absolute slope $|\beta \times \Delta t| \le 0.001$.
3. **`RISING`**:
   - $\beta > 0$ and $\Delta y_{\%} > 1.0\%$.
4. **`FALLING`**:
   - $\beta < 0$ and $\Delta y_{\%} < -1.0\%$.

---

## 7. Threshold Projection & Forecasting

Threshold projection determines whether a metric is trending toward an operational breach point (e.g., storage reaching 85%):

### 7.1 Status Vocabulary
- **`ALREADY_EXCEEDED`**: $y_{\text{current}} \ge y_{\text{threshold}}$.
- **`INSUFFICIENT_DATA`**: Data quality is `INSUFFICIENT` or sample count $< 3$.
- **`NOT_APPROACHING`**:
  - $\beta \le 0$ (metric is falling or stable).
  - Or projected exceedance horizon exceeds 1 year ($\Delta t_{\text{est}} > 365 \text{ days}$).
- **`APPROACHING`**:
  - $\beta > 0$ and $\Delta t_{\text{est}} \le 365 \text{ days}$.

### 7.2 Time-to-Threshold Formula
$$\Delta t_{\text{est}} = \frac{y_{\text{threshold}} - y_{\text{current}}}{\beta} \quad \text{[seconds]}$$
$$\text{Projected Exceed Timestamp} = t_{\text{now}} + (\Delta t_{\text{est}} \times 1000) \text{ ms}$$

---

## 8. Data Quality & Sufficiency Evaluation

Every analytical response carries a `dataQuality` indicator:

| Level | Criteria | Operational Meaning |
|---|---|---|
| **`HIGH`** | Sample count $\ge 10$, cadence coverage $\ge 75\%$, recent observation present ($\le 2\text{h}$). | Strong statistical confidence. |
| **`MEDIUM`** | Sample count $\ge 5$, cadence coverage $\ge 40\%$, recent observation present. | Acceptable operational confidence. |
| **`LOW`** | Sample count $3 - 4$, or coverage $< 40\%$, or oldest gap detected. | Low confidence; directional indicator only. |
| **`INSUFFICIENT`** | Sample count $< 3$, or latest observation is stale/missing. | Zero projection permitted; returns `INSUFFICIENT_DATA`. |

---

## 9. Incident Historical Analytics & MTTR

Historical incident analytics track organizational response and resolution efficiency:

### 9.1 Mean Time to Resolution (MTTR) Definition
- **Scope**: Computed **strictly** for completed incidents (`status = 'RESOLVED'`).
- **Formula**:
  $$\text{MTTR} = \frac{1}{N_{\text{resolved}}} \sum_{j=1}^{N_{\text{resolved}}} (t_{\text{resolved}, j} - t_{\text{opened}, j})$$
- Unresolved incidents are strictly excluded from MTTR and tracked independently as `openIncidentAverageAgeMs` to prevent distorting completion averages.

### 9.2 Provenance Breakdown
- **`automaticRecoveryCount`**: Incidents closed via automated condition recovery (`resolution_type = 'AUTO_RECOVERY'`).
- **`manualResolutionCount`**: Incidents closed via authenticated Super Admin intervention (`resolution_type = 'MANUAL'`).

---

## 10. API Contract: Operations Gateway Router

All analytical requests are routed through the existing Super Admin Operations Gateway (`superadmin-operations` Edge Function):

```http
POST /functions/v1/superadmin-operations
Authorization: Bearer <super_admin_jwt>
Content-Type: application/json

{
  "action": "analytics-metric",
  "params": {
    "service_id": "supabase_database",
    "metric_key": "database.storage_percent",
    "window": "24h"
  }
}
```

### Supported Analytics Actions:
1. `analytics-overview`: Cross-service 24h/7d/30d incident counts, critical incidents, top recurring rule, and most unstable service.
2. `analytics-metric`: Time-series observations, aggregations, trend, and data quality.
3. `analytics-trend`: Linear trend evaluation and baseline comparisons.
4. `analytics-forecast`: Threshold projection and estimated time to breach.
5. `analytics-incidents`: Historical incident volume, severity distribution, MTTR, and resolution provenance.
6. `analytics-alerts`: Alert volume, top recurring rules, and severities.
7. `analytics-jobs`: Maintenance job execution counts, success/failure rates, and duration stats.
8. `analytics-services`: Service-level operational summaries.
9. `analytics-rollup`: Scheduled/manual invocation of pre-computed metric aggregation.

---

## 11. Security & Privilege Boundaries

- **Public / Anon Access**: Strictly REVOKED.
- **Student / Organizer Roles**: HTTP 403 Forbidden.
- **Super Admin Role**: Enforced through `public.is_super_admin()` via RLS and JWT verification.
- **Provider Credentials**: Provider API tokens remain strictly isolated server-side. Zero provider secrets exist in client bundles or analytics response bodies.
