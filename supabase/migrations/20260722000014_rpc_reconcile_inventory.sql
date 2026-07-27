-- =============================================================================
-- TASK-022: RPC reconcile_inventory_counters()
-- Migration: 20260722000014_rpc_reconcile_inventory.sql
-- Depends on: 20260722000001_canonical_schema.sql (TASK-001)
-- References: REQ-BOOK-005, DB-006, IMP-007
-- =============================================================================

-- ---------------------------------------------------------------------------
-- reconcile_inventory_counters(p_event_id)
--
-- Recalculates and corrects event_inventory counters by counting actual ticket
-- rows. Designed to be run by super_admin or scheduled jobs to fix any drift
-- caused by failures or race conditions.
--
-- For each event_inventory row (scoped to p_event_id if provided, else all):
--   1. Count tickets in status='valid' or status='used'  -> sold_count
--      NOTE: tickets table has no ticket_type_id column; all tickets for the
--            event are counted regardless of ticket_type_id on the inventory row.
--   2. Count reservations in status='held' OR status='payment_pending' (active,
--      not expired) -> reserved_count.
--      NOTE: reservation_status enum values are 'held', 'payment_pending',
--            'confirmed', 'cancelled', 'expired' — there is no 'pending' value.
--   3. available = total_tickets - sold_count - reserved_count
--   4. Update event_inventory with corrected values.
--   5. Returns a summary of all corrected rows.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reconcile_inventory_counters(
  p_event_id uuid DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_row              RECORD;
  v_sold_count       integer;
  v_reserved_count   integer;
  v_available_count  integer;
  v_corrections      jsonb := '[]'::jsonb;
  v_correction_entry jsonb;
  v_rows_processed   integer := 0;
  v_rows_corrected   integer := 0;
BEGIN
  -- -------------------------------------------------------------------------
  -- Loop over all event_inventory rows (optionally scoped to p_event_id)
  -- -------------------------------------------------------------------------
  FOR v_row IN
    SELECT ei.id,
           ei.event_id,
           ei.ticket_type_id,
           ei.total_tickets,
           ei.available_tickets AS old_available,
           ei.reserved_tickets  AS old_reserved,
           ei.sold_tickets      AS old_sold
      FROM public.event_inventory ei
     WHERE (p_event_id IS NULL OR ei.event_id = p_event_id)
     ORDER BY ei.event_id, ei.id
     FOR UPDATE
  LOOP
    v_rows_processed := v_rows_processed + 1;

    -- -----------------------------------------------------------------------
    -- Count sold tickets (valid + used)
    -- DB-003 §7.1: tickets table does NOT have a ticket_type_id column.
    -- We count all tickets for the event regardless of ticket type.
    -- -----------------------------------------------------------------------
    SELECT COUNT(*)
      INTO v_sold_count
      FROM public.tickets t
     WHERE t.event_id = v_row.event_id
       AND t.status IN ('valid', 'used');

    -- -----------------------------------------------------------------------
    -- Count active reservations (held or payment_pending, not expired)
    -- reservation_status enum: 'held', 'payment_pending', 'confirmed',
    --                          'cancelled', 'expired'
    -- 'pending' is NOT a valid enum value.
    -- -----------------------------------------------------------------------
    SELECT COUNT(*)
      INTO v_reserved_count
      FROM public.reservations r
     WHERE r.event_id = v_row.event_id
       AND (v_row.ticket_type_id IS NULL OR r.ticket_type_id = v_row.ticket_type_id)
       AND r.status IN ('held', 'payment_pending')
       AND r.expires_at > now();

    -- -----------------------------------------------------------------------
    -- Compute corrected available count (floor at 0)
    -- -----------------------------------------------------------------------
    v_available_count := GREATEST(
      0,
      v_row.total_tickets - v_sold_count - v_reserved_count
    );

    -- -----------------------------------------------------------------------
    -- Only update (and log) if values differ
    -- -----------------------------------------------------------------------
    IF v_sold_count      <> v_row.old_sold
       OR v_reserved_count <> v_row.old_reserved
       OR v_available_count <> v_row.old_available
    THEN
      UPDATE public.event_inventory
         SET sold_tickets      = v_sold_count,
             reserved_tickets  = v_reserved_count,
             available_tickets = v_available_count,
             updated_at        = now()
       WHERE id = v_row.id;

      v_rows_corrected := v_rows_corrected + 1;

      v_correction_entry := jsonb_build_object(
        'inventory_id',       v_row.id,
        'event_id',           v_row.event_id,
        'ticket_type_id',     v_row.ticket_type_id,
        'total_tickets',      v_row.total_tickets,
        'before', jsonb_build_object(
          'sold',      v_row.old_sold,
          'reserved',  v_row.old_reserved,
          'available', v_row.old_available
        ),
        'after', jsonb_build_object(
          'sold',      v_sold_count,
          'reserved',  v_reserved_count,
          'available', v_available_count
        )
      );

      v_corrections := v_corrections || jsonb_build_array(v_correction_entry);
    END IF;

  END LOOP;

  -- -------------------------------------------------------------------------
  -- Return reconciliation summary
  -- -------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'rows_processed', v_rows_processed,
    'rows_corrected', v_rows_corrected,
    'corrections',    v_corrections,
    'reconciled_at',  now()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   'INTERNAL_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- =============================================================================
-- End of TASK-022: RPC reconcile_inventory_counters()
-- =============================================================================
