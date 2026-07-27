-- =============================================================================
-- TASK-013: Immutable Audit Log & Tampering Guard Triggers
-- Migration: 20260722000005_audit_triggers.sql
-- Depends on: 20260722000001_canonical_schema.sql, 20260722000004_rls_policies.sql
-- References: DB-007_TRIGGER_SPECIFICATION.md, IMP-007, IMP-012
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. set_updated_at trigger function
-- Updates updated_at to now() before any UPDATE on tracked tables.
-- DB-007 §3.2
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_TABLE_NAME IN ('profiles', 'categories', 'subcategories', 'events', 'ticket_types', 'event_inventory', 'advertisements') THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach set_updated_at trigger to all required tables (DB-007 §3.2)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles',
    'organizer_applications',
    'categories',
    'subcategories',
    'events',
    'event_faqs',
    'ticket_types',
    'event_inventory',
    'reservations',
    'registrations',
    'payments',
    'tickets',
    'advertisements',
    'system_config'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      $f$
        DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
        CREATE TRIGGER set_updated_at
          BEFORE UPDATE ON public.%I
          FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
      $f$,
      t, t
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. bump_sync_version trigger function
-- Increments sync_versions counter for resource after INSERT/UPDATE/DELETE.
-- DB-007 §3.3
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_bump_sync_version()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sync_versions (resource_type, current_version, updated_at)
  VALUES (TG_TABLE_NAME, 1, now())
  ON CONFLICT (resource_type)
  DO UPDATE SET
    current_version = sync_versions.current_version + 1,
    updated_at      = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach bump_sync_version trigger to all required tables (DB-007 §3.3)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles',
    'categories',
    'subcategories',
    'events',
    'ticket_types',
    'event_inventory',
    'advertisements'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      $f$
        DROP TRIGGER IF EXISTS bump_sync_version ON public.%I;
        CREATE TRIGGER bump_sync_version
          AFTER INSERT OR UPDATE OR DELETE ON public.%I
          FOR EACH ROW EXECUTE FUNCTION public.trigger_bump_sync_version();
      $f$,
      t, t
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. audit_table_changes trigger function
-- Writes row-level change records to audit_log on INSERT/UPDATE/DELETE.
-- Actor ID and correlation ID captured from auth.uid() and request headers.
-- DB-007 §3.4
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_audit_log()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid;
  v_actor_role  public.user_role;
  v_before      jsonb;
  v_after       jsonb;
  v_resource_id uuid;
  v_action      text;
  v_ip_address  inet;
  v_user_agent  text;
  v_headers     json;
BEGIN
  -- Determine actor
  v_actor_id   := auth.uid();
  v_actor_role := public.get_user_role();

  -- Determine operation
  v_action := TG_TABLE_NAME || '.' || lower(TG_OP);

  -- Capture before / after state
  IF TG_OP = 'INSERT' THEN
    v_before      := NULL;
    v_after       := to_jsonb(NEW);
    v_resource_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_before      := to_jsonb(OLD);
    v_after       := to_jsonb(NEW);
    v_resource_id := NEW.id;
  ELSE -- DELETE
    v_before      := to_jsonb(OLD);
    v_after       := NULL;
    v_resource_id := OLD.id;
  END IF;

  -- Extract IP address and user agent from request headers (best-effort)
  BEGIN
    v_headers    := current_setting('request.headers', true)::json;
    v_ip_address := (v_headers->>'x-forwarded-for')::inet;
    v_user_agent := v_headers->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
    v_user_agent := NULL;
  END;

  -- Insert audit record
  INSERT INTO public.audit_log (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    before_state,
    after_state,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    v_actor_id,
    v_actor_role,
    v_action,
    TG_TABLE_NAME,
    v_resource_id,
    v_before,
    v_after,
    v_ip_address,
    v_user_agent,
    now()
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Do not block the original operation if audit insert fails
  RAISE WARNING 'audit_table_changes: failed to write audit log for table %, op %: %',
    TG_TABLE_NAME, TG_OP, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit_table_changes trigger to all required tables (DB-007 §3.4)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles',
    'organizer_applications',
    'events',
    'ticket_types',
    'registrations',
    'payments',
    'refunds',
    'advertisements',
    'system_config'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      $f$
        DROP TRIGGER IF EXISTS audit_table_changes ON public.%I;
        CREATE TRIGGER audit_table_changes
          AFTER INSERT OR UPDATE OR DELETE ON public.%I
          FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();
      $f$,
      t, t
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. prevent_audit_log_tampering trigger
-- Raises exception on any UPDATE or DELETE against audit_log.
-- DB-007 §3.5 — requirement: RAISE EXCEPTION 'Audit log entries are immutable'
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_prevent_audit_tampering()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.'
    USING ERRCODE = '42881';
END;
$$;

DROP TRIGGER IF EXISTS prevent_audit_log_tampering ON public.audit_log;

CREATE TRIGGER prevent_audit_log_tampering
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.trigger_prevent_audit_tampering();

-- ---------------------------------------------------------------------------
-- 5. enforce_inventory_invariant trigger
-- Asserts available + reserved + sold = total on INSERT or UPDATE.
-- DB-007 §3.6
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_enforce_inventory_invariant()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF (NEW.available_tickets + NEW.reserved_tickets + NEW.sold_tickets) <> NEW.total_tickets THEN
    RAISE EXCEPTION
      'Inventory invariant violated: available (%) + reserved (%) + sold (%) != total (%)',
      NEW.available_tickets, NEW.reserved_tickets, NEW.sold_tickets, NEW.total_tickets
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_inventory_invariant ON public.event_inventory;

CREATE TRIGGER enforce_inventory_invariant
  BEFORE INSERT OR UPDATE ON public.event_inventory
  FOR EACH ROW EXECUTE FUNCTION public.trigger_enforce_inventory_invariant();

-- =============================================================================
-- End of TASK-013: Audit Log & Tampering Guard Triggers
-- =============================================================================
