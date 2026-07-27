import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getCategoryBySlug } from '@/lib/db/categories';

export interface EventSummary {
  id: string;
  slug: string;
  status: EventStatus;
  title: string;
  shortDescription: string;
  description: string;
  bannerUrl: string | null;
  startDate: string;
  endDate: string;
  registrationEndAt: string;
  venueName: string;
  isFeatured: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
    iconName: string;
  } | null;
  organizer: {
    name: string;
    slug: string;
  } | null;
  minPrice: number | null;
  hasAvailableTickets: boolean;
}

export type EventStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'ongoing'
  | 'completed'
  | 'cancelled'
  | 'archived';

export interface EventDetail extends EventSummary {
  registrationStartAt: string;
  venueAddress: string | null;
  venueBuilding: string | null;
  venueRoom: string | null;
  maxCapacity: number | null;
  terms: string | null;
  instructions: string | null;
  tags: string[];
  faqs: Array<{
    question: string;
    answer: string;
    displayOrder: number;
  }>;
  gallery: Array<{
    url: string;
    displayOrder: number;
  }>;
  documents: Array<{
    name: string;
    url: string;
    fileType: string;
  }>;
  ticketTiers: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    stockAvailable: number;
    maxPerUser: number;
    saleEnd: string | null;
  }>;
}

type TicketTierRow = {
  id?: string;
  name?: string;
  description?: string | null;
  price?: number | string;
  stock_available?: number;
  max_per_user?: number;
  sale_end_at?: string | null;
};

type EventRow = {
  id: string;
  slug: string;
  status: EventStatus;
  title: string;
  short_description: string;
  description: string;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string;
  registration_opens_at: string;
  registration_closes_at: string;
  venue: string;
  is_featured?: boolean;
  venue_address?: string | null;
  venue_building?: string | null;
  venue_room?: string | null;
  max_capacity?: number | null;
  terms_and_conditions?: string | null;
  instructions?: string | null;
  category?:
    | {
        id: string;
        name: string;
        slug: string;
        icon_name: string;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        icon_name: string;
      }>
    | null;
  organizer?:
    | {
        name: string;
        slug: string;
      }
    | Array<{
        name: string;
        slug: string;
      }>
    | null;
  ticket_types?: TicketTierRow[] | null;
  event_tags_mapping?: Array<{ tag: { name: string } | Array<{ name: string }> | null }> | null;
  event_faqs?: Array<{
    question: string;
    answer: string;
    display_order: number;
  }> | null;
  event_gallery?: Array<{
    image_url: string;
    display_order: number;
  }> | null;
  event_documents?: Array<{
    title: string;
    file_url: string;
    file_type: string;
  }> | null;
};

const EVENT_SUMMARY_SELECT = `
  id,
  slug,
  status,
  title,
  short_description,
  description,
  cover_image_url,
  starts_at,
  ends_at,
  registration_opens_at,
  registration_closes_at,
  venue,
  is_featured,
  category:categories!events_category_id_fkey(id, name, slug, icon_name),
  organizer:organizers!events_organizer_id_fkey(name, slug),
  ticket_types(price, stock_available, sale_end_at)
`;

const PUBLIC_EVENT_STATUSES: EventStatus[] = ['published', 'ongoing', 'completed', 'cancelled'];

function toNumber(value: number | string | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null;
  }
  return value;
}

function normalizeSummary(row: EventRow): EventSummary {
  const ticketTiers = row.ticket_types ?? [];
  const activeTiers = ticketTiers.filter((tier) => {
    if (!tier.sale_end_at) {
      return true;
    }

    return new Date(tier.sale_end_at).getTime() >= Date.now();
  });
  const priceCandidates = activeTiers
    .map((tier) => toNumber(tier.price))
    .filter((price) => price >= 0);
  const availableCounts = activeTiers.map((tier) => tier.stock_available ?? 0);

  const category = getSingleRelation(row.category);
  const organizer = getSingleRelation(row.organizer);

  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: row.title,
    shortDescription: row.short_description,
    description: row.description,
    bannerUrl: row.cover_image_url,
    startDate: row.starts_at,
    endDate: row.ends_at,
    registrationEndAt: row.registration_closes_at,
    venueName: row.venue,
    isFeatured: row.is_featured ?? false,
    category: category
      ? {
          id: category.id,
          name: category.name,
          slug: category.slug,
          iconName: category.icon_name,
        }
      : null,
    organizer: organizer
      ? {
          name: organizer.name,
          slug: organizer.slug,
        }
      : null,
    minPrice: priceCandidates.length > 0 ? Math.min(...priceCandidates) : null,
    hasAvailableTickets: availableCounts.some((count) => count > 0),
  };
}

export async function getFeaturedEvents(): Promise<EventSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SUMMARY_SELECT)
    .eq('status', 'published')
    .eq('is_featured', true)
    .order('starts_at', { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(`getFeaturedEvents: ${error.message}`);
  }

  return (data ?? []).map(normalizeSummary);
}

