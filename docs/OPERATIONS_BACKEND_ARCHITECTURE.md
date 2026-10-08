# LPU Events — Super Admin Operations Backend Architecture (Phase 2)

## 1. Overview & Purpose

The **Super Admin Operations Control Plane** is the dedicated, secure server-side infrastructure gateway for all platform-level observability, infrastructure state queries, and administrative diagnostics across LPU Events.

Prior to Phase 2, mock or simulated operational numbers existed in the frontend (eliminated in Phase 1). Phase 2 establishes the **secure, extensible server-side backend foundation** without introducing premature metrics, time-series tables, or live provider API integrations.

```text
Super Admin Browser
        ↓  (Authenticated Admin Session JWT)
Super Admin Authorization Gateway
        ↓  (Verified active admin + platform SUPER_ADMIN role)
Operations Backend Edge Function (superadmin-operations)
        ↓  (Internal diagnostics & service registry evaluation)
Sanitized Operational Response Envelope
```

Crucially, the client browser never interacts directly with infrastructure provider management APIs:
```text
Browser  ───X───►  Cloudflare API (api.cloudflare.com)
Browser  ───X───►  Supabase Management API (api.supabase.com)
Browser  ───X───►  Sentry API (sentry.io/api)
Browser  ───X───►  Resend API (api.resend.com)
Browser  ───X───►  R2 S3 Direct Credentials
```

---

## 2. Security & Authorization Model

Operations data and administrative diagnostics are strictly **SUPER ADMIN ONLY**. This invariant is enforced cryptographically and server-side:

1. **Authentication Verification**:
   - Every request must present a valid `Authorization: Bearer <JWT>` header.
   - The token is verified against Supabase Auth (`supabase.auth.getUser(jwt)`).
   - Missing or malformed tokens yield `401 UNAUTHENTICATED`.

2. **Administrative Identity Resolution**:
   - The verified Auth identity is resolved against `public.admin_users`.
   - The account must have `is_active = true`. Inactive accounts receive `403 FORBIDDEN`.

3. **Platform Role Verification**:
   - The account must have a confirmed role in `public.platform_admin_roles`.
   - The role must strictly match `'SUPER_ADMIN'`.
   - Organizers, unapproved staff, or standard administrators receive `403 FORBIDDEN`.

4. **Zero Dependency on Student Entities**:
   - Operations authorization is completely decoupled from student accounts, public profiles, or student tables.
   - The Student Website (`lpu-events-student`) has zero access to Operations endpoints and includes no Operations SDK.

---

## 3. Operations API Contract

The Operations backend operates on an explicit capability-based whitelist rather than arbitrary query proxies:

| Method | Endpoint / Action | Capability Description | Input Parameters | Output |
|---|---|---|---|---|
| `GET` / `POST` | `overview` | System gateway health, service count, provider credential summary | None | `OperationsOverview` |
| `GET` / `POST` | `services` | Canonical service registry & monitoring status | None | `ServiceDefinition[]` |
| `GET` / `POST` | `capabilities` | Service capability matrix (health probes, metrics, quotas) | None | Capability Matrix |
| `GET` / `POST` | `database` | Privileged safe PostgreSQL diagnostic probe | None | `DatabaseDiagnosticsResult` |
| `GET` / `POST` | `providers` | Server credential presence registry (no secrets exposed) | None | `ProviderStatus[]` |

### Explicit Anti-Patterns Forbidden
- No arbitrary SQL runner endpoints (`/run-sql`, `execute_admin_sql`).
- No raw PostgreSQL debugging proxies (`pg_stat_activity` dumps).
- No arbitrary external proxy endpoints.

---

## 4. Request Context & Correlation ID Foundation

Every incoming Operations request creates a structured server-side `OperationsRequestContext`:

```typescript
export interface OperationsRequestContext {
  requestId: string;      // ops_req_${crypto.randomUUID()}
  correlationId: string;  // Validated incoming X-Correlation-Id or matches requestId
  startedAt: string;      // ISO 8601 timestamp
  startTimeMs: number;    // High-resolution performance timer
  adminUserId?: string;   // Resolved administrative identity
  operation?: string;     // Requested capability action
}
```

- **Correlation ID Validation**: If the client supplies `x-correlation-id`, it is strictly validated against `/^[A-Za-z0-9_-]{1,64}$/`. If invalid or absent, the server assigns `requestId` as the correlation ID.
- **Server Logging**: Every operation emits a structured JSON log entry to `stdout`/`stderr` tagged with `channel: "operations_control_plane"`. Authorization tokens, session cookies, passwords, and PII are strictly redacted.

---

## 5. Standard Response Envelope & Error Taxonomy

### 5.1 Success Envelope
```json
{
  "success": true,
  "request_id": "ops_req_8f1b2c3d-...",
  "correlation_id": "client_ops_4a5e6f...",
  "data": { ... },
  "meta": {
    "generated_at": "2026-10-08T08:45:00.000Z",
    "duration_ms": 14.25,
    "source": "operations_gateway",
    "environment": "development"
  }
}
```

