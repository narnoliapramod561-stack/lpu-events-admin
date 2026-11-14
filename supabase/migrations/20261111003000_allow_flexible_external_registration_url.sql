-- Migration: Allow flexible external registration URLs in publish_event and edit_event
-- Description: Normalizes any user-entered link (e.g. forms.gle/xyz -> https://forms.gle/xyz)
-- and accepts all valid external links while strictly preventing malicious javascript:/data:/vbscript: injections.

CREATE OR REPLACE FUNCTION public.edit_event(p_event_id uuid, p_event_payload jsonb, p_content_sections jsonb DEFAULT NULL::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_admin_id uuid;
  v_existing record;
  v_org_id uuid;
  v_cat_id uuid;
  v_subcat_id uuid;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_reg_mode text;
  v_reg_url text;
  v_pricing_type text;
  v_price_amount numeric;
  v_banner_media_id uuid;
  v_item jsonb;
begin
  -- Resolve authenticated user
  if auth.uid() is null then
    return public.set_api_error(401, 'UNAUTHENTICATED', 'Administrative session required.');
  end if;

  select id into v_admin_id from public.admin_users where auth_user_id = auth.uid() and is_active = true;
  if v_admin_id is null then
    return public.set_api_error(403, 'UNAUTHORIZED', 'No active administrative profile found.');
  end if;

  -- Load existing event
  select * into v_existing from public.events where id = p_event_id;
  if v_existing.id is null then
    return public.set_api_error(404, 'EVENT_NOT_FOUND', 'The specified event could not be found.');
  end if;

  if v_existing.status = 'COMPLETED' then
    return public.set_api_error(400, 'EVENT_COMPLETED', 'Completed events cannot be modified.');
  end if;

  -- 1. Validate Organizer Authorization on Existing Event
  if not public.is_super_admin() then
    if not exists(
      select 1 from public.organization_members 
      where organization_id = v_existing.organization_id and admin_user_id = v_admin_id and role = 'ORGANIZER'
    ) then
      return public.set_api_error(403, 'INSUFFICIENT_ORGANIZATION_PERMISSIONS', 'You do not have active administrative permissions for this organization.');
    end if;
  end if;

  -- Extract payload fields
  v_org_id := coalesce((p_event_payload->>'organization_id')::uuid, v_existing.organization_id);
  v_cat_id := coalesce((p_event_payload->>'category_id')::uuid, v_existing.category_id);
  v_subcat_id := case when p_event_payload ? 'subcategory_id' then (p_event_payload->>'subcategory_id')::uuid else v_existing.subcategory_id end;
  v_start_at := coalesce((p_event_payload->>'start_at')::timestamptz, v_existing.start_at);
  v_end_at := coalesce((p_event_payload->>'end_at')::timestamptz, v_existing.end_at);
  v_reg_mode := coalesce(p_event_payload->>'registration_mode', v_existing.registration_mode::text);
  v_reg_url := case when p_event_payload ? 'external_registration_url' then p_event_payload->>'external_registration_url' else v_existing.external_registration_url end;
  v_pricing_type := coalesce(p_event_payload->>'pricing_type', v_existing.pricing_type::text);
  v_price_amount := case when p_event_payload ? 'price_amount' then (p_event_payload->>'price_amount')::numeric else v_existing.price_amount end;
  v_banner_media_id := case when p_event_payload ? 'banner_media_id' then (p_event_payload->>'banner_media_id')::uuid else v_existing.banner_media_id end;

  -- 1a. Validate Organization Reassignment Authorization (BOLA defense)
  if not public.is_super_admin() and v_org_id <> v_existing.organization_id then
    if not exists(
      select 1 from public.organization_members 
      where organization_id = v_org_id and admin_user_id = v_admin_id and role = 'ORGANIZER'
    ) then
      return public.set_api_error(403, 'INSUFFICIENT_ORGANIZATION_PERMISSIONS', 'You cannot reassign an event to an organization you do not administer.');
    end if;
  end if;

  -- 2. Validate Category-Subcategory Taxonomy
  if v_subcat_id is not null then
    if not exists(
      select 1 from public.subcategories 
      where id = v_subcat_id and category_id = v_cat_id
    ) then
      return public.set_api_error(400, 'TAXONOMY_MISMATCH', 'The selected subcategory does not belong to the parent category.');
    end if;
  end if;

  -- 3. Validate Date Boundaries
  if v_end_at <= v_start_at then
    return public.set_api_error(400, 'INVALID_TEMPORAL_BOUNDS', 'Event end time must occur after the start time.');
  end if;

  -- 4. Validate Registration Mode State
  if v_reg_mode = 'EXTERNAL' and (v_reg_url is null or length(trim(v_reg_url)) = 0) then
    return public.set_api_error(400, 'REGISTRATION_MODE_INVARIANT_VIOLATION', 'Registration URL must be provided if and only if mode is set to EXTERNAL.');
  end if;

  if v_reg_mode <> 'EXTERNAL' and v_reg_url is not null and length(trim(v_reg_url)) > 0 then
    return public.set_api_error(400, 'REGISTRATION_MODE_INVARIANT_VIOLATION', 'Registration URL must be provided if and only if mode is set to EXTERNAL.');
  end if;

  -- 4a. Normalize and validate URL Scheme — allow any external link, reject script schemes
  if v_reg_url is not null and length(trim(v_reg_url)) > 0 then
    v_reg_url := trim(v_reg_url);
    if v_reg_url !~* '^[a-zA-Z][a-zA-Z0-9+.-]*://' then
      v_reg_url := 'https://' || regexp_replace(v_reg_url, '^/+', '');
    end if;
    if v_reg_url ~* '^(javascript|data|vbscript):' then
      return public.set_api_error(400, 'INVALID_URL_FORMAT', 'Malicious or unsupported URL scheme detected.');
    end if;
  end if;

  -- 5. Validate Pricing
  if v_pricing_type = 'FREE' and v_price_amount is not null and v_price_amount > 0 then
    return public.set_api_error(400, 'PRICING_INVARIANT_VIOLATION', 'Free events cannot have a positive price amount.');
  end if;

  if v_pricing_type = 'PAID' and v_price_amount is not null and v_price_amount < 0 then
    return public.set_api_error(400, 'PRICING_INVARIANT_VIOLATION', 'Price amount cannot be negative.');
  end if;

  -- 6. Validate Media Reference (if provided)
  if v_banner_media_id is not null then
    if not exists(
      select 1 from public.media_assets 
      where id = v_banner_media_id and status = 'READY'
    ) then
      return public.set_api_error(400, 'MEDIA_NOT_READY', 'The selected banner media asset is not ready or does not exist.');
    end if;
  end if;

  -- Update Event record
  update public.events set
    organization_id = v_org_id,
    name = coalesce(p_event_payload->>'name', name),
    description = coalesce(p_event_payload->>'description', description),
    category_id = v_cat_id,
    subcategory_id = v_subcat_id,
    banner_media_id = v_banner_media_id,
    start_at = v_start_at,
    end_at = v_end_at,
    venue_name = coalesce(p_event_payload->>'venue_name', venue_name),
    registration_mode = (v_reg_mode)::public.registration_mode,
    external_registration_url = v_reg_url,
    pricing_type = (v_pricing_type)::public.event_pricing_type,
    registration_format = coalesce(p_event_payload->>'registration_format', registration_format),
    capacity_limit = case when p_event_payload ? 'capacity_limit' then (p_event_payload->>'capacity_limit')::integer else capacity_limit end,
    price_amount = coalesce(v_price_amount, 0),
    updated_by = v_admin_id,
    updated_at = now()
  where id = p_event_id;

  -- Replace Content Sections if provided
  if p_content_sections is not null and jsonb_typeof(p_content_sections) = 'array' then
    delete from public.event_content_sections where event_id = p_event_id;
    for v_item in select * from jsonb_array_elements(p_content_sections) loop
      insert into public.event_content_sections (
        event_id,
        section_type,
        title,
        content,
        sort_order
      ) values (
        p_event_id,
        v_item->>'section_type',
        v_item->>'title',
        coalesce(v_item->'content', to_jsonb(v_item->>'content'), '""'::jsonb),
        (v_item->>'sort_order')::integer
      );
    end loop;
  end if;

  -- Insert transactional audit log
  insert into public.audit_logs (
    actor_admin_id,
    actor_role,
    action,
    target_type,
    target_id,
    reason,
    before_data,
    after_data
  ) values (
    v_admin_id,
    coalesce((select role::text from public.platform_admin_roles where admin_user_id = v_admin_id), 'ORGANIZER'),
    'EVENT_UPDATE',
    'event',
    p_event_id,
    'Event updated directly',
    jsonb_build_object('name', v_existing.name, 'organization_id', v_existing.organization_id),
    jsonb_build_object('name', coalesce(p_event_payload->>'name', v_existing.name), 'organization_id', v_org_id)
  );

  return json_build_object('status', 'success', 'event_id', p_event_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_event(p_event_payload jsonb, p_content_sections jsonb DEFAULT '[]'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_admin_id uuid;
  v_org_id uuid;
  v_cat_id uuid;
  v_subcat_id uuid;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_reg_mode text;
  v_reg_url text;
  v_pricing_type text;
  v_price_amount numeric;
  v_banner_media_id uuid;
  v_event_id uuid;
  v_item jsonb;
begin
  -- Resolve authenticated user
  if auth.uid() is null then
    return public.set_api_error(401, 'UNAUTHENTICATED', 'Administrative session required.');
  end if;

  select id into v_admin_id from public.admin_users where auth_user_id = auth.uid() and is_active = true;
  if v_admin_id is null then
    return public.set_api_error(403, 'UNAUTHORIZED', 'No active administrative profile found.');
  end if;

  -- Extract payload fields
  v_org_id := (p_event_payload->>'organization_id')::uuid;
  v_cat_id := (p_event_payload->>'category_id')::uuid;
  v_subcat_id := (p_event_payload->>'subcategory_id')::uuid;
  v_start_at := (p_event_payload->>'start_at')::timestamptz;
  v_end_at := (p_event_payload->>'end_at')::timestamptz;
  v_reg_mode := p_event_payload->>'registration_mode';
  v_reg_url := p_event_payload->>'external_registration_url';
  v_pricing_type := p_event_payload->>'pricing_type';
  v_price_amount := (p_event_payload->>'price_amount')::numeric;
  v_banner_media_id := (p_event_payload->>'banner_media_id')::uuid;

  -- 1. Validate Organizer Authorization
  if not public.is_super_admin() then
    if not exists(
      select 1 from public.organization_members 
      where organization_id = v_org_id and admin_user_id = v_admin_id and role = 'ORGANIZER'
    ) then
      return public.set_api_error(403, 'INSUFFICIENT_ORGANIZATION_PERMISSIONS', 'You do not have active administrative permissions for this organization.', jsonb_build_object('organization_id', v_org_id));
    end if;
  end if;

  -- 1a. Concurrency: Prevent duplicate publish requests (same name, org, and start time)
  if exists (
    select 1 from public.events
    where organization_id = v_org_id 
      and lower(trim(name)) = lower(trim(p_event_payload->>'name'))
      and start_at = v_start_at
  ) then
    return public.set_api_error(409, 'DUPLICATE_EVENT', 'An event with this name, organization, and start time is already published.');
  end if;

  -- 2. Validate Category-Subcategory Taxonomy
  if v_subcat_id is not null then
    if not exists(
      select 1 from public.subcategories 
      where id = v_subcat_id and category_id = v_cat_id
    ) then
      return public.set_api_error(400, 'TAXONOMY_MISMATCH', 'The selected subcategory does not belong to the parent category.', jsonb_build_object('category_id', v_cat_id, 'subcategory_id', v_subcat_id));
    end if;
  end if;

  -- 3. Validate Date Boundaries
  if v_end_at <= v_start_at then
    return public.set_api_error(400, 'INVALID_TEMPORAL_BOUNDS', 'Event end time must occur after the start time.', jsonb_build_object('start_at', v_start_at, 'end_at', v_end_at));
  end if;

  -- 4. Validate Registration Mode State
  if v_reg_mode = 'EXTERNAL' and (v_reg_url is null or length(trim(v_reg_url)) = 0) then
    return public.set_api_error(400, 'REGISTRATION_MODE_INVARIANT_VIOLATION', 'Registration URL must be provided if and only if mode is set to EXTERNAL.');
  end if;

  if v_reg_mode <> 'EXTERNAL' and v_reg_url is not null and length(trim(v_reg_url)) > 0 then
    return public.set_api_error(400, 'REGISTRATION_MODE_INVARIANT_VIOLATION', 'Registration URL must be provided if and only if mode is set to EXTERNAL.');
  end if;

  -- 4a. Normalize and validate URL Scheme — allow any external link, reject script schemes
  if v_reg_url is not null and length(trim(v_reg_url)) > 0 then
    v_reg_url := trim(v_reg_url);
    if v_reg_url !~* '^[a-zA-Z][a-zA-Z0-9+.-]*://' then
      v_reg_url := 'https://' || regexp_replace(v_reg_url, '^/+', '');
    end if;
    if v_reg_url ~* '^(javascript|data|vbscript):' then
      return public.set_api_error(400, 'INVALID_URL_FORMAT', 'Malicious or unsupported URL scheme detected.');
    end if;
  end if;

  -- 5. Validate Pricing
  if v_pricing_type = 'FREE' and v_price_amount is not null and v_price_amount > 0 then
    return public.set_api_error(400, 'PRICING_INVARIANT_VIOLATION', 'Free events cannot have a positive price amount.');
  end if;

  if v_pricing_type = 'PAID' and v_price_amount is not null and v_price_amount < 0 then
    return public.set_api_error(400, 'PRICING_INVARIANT_VIOLATION', 'Price amount cannot be negative.');
  end if;

  -- 6. Validate Media Reference (if provided)
  if v_banner_media_id is not null then
    if not exists(
      select 1 from public.media_assets 
      where id = v_banner_media_id and status = 'READY'
    ) then
      return public.set_api_error(400, 'MEDIA_NOT_READY', 'The selected banner media asset is not ready or does not exist.');
    end if;
  end if;

  -- Generate random event ID
  v_event_id := gen_random_uuid();

  -- Insert Event record (simplified columns)
  insert into public.events (
    id,
    organization_id,
    name,
    description,
    category_id,
    subcategory_id,
    banner_media_id,
    start_at,
    end_at,
    venue_name,
    registration_mode,
    external_registration_url,
    pricing_type,
    registration_format,
    capacity_limit,
    price_amount,
    status,
    created_by,
    updated_by
  ) values (
    v_event_id,
    v_org_id,
    p_event_payload->>'name',
    p_event_payload->>'description',
    v_cat_id,
    v_subcat_id,
    v_banner_media_id,
    v_start_at,
    v_end_at,
    p_event_payload->>'venue_name',
    (p_event_payload->>'registration_mode')::public.registration_mode,
    v_reg_url,
    (v_pricing_type)::public.event_pricing_type,
    coalesce(p_event_payload->>'registration_format', 'INDIVIDUAL'),
    (p_event_payload->>'capacity_limit')::integer,
    coalesce(v_price_amount, 0),
    'PUBLISHED',
    v_admin_id,
    v_admin_id
  );

  -- Insert Content Sections
  if p_content_sections is not null and jsonb_typeof(p_content_sections) = 'array' then
    for v_item in select * from jsonb_array_elements(p_content_sections) loop
      insert into public.event_content_sections (
        event_id,
        section_type,
        title,
        content,
        sort_order
      ) values (
        v_event_id,
        v_item->>'section_type',
        v_item->>'title',
        coalesce(v_item->'content', to_jsonb(v_item->>'content'), '""'::jsonb),
        (v_item->>'sort_order')::integer
      );
    end loop;
  end if;

  -- Insert transactional audit log
  insert into public.audit_logs (
    actor_admin_id,
    actor_role,
    action,
    target_type,
    target_id,
    reason,
    before_data,
    after_data
  ) values (
    v_admin_id,
    coalesce((select role::text from public.platform_admin_roles where admin_user_id = v_admin_id), 'ORGANIZER'),
    'EVENT_CREATE',
    'event',
    v_event_id,
    'Event published directly',
    null,
    jsonb_build_object('name', p_event_payload->>'name')
  );

  return json_build_object(
    'status', 'success',
    'event_id', v_event_id
  );
end;
$function$;
