-- Migration: 20261113110000_add_event_search_tokens_and_indexing.sql
-- Description: Adds pre-computed search_tokens and search_index to public.events with automatic taxonomy & synonym enrichment

-- 1. Add columns to public.events
alter table public.events 
  add column if not exists search_tokens text[],
  add column if not exists search_index text;

-- 2. Build deterministic search index function with official taxonomy synonym expansion
create or replace function public.build_event_search_tokens(
  p_name text,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_organization_id uuid
) returns text[] as $$
declare
  v_cat record;
  v_sub record;
  v_org record;
  v_tokens text[] := array[]::text[];
  v_synonyms text[] := array[]::text[];
  v_clean_name text;
begin
  select name, key into v_cat from public.categories where id = p_category_id;
  select name, key into v_sub from public.subcategories where id = p_subcategory_id;
  select name into v_org from public.organizations where id = p_organization_id;

  -- Clean and tokenize name
  v_clean_name := lower(regexp_replace(coalesce(p_name, ''), '[^a-zA-Z0-9]+', ' ', 'g'));
  v_tokens := array_cat(v_tokens, string_to_array(trim(v_clean_name), ' '));

  -- Add category and subcategory terms
  if v_cat.name is not null then
    v_tokens := array_append(v_tokens, lower(v_cat.name));
    v_tokens := array_append(v_tokens, lower(v_cat.key));
  end if;

  if v_sub.name is not null then
    v_tokens := array_append(v_tokens, lower(v_sub.name));
    v_tokens := array_append(v_tokens, lower(v_sub.key));
  end if;

  if v_org.name is not null then
    v_tokens := array_append(v_tokens, lower(v_org.name));
  end if;

  -- Universal Taxonomy Synonyms Expansion
  if v_sub.key = 'dance' then
    v_synonyms := array['dance', 'nritya', 'choreography', 'bhangra', 'western', 'classical', 'hiphop', 'solo', 'gidda'];
  elsif v_sub.key = 'hackathon' then
    v_synonyms := array['hackathon', 'hackhaton', 'coding', 'developer', 'dsa', 'ideathon', 'programming', 'codefest'];
  elsif v_sub.key = 'technical-events' then
    v_synonyms := array['tech', 'robowar', 'robotics', 'circuit', 'drone', 'competitive', 'programming'];
  elsif v_sub.key = 'music' then
    v_synonyms := array['music', 'singing', 'vocal', 'band', 'acoustic', 'concert', 'choir'];
  elsif v_sub.key = 'theatre' then
    v_synonyms := array['theatre', 'nukkad', 'natak', 'drama', 'play', 'skit', 'acting', 'mime'];
  elsif v_sub.key = 'b-plan' then
    v_synonyms := array['business', 'plan', 'startup', 'pitch', 'venture', 'bplan'];
  elsif v_sub.key = 'donation-drives' then
    v_synonyms := array['blood', 'donation', 'charity', 'relief', 'fund'];
  elsif v_sub.key = 'school-cse' then
    v_synonyms := array['cse', 'computer', 'science', 'bca', 'mca', 'data', 'cloud'];
  elsif v_sub.key = 'school-law' then
    v_synonyms := array['law', 'moot', 'court', 'legal', 'debate', 'parliament'];
  elsif v_sub.key = 'shows' and v_cat.key = 'fashion' then
    v_synonyms := array['fashion', 'runway', 'ramp', 'modeling', 'couture'];
  elsif v_sub.key = 'parades' and v_cat.key = 'ncc' then
    v_synonyms := array['ncc', 'parade', 'drill', 'cadet', 'corps'];
  elsif v_sub.key = 'social-work' and v_cat.key = 'nss' then
    v_synonyms := array['nss', 'social', 'community', 'service', 'volunteering'];
  end if;

  -- Campus Acronyms
  if lower(coalesce(v_org.name, '')) like '%google developer%' then
    v_synonyms := array_cat(v_synonyms, array['gdsc', 'dsc']);
  elsif lower(coalesce(v_org.name, '')) like '%electrical and electronics%' then
    v_synonyms := array_cat(v_synonyms, array['ieee']);
  elsif lower(coalesce(v_org.name, '')) like '%oasis%' then
    v_synonyms := array_cat(v_synonyms, array['oasis', 'cultural', 'society']);
  end if;

  v_tokens := array_cat(v_tokens, v_synonyms);

  -- Deduplicate and filter min length >= 2
  select array_agg(distinct t) into v_tokens
  from unnest(v_tokens) as t
  where length(trim(t)) >= 2;

  return coalesce(v_tokens, array[]::text[]);
end;
$$ language plpgsql stable;

-- 3. Automatic Trigger on Event Upsert
create or replace function public.trg_events_search_index_sync()
returns trigger as $$
begin
  new.search_tokens := public.build_event_search_tokens(
    new.name,
    new.category_id,
    new.subcategory_id,
    new.organization_id
  );
  new.search_index := array_to_string(new.search_tokens, ' ');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_events_search_index_sync on public.events;
create trigger trg_events_search_index_sync
before insert or update of name, category_id, subcategory_id, organization_id
on public.events
for each row execute function public.trg_events_search_index_sync();

-- 4. Backfill existing events
update public.events e
set 
  search_tokens = public.build_event_search_tokens(e.name, e.category_id, e.subcategory_id, e.organization_id),
  search_index = array_to_string(public.build_event_search_tokens(e.name, e.category_id, e.subcategory_id, e.organization_id), ' ')
where e.deleted_at is null;
