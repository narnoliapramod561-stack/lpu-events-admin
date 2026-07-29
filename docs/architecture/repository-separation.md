# Repository Separation Notes

## Dependency Map

Admin website:

- `app/auth/*` owns organizer/admin sign-in, callback, sign-out, and verification flows.
- `app/dashboard/*` owns organizer and super-admin workspaces.
- `app/api/admin/*` owns super-admin API routes.
- `app/api/organizer/*` owns organizer event management API routes.
- `components/auth/*` and `components/dashboard/*` contain admin-facing UI only.
- `lib/auth/*` contains role guards and redirect rules.
- `lib/db/*`, `lib/services/*`, `lib/domain/*`, and `lib/validators/*` contain admin event-management business logic.
- `lib/supabase/*` contains browser, server, middleware, and service-role Supabase clients.
- `lib/storage/*` contains Cloudflare R2 configuration and media validation helpers.

External shared services:

- Supabase database and auth project, with migrations in this repository
- Supabase edge functions in this repository
- Razorpay
- Resend
- Cloudflare R2/CDN

## Shared Code Strategy

Small stable frontend helpers are duplicated locally instead of introducing a shared package. This avoids coupling two independently deployed repositories.

Shared backend logic remains in `supabase/` inside this organizer/admin repository. The admin app connects to that backend through environment variables, including a server-only service-role key where required.

## Removed From Admin Repository

- Student homepage implementation at `/`
- Student `/events` public routes
- Student public event-detail route
- Student auth API route
- Student discovery components: `components/home`, `components/events`, `components/search`, and public navbar

Admin public event preview links now point to `https://www.lpuevents.live/?event=<event-id>`.

## Deployment Boundary

- GitHub repository: `lpu-events-admin`
- Cloudflare project: `lpu-events-admin`
- Domain: `www.lpueventsadmin.live`
- Cloudflare adapter: `@opennextjs/cloudflare`
- Supabase backend folder: `supabase/`

No imports or runtime paths point at `lpu-events-student`; only explicit public URLs point to the deployed student domain.
