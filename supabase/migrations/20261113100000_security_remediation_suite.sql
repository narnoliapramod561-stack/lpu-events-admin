-- ==============================================================================
-- Migration: 20261113100000_security_remediation_suite.sql
-- Description: Comprehensive Security Remediation Suite
-- Fixes:
--   1. SEC-03: Close self-registration storage takeover. Default is_active = false for
--      non-preapproved accounts.
--   2. SEC-03: Restrict storage.objects permissions to verified organizers & SuperAdmins.
--   3. SEC-04: Column-level protection trigger on public.admin_users.
--   4. SEC-04: Restrict organization updates so organizers cannot alter is_active.
--   5. SEC-06: Strip image/svg+xml from media storage bucket allowed mime types.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEC-03: Harden handle_new_auth_user() trigger
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid;
  v_clean_email text;
  v_is_super_admin boolean;
  v_is_pre_approved boolean;
  v_initial_active boolean;
  v_pre_app record;
begin
  v_clean_email := lower(trim(new.email));
  v_is_super_admin := (v_clean_email = 'subhamkumar86032@gmail.com');
  
  select exists (
    select 1 from public.pre_approved_organizers
    where lower(trim(email)) = v_clean_email
  ) into v_is_pre_approved;

  -- Only pre-approved organizers and the bootstrapped Super Admin start as active
  v_initial_active := (v_is_super_admin or v_is_pre_approved);

  insert into public.admin_users (auth_user_id, display_name, email, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(v_clean_email, '@', 1)),
    v_clean_email,
    v_initial_active
  )
  on conflict (auth_user_id) do update set email = excluded.email
  returning id into v_admin_id;

  if v_admin_id is null then
    select id into v_admin_id from public.admin_users where auth_user_id = new.id;
  end if;

  -- Bootstrap Super Admin role
  if v_is_super_admin then
    insert into public.platform_admin_roles (admin_user_id, role)
    values (v_admin_id, 'SUPER_ADMIN')
    on conflict (admin_user_id) do nothing;
  end if;

  -- Auto-link pre-approved organizers
  if v_is_pre_approved then
    for v_pre_app in 
      select organization_id, organization_name 
      from public.pre_approved_organizers 
      where lower(trim(email)) = v_clean_email
    loop
      insert into public.organization_members (organization_id, admin_user_id, role, is_active)
      values (v_pre_app.organization_id, v_admin_id, 'ORGANIZER', true)
      on conflict (organization_id, admin_user_id) do update
      set role = 'ORGANIZER', is_active = true;

      insert into public.organizer_access_requests (admin_user_id, organization_name, status, review_reason)
      values (v_admin_id, v_pre_app.organization_name, 'APPROVED', 'Pre-approved manually by Super Administrator')
      on conflict do nothing;
    end loop;
  end if;

  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Allow unapproved users to view their own admin_users record (for access request UI)
-- ------------------------------------------------------------------------------
drop policy if exists admin_users_self_select on public.admin_users;
create policy admin_users_self_select on public.admin_users
  for select using (auth_user_id = auth.uid());

-- Update review_access_request to activate the admin_user upon approval
create or replace function public.review_access_request(
  request_id uuid,
  action_status text,
  reason text default null
)
returns json security definer
set search_path = pg_catalog, public
as $$
declare
  v_sa_id uuid;
  v_req_status public.access_request_status;
  v_admin_id uuid;
  v_org_name text;
  v_org_id uuid;
