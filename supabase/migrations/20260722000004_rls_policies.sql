-- =============================================================================
-- TASK-012: PostgreSQL 29 Row Level Security (RLS) Policies
-- Migration: 20260722000004_rls_policies.sql
-- Depends on: 20260722000001_canonical_schema.sql
-- References: DB-005_RLS_POLICY_MATRIX.md, IMP-006, IMP-007
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions referenced by RLS policies (SECURITY DEFINER, STABLE)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS public.user_role
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organizer()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('organizer', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_organizer(p_event_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND organizer_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on all 24 canonical tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_faqs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_gallery           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_inventory         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_verifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertisements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_versions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config           ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (prevents owner bypass)
ALTER TABLE public.profiles                FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_applications  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.events                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_faqs              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_gallery           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_documents         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_inventory         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reservations            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registrations           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registration_members    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments                FORCE ROW LEVEL SECURITY;
ALTER TABLE public.refunds                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tickets                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_verifications    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.advertisements          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_log               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_events           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sync_versions           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.system_config           FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Identity Domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 profiles
-- ---------------------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY profiles_select_admin
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Organizers can read profiles of users in their events (for ticket verification, attendee lists, etc.)
CREATE POLICY profiles_select_event_participants
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.user_id = profiles.id
        AND public.is_event_organizer(tickets.event_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.user_id = profiles.id
        AND public.is_event_organizer(registrations.event_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.reservations
      WHERE reservations.user_id = profiles.id
        AND public.is_event_organizer(reservations.event_id)
    )
  );

-- Users can update their own profile
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Super admin can update any profile
CREATE POLICY profiles_update_admin
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Profiles are ONLY created by the on_auth_user_created trigger (service_role)
CREATE POLICY profiles_insert_trigger_only
  ON public.profiles FOR INSERT
  WITH CHECK (FALSE);

-- No direct delete — handled via auth.users CASCADE
CREATE POLICY profiles_delete_none
  ON public.profiles FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 2.2 organizer_applications
-- ---------------------------------------------------------------------------

CREATE POLICY orgapps_select_own
  ON public.organizer_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY orgapps_select_admin
  ON public.organizer_applications FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY orgapps_insert_own
  ON public.organizer_applications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY orgapps_update_admin
  ON public.organizer_applications FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY orgapps_delete_none
  ON public.organizer_applications FOR DELETE
  USING (FALSE);

-- =============================================================================
-- 3. Taxonomy Domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 categories
-- ---------------------------------------------------------------------------

CREATE POLICY categories_select_public
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL AND is_active = TRUE);

CREATE POLICY categories_select_admin
  ON public.categories FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY categories_insert_admin
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY categories_update_admin
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY categories_delete_none
  ON public.categories FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 3.2 subcategories
-- ---------------------------------------------------------------------------

CREATE POLICY subcategories_select_public
  ON public.subcategories FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL AND is_active = TRUE);

CREATE POLICY subcategories_select_admin
  ON public.subcategories FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY subcategories_insert_admin
  ON public.subcategories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY subcategories_update_admin
  ON public.subcategories FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY subcategories_delete_none
  ON public.subcategories FOR DELETE
  USING (FALSE);

-- =============================================================================
-- 4. Events Domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4.1 events
-- ---------------------------------------------------------------------------

-- Public can see published events
CREATE POLICY events_select_published
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL AND status = 'published');

-- Organizers see own events (any status)
CREATE POLICY events_select_own
  ON public.events FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND organizer_id = auth.uid());

-- Admin sees all events
CREATE POLICY events_select_admin
  ON public.events FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Organizers create own events
CREATE POLICY events_insert_organizer
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_organizer() AND organizer_id = auth.uid());

-- Organizers update own events
CREATE POLICY events_update_own
  ON public.events FOR UPDATE
  TO authenticated
  USING (organizer_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (organizer_id = auth.uid());

-- Admin can update any event
CREATE POLICY events_update_admin
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Soft delete only
CREATE POLICY events_delete_none
  ON public.events FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 4.2 event_faqs
-- ---------------------------------------------------------------------------

-- Public sees FAQs of published events
CREATE POLICY event_faqs_select_public
  ON public.event_faqs FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_faqs.event_id
        AND events.status = 'published'
        AND events.deleted_at IS NULL
    )
  );

-- Organizer sees own event FAQs
CREATE POLICY event_faqs_select_own
  ON public.event_faqs FOR SELECT
  TO authenticated
  USING (public.is_event_organizer(event_id));

-- Organizer adds FAQs
CREATE POLICY event_faqs_insert_own
  ON public.event_faqs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_event_organizer(event_id));

-- Organizer updates FAQs
CREATE POLICY event_faqs_update_own
  ON public.event_faqs FOR UPDATE
  TO authenticated
  USING (public.is_event_organizer(event_id))
  WITH CHECK (public.is_event_organizer(event_id));

-- Organizer deletes FAQs (hard delete — cascade)
CREATE POLICY event_faqs_delete_own
  ON public.event_faqs FOR DELETE
  TO authenticated
  USING (public.is_event_organizer(event_id));

-- Admin full access
CREATE POLICY event_faqs_all_admin
  ON public.event_faqs FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4.3 event_gallery
-- ---------------------------------------------------------------------------

CREATE POLICY event_gallery_select_public
  ON public.event_gallery FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_gallery.event_id
        AND events.status = 'published'
        AND events.deleted_at IS NULL
    )
  );

CREATE POLICY event_gallery_select_own
  ON public.event_gallery FOR SELECT
  TO authenticated
  USING (public.is_event_organizer(event_id));

CREATE POLICY event_gallery_insert_own
  ON public.event_gallery FOR INSERT
  TO authenticated
  WITH CHECK (public.is_event_organizer(event_id));

CREATE POLICY event_gallery_delete_own
  ON public.event_gallery FOR DELETE
  TO authenticated
  USING (public.is_event_organizer(event_id));

CREATE POLICY event_gallery_all_admin
  ON public.event_gallery FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4.4 event_documents
-- ---------------------------------------------------------------------------

CREATE POLICY event_documents_select_public
  ON public.event_documents FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_documents.event_id
        AND events.status = 'published'
        AND events.deleted_at IS NULL
    )
  );

CREATE POLICY event_documents_select_own
  ON public.event_documents FOR SELECT
  TO authenticated
  USING (public.is_event_organizer(event_id));

CREATE POLICY event_documents_insert_own
  ON public.event_documents FOR INSERT
  TO authenticated
  WITH CHECK (public.is_event_organizer(event_id));

CREATE POLICY event_documents_delete_own
  ON public.event_documents FOR DELETE
  TO authenticated
  USING (public.is_event_organizer(event_id));

CREATE POLICY event_documents_all_admin
  ON public.event_documents FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4.5 ticket_types
-- ---------------------------------------------------------------------------

-- Public sees active types of published events
CREATE POLICY ticket_types_select_public
  ON public.ticket_types FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = ticket_types.event_id
        AND events.status = 'published'
        AND events.deleted_at IS NULL
    )
  );

-- Organizer sees own
CREATE POLICY ticket_types_select_own
  ON public.ticket_types FOR SELECT
  TO authenticated
  USING (public.is_event_organizer(event_id));

-- Admin sees all
CREATE POLICY ticket_types_select_admin
  ON public.ticket_types FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Organizer creates
CREATE POLICY ticket_types_insert_own
  ON public.ticket_types FOR INSERT
  TO authenticated
  WITH CHECK (public.is_event_organizer(event_id));

-- Organizer updates
CREATE POLICY ticket_types_update_own
  ON public.ticket_types FOR UPDATE
  TO authenticated
  USING (public.is_event_organizer(event_id))
  WITH CHECK (public.is_event_organizer(event_id));

-- Soft delete only
CREATE POLICY ticket_types_delete_none
  ON public.ticket_types FOR DELETE
  USING (FALSE);

-- =============================================================================
-- 5. Booking Domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 event_inventory
-- ---------------------------------------------------------------------------

-- Public can check availability
CREATE POLICY inventory_select_public
  ON public.event_inventory FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_inventory.event_id
        AND events.status = 'published'
        AND events.deleted_at IS NULL
    )
  );

-- Organizer sees own inventory
CREATE POLICY inventory_select_own
  ON public.event_inventory FOR SELECT
  TO authenticated
  USING (public.is_event_organizer(event_id));

-- Admin sees all
CREATE POLICY inventory_select_admin
  ON public.event_inventory FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created only by RPCs (service_role)
CREATE POLICY inventory_insert_none
  ON public.event_inventory FOR INSERT
  WITH CHECK (FALSE);

-- Updated only by RPCs (service_role)
CREATE POLICY inventory_update_none
  ON public.event_inventory FOR UPDATE
  USING (FALSE);

-- Cascade from events only
CREATE POLICY inventory_delete_none
  ON public.event_inventory FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 5.2 reservations
-- ---------------------------------------------------------------------------

-- Users see own reservations
CREATE POLICY reservations_select_own
  ON public.reservations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Organizer sees event reservations
CREATE POLICY reservations_select_organizer
  ON public.reservations FOR SELECT
  TO authenticated
  USING (public.is_event_organizer(event_id));

-- Admin sees all
CREATE POLICY reservations_select_admin
  ON public.reservations FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created only by reserve_ticket() RPC
