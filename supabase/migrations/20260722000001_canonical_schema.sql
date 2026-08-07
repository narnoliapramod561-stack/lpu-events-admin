-- Migration: 20260722000001_canonical_schema.sql
-- Description: Create all 24 canonical tables, enums, indexes per DB-003, DB-009
-- TASK-011: PostgreSQL 24 Canonical Tables Migration
-- Depends on: (none — this is the first migration)
-- References: DB-001, DB-002, DB-003, DB-004, DB-008, DB-009, IMP-007

-- ============================================================
-- SECTION 1: ENUM TYPES (DB-009)
-- All 12 canonical PostgreSQL enum types
-- ============================================================

CREATE TYPE public.user_role AS ENUM ('student', 'organizer', 'super_admin', 'admin', 'pending');

CREATE TYPE public.organizer_app_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE public.event_status AS ENUM (
  'draft',
  'pending_approval',
  'published',
  'ongoing',
  'completed',
  'cancelled',
  'archived'
);

CREATE TYPE public.registration_mode AS ENUM ('individual', 'team');

CREATE TYPE public.team_pricing_mode AS ENUM ('fixed', 'per_member');

CREATE TYPE public.reservation_status AS ENUM (
  'held',
  'payment_pending',
  'confirmed',
  'expired',
  'cancelled'
);

CREATE TYPE public.registration_status AS ENUM ('confirmed', 'cancelled', 'attended');

CREATE TYPE public.payment_status AS ENUM (
  'initiated',
  'processing',
  'captured',
  'failed',
  'refunded'
);

CREATE TYPE public.refund_status AS ENUM ('pending', 'processed', 'failed');

CREATE TYPE public.ticket_status AS ENUM ('valid', 'used', 'cancelled', 'expired');

CREATE TYPE public.verification_method AS ENUM ('qr_scan', 'manual_lookup');

CREATE TYPE public.verification_status AS ENUM (
  'success',
  'already_used',
  'invalid',
  'expired'
);

CREATE TYPE public.ad_placement AS ENUM ('banner', 'sidebar', 'popup', 'featured_event');

CREATE TYPE public.ad_status AS ENUM ('draft', 'active', 'paused', 'expired');

CREATE TYPE public.notification_type AS ENUM (
  'booking_confirmed',
  'event_reminder',
  'event_cancelled',
  'payment_received',
  'refund_processed',
  'general'
);

CREATE TYPE public.email_status AS ENUM ('queued', 'sent', 'delivered', 'bounced', 'failed');

-- ============================================================
-- SECTION 2: IDENTITY DOMAIN TABLES
-- ============================================================

-- Table 1: profiles
-- Extends auth.users with application-specific data
-- Created automatically by on_auth_user_created trigger (TASK-001)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID          NOT NULL,
  email               TEXT          NOT NULL,
  role                public.user_role NOT NULL DEFAULT 'student',
  full_name           TEXT          NULL,
  avatar_url          TEXT          NULL,
  phone               TEXT          NULL,
  registration_number TEXT          NULL,
  department          TEXT          NULL,
  metadata            JSONB         NULL DEFAULT '{}',
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  version             BIGINT        NOT NULL DEFAULT 1,
  deleted_at          TIMESTAMPTZ   NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_auth_users_fk FOREIGN KEY (id)
    REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Check constraints
  CONSTRAINT profiles_full_name_length
    CHECK (full_name IS NULL OR (char_length(full_name) BETWEEN 1 AND 200)),
  CONSTRAINT profiles_phone_length
    CHECK (phone IS NULL OR char_length(phone) <= 20),
  CONSTRAINT profiles_registration_number_length
    CHECK (registration_number IS NULL OR char_length(registration_number) <= 50)
);

-- Partial unique index: one registration_number per active (non-deleted) profile
CREATE UNIQUE INDEX IF NOT EXISTS profiles_registration_number_unique
  ON public.profiles (registration_number)
  WHERE deleted_at IS NULL AND registration_number IS NOT NULL;

