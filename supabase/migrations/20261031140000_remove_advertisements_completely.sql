-- Migration: Remove advertisements system completely
-- Date: 2026-10-31

-- 1. Drop advertisement_positions table
DROP TABLE IF EXISTS public.advertisement_positions CASCADE;

-- 2. Drop advertisement_id constraint and column from carousel_items
ALTER TABLE public.carousel_items DROP CONSTRAINT IF EXISTS carousel_items_advertisement_id_fkey;
ALTER TABLE public.carousel_items DROP COLUMN IF EXISTS advertisement_id CASCADE;

-- 3. Drop advertisements table
DROP TABLE IF EXISTS public.advertisements CASCADE;

-- 4. Drop obsolete advertisement functions
DROP FUNCTION IF EXISTS public.manage_advertisement CASCADE;
DROP FUNCTION IF EXISTS public.track_advertisement_interaction CASCADE;

-- 5. Delete ad-related keys from global_settings
DELETE FROM public.global_settings WHERE key IN ('ad_system_config', 'ad_placement_interval');

-- 6. Update get_homepage_bundle to remove advertisements queries
CREATE OR REPLACE FUNCTION public.get_homepage_bundle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_now timestamptz := now();
  v_categories jsonb;
  v_carousel jsonb;
  v_featured jsonb;
  v_trending jsonb;
  v_settings jsonb;
  v_events jsonb;