CREATE POLICY reservations_insert_none
  ON public.reservations FOR INSERT
  WITH CHECK (FALSE);

-- Updated only by RPCs
CREATE POLICY reservations_update_none
  ON public.reservations FOR UPDATE
  USING (FALSE);

-- Never deleted
CREATE POLICY reservations_delete_none
  ON public.reservations FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 5.3 registrations
-- ---------------------------------------------------------------------------

-- Users see own registrations
CREATE POLICY registrations_select_own
  ON public.registrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Organizer sees event registrations
CREATE POLICY registrations_select_organizer
  ON public.registrations FOR SELECT
  TO authenticated
  USING (public.is_event_organizer(event_id));

-- Admin sees all
CREATE POLICY registrations_select_admin
  ON public.registrations FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created only by confirm_reservation() RPC
CREATE POLICY registrations_insert_none
  ON public.registrations FOR INSERT
  WITH CHECK (FALSE);

-- Updated only by RPCs
CREATE POLICY registrations_update_none
  ON public.registrations FOR UPDATE
  USING (FALSE);

-- Never deleted
CREATE POLICY registrations_delete_none
  ON public.registrations FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 5.4 registration_members
-- ---------------------------------------------------------------------------

-- User sees own team members
CREATE POLICY regmembers_select_own
  ON public.registration_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = registration_members.registration_id
        AND registrations.user_id = auth.uid()
    )
  );

-- Organizer sees team members
CREATE POLICY regmembers_select_organizer
  ON public.registration_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = registration_members.registration_id
        AND public.is_event_organizer(registrations.event_id)
    )
  );

-- Admin sees all
CREATE POLICY regmembers_select_admin
  ON public.registration_members FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created only by RPCs
CREATE POLICY regmembers_insert_none
  ON public.registration_members FOR INSERT
  WITH CHECK (FALSE);

-- No updates
CREATE POLICY regmembers_update_none
  ON public.registration_members FOR UPDATE
  USING (FALSE);

-- Cascade from registrations only
CREATE POLICY regmembers_delete_none
  ON public.registration_members FOR DELETE
  USING (FALSE);

-- =============================================================================
-- 6. Payment Domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 6.1 payments
-- ---------------------------------------------------------------------------

-- Users see own payments
CREATE POLICY payments_select_own
  ON public.payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Organizer sees event payments
CREATE POLICY payments_select_organizer
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = payments.registration_id
        AND public.is_event_organizer(registrations.event_id)
    )
  );

-- Admin sees all
CREATE POLICY payments_select_admin
  ON public.payments FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created by payment RPCs (service_role)
CREATE POLICY payments_insert_none
  ON public.payments FOR INSERT
  WITH CHECK (FALSE);

-- Updated by webhook handler (service_role)
CREATE POLICY payments_update_none
  ON public.payments FOR UPDATE
  USING (FALSE);

-- Never deleted
CREATE POLICY payments_delete_none
  ON public.payments FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 6.2 refunds
-- ---------------------------------------------------------------------------

-- Users see own refunds
CREATE POLICY refunds_select_own
  ON public.refunds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments
      WHERE payments.id = refunds.payment_id
        AND payments.user_id = auth.uid()
    )
  );

-- Admin sees all
CREATE POLICY refunds_select_admin
  ON public.refunds FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created by refund RPCs (service_role)
CREATE POLICY refunds_insert_none
  ON public.refunds FOR INSERT
  WITH CHECK (FALSE);

-- Updated by webhook handler (service_role)
CREATE POLICY refunds_update_none
  ON public.refunds FOR UPDATE
  USING (FALSE);

-- Never deleted
CREATE POLICY refunds_delete_none
  ON public.refunds FOR DELETE
  USING (FALSE);

-- =============================================================================
-- 7. Ticket Domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 7.1 tickets
-- ---------------------------------------------------------------------------

-- Users see own tickets
CREATE POLICY tickets_select_own
  ON public.tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Organizer sees event tickets
CREATE POLICY tickets_select_organizer
  ON public.tickets FOR SELECT
  TO authenticated
  USING (public.is_event_organizer(event_id));

-- Admin sees all
CREATE POLICY tickets_select_admin
  ON public.tickets FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created by registration RPCs
CREATE POLICY tickets_insert_none
  ON public.tickets FOR INSERT
  WITH CHECK (FALSE);

-- Updated by verification RPCs
CREATE POLICY tickets_update_none
  ON public.tickets FOR UPDATE
  USING (FALSE);

-- Never deleted
CREATE POLICY tickets_delete_none
  ON public.tickets FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 7.2 ticket_verifications
-- ---------------------------------------------------------------------------

