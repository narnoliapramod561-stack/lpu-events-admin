-- Migration: 20261119000001_auto_enqueue_snapshot_publication.sql
-- Description: Automatically enqueues snapshot publication on substantive mutations to public content tables

create or replace function public.trg_auto_enqueue_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.enqueue_snapshot_publication('MUTATION');
  return coalesce(new, old);
end;
$$;

-- Register statement-level triggers to avoid per-row overhead on batch operations
drop trigger if exists trg_auto_enqueue_snapshot_events on public.events;
create trigger trg_auto_enqueue_snapshot_events
  after insert or update or delete on public.events
  for each statement execute function public.trg_auto_enqueue_snapshot();

drop trigger if exists trg_auto_enqueue_snapshot_categories on public.categories;
create trigger trg_auto_enqueue_snapshot_categories
  after insert or update or delete on public.categories
  for each statement execute function public.trg_auto_enqueue_snapshot();

drop trigger if exists trg_auto_enqueue_snapshot_carousel on public.carousel_items;
create trigger trg_auto_enqueue_snapshot_carousel
  after insert or update or delete on public.carousel_items
  for each statement execute function public.trg_auto_enqueue_snapshot();

drop trigger if exists trg_auto_enqueue_snapshot_featured on public.featured_events;
create trigger trg_auto_enqueue_snapshot_featured
  after insert or update or delete on public.featured_events
  for each statement execute function public.trg_auto_enqueue_snapshot();

drop trigger if exists trg_auto_enqueue_snapshot_ads on public.advertisements;
create trigger trg_auto_enqueue_snapshot_ads
  after insert or update or delete on public.advertisements
  for each statement execute function public.trg_auto_enqueue_snapshot();
