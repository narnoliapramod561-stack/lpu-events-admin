# Admin Control Center Guidelines (`lpu-events-admin`)

## Stack & Target Environment
- **Runtime & Build**: Vite 6, React 18, TypeScript, `@tailwindcss/vite` (Tailwind CSS v4).
- **Backend & Auth**: Supabase JS v2, Postgres RLS, security definer RPCs, and authenticated OTP role validation.

---

## Tooling & MCP Protocols
- **Symbol & Flow Navigation**: Use `codebase-memory` (`search_graph`, `trace_path`) to check admin auth providers, mutation functions, and schema definitions.
- **API Documentation**: Use `context7` for Supabase JS v2 client patterns, session handling, and Tailwind CSS v4 styling.
- **Verification**: Run `npm run typecheck` (`tsc --noEmit`) in this subfolder after edits.

---

## Critical Architecture Guardrails
1. **Strict Auth & Role-Based Access (RBAC)**:
   - Admin routes and operations require an authenticated Supabase session verified via OTP and admin role checks.
   - Any sensitive mutations (approving events, editing taxonomy, operations toggles) must invoke Postgres RPCs or RLS-secured operations with caller role verification.
2. **Snapshot Publication Pipeline**:
   - Any write, approval, or update of public event data must trigger snapshot publication (`packages/shared/src/snapshotPublisher.ts`) to keep Cloudflare R2 cache aligned with database state.
3. **Execution Speed**:
   - Make precise, surgical modifications. Zero conversational preambles or post-edit summaries.

