-- ==============================================================================
-- Migration: 20261113000000_harden_global_settings_rls.sql
-- Description: Harden global_settings Row Level Security against unauthenticated key enumeration
--
-- Defense:
--   1. Replaces permissive `for select using (true)` on public.global_settings with
--      an explicit whitelist of public-safe setting keys.
--   2. Prevents anonymous REST callers from harvesting admin UUIDs or internal system keys.
-- ==============================================================================

drop policy if exists global_settings_public_select on public.global_settings;

create policy global_settings_public_select on public.global_settings
  for select using (
    key in (
      'site_notice_banner',
      'platform_maintenance_mode',
      'max_featured_events',
      'max_trending_events',
      'happening_today_config',
      'contact_messages_config'
    )
  );

