# Coding Rules

## Core Rules

- Follow existing repository architecture before adding or moving code.
- Prefer minimal, targeted fixes over broad organizational refactors.
- Do not duplicate business logic when an existing domain, db, validator, or service helper already covers the use case.
- Keep student and admin repositories independently deployable.

## Backend and Security Rules

- Never bypass Supabase RLS or secure server-side boundaries.
- Keep privileged logic on the server/admin side only.
- Treat `supabase/` in this repository as the canonical shared backend.
- Do not move migrations, edge functions, or service-role flows into the student repository.

## API and Architecture Rules

- Never rename API routes as a cleanup step without explicit approval and a migration plan.
- Preserve current route ownership boundaries unless a functional refactor is intentionally planned.
- Do not introduce cross-repository imports.
- Reuse current domain/service/storage layers instead of creating parallel abstractions.

## Validation Rules

- Prefer existing validation patterns and validators.
- When input validation is needed, use the established validation layer rather than ad hoc checks.
- Confirm backend contracts against `docs/database/supabase-backend-ownership.md` before changing data access patterns.

## Tooling Rules

- Keep generated artifacts out of version control.
- Update `.gitignore` if local tooling introduces persistent output.
- Do not add Docker or unrelated infrastructure unless explicitly requested.

## Documentation Rules

- Update AI context docs when stable architectural decisions change.
- Update testing trackers after verification work.
- Keep `README.md` concise and point detailed context to `docs/`.
