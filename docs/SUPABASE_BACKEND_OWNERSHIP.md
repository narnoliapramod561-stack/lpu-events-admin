# Supabase Backend Ownership

The organizer/admin repository owns the shared Supabase backend for both deployed websites.

## Why Supabase Lives Here

The backend belongs in `lpu-events-admin` because this app owns privileged workflows:

- Organizer approval and rejection
- Event creation, publishing, and lifecycle management
- Advertisement management
- Refund management
- Audit logs and analytics
- Service-role Supabase operations
- Cloudflare R2 media/archive workflows
- Razorpay and outbox edge-function processing

The student website consumes this backend through anon-key access and RLS policies. It does not deploy migrations or edge functions.

## Included Backend Files

```text
supabase/
├── config.toml
├── functions/
│   ├── _shared/
│   ├── archive-events/
│   ├── auth-google/
│   ├── auth-logout/
│   ├── auth-otp/
│   ├── auth-verify-otp/
│   ├── expire-reservations/
│   ├── health/
│   ├── outbox-processor/
│   └── razorpay-webhook/
└── migrations/
```

## Canonical Tables

The canonical schema defines these tables:

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

## Student-Facing Contract

The student website reads or calls:

- `events`
- `categories`
- `advertisements`
- `sync_versions`
- `registrations`
- `tickets`
- `reserve_ticket`
- `get_sync_changes`

All access must remain controlled by Supabase RLS and public anon-key policies.

## Admin-Facing Contract

The organizer/admin website reads or mutates:

- Identity and access: `profiles`, `organizer_applications`, `system_config`
- Event management: `events`, `categories`, `subcategories`, `ticket_types`, `event_inventory`
- Operations: `payments`, `refunds`, `registrations`, `tickets`, `ticket_verifications`
- Marketing and observability: `advertisements`, `audit_log`, `outbox_events`, `notifications`, `email_log`, `sync_versions`
- RPCs: `approve_organizer`, `reject_organizer`, `publish_event`, `initiate_refund`, `verify_ticket`

## Deployment

Supabase backend CI lives in `.github/workflows/supabase.yml`.

- PR/push validation checks Deno formatting, Deno linting, and Supabase config.
- Production migration/function deployment is manual via `workflow_dispatch`.
- Required secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.