begin
  -- Categories
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'key', c.key,
      'name', c.name,
      'sort_order', c.sort_order,
      'subcategories', coalesce(sub.items, '[]'::jsonb)
    ) order by c.sort_order asc
  ), '[]'::jsonb)
  into v_categories
  from public.categories c
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'key', s.key,
        'name', s.name,
        'sort_order', s.sort_order
      ) order by s.sort_order asc
    ) as items
    from public.subcategories s
    where s.category_id = c.id and s.is_active = true
  ) sub on true
  where c.is_active = true;

  -- Carousel Items
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ci.id,
      'item_type', ci.item_type,
      'event_id', ci.event_id,
      'media_id', ci.media_id,
      'sort_order', ci.sort_order,
      'is_active', ci.is_active,
      'start_at', ci.start_at,
      'end_at', ci.end_at,
      'display_duration_ms', ci.display_duration_ms,
      'custom_title', ci.custom_title,
      'custom_subtitle', ci.custom_subtitle,
      'custom_cta_text', ci.custom_cta_text,
      'custom_cta_url', ci.custom_cta_url,
      'badge_text', ci.badge_text,
      'events', case when e.id is not null then jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'description', e.description,
        'start_at', e.start_at,
        'end_at', e.end_at,
        'venue_name', e.venue_name,
        'registration_mode', e.registration_mode,
        'pricing_type', e.pricing_type,
        'banner_media_id', e.banner_media_id,
        'status', e.status,
        'category_id', e.category_id,
        'subcategory_id', e.subcategory_id,
        'media_assets', case when m.id is not null then jsonb_build_object('id', m.id, 'object_key', m.object_key) else null end,
        'organizations', jsonb_build_object('name', o.name),
        'categories', jsonb_build_object('name', cat.name, 'key', cat.key),
        'subcategories', case when scat.id is not null then jsonb_build_object('name', scat.name, 'key', scat.key) else null end
      ) else null end,
      'media_assets', case when cm.id is not null then jsonb_build_object('id', cm.id, 'object_key', cm.object_key) else null end
    ) order by ci.sort_order asc
  ), '[]'::jsonb)
  into v_carousel
  from public.carousel_items ci
  left join public.events e on ci.event_id = e.id
  left join public.organizations o on e.organization_id = o.id
  left join public.categories cat on e.category_id = cat.id
  left join public.subcategories scat on e.subcategory_id = scat.id
  left join public.media_assets m on e.banner_media_id = m.id
  left join public.media_assets cm on ci.media_id = cm.id
  where ci.is_active = true
    and (ci.start_at is null or ci.start_at <= v_now)
    and (ci.end_at is null or ci.end_at >= v_now)
    and (ci.item_type != 'EVENT' or (e.status = 'PUBLISHED' and e.end_at >= v_now and e.deleted_at is null))
  limit 8;

  -- Featured Events
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'event_id', fe.event_id,
      'sort_order', fe.sort_order,
      'events', jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'description', e.description,
        'start_at', e.start_at,
        'end_at', e.end_at,
        'venue_name', e.venue_name,
        'registration_mode', e.registration_mode,
        'pricing_type', e.pricing_type,
        'price_amount', e.price_amount,
        'external_registration_url', e.external_registration_url,
        'banner_media_id', e.banner_media_id,
        'status', e.status,
        'category_id', e.category_id,
        'subcategory_id', e.subcategory_id,
        'media_assets', case when m.id is not null then jsonb_build_object('id', m.id, 'object_key', m.object_key) else null end,
        'organizations', jsonb_build_object('id', o.id, 'name', o.name)
      )
    ) order by fe.sort_order asc
  ), '[]'::jsonb)
  into v_featured
  from public.featured_events fe
  join public.events e on fe.event_id = e.id
  join public.organizations o on e.organization_id = o.id
  left join public.media_assets m on e.banner_media_id = m.id
  where e.status = 'PUBLISHED' and e.end_at >= v_now and e.deleted_at is null
  limit 10;

  -- Trending Events
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'event_id', te.event_id,
      'sort_order', te.sort_order,
      'events', jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'description', e.description,
        'start_at', e.start_at,
        'end_at', e.end_at,
        'venue_name', e.venue_name,
        'registration_mode', e.registration_mode,
        'pricing_type', e.pricing_type,
        'price_amount', e.price_amount,
        'external_registration_url', e.external_registration_url,
        'banner_media_id', e.banner_media_id,
        'status', e.status,
        'category_id', e.category_id,
        'subcategory_id', e.subcategory_id,
        'media_assets', case when m.id is not null then jsonb_build_object('id', m.id, 'object_key', m.object_key) else null end,
        'organizations', jsonb_build_object('id', o.id, 'name', o.name),
        'categories', jsonb_build_object('name', cat.name, 'key', cat.key),
        'subcategories', case when scat.id is not null then jsonb_build_object('name', scat.name, 'key', scat.key) else null end
      )
    ) order by te.sort_order asc
  ), '[]'::jsonb)
  into v_trending
  from public.trending_events te
  join public.events e on te.event_id = e.id
  join public.organizations o on e.organization_id = o.id
  left join public.categories cat on e.category_id = cat.id
  left join public.subcategories scat on e.subcategory_id = scat.id
  left join public.media_assets m on e.banner_media_id = m.id
  where e.status = 'PUBLISHED' and e.end_at >= v_now and e.deleted_at is null
  limit 10;

  -- Global Settings
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'key', gs.key,
      'value', gs.value
    )
  ), '[]'::jsonb)
  into v_settings
  from public.global_settings gs;

  -- Live Events
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'name', e.name,
      'description', e.description,
      'start_at', e.start_at,
      'end_at', e.end_at,
      'venue_name', e.venue_name,
      'registration_mode', e.registration_mode,
      'pricing_type', e.pricing_type,
      'price_amount', e.price_amount,
      'external_registration_url', e.external_registration_url,
      'registration_format', e.registration_format,
      'banner_media_id', e.banner_media_id,
      'status', e.status,
      'category_id', e.category_id,
      'subcategory_id', e.subcategory_id,
      'media_assets', case when m.id is not null then jsonb_build_object('id', m.id, 'object_key', m.object_key) else null end,
      'organizations', jsonb_build_object('id', o.id, 'name', o.name),
      'categories', jsonb_build_object('name', cat.name, 'key', cat.key),
      'subcategories', case when scat.id is not null then jsonb_build_object('name', scat.name, 'key', scat.key) else null end
    ) order by e.start_at asc
  ), '[]'::jsonb)
  into v_events
  from (
    select * from public.events
    where status = 'PUBLISHED' and end_at >= v_now and deleted_at is null
    order by start_at asc
    limit 9
  ) e
  join public.organizations o on e.organization_id = o.id
  left join public.categories cat on e.category_id = cat.id
  left join public.subcategories scat on e.subcategory_id = scat.id
  left join public.media_assets m on e.banner_media_id = m.id;

  return jsonb_build_object(
    'categories', v_categories,
    'carousel', v_carousel,
    'featured', v_featured,
    'trending', v_trending,
    'advertisements', '[]'::jsonb,
    'settings', v_settings,
    'events', v_events
  );
end;
$$;