-- Organizer sees verification logs
CREATE POLICY ticketverif_select_organizer
  ON public.ticket_verifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_verifications.ticket_id
        AND public.is_event_organizer(tickets.event_id)
    )
  );

-- Admin sees all
CREATE POLICY ticketverif_select_admin
  ON public.ticket_verifications FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created by verification RPCs only
CREATE POLICY ticketverif_insert_none
  ON public.ticket_verifications FOR INSERT
  WITH CHECK (FALSE);

-- Append-only — no updates
CREATE POLICY ticketverif_update_none
  ON public.ticket_verifications FOR UPDATE
  USING (FALSE);

-- Append-only — no deletes
CREATE POLICY ticketverif_delete_none
  ON public.ticket_verifications FOR DELETE
  USING (FALSE);

-- =============================================================================
-- 8. Ads Domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 8.1 advertisements
-- ---------------------------------------------------------------------------

-- Public sees active ads
CREATE POLICY ads_select_public
  ON public.advertisements FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL AND status = 'active');

-- Admin sees all
CREATE POLICY ads_select_admin
  ON public.advertisements FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Admin creates
CREATE POLICY ads_insert_admin
  ON public.advertisements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

-- Admin updates
CREATE POLICY ads_update_admin
  ON public.advertisements FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Soft delete only
CREATE POLICY ads_delete_none
  ON public.advertisements FOR DELETE
  USING (FALSE);

-- =============================================================================
-- 9. Notifications Domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 9.1 notifications
-- ---------------------------------------------------------------------------

-- Users see own notifications
CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- Users can mark as read / soft delete
CREATE POLICY notifications_update_own
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- Created by system (outbox → service_role)
CREATE POLICY notifications_insert_none
  ON public.notifications FOR INSERT
  WITH CHECK (FALSE);

-- Soft delete only
CREATE POLICY notifications_delete_none
  ON public.notifications FOR DELETE
  USING (FALSE);

-- Admin can view all notifications
CREATE POLICY notifications_select_admin
  ON public.notifications FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- 10. System Domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 10.1 email_log
-- ---------------------------------------------------------------------------

-- Admin only
CREATE POLICY email_log_select_admin
  ON public.email_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Service role only
CREATE POLICY email_log_insert_none
  ON public.email_log FOR INSERT
  WITH CHECK (FALSE);

-- Service role only
CREATE POLICY email_log_update_none
  ON public.email_log FOR UPDATE
  USING (FALSE);

-- Never deleted
CREATE POLICY email_log_delete_none
  ON public.email_log FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 10.2 audit_log
-- ---------------------------------------------------------------------------

-- Admin only — full audit access
CREATE POLICY audit_log_select_admin
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created by triggers/RPCs (service_role)
CREATE POLICY audit_log_insert_none
  ON public.audit_log FOR INSERT
  WITH CHECK (FALSE);

-- Immutable — never updated
CREATE POLICY audit_log_update_none
  ON public.audit_log FOR UPDATE
  USING (FALSE);

-- Immutable — never deleted
CREATE POLICY audit_log_delete_none
  ON public.audit_log FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 10.3 outbox_events
-- ---------------------------------------------------------------------------

-- Admin can monitor outbox
CREATE POLICY outbox_select_admin
  ON public.outbox_events FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Created in transactions (service_role)
CREATE POLICY outbox_insert_none
  ON public.outbox_events FOR INSERT
  WITH CHECK (FALSE);

-- Processed by Edge Functions (service_role)
CREATE POLICY outbox_update_none
  ON public.outbox_events FOR UPDATE
  USING (FALSE);

-- Purged by scheduled job (service_role)
CREATE POLICY outbox_delete_none
  ON public.outbox_events FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 10.4 sync_versions
-- ---------------------------------------------------------------------------

-- Everyone can read sync versions
CREATE POLICY sync_versions_select_public
  ON public.sync_versions FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Service role only
CREATE POLICY sync_versions_insert_none
  ON public.sync_versions FOR INSERT
  WITH CHECK (FALSE);

-- Service role / triggers only
CREATE POLICY sync_versions_update_none
  ON public.sync_versions FOR UPDATE
  USING (FALSE);

-- Never deleted
CREATE POLICY sync_versions_delete_none
  ON public.sync_versions FOR DELETE
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 10.5 system_config
-- ---------------------------------------------------------------------------

-- Admin only
CREATE POLICY system_config_select_admin
  ON public.system_config FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Admin only
CREATE POLICY system_config_insert_admin
  ON public.system_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

-- Admin only
CREATE POLICY system_config_update_admin
  ON public.system_config FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Admin only
CREATE POLICY system_config_delete_admin
  ON public.system_config FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- End of TASK-012: RLS Policies
-- =============================================================================