begin
  if auth.uid() is null or not public.is_super_admin() then
    return json_build_object('error', 'You do not have active administrative permissions for this action.');
  end if;

  select id into v_sa_id from public.admin_users where auth_user_id = auth.uid() limit 1;

  if upper(action_status) not in ('APPROVED', 'REJECTED') then
    return json_build_object('error', 'Action status must be APPROVED or REJECTED.');
  end if;

  select status, admin_user_id, organization_name
  into v_req_status, v_admin_id, v_org_name
  from public.organizer_access_requests
  where id = request_id
  for update;

  if v_req_status is null then
    return json_build_object('error', 'Access request not found.');
  end if;

  if v_req_status <> 'PENDING' then
    return json_build_object('error', 'Access request is already processed.');
  end if;

  if upper(action_status) = 'APPROVED' then
    -- Activate administrative account
    update public.admin_users
    set is_active = true, updated_at = now()
    where id = v_admin_id;

    -- Find or create organization
    select id into v_org_id 
    from public.organizations 
    where lower(trim(name)) = lower(trim(v_org_name)) 
    limit 1;

    if v_org_id is null then
      insert into public.organizations (name, is_active)
      values (trim(v_org_name), true)
      returning id into v_org_id;
    else
      update public.organizations set is_active = true where id = v_org_id;
    end if;

    -- Link admin user to organization
    insert into public.organization_members (organization_id, admin_user_id, role, is_active)
    values (v_org_id, v_admin_id, 'ORGANIZER', true)
    on conflict (organization_id, admin_user_id) do update
    set role = 'ORGANIZER', is_active = true;

    -- Update request status
    update public.organizer_access_requests
    set status = 'APPROVED',
        reviewed_by = v_sa_id,
        reviewed_at = now(),
        review_reason = coalesce(nullif(trim(reason), ''), 'Approved by Super Administrator')
    where id = request_id;

    return json_build_object('status', 'success', 'message', 'Access request approved successfully.');
  else
    -- Reject
    update public.organizer_access_requests
    set status = 'REJECTED',
        reviewed_by = v_sa_id,
        reviewed_at = now(),
        review_reason = coalesce(nullif(trim(reason), ''), 'Declined by Super Administrator')
    where id = request_id;

    return json_build_object('status', 'success', 'message', 'Access request rejected.');
  end if;
end;
$$ language plpgsql;

-- ------------------------------------------------------------------------------
-- 3. SEC-03 & SEC-06: Storage Bucket Policies Hardening
-- ------------------------------------------------------------------------------
-- Disallow SVG uploads in the public media bucket to prevent Stored XSS
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']
where id = 'media';

-- Replace open storage policies: Only SuperAdmins or active members of active organizations can upload/update/delete media
drop policy if exists "Authenticated Admin Media Upload" on storage.objects;
create policy "Authenticated Admin Media Upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.organization_members om
        join public.admin_users au on om.admin_user_id = au.id
        where au.auth_user_id = auth.uid()
          and au.is_active = true
          and om.is_active = true
      )
    )
  );

drop policy if exists "Authenticated Admin Media Update" on storage.objects;
create policy "Authenticated Admin Media Update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.organization_members om
        join public.admin_users au on om.admin_user_id = au.id
        where au.auth_user_id = auth.uid()
          and au.is_active = true
          and om.is_active = true
      )
    )
  );

drop policy if exists "Authenticated Admin Media Delete" on storage.objects;
create policy "Authenticated Admin Media Delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.organization_members om
        join public.admin_users au on om.admin_user_id = au.id
        where au.auth_user_id = auth.uid()
          and au.is_active = true
          and om.is_active = true
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 4. SEC-04: Column-Level Protection on public.admin_users
-- ------------------------------------------------------------------------------
create or replace function public.protect_admin_user_columns()
returns trigger
security definer
set search_path = pg_catalog, public
language plpgsql as $$
begin
  -- If not a superadmin, prohibit changing auth_user_id, email, or is_active
  if not public.is_super_admin() then
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'Security Violation: Modifying auth_user_id is strictly prohibited.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Security Violation: Modifying email address directly is strictly prohibited.';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Security Violation: Self-activation or deactivation is strictly prohibited.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_admin_user_columns on public.admin_users;
create trigger trg_protect_admin_user_columns
before update on public.admin_users
for each row execute function public.protect_admin_user_columns();

-- ------------------------------------------------------------------------------
-- 5. SEC-04: Column-Level Protection on public.organizations
-- ------------------------------------------------------------------------------
create or replace function public.protect_organization_columns()
returns trigger
security definer
set search_path = pg_catalog, public
language plpgsql as $$
begin
  -- Organizers can only update aesthetic fields (name, logo_media_id); cannot deactivate organization
  if not public.is_super_admin() then
    if new.is_active is distinct from old.is_active then
      raise exception 'Security Violation: Only Super Administrators can alter organization active status.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_organization_columns on public.organizations;
create trigger trg_protect_organization_columns
before update on public.organizations
for each row execute function public.protect_organization_columns();