export async function getTodayEvents(): Promise<EventSummary[]> {
  const supabase = await createClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SUMMARY_SELECT)
    .eq('status', 'published')
    .gte('starts_at', start.toISOString())
    .lte('starts_at', end.toISOString())
    .order('starts_at', { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`getTodayEvents: ${error.message}`);
  }

  return (data ?? []).map(normalizeSummary);
}

export async function getEvents(options: {
  categorySlug?: string;
  page?: number;
  pageSize?: number;
  query?: string;
}): Promise<{ events: EventSummary[]; total: number }> {
  const { categorySlug, page = 1, pageSize = 6, query } = options;
  const supabase = await createClient();
  const limit = page * pageSize;

  let categoryId: string | null = null;

  if (categorySlug && categorySlug !== 'all') {
    const category = await getCategoryBySlug(categorySlug);
    categoryId = category?.id ?? null;
  }

  if (categorySlug && categorySlug !== 'all' && !categoryId) {
    return { events: [], total: 0 };
  }

  let qb = supabase
    .from('events')
    .select(EVENT_SUMMARY_SELECT, { count: 'exact' })
    .eq('status', 'published')
    .order('starts_at', { ascending: true })
    .range(0, limit - 1);

  if (categoryId) {
    qb = qb.eq('category_id', categoryId);
  }

  if (query) {
    qb = qb.or(`title.ilike.%${query}%,short_description.ilike.%${query}%`);
  }

  const { data, error, count } = await qb;

  if (error) {
    throw new Error(`getEvents: ${error.message}`);
  }

  return {
    events: (data ?? []).map(normalizeSummary),
    total: count ?? 0,
  };
}

export async function getEventBySlug(slug: string): Promise<EventDetail | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('events')
    .select(
      `
      id,
      slug,
      status,
      title,
      short_description,
      description,
      cover_image_url,
      starts_at,
      ends_at,
      registration_opens_at,
      registration_closes_at,
      venue,
      venue_address,
      venue_building,
      venue_room,
      max_capacity,
      terms_and_conditions,
      instructions,
      category:categories!events_category_id_fkey(id, name, slug, icon_name),
      organizer:organizers!events_organizer_id_fkey(name, slug),
      event_tags_mapping(tag:event_tags(name)),
      event_faqs(question, answer, display_order),
      event_gallery(image_url, display_order),
      event_documents(title, file_url, file_type),
      ticket_types(id, name, description, price, stock_available, max_per_user, sale_end_at)
    `
    )
    .eq('slug', slug)
    .in('status', PUBLIC_EVENT_STATUSES)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`getEventBySlug: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const summary = normalizeSummary(data);

  return {
    ...summary,
    registrationStartAt: data.registration_opens_at,
    venueAddress: data.venue_address ?? null,
    venueBuilding: data.venue_building ?? null,
    venueRoom: data.venue_room ?? null,
    maxCapacity: data.max_capacity ?? null,
    terms: data.terms_and_conditions ?? null,
    instructions: data.instructions ?? null,
    tags: (data.event_tags_mapping ?? [])
      .map((entry) => getSingleRelation(entry.tag)?.name)
      .filter((tag): tag is string => Boolean(tag)),
    faqs: (data.event_faqs ?? [])
      .slice()
      .sort((left, right) => left.display_order - right.display_order)
      .map((faq) => ({
        question: faq.question,
        answer: faq.answer,
        displayOrder: faq.display_order,
      })),
    gallery: (data.event_gallery ?? [])
      .slice()
      .sort((left, right) => left.display_order - right.display_order)
      .map((item) => ({
        url: item.image_url,
        displayOrder: item.display_order,
      })),
    documents: (data.event_documents ?? []).map((doc) => ({
      name: doc.title,
      url: doc.file_url,
      fileType: doc.file_type,
    })),
    ticketTiers: (data.ticket_types ?? [])
      .slice()
      .sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''))
      .map((tier) => ({
        id: tier.id ?? '',
        name: tier.name ?? 'Ticket',
        description: tier.description ?? null,
        price: toNumber(tier.price),
        stockAvailable: tier.stock_available ?? 0,
        maxPerUser: tier.max_per_user ?? 1,
        saleEnd: tier.sale_end_at ?? null,
      })),
  };
}

export async function getAllPublishedSlugs(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('slug')
    .eq('status', 'published')
    .order('starts_at', { ascending: true });

  if (error) {
    throw new Error(`getAllPublishedSlugs: ${error.message}`);
  }

  return (data ?? []).map((row) => row.slug);
}

/**
 * Build-time variant — uses the service-role client so it can be called
 * from generateStaticParams without a request/cookies context.
 */
export async function getAllPublishedSlugsForBuild(): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('events')
    .select('slug')
    .eq('status', 'published')
    .order('starts_at', { ascending: true });

  if (error) {
    // During build, fall back to empty list rather than crashing the build.
    console.error(`getAllPublishedSlugsForBuild: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row: { slug: string }) => row.slug);
}