*Note: The `environment` field is dynamically resolved at runtime via `resolveEnvironment()` (`ENVIRONMENT` / `DENO_ENV` / `APP_ENV`, or inferred from `SUPABASE_URL`). It is never hardcoded to "production", preventing staging and development invocations from misrepresenting their deployment tier.*

### 5.2 Error Envelope
```json
{
  "success": false,
  "request_id": "ops_req_8f1b2c3d-...",
  "correlation_id": "client_ops_4a5e6f...",
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied: Platform SUPER_ADMIN authorization required."
  },
  "meta": {
    "generated_at": "2026-10-08T08:45:00.000Z",
    "duration_ms": 5.10,
    "source": "operations_gateway",
    "environment": "development"
  }
}
```

### 5.3 Error Taxonomy
- `UNAUTHENTICATED`: Missing or invalid Bearer token / expired session (HTTP 401).
- `FORBIDDEN`: Non-Super-Admin identity or inactive admin account (HTTP 403).
- `INVALID_REQUEST`: Malformed JSON or unknown operation action (HTTP 400).
- `NOT_FOUND`: Requested capability or entity not found (HTTP 404).
- `PROVIDER_NOT_CONFIGURED`: Target provider credentials missing on server (HTTP 503).
- `PROVIDER_UNAVAILABLE`: Provider network or runtime service unreachable (HTTP 502).
- `DIAGNOSTIC_FAILED`: Internal diagnostic probe failed (HTTP 500).
- `INTERNAL_ERROR`: Unexpected internal server exception (HTTP 500).
- `TIMEOUT`: Operation exceeded bounded execution deadline (HTTP 504).

---

## 6. Provider Secret Isolation & Boundary

Provider management credentials reside exclusively in server-side environment variables or Supabase secrets vaults. They are never transmitted to client bundles:

```text
SUPABASE_SERVICE_ROLE_KEY   ──► Edge Function / Server only
R2_SECRET_ACCESS_KEY        ──► Edge Function / Server only
CLOUDFLARE_API_TOKEN        ──► Edge Function / Server only
SENTRY_API_TOKEN            ──► Edge Function / Server only
RESEND_API_KEY              ──► Edge Function / Server only
SUPABASE_MANAGEMENT_TOKEN   ──► Edge Function / Server only
```

The `providers` capability endpoint only inspects Boolean credential presence:
```json
{
  "provider": "resend",
  "displayName": "Resend Transactional Mail",
  "isConfigured": true,
  "phase": "PHASE_2_FOUNDATION",
  "note": "Server credentials detected; provider telemetry not instrumented in Phase 2"
}
```
Zero secrets, API keys, or tokens are returned in the response.

---

## 7. Service Registry & Truthful Status Vocabulary

### 7.1 Canonical Status Vocabulary
- `HEALTHY`: Active probe verified normal operation.
- `WARNING`: Subsystem functional but approaching limits or elevated latency.
- `CRITICAL`: Subsystem failure impacting core workflows.
- `DEGRADED`: Partial impairment or fallback mode active.
- `UNKNOWN`: Probe executed but returned indeterminate state.
- `NOT_MONITORED`: Registered service without an active operational probe. **Must NEVER be converted to HEALTHY.**
- `NOT_CONFIGURED`: Service credentials or integration disabled.
- `UNAVAILABLE`: Service endpoint unreachable.

### 7.2 Foundational Platform Services
| Service Key | Display Name | Provider | Criticality | Phase 2 Monitoring Status |
|---|---|---|---|---|
| `supabase_database` | PostgreSQL Database Engine | `supabase` | P0 (Core) | `HEALTHY` (active probe) |
| `supabase_auth` | Supabase Authentication Service | `supabase` | P0 (Core) | `NOT_MONITORED` |
| `cloudflare_worker` | Cloudflare Edge Worker API Gateway | `cloudflare` | P0 (Core) | `NOT_MONITORED` |
| `cloudflare_r2` | Cloudflare R2 Content Storage | `r2` | P1 (Critical) | `NOT_MONITORED` |
| `resend` | Resend Transactional Mail Pipeline | `resend` | P2 (Standard) | `NOT_MONITORED` |
| `sentry` | Sentry Crash & Error Telemetry | `sentry` | P2 (Standard) | `NOT_MONITORED` |
| `github_actions` | GitHub Actions CI/CD Pipeline | `github` | P3 (Supporting) | `NOT_MONITORED` |

---

## 8. Safe Database Diagnostics RPC Foundation

Phase 2 establishes the privileged database diagnostic function:
`public.get_operations_database_diagnostics()`

### Security Controls:
- **`SECURITY DEFINER`**: Runs with elevated rights to query `pg_is_in_recovery()` and system views safely.
- **`SET search_path = pg_catalog, public`**: Prevents search-path hijacking attacks.
- **Explicit Role Check**: Raises exception code `42501` (`insufficient_privilege`) if `auth.uid() IS NULL OR NOT public.is_super_admin()`.
- **Restricted Grants**: `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role;`.
- **Sanitized Metrics Only**: Returns structured JSON with safe database connectivity status, latency, pretty size (`pg_size_pretty`), and aggregate record counts. Raw SQL and connection connection state tables are not exposed.

