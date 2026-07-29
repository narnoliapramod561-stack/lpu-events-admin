# Project Context

## Project Overview

`lpu-events-admin` is the organizer and super-admin website deployed at `www.lpueventsadmin.live`.

It is intentionally independent from the student website and also owns the shared Supabase backend used by both deployed websites.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript 5
- Jest
- ESLint 9
- OpenNext Cloudflare adapter
- Supabase SSR and service-role/server clients where required
- Cloudflare Workers and Cloudflare R2 integration

## Folder Structure

```text
.
├── __tests__/              # Jest tests
├── app/                    # Next.js routes and API handlers
├── components/             # Admin-facing UI
├── docs/
│   ├── ai/                 # AI session context and working rules
│   ├── architecture/       # Repository boundaries and structural decisions
│   ├── api/                # API-facing documentation
│   ├── database/           # Backend ownership and schema notes
│   ├── deployment/         # Deployment notes and runbooks
│   ├── testing/            # Build/test status and QA trackers
│   ├── workflows/          # Process and workflow docs
│   └── changelog/          # Historical notes and reports
├── hooks/                  # Dashboard hooks
├── lib/
│   ├── auth/               # Role guards
│   ├── db/                 # Data access
│   ├── domain/             # Domain rules
│   ├── services/           # Business logic
│   ├── storage/            # R2 helpers
│   ├── supabase/           # Browser/server/service-role clients
│   └── validators/         # Validation layer
├── public/                 # Admin assets and headers
├── supabase/               # Canonical shared backend infrastructure
├── next.config.ts
├── open-next.config.ts
├── tsconfig.json
└── wrangler.jsonc
```

## Authentication

This repository owns organizer/admin authentication flows and uses both public and server-side Supabase integration as required.

Documented auth areas include:
- `app/auth/*`
- `app/api/v1/auth/*`
- `lib/auth/*`
- `lib/supabase/*`

## Database

This repository owns the shared Supabase backend for both applications.

Canonical backend location:
- `supabase/`
- `supabase/migrations/`
- `supabase/functions/`

Documented canonical tables include:
- `profiles`
- `organizer_applications`
- `categories`
- `subcategories`
- `events`
- `event_faqs`
- `event_gallery`
- `event_documents`
- `ticket_types`
- `event_inventory`
- `reservations`
- `registrations`
- `registration_members`
- `payments`
- `refunds`
- `tickets`
- `ticket_verifications`
- `advertisements`
- `notifications`
- `email_log`
- `audit_log`
- `outbox_events`
- `sync_versions`
- `system_config`

## API Architecture

Documented route ownership currently includes:
- `app/api/admin/*` for super-admin routes
- `app/api/organizer/*` for organizer event-management routes
- `app/api/v1/*` for versioned/public-facing app endpoints used by current workflows

This structure exists today and should be treated as current architecture, not reorganized casually.

## Deployment

- Cloudflare Workers project: `lpu-events-admin`
- Domain: `www.lpueventsadmin.live`
- Build command: `npm run build`
- Deploy command: `npm run deploy:cloudflare`
- Adapter: `@opennextjs/cloudflare`

Supabase backend CI is documented in `.github/workflows/supabase.yml`.

## Ownership Boundaries

This repository owns:
- organizer authentication and application flow
- organizer dashboard and event management
- super-admin organizer review
- category, advertisement, refund, audit, analytics, and access management
- admin API routes
- service-role Supabase operations where required
- shared Supabase migrations and edge functions
- Cloudflare R2 media/archive workflows

This repository does not own:
- student homepage implementation
- student public discovery UI
- student public event-detail experience
- student-only frontend presentation code

## Important Decisions

- Student and admin remain independently installable, buildable, deployable, and versioned.
- Shared backend infrastructure is owned by this repository.
- Stable frontend helpers may be duplicated locally instead of extracted to a shared package.
- Public event preview links should target the deployed student website, not a local shared route.

## Do Not Change Without Approval

- Do not move or split the canonical `supabase/` backend without explicit approval.
- Do not weaken RLS assumptions or replace secure server-side flows with client-side privileged access.
- Do not rename API routes as a “cleanup” step without a functional migration plan.
- Do not introduce cross-repository imports between admin and student codebases.
