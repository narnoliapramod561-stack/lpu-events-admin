# Production Telemetry Truth Rule

> **Mandatory Architectural Rule:**
> 
> Every operational metric displayed in the Super Admin interface must have an identifiable, authoritative production data source. Metrics without a trustworthy production source must either be explicitly marked as unavailable/not monitored or omitted. Mock, simulated, random, hardcoded, or placeholder values must never be presented as production telemetry.

---

## 1. Classification Standards for Operational Metrics

Every operational or platform metric visible across LPU Events must belong to exactly one of the following four classifications:

| Category | Definition | Interface Presentation Rule |
|---|---|---|
| **A. Real** | Value is obtained from an authoritative, instrumented production source. | Render with source identity and timestamp. |
| **B. Business / Data Count** | Value is an exact count or aggregation of application rows in the database (e.g., published events, approved clubs, registered admins). | Must be labeled strictly as application/database records (e.g., "Platform Events", "Admin Accounts"). Never call row counts physical storage, server capacity, or infrastructure health. |
| **C. Unavailable / Not Monitored** | Metric is relevant to system operations but is not yet instrumented in the current phase (e.g., PostgreSQL physical disk consumption, Cloudflare Worker requests, R2 byte storage, ad impressions/CTR). | Must display an explicit "Not Monitored" state. Never render `0`, empty bars, or dummy fallback numbers to simulate a complete UI. |
| **D. Removed** | Metric has no trustworthy telemetry source and displaying it would mislead administrators. | Remove the card, chart, or table entirely. |

---

## 2. Prohibited Patterns

1. **No Fake Infrastructure Telemetry**:
   - Database row counts (such as rows in `media_assets` or `events`) must never be described as "Storage Health", "Infrastructure Telemetry", or "Storage Usage".
   - Cache invalidation revision numbers (such as `resource_versions.version`) must never be presented as cache hit rate, edge health, or cache latency. They are database mutation counters only.

2. **No Fabricated Analytics from Empty Datasets**:
   - Defining `const adMetrics: any[] = []` and displaying derived 0 impressions, 0 clicks, or 0.00% CTR is prohibited.
   - If engagement or conversion tracking is uninstrumented, state explicitly that it is not currently monitored.

3. **No Simulated Quota Logging**:
   - Hardcoded metrics (such as CPU time, cache hit ratio, database size) must never be written to persistence stores (such as `daily_quota_metrics.json`) as production baselines.
   - Physical quota telemetry requires authoritative provider management APIs.

4. **Truthful UI Wording**:
   - Interfaces must never claim "Real-Time", "Live Telemetry", or "System Diagnostic Health" unless a live subscription or instrumentation probe actually exists.
