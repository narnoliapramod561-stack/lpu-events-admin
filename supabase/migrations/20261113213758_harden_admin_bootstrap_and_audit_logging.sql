-- Remove email-based privilege assignment and tighten privileged RPC exposure.

create or replace function public.handle_new_auth_user()
returns trigger
security definer
set search_path = pg_catalog, public
language plpgsql
as $$
declare
  v_clean_email text;
  v_initial_active boolean;
begin
  v_clean_email := lower(trim(new.email));

  select exists (
    select 1
    from public.pre_approved_organizers
    where lower(trim(email)) = v_clean_email
  )
  into v_initial_active;

  insert into public.admin_users (auth_user_id, display_name, email, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(v_clean_email, '@', 1)),
    v_clean_email,
    v_initial_active
  )
  on conflict (auth_user_id) do update
  set email = excluded.email;

  return new;
end;
$$;

-- Bootstrap is an explicit operator action, not an email convention.
create or replace function public.bootstrap_super_admin(p_admin_id uuid)
returns void
security definer
set search_path = pg_catalog, public
language plpgsql
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'Only the service role may bootstrap a super administrator.';
  end if;

  if exists (
    select 1
    from public.platform_admin_roles par
    join public.admin_users au on au.id = par.admin_user_id
    where par.role = 'SUPER_ADMIN'
      and au.is_active = true
  ) then
    raise exception 'An active super administrator already exists.';
  end if;

  if not exists (
    select 1
    from public.admin_users
    where id = p_admin_id
      and is_active = true
  ) then
    raise exception 'The target administrator must exist and be active.';
  end if;

  insert into public.platform_admin_roles (admin_user_id, role)
  values (p_admin_id, 'SUPER_ADMIN')
  on conflict (admin_user_id) do update
  set role = 'SUPER_ADMIN';
end;
$$;

revoke all on function public.bootstrap_super_admin(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_super_admin(uuid) to service_role;

-- This profile is only needed by the authenticated admin application.
revoke all on function public.get_current_admin_profile() from public, anon;
grant execute on function public.get_current_admin_profile() to authenticated;

create or replace function public.get_current_admin_profile()
returns json
security definer
set search_path = pg_catalog, public
language plpgsql
as $$
declare
  v_admin_id uuid;
  v_display_name text;
  v_email text;
  v_is_super_admin boolean;
  v_org_id uuid;
  v_org_name text;
  v_org_role text;
begin
  select id, display_name, email
  into v_admin_id, v_display_name, v_email
  from public.admin_users
  where auth_user_id = auth.uid()
    and is_active = true;

  if v_admin_id is null then
    return null;
  end if;

  select exists (
    select 1
    from public.platform_admin_roles
    where admin_user_id = v_admin_id
      and role = 'SUPER_ADMIN'
  )
  into v_is_super_admin;

  select o.id, o.name, om.role
  into v_org_id, v_org_name, v_org_role
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.admin_user_id = v_admin_id
    and om.is_active = true
    and om.role = 'ORGANIZER'
    and o.is_active = true
  order by om.created_at asc
  limit 1;

  return json_build_object(
    'id', v_admin_id,
    'display_name', v_display_name,
    'email', v_email,
    'is_super_admin', v_is_super_admin,
    'org_id', v_org_id,
    'org_name', v_org_name,
    'org_role', v_org_role
  );
end;
$$;

drop function if exists public.log_security_event(text, text, jsonb);