# LPU Events Organizer/Admin Website

Organizer and super-admin website for `www.lpueventsadmin.live`.

This repository is intentionally independent from the student website. It connects to the same Supabase backend and shared external services, but it does not import files from the student repository.

## Responsibilities

- Organizer authentication and application flow
- Organizer dashboard and event management
- Super-admin organizer review
- Category, advertisement, refund, audit, analytics, and access management
- Admin API routes for organizer/admin workflows
- Cloudflare R2 media/storage configuration
- Health checks for Supabase, edge functions, and Cloudflare

Student homepage, discovery, filters, public event details, and booking UI belong in `lpu-events-student`.

## Folder Structure

```text
.
├── .github/workflows/      # CI and Cloudflare Workers deployment
├── __tests__/              # Jest tests
├── app/                    # Next.js App Router routes and API handlers
├── components/             # Auth and dashboard UI
├── docs/
│   ├── architecture/       # Repository boundaries and structural decisions
│   ├── database/           # Supabase ownership and schema notes
│   ├── deployment/         # Deployment notes and runbooks
│   ├── testing/            # Testing documentation
│   ├── workflows/          # Process and workflow docs
│   └── changelog/          # Historical implementation reports
├── hooks/                  # Dashboard hooks
├── lib/
│   ├── auth/               # Role guards
│   ├── db/                 # Supabase data access
│   ├── domain/             # Event lifecycle/domain rules
│   ├── services/           # Event, media, organizer services
│   ├── storage/            # Cloudflare R2 helpers
│   ├── supabase/           # Browser/server/service-role clients
│   └── validators/         # Admin/organizer validation
├── public/                 # Admin assets and Cloudflare headers
├── supabase/               # Shared database migrations and edge functions
├── next.config.ts
├── open-next.config.ts
├── tsconfig.json
└── wrangler.jsonc
```

## Environment

Copy `.env.example` to `.env.local`.

Required groups:

- App: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Admin access: `SUPER_ADMIN_EMAILS`
- Cloudflare R2: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `R2_EVENT_IMAGES_BUCKET`
- Payments/email/security: Razorpay, Resend, `APP_SECRET`, `JWT_TICKET_SECRET`, `ENCRYPTION_KEY`

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run type-check
npm test
npm run build
```

## Deployment

Cloudflare Workers project: `lpu-events-admin`

- Domain: `www.lpueventsadmin.live`
- Build command: `npm run build`
- Worker adapter: `@opennextjs/cloudflare`
- Deploy command: `npm run deploy:cloudflare`

The admin app uses OpenNext for Cloudflare because it contains dynamic Next.js App Router pages, route handlers, middleware, and server-side Supabase clients.

GitHub Actions deploys from `main` using `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the production app/service secrets.

## Shared Backend

Supabase migrations, edge functions, Razorpay webhooks, Resend mail dispatch, and R2 archival jobs are shared backend infrastructure owned by this repository. See `docs/database/supabase-backend-ownership.md`.