### 8.1 Migration Authority & Mechanical Parity Guarantee
- **Canonical Master**: `lpu-events-admin/supabase/migrations/` is the single authoritative source of truth for all database schema definitions, security privileges, and RPC contracts across LPU Events (containing all 45 chronological migration files, `config.toml`, and `seed.sql`).
- **Mechanical Guarantee**: The sync tool `scripts/sync_supabase_migrations.mjs` mechanically verifies byte-for-byte parity and mirrors any migration from the canonical directory to root `supabase/migrations/`, preventing architectural drift.

---

## 9. Audit Log vs. Operations Log Separation

The platform strictly separates administrative accountability from operational telemetry:

| Dimension | Audit Ledger (`audit_logs`) | Operations Telemetry (`superadmin-operations`) |
|---|---|---|
| **Question Answered** | *Who changed what business entity?* | *What is the operational health of the platform?* |
| **Examples** | Event published, Organizer approved, Ad deleted | DB latency spike, Edge error rate, Provider timeout |
| **Audience** | Compliance, Security, Auditability | SRE, Infrastructure, Super Admin operations |
| **Storage** | Relational ledger with mutation actor | Structured server logs & future ephemeral metrics |
| **Immutability** | Cryptographically/RLS protected immutable rows | Edge logs & telemetry streams |

---

## 10. Operational Telemetry Architecture (Phase 3)

Phase 3 transitions the control plane from foundation to **real operational telemetry collection**:

### 10.1 Operational Tables
- **`ops_collection_runs`**: Tracks telemetry collection executions with single-flight concurrency lock (`start_operations_collection_run`), metrics collected count, error counts, and error summaries.
- **`ops_metric_snapshots`**: Stores normalized metric snapshots with explicit units (`bytes`, `milliseconds`, `count`, `ratio`, `percent`), sources (`supabase_sql`, `supabase_management_api`, `cloudflare_graphql`, `resend_usage_api`, `sentry_stats_api`), status, and observation windows.
- **`ops_health_probes`**: Stores non-destructive reachability probes per service with latency, HTTP status codes, and error codes.

### 10.2 Provider Adapters (Fault-Isolated)
- **Supabase / PostgreSQL**: Local SQL diagnostics probe (`latency_ms`, `active_connections`, `events_count`) + Management API usage when configured.
- **Cloudflare Workers & R2**: GraphQL Analytics API adapter collecting Worker requests, error rate, CPU p50/p99 quantiles, R2 gateway reachability probe, and DB media asset reconciliation (keeping DB metadata counts strictly distinct from physical R2 storage bytes).
- **Resend**: Non-destructive API probe (`GET /api-keys`) and Usage API adapter (`resend.emails_today`, `resend.monthly_usage`).
- **Sentry**: Organization health probe and Stats API adapter (`stats_v2`) collecting 24h error aggregates (strictly excluding raw stack traces, tokens, or PII).

### 10.3 Truthful Status Invariant
Unconfigured providers are honestly reported as `NOT_CONFIGURED` without manufacturing fake telemetry. Probe failures are reported as `UNAVAILABLE` or `PROVIDER_ERROR`. Metrics older than 1 hour are dynamically flagged as `STALE`.

---

## 11. Phase Boundary Separation

### Implemented in Phase 1, 2 & 3
- [x] Phase 1: Telemetry Truthfulness & Simulation Removal (**CLOSED & CERTIFIED**).
- [x] Phase 2: Operations Backend Foundation & Gateway Isolation (**CLOSED & FROZEN**).
- [x] Phase 3: Provider & Infrastructure Operational Telemetry:
  - [x] Compact operational storage schema (`ops_collection_runs`, `ops_metric_snapshots`, `ops_health_probes`).
  - [x] Privileged single-flight collection lock manager (`start_operations_collection_run`).
  - [x] Provider telemetry adapters (Supabase, Cloudflare, Resend, Sentry).
  - [x] Non-destructive service health probes with roundtrip latency tracking.
  - [x] Metric normalization with canonical units and source tracking.
  - [x] Data freshness tracking (`is_stale: boolean`, `age_seconds`).
  - [x] Server-side secrets boundary (0 credentials in browser bundles).
  - [x] OperationsClient SDK methods (`getMetrics`, `getHealthProbes`, `triggerCollection`).
  - [x] Automated Phase 3 verification suite (20/20 assertions passing).

### Explicitly Excluded (Planned for Future Canonical Phases)
- **Alert Engine**: No incident management, threshold evaluation, or notification webhooks.
- **Incident Engine**: No incident escalation, acknowledgement, or resolution workflows.
- **Forecasting**: No predictive usage models or machine learning telemetry.
- **Final Operations Dashboard UI**: No full dashboard redesign, charts, or quota gauges.