-- Table 2: organizer_applications
-- Tracks applications from students wanting to become organizers
CREATE TABLE IF NOT EXISTS public.organizer_applications (
  id                    UUID                       NOT NULL DEFAULT gen_random_uuid(),
  user_id               UUID                       NOT NULL,
  organization_name     TEXT                       NOT NULL,
  description           TEXT                       NOT NULL,
  supporting_documents  JSONB                      NULL DEFAULT '[]',
  status                public.organizer_app_status NOT NULL DEFAULT 'pending',
  reviewed_by           UUID                       NULL,
  review_notes          TEXT                       NULL,
  reviewed_at           TIMESTAMPTZ                NULL,
  created_at            TIMESTAMPTZ                NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ                NOT NULL DEFAULT now(),

  CONSTRAINT organizer_applications_pkey PRIMARY KEY (id),
  CONSTRAINT organizer_applications_user_id_fk FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT organizer_applications_reviewed_by_fk FOREIGN KEY (reviewed_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Check constraints
  CONSTRAINT organizer_applications_org_name_length
    CHECK (char_length(organization_name) BETWEEN 2 AND 200),
  CONSTRAINT organizer_applications_description_length
    CHECK (char_length(description) BETWEEN 10 AND 5000)
);

-- Partial unique index: only one pending application per user
CREATE UNIQUE INDEX IF NOT EXISTS organizer_applications_one_pending_per_user
  ON public.organizer_applications (user_id)
  WHERE status = 'pending';

-- ============================================================
-- SECTION 3: TAXONOMY DOMAIN TABLES
-- ============================================================

-- Table 3: categories
-- Top-level event classification
CREATE TABLE IF NOT EXISTS public.categories (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL,
  description   TEXT        NULL,
  icon_url      TEXT        NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  version       BIGINT      NOT NULL DEFAULT 1,
  deleted_at    TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT categories_pkey PRIMARY KEY (id),

  -- Check constraints
  CONSTRAINT categories_name_length
    CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT categories_slug_length
    CHECK (char_length(slug) BETWEEN 1 AND 100),
  CONSTRAINT categories_slug_format
    CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT categories_display_order_positive
    CHECK (display_order >= 0)
);

-- Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique
  ON public.categories (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_unique
  ON public.categories (slug) WHERE deleted_at IS NULL;

-- Table 4: subcategories
-- Second-level event classification under a category
CREATE TABLE IF NOT EXISTS public.subcategories (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  category_id   UUID        NOT NULL,
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL,
  description   TEXT        NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  version       BIGINT      NOT NULL DEFAULT 1,
  deleted_at    TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT subcategories_pkey PRIMARY KEY (id),
  CONSTRAINT subcategories_category_id_fk FOREIGN KEY (category_id)
    REFERENCES public.categories(id) ON DELETE RESTRICT,

  -- Check constraints
  CONSTRAINT subcategories_name_length
    CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT subcategories_slug_length
    CHECK (char_length(slug) BETWEEN 1 AND 100),
  CONSTRAINT subcategories_slug_format
    CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT subcategories_display_order_positive
    CHECK (display_order >= 0)
);

-- Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS subcategories_category_name_unique
  ON public.subcategories (category_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subcategories_category_slug_unique
  ON public.subcategories (category_id, slug) WHERE deleted_at IS NULL;

-- ============================================================
-- SECTION 4: EVENTS DOMAIN TABLES
-- ============================================================

-- Table 5: events
-- Core event entity. Owned by an organizer.
CREATE TABLE IF NOT EXISTS public.events (
  id                      UUID                      NOT NULL DEFAULT gen_random_uuid(),
  organizer_id            UUID                      NOT NULL,
  category_id             UUID                      NOT NULL,
  subcategory_id          UUID                      NULL,
  title                   TEXT                      NOT NULL,
  slug                    TEXT                      NOT NULL,
  description             TEXT                      NOT NULL,
  short_description       TEXT                      NULL,
  cover_image_url         TEXT                      NULL,
  venue                   TEXT                      NOT NULL,
  venue_address           TEXT                      NULL,
  latitude                NUMERIC(10, 7)            NULL,
  longitude               NUMERIC(10, 7)            NULL,
  starts_at               TIMESTAMPTZ               NOT NULL,
  ends_at                 TIMESTAMPTZ               NOT NULL,
  registration_opens_at   TIMESTAMPTZ               NULL,
  registration_closes_at  TIMESTAMPTZ               NULL,
  is_free                 BOOLEAN                   NOT NULL DEFAULT TRUE,
  is_featured             BOOLEAN                   NOT NULL DEFAULT FALSE,
  registration_mode       public.registration_mode  NOT NULL DEFAULT 'individual',
  team_min_size           INTEGER                   NULL,
  team_max_size           INTEGER                   NULL,
  team_pricing            public.team_pricing_mode  NULL,
  status                  public.event_status       NOT NULL DEFAULT 'draft',
  max_tickets             INTEGER                   NULL,
  terms_and_conditions    TEXT                      NULL,
  contact_email           TEXT                      NULL,
  contact_phone           TEXT                      NULL,
  metadata                JSONB                     NULL DEFAULT '{}',
  version                 BIGINT                    NOT NULL DEFAULT 1,
  deleted_at              TIMESTAMPTZ               NULL,
  created_at              TIMESTAMPTZ               NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ               NOT NULL DEFAULT now(),

  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_organizer_id_fk FOREIGN KEY (organizer_id)
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT events_category_id_fk FOREIGN KEY (category_id)
    REFERENCES public.categories(id) ON DELETE RESTRICT,
  CONSTRAINT events_subcategory_id_fk FOREIGN KEY (subcategory_id)
    REFERENCES public.subcategories(id) ON DELETE SET NULL,

  -- Check constraints
  CONSTRAINT events_title_length
    CHECK (char_length(title) BETWEEN 3 AND 300),
  CONSTRAINT events_slug_length
    CHECK (char_length(slug) BETWEEN 3 AND 300),
  CONSTRAINT events_slug_format
    CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT events_description_length
    CHECK (char_length(description) BETWEEN 10 AND 50000),
  CONSTRAINT events_short_description_length
    CHECK (short_description IS NULL OR char_length(short_description) <= 500),
  CONSTRAINT events_venue_length
    CHECK (char_length(venue) BETWEEN 1 AND 500),
  CONSTRAINT events_ends_after_starts
    CHECK (ends_at > starts_at),
  CONSTRAINT events_registration_window_valid
    CHECK (
      registration_closes_at IS NULL
      OR registration_opens_at IS NULL
      OR registration_closes_at > registration_opens_at
    ),
  CONSTRAINT events_team_min_size_valid
    CHECK (team_min_size IS NULL OR team_min_size >= 2),
  CONSTRAINT events_team_max_size_valid
    CHECK (
      team_max_size IS NULL
      OR team_min_size IS NULL
      OR team_max_size >= team_min_size
    ),
  CONSTRAINT events_max_tickets_positive
    CHECK (max_tickets IS NULL OR max_tickets > 0),
  CONSTRAINT events_latitude_range
    CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  CONSTRAINT events_longitude_range
    CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
);

-- Partial unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_unique
  ON public.events (slug) WHERE deleted_at IS NULL;

-- Supporting indexes for events
CREATE INDEX IF NOT EXISTS events_organizer_id_idx ON public.events (organizer_id);
CREATE INDEX IF NOT EXISTS events_category_id_idx ON public.events (category_id);
CREATE INDEX IF NOT EXISTS events_status_idx ON public.events (status);
CREATE INDEX IF NOT EXISTS events_starts_at_idx ON public.events (starts_at);
CREATE INDEX IF NOT EXISTS events_is_featured_idx ON public.events (is_featured) WHERE is_featured = TRUE;

-- Table 6: event_faqs
-- Frequently asked questions for an event
CREATE TABLE IF NOT EXISTS public.event_faqs (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL,
  question      TEXT        NOT NULL,
  answer        TEXT        NOT NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_faqs_pkey PRIMARY KEY (id),
  CONSTRAINT event_faqs_event_id_fk FOREIGN KEY (event_id)
    REFERENCES public.events(id) ON DELETE CASCADE,

  -- Check constraints
  CONSTRAINT event_faqs_question_length
    CHECK (char_length(question) BETWEEN 3 AND 1000),
  CONSTRAINT event_faqs_answer_length
    CHECK (char_length(answer) BETWEEN 1 AND 5000),
  CONSTRAINT event_faqs_display_order_positive
    CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS event_faqs_event_id_idx ON public.event_faqs (event_id);

-- Table 7: event_gallery
-- Image gallery for an event
CREATE TABLE IF NOT EXISTS public.event_gallery (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL,
  image_url     TEXT        NOT NULL,
  caption       TEXT        NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_gallery_pkey PRIMARY KEY (id),
  CONSTRAINT event_gallery_event_id_fk FOREIGN KEY (event_id)
    REFERENCES public.events(id) ON DELETE CASCADE,

  -- Check constraints
  CONSTRAINT event_gallery_image_url_length
    CHECK (char_length(image_url) BETWEEN 1 AND 2000),
  CONSTRAINT event_gallery_caption_length
    CHECK (caption IS NULL OR char_length(caption) <= 500),
  CONSTRAINT event_gallery_display_order_positive
    CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS event_gallery_event_id_idx ON public.event_gallery (event_id);

-- Table 8: event_documents
-- Downloadable documents attached to an event
CREATE TABLE IF NOT EXISTS public.event_documents (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL,
  name            TEXT        NOT NULL,
  file_url        TEXT        NOT NULL,
  file_type       TEXT        NULL,
  file_size_bytes BIGINT      NULL,
  display_order   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_documents_pkey PRIMARY KEY (id),
  CONSTRAINT event_documents_event_id_fk FOREIGN KEY (event_id)
    REFERENCES public.events(id) ON DELETE CASCADE,

  -- Check constraints
  CONSTRAINT event_documents_name_length
    CHECK (char_length(name) BETWEEN 1 AND 300),
  CONSTRAINT event_documents_file_url_length
    CHECK (char_length(file_url) BETWEEN 1 AND 2000),
  CONSTRAINT event_documents_file_size_positive
    CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  CONSTRAINT event_documents_display_order_positive
    CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS event_documents_event_id_idx ON public.event_documents (event_id);

-- Table 9: ticket_types
-- Defines pricing tiers for an event (e.g., General, VIP, Early Bird)
CREATE TABLE IF NOT EXISTS public.ticket_types (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL,
  name          TEXT        NOT NULL,
  description   TEXT        NULL,
  price         NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  max_per_order INTEGER     NULL,
  sale_starts_at TIMESTAMPTZ NULL,
  sale_ends_at  TIMESTAMPTZ NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  version       BIGINT      NOT NULL DEFAULT 1,
  deleted_at    TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ticket_types_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_types_event_id_fk FOREIGN KEY (event_id)
    REFERENCES public.events(id) ON DELETE RESTRICT,

  -- Check constraints
  CONSTRAINT ticket_types_name_length
    CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT ticket_types_price_non_negative
    CHECK (price >= 0),
  CONSTRAINT ticket_types_max_per_order_positive
    CHECK (max_per_order IS NULL OR max_per_order > 0),
  CONSTRAINT ticket_types_sale_window_valid
    CHECK (
      sale_ends_at IS NULL
      OR sale_starts_at IS NULL
      OR sale_ends_at > sale_starts_at
    ),
  CONSTRAINT ticket_types_display_order_positive
    CHECK (display_order >= 0)
);

-- Partial unique index: unique name per event per non-deleted type
CREATE UNIQUE INDEX IF NOT EXISTS ticket_types_event_name_unique
  ON public.ticket_types (event_id, name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ticket_types_event_id_idx ON public.ticket_types (event_id);

-- ============================================================
-- SECTION 5: BOOKING DOMAIN TABLES
-- ============================================================

-- Table 10: event_inventory
-- Tracks real-time ticket availability — updated ONLY via RPCs
CREATE TABLE IF NOT EXISTS public.event_inventory (
  id                UUID        NOT NULL DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL,
  ticket_type_id    UUID        NULL,
  total_tickets     INTEGER     NOT NULL DEFAULT 0,
  available_tickets INTEGER     NOT NULL DEFAULT 0,
  reserved_tickets  INTEGER     NOT NULL DEFAULT 0,
  sold_tickets      INTEGER     NOT NULL DEFAULT 0,
  version           BIGINT      NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT event_inventory_event_id_fk FOREIGN KEY (event_id)
    REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT event_inventory_ticket_type_id_fk FOREIGN KEY (ticket_type_id)
    REFERENCES public.ticket_types(id) ON DELETE CASCADE,

  -- Check constraints
  CONSTRAINT event_inventory_total_non_negative
    CHECK (total_tickets >= 0),
  CONSTRAINT event_inventory_available_non_negative
    CHECK (available_tickets >= 0),
  CONSTRAINT event_inventory_reserved_non_negative
    CHECK (reserved_tickets >= 0),
  CONSTRAINT event_inventory_sold_non_negative
    CHECK (sold_tickets >= 0),
  -- Invariant: available + reserved + sold = total
  CONSTRAINT event_inventory_counter_invariant
    CHECK (available_tickets + reserved_tickets + sold_tickets = total_tickets)
);

-- Unique: one inventory row per event/type combo (NULL ticket_type_id = event-level)
CREATE UNIQUE INDEX IF NOT EXISTS event_inventory_event_type_unique
  ON public.event_inventory (event_id, COALESCE(ticket_type_id, '00000000-0000-0000-0000-000000000000'::UUID));

CREATE INDEX IF NOT EXISTS event_inventory_event_id_idx ON public.event_inventory (event_id);

-- Table 11: reservations
-- Two-stage temporary holds (Stage 1: 2min, Stage 2: +5min)
CREATE TABLE IF NOT EXISTS public.reservations (
  id              UUID                       NOT NULL DEFAULT gen_random_uuid(),
  user_id         UUID                       NOT NULL,
  event_id        UUID                       NOT NULL,
  ticket_type_id  UUID                       NOT NULL,
  status          public.reservation_status  NOT NULL DEFAULT 'held',
  quantity        INTEGER                    NOT NULL DEFAULT 1,
  held_at         TIMESTAMPTZ                NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ                NOT NULL,
  extended_at     TIMESTAMPTZ                NULL,
  confirmed_at    TIMESTAMPTZ                NULL,
  cancelled_at    TIMESTAMPTZ                NULL,
  created_at      TIMESTAMPTZ                NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ                NOT NULL DEFAULT now(),

  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT reservations_user_id_fk FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT reservations_event_id_fk FOREIGN KEY (event_id)
    REFERENCES public.events(id) ON DELETE RESTRICT,
  CONSTRAINT reservations_ticket_type_id_fk FOREIGN KEY (ticket_type_id)
    REFERENCES public.ticket_types(id) ON DELETE RESTRICT,

  -- Check constraints
  CONSTRAINT reservations_quantity_positive
    CHECK (quantity > 0),
  CONSTRAINT reservations_expires_after_held
    CHECK (expires_at > held_at)
);

-- Partial unique index: one active reservation per user per event
CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_user_event
  ON public.reservations (user_id, event_id)
  WHERE status IN ('held', 'payment_pending');

CREATE INDEX IF NOT EXISTS reservations_user_id_idx ON public.reservations (user_id);
CREATE INDEX IF NOT EXISTS reservations_event_id_idx ON public.reservations (event_id);
CREATE INDEX IF NOT EXISTS reservations_expires_at_idx ON public.reservations (expires_at);
CREATE INDEX IF NOT EXISTS reservations_status_idx ON public.reservations (status);

-- Table 12: registrations
-- Confirmed bookings (created when reservation confirmed or payment succeeds)
CREATE TABLE IF NOT EXISTS public.registrations (
  id                    UUID                        NOT NULL DEFAULT gen_random_uuid(),
  reservation_id        UUID                        NULL,
  user_id               UUID                        NOT NULL,
  event_id              UUID                        NOT NULL,
  ticket_type_id        UUID                        NOT NULL,
  registration_mode     public.registration_mode    NOT NULL,
  team_name             TEXT                        NULL,
  quantity              INTEGER                     NOT NULL DEFAULT 1,
  total_amount          NUMERIC(12, 2)              NOT NULL DEFAULT 0.00,
  status                public.registration_status  NOT NULL DEFAULT 'confirmed',
  confirmed_at          TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  cancelled_at          TIMESTAMPTZ                 NULL,
  cancellation_reason   TEXT                        NULL,
  created_at            TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ                 NOT NULL DEFAULT now(),

  CONSTRAINT registrations_pkey PRIMARY KEY (id),
  CONSTRAINT registrations_reservation_id_fk FOREIGN KEY (reservation_id)
    REFERENCES public.reservations(id) ON DELETE SET NULL,
  CONSTRAINT registrations_user_id_fk FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT registrations_event_id_fk FOREIGN KEY (event_id)
    REFERENCES public.events(id) ON DELETE RESTRICT,
  CONSTRAINT registrations_ticket_type_id_fk FOREIGN KEY (ticket_type_id)
    REFERENCES public.ticket_types(id) ON DELETE RESTRICT,

  -- Check constraints
  CONSTRAINT registrations_quantity_positive
    CHECK (quantity > 0),
  CONSTRAINT registrations_total_amount_non_negative
    CHECK (total_amount >= 0),
  CONSTRAINT registrations_team_name_length
    CHECK (team_name IS NULL OR char_length(team_name) BETWEEN 1 AND 200)
);

-- Partial unique: one registration per reservation
CREATE UNIQUE INDEX IF NOT EXISTS registrations_reservation_id_unique
  ON public.registrations (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS registrations_user_id_idx ON public.registrations (user_id);
CREATE INDEX IF NOT EXISTS registrations_event_id_idx ON public.registrations (event_id);
CREATE INDEX IF NOT EXISTS registrations_status_idx ON public.registrations (status);

-- Table 13: registration_members
-- Individual members within a team registration
CREATE TABLE IF NOT EXISTS public.registration_members (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  registration_id     UUID        NOT NULL,
  full_name           TEXT        NOT NULL,
  email               TEXT        NULL,
  phone               TEXT        NULL,
  registration_number TEXT        NULL,
  role_in_team        TEXT        NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT registration_members_pkey PRIMARY KEY (id),
  CONSTRAINT registration_members_registration_id_fk FOREIGN KEY (registration_id)
    REFERENCES public.registrations(id) ON DELETE CASCADE,

  -- Check constraints
  CONSTRAINT registration_members_full_name_length
    CHECK (char_length(full_name) BETWEEN 1 AND 200),
  CONSTRAINT registration_members_email_length
    CHECK (email IS NULL OR char_length(email) <= 320),
  CONSTRAINT registration_members_phone_length
    CHECK (phone IS NULL OR char_length(phone) <= 20)
);

CREATE INDEX IF NOT EXISTS registration_members_registration_id_idx
  ON public.registration_members (registration_id);

-- ============================================================
-- SECTION 6: PAYMENT DOMAIN TABLES
-- ============================================================

-- Table 14: payments
-- Payment records linked to registrations. Integration with Razorpay.
CREATE TABLE IF NOT EXISTS public.payments (
  id                    UUID                    NOT NULL DEFAULT gen_random_uuid(),
  registration_id       UUID                    NOT NULL,
  user_id               UUID                    NOT NULL,
  razorpay_order_id     TEXT                    NULL,
  razorpay_payment_id   TEXT                    NULL,
  razorpay_signature    TEXT                    NULL,
  status                public.payment_status   NOT NULL DEFAULT 'initiated',
  amount                NUMERIC(12, 2)          NOT NULL,
  currency              TEXT                    NOT NULL DEFAULT 'INR',
  metadata              JSONB                   NULL DEFAULT '{}',
  initiated_at          TIMESTAMPTZ             NOT NULL DEFAULT now(),
  captured_at           TIMESTAMPTZ             NULL,
  failed_at             TIMESTAMPTZ             NULL,
  created_at            TIMESTAMPTZ             NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ             NOT NULL DEFAULT now(),

  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_registration_id_fk FOREIGN KEY (registration_id)
    REFERENCES public.registrations(id) ON DELETE RESTRICT,
  CONSTRAINT payments_user_id_fk FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- Check constraints
  CONSTRAINT payments_amount_positive
    CHECK (amount > 0),
  CONSTRAINT payments_currency_length
    CHECK (char_length(currency) = 3)
);

-- Partial unique indexes on Razorpay IDs (when NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_order_id_unique
  ON public.payments (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_payment_id_unique
  ON public.payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_registration_id_idx ON public.payments (registration_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);

-- Table 15: refunds
-- Refund records linked to payments
CREATE TABLE IF NOT EXISTS public.refunds (
  id                  UUID                  NOT NULL DEFAULT gen_random_uuid(),
  payment_id          UUID                  NOT NULL,
  initiated_by        UUID                  NOT NULL,
  razorpay_refund_id  TEXT                  NULL,
  status              public.refund_status  NOT NULL DEFAULT 'pending',
  amount              NUMERIC(12, 2)        NOT NULL,
  reason              TEXT                  NULL,
  metadata            JSONB                 NULL DEFAULT '{}',
  initiated_at        TIMESTAMPTZ           NOT NULL DEFAULT now(),
  processed_at        TIMESTAMPTZ           NULL,
  created_at          TIMESTAMPTZ           NOT NULL DEFAULT now(),

  CONSTRAINT refunds_pkey PRIMARY KEY (id),
  CONSTRAINT refunds_payment_id_fk FOREIGN KEY (payment_id)
    REFERENCES public.payments(id) ON DELETE RESTRICT,
  CONSTRAINT refunds_initiated_by_fk FOREIGN KEY (initiated_by)
    REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- Check constraints
  CONSTRAINT refunds_amount_positive
    CHECK (amount > 0),
  CONSTRAINT refunds_reason_length
    CHECK (reason IS NULL OR char_length(reason) <= 2000)
);

-- Partial unique index on Razorpay refund ID
CREATE UNIQUE INDEX IF NOT EXISTS refunds_razorpay_refund_id_unique
  ON public.refunds (razorpay_refund_id)
  WHERE razorpay_refund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS refunds_payment_id_idx ON public.refunds (payment_id);

-- ============================================================
-- SECTION 7: TICKET DOMAIN TABLES
-- ============================================================

-- Table 16: tickets
-- Issued tickets with secure QR token and human-readable ticket number
CREATE TABLE IF NOT EXISTS public.tickets (
  id              UUID                  NOT NULL DEFAULT gen_random_uuid(),
  registration_id UUID                  NOT NULL,
  event_id        UUID                  NOT NULL,
  user_id         UUID                  NOT NULL,
  ticket_number   TEXT                  NOT NULL,
  qr_token        TEXT                  NOT NULL,
  status          public.ticket_status  NOT NULL DEFAULT 'valid',
  manual_override BOOLEAN               NOT NULL DEFAULT FALSE,
  override_reason TEXT                  NULL,
  issued_at       TIMESTAMPTZ           NOT NULL DEFAULT now(),
  used_at         TIMESTAMPTZ           NULL,
  cancelled_at    TIMESTAMPTZ           NULL,
  created_at      TIMESTAMPTZ           NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ           NOT NULL DEFAULT now(),

  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_registration_id_fk FOREIGN KEY (registration_id)
    REFERENCES public.registrations(id) ON DELETE RESTRICT,
  CONSTRAINT tickets_event_id_fk FOREIGN KEY (event_id)
    REFERENCES public.events(id) ON DELETE RESTRICT,
  CONSTRAINT tickets_user_id_fk FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- Check constraints
  CONSTRAINT tickets_ticket_number_length
    CHECK (char_length(ticket_number) BETWEEN 5 AND 50),
  CONSTRAINT tickets_qr_token_length
    CHECK (char_length(qr_token) BETWEEN 32 AND 256),

  -- Unique constraints
  CONSTRAINT tickets_ticket_number_unique UNIQUE (ticket_number),
  CONSTRAINT tickets_qr_token_unique UNIQUE (qr_token),
  CONSTRAINT tickets_registration_id_unique UNIQUE (registration_id)
);

CREATE INDEX IF NOT EXISTS tickets_event_id_idx ON public.tickets (event_id);
CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON public.tickets (user_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON public.tickets (status);
-- High-priority index for QR scan verification
CREATE INDEX IF NOT EXISTS tickets_qr_token_idx ON public.tickets (qr_token);

-- Table 17: ticket_verifications
-- Audit log of ticket scan/verification attempts (append-only)
CREATE TABLE IF NOT EXISTS public.ticket_verifications (
  id          UUID                          NOT NULL DEFAULT gen_random_uuid(),
  ticket_id   UUID                          NOT NULL,
  verified_by UUID                          NOT NULL,
  method      public.verification_method    NOT NULL,
  status      public.verification_status    NOT NULL,
  notes       TEXT                          NULL,
  verified_at TIMESTAMPTZ                   NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ                   NOT NULL DEFAULT now(),

  CONSTRAINT ticket_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_verifications_ticket_id_fk FOREIGN KEY (ticket_id)
    REFERENCES public.tickets(id) ON DELETE CASCADE,
  CONSTRAINT ticket_verifications_verified_by_fk FOREIGN KEY (verified_by)
    REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- Check constraints
  CONSTRAINT ticket_verifications_notes_length
    CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

CREATE INDEX IF NOT EXISTS ticket_verifications_ticket_id_idx
  ON public.ticket_verifications (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_verifications_verified_by_idx
  ON public.ticket_verifications (verified_by);
CREATE INDEX IF NOT EXISTS ticket_verifications_verified_at_idx
  ON public.ticket_verifications (verified_at);

-- ============================================================
-- SECTION 8: ADS DOMAIN TABLES
-- ============================================================

-- Table 18: advertisements
-- Platform-level promotional banners managed by super admin
CREATE TABLE IF NOT EXISTS public.advertisements (
  id            UUID                NOT NULL DEFAULT gen_random_uuid(),
  title         TEXT                NOT NULL,
  image_url     TEXT                NOT NULL,
  target_url    TEXT                NULL,
  status        public.ad_status    NOT NULL DEFAULT 'draft',
  placement     public.ad_placement NOT NULL DEFAULT 'banner',
  display_order INTEGER             NOT NULL DEFAULT 0,
  starts_at     TIMESTAMPTZ         NULL,
  ends_at       TIMESTAMPTZ         NULL,
  deleted_at    TIMESTAMPTZ         NULL,
  version       BIGINT              NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT now(),

  CONSTRAINT advertisements_pkey PRIMARY KEY (id),

  -- Check constraints
  CONSTRAINT advertisements_title_length
    CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT advertisements_image_url_length
    CHECK (char_length(image_url) BETWEEN 1 AND 2000),
  CONSTRAINT advertisements_target_url_length
    CHECK (target_url IS NULL OR char_length(target_url) <= 2000),
  CONSTRAINT advertisements_display_order_positive
    CHECK (display_order >= 0),
  CONSTRAINT advertisements_date_range_valid
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS advertisements_status_idx ON public.advertisements (status);
CREATE INDEX IF NOT EXISTS advertisements_placement_idx ON public.advertisements (placement);

-- ============================================================
-- SECTION 9: NOTIFICATIONS DOMAIN TABLES
-- ============================================================

-- Table 19: notifications
-- In-app notifications delivered to users
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID                        NOT NULL DEFAULT gen_random_uuid(),
  user_id     UUID                        NOT NULL,
  type        public.notification_type    NOT NULL,
  title       TEXT                        NOT NULL,
  body        TEXT                        NOT NULL,
  data        JSONB                       NULL DEFAULT '{}',
  is_read     BOOLEAN                     NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ                 NULL,
  deleted_at  TIMESTAMPTZ                 NULL,
  created_at  TIMESTAMPTZ                 NOT NULL DEFAULT now(),

  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fk FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Check constraints
  CONSTRAINT notifications_title_length
    CHECK (char_length(title) BETWEEN 1 AND 300),
  CONSTRAINT notifications_body_length
    CHECK (char_length(body) BETWEEN 1 AND 5000)
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx
  ON public.notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at);

-- ============================================================
-- SECTION 10: SYSTEM DOMAIN TABLES
-- ============================================================

-- Table 20: email_log
-- Tracks all transactional emails sent via Resend (append-only)
CREATE TABLE IF NOT EXISTS public.email_log (
  id            UUID                NOT NULL DEFAULT gen_random_uuid(),
  user_id       UUID                NULL,
  template_name TEXT                NOT NULL,
  to_email      TEXT                NOT NULL,
  subject       TEXT                NOT NULL,
  status        public.email_status NOT NULL DEFAULT 'queued',
  metadata      JSONB               NULL DEFAULT '{}',
  error_message TEXT                NULL,
  sent_at       TIMESTAMPTZ         NULL,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT now(),

  CONSTRAINT email_log_pkey PRIMARY KEY (id),
  CONSTRAINT email_log_user_id_fk FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Check constraints
  CONSTRAINT email_log_template_name_length
    CHECK (char_length(template_name) BETWEEN 1 AND 200),
  CONSTRAINT email_log_to_email_length
    CHECK (char_length(to_email) BETWEEN 3 AND 320),
  CONSTRAINT email_log_subject_length
    CHECK (char_length(subject) BETWEEN 1 AND 500),
  CONSTRAINT email_log_error_message_length
    CHECK (error_message IS NULL OR char_length(error_message) <= 5000)
);

CREATE INDEX IF NOT EXISTS email_log_user_id_idx ON public.email_log (user_id);
CREATE INDEX IF NOT EXISTS email_log_status_idx ON public.email_log (status);
CREATE INDEX IF NOT EXISTS email_log_created_at_idx ON public.email_log (created_at);

-- Table 21: audit_log
-- Immutable audit trail of all significant system actions (append-only)
-- Note: Partitioned by created_at for performance (monthly partitions) per DB-003
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  actor_id      UUID        NULL,
  actor_role    TEXT        NOT NULL,
  action        TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   UUID        NULL,
  before_state  JSONB       NULL,
  after_state   JSONB       NULL,
  ip_address    TEXT        NULL,
  user_agent    TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_actor_id_fk FOREIGN KEY (actor_id)
    REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Check constraints
  CONSTRAINT audit_log_actor_role_length
    CHECK (char_length(actor_role) BETWEEN 1 AND 50),
  CONSTRAINT audit_log_action_length
    CHECK (char_length(action) BETWEEN 1 AND 200),
  CONSTRAINT audit_log_resource_type_length
    CHECK (char_length(resource_type) BETWEEN 1 AND 100),
  CONSTRAINT audit_log_ip_address_length
    CHECK (ip_address IS NULL OR char_length(ip_address) <= 45)
);

CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_resource_type_idx ON public.audit_log (resource_type);
CREATE INDEX IF NOT EXISTS audit_log_resource_id_idx ON public.audit_log (resource_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at);

-- Table 22: outbox_events
-- Transactional outbox pattern for reliable side effects
CREATE TABLE IF NOT EXISTS public.outbox_events (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  event_type    TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   UUID        NOT NULL,
  payload       JSONB       NOT NULL DEFAULT '{}',
  processed     BOOLEAN     NOT NULL DEFAULT FALSE,
  retry_count   INTEGER     NOT NULL DEFAULT 0,
  error_message TEXT        NULL,
  process_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT outbox_events_pkey PRIMARY KEY (id),

  -- Check constraints
  CONSTRAINT outbox_events_event_type_length
    CHECK (char_length(event_type) BETWEEN 1 AND 200),
  CONSTRAINT outbox_events_resource_type_length
    CHECK (char_length(resource_type) BETWEEN 1 AND 100),
  CONSTRAINT outbox_events_retry_count_non_negative
    CHECK (retry_count >= 0)
);

CREATE INDEX IF NOT EXISTS outbox_events_processed_idx
  ON public.outbox_events (processed, process_after)
  WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS outbox_events_resource_idx
  ON public.outbox_events (resource_type, resource_id);

-- Table 23: sync_versions
-- Resource-specific version counters for mobile/web sync
CREATE TABLE IF NOT EXISTS public.sync_versions (
  resource_type   TEXT        NOT NULL,
  current_version BIGINT      NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sync_versions_pkey PRIMARY KEY (resource_type),

  -- Check constraints
  CONSTRAINT sync_versions_resource_type_length
    CHECK (char_length(resource_type) BETWEEN 1 AND 100),
  CONSTRAINT sync_versions_current_version_non_negative
    CHECK (current_version >= 0)
);

-- Table 24: system_config
-- Runtime key-value configuration store (managed by super admin)
CREATE TABLE IF NOT EXISTS public.system_config (
  key         TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  description TEXT        NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT system_config_pkey PRIMARY KEY (key),

  -- Check constraints
  CONSTRAINT system_config_key_length
    CHECK (char_length(key) BETWEEN 1 AND 200),
  CONSTRAINT system_config_key_format
    CHECK (key ~ '^[a-z0-9_.]+$'),
  CONSTRAINT system_config_value_length
    CHECK (char_length(value) <= 10000),
  CONSTRAINT system_config_description_length
    CHECK (description IS NULL OR char_length(description) <= 1000)
);

-- ============================================================
-- SECTION 11: SEED SYSTEM CONFIG WITH CANONICAL CONSTANTS (DB-009)
-- ============================================================

INSERT INTO public.system_config (key, value, description)
VALUES
  ('reservation.stage1_ttl_seconds',     '120',  'Stage 1 reservation hold time in seconds (2 minutes)'),
  ('reservation.stage2_ttl_seconds',     '300',  'Stage 2 reservation extension time in seconds (+5 minutes)'),
  ('reservation.max_per_user_per_event', '1',    'Maximum active reservations per user per event'),
  ('event.zero_booking_retention_days',  '30',   'Days before unbooked events are deleted'),
  ('event.booked_retention_days',        '7',    'Days after event end before archiving booked events'),
  ('verify.manual_lookup_rate_window_s', '60',   'Rate limit window in seconds for manual ticket lookup'),
  ('verify.manual_lookup_rate_max',      '10',   'Max manual lookups per window per verifier'),
  ('outbox.poll_interval_ms',            '1000', 'Outbox polling frequency in milliseconds'),
  ('outbox.max_retries',                 '5',    'Maximum outbox event retry count'),
  ('payment.default_currency',           'INR',  'Default payment currency ISO code')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SECTION 12: SEED SYNC_VERSIONS INITIAL ROWS
-- ============================================================

INSERT INTO public.sync_versions (resource_type, current_version)
VALUES
  ('events',         0),
  ('categories',     0),
  ('subcategories',  0),
  ('ticket_types',   0),
  ('profiles',       0),
  ('advertisements', 0)
ON CONFLICT (resource_type) DO NOTHING;

-- ============================================================
-- TABLE COUNT VERIFICATION COMMENT
-- ============================================================
-- 1.  profiles
-- 2.  organizer_applications
-- 3.  categories
-- 4.  subcategories
-- 5.  events
-- 6.  event_faqs
-- 7.  event_gallery
-- 8.  event_documents
-- 9.  ticket_types
-- 10. event_inventory
-- 11. reservations
-- 12. registrations
-- 13. registration_members
-- 14. payments
-- 15. refunds
-- 16. tickets
-- 17. ticket_verifications
-- 18. advertisements
-- 19. notifications
-- 20. email_log
-- 21. audit_log
-- 22. outbox_events
-- 23. sync_versions
-- 24. system_config
-- TOTAL: 24 tables ✅
