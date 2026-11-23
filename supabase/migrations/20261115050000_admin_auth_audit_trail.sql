-- ==============================================================================
-- Migration: 20261115050000_admin_auth_audit_trail.sql
-- Description: Trusted RPC for recording administrative authentication lifecycle events
-- ==============================================================================

create or replace function public.admin_record_auth_audit(
  p_action text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
security definer
set search_path = pg_catalog, public
language plpgsql
as $$
declare
  v_admin_id uuid;
  v_role text;
  v_action text;
begin
  -- Validate action against strict whitelist
  v_action := upper(trim(p_action));
  if v_action not in ('LOGIN', 'LOGOUT', 'REQUEST_OTP', 'SESSION_REFRESH') then
    raise exception 'Invalid auth audit action: %', p_action;
  end if;

  -- Derive the authenticated admin user from auth context (cannot be spoofed)
  select au.id,
    case
      when exists (
        select 1
        from public.platform_admin_roles par
        where par.admin_user_id = au.id
          and par.role = 'SUPER_ADMIN'
      ) then 'SUPER_ADMIN'
      else 'ORGANIZER'
    end
  into v_admin_id, v_role
  from public.admin_users au
  where au.auth_user_id = auth.uid()
    and au.is_active = true;

  if v_admin_id is null then
    -- Not an authenticated/active administrator
    return;
  end if;

  insert into public.audit_logs (
    actor_admin_id,
    actor_role,
    action,
    target_type,
    target_id,
    reason,
    before_data,
    after_data,
    metadata
  )
  values (
    v_admin_id,
    v_role,
    v_action,
    'security',
    v_admin_id,
    p_reason,
    null,
    jsonb_build_object('auth_user_id', auth.uid()),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.admin_record_auth_audit(text, text, jsonb) from public, anon;
grant execute on function public.admin_record_auth_audit(text, text, jsonb) to authenticated;
