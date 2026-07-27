import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  description: string | null;
}

const categoryDescriptions: Record<string, string> = {
  academics: 'Debates, presentations, quizzes, and knowledge-led campus sessions.',
  career: 'Career fairs, placement prep, recruiter sessions, and hiring-readiness events.',
  cultural: 'Music, dance, arts, and stage experiences that light up campus life.',
  seminar: 'Keynotes, panels, conferences, and insight-rich talks from experts.',
  social: 'Community mixers, networking events, and student life gatherings.',
  sports: 'Competitive tournaments, match nights, and spectator-first sports events.',
  technical: 'Hackathons, coding battles, AI/ML sessions, and engineering showcases.',
  workshop: 'Hands-on practical learning, guided labs, and skill-building intensives.',
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon_name: string;
};

function normalizeCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    iconName: row.icon_name,
    description: categoryDescriptions[row.slug] ?? null,
  };
}

export async function getAllCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, icon_name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`getAllCategories: ${error.message}`);
  }

  return (data ?? []).map(normalizeCategory);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, icon_name')
    .eq('slug', slug)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`getCategoryBySlug: ${error.message}`);
  }

  return data ? normalizeCategory(data) : null;
}

/**
 * Build-time variant — uses the service-role client so it can be called
 * from generateStaticParams without a request/cookies context.
 */
export async function getAllCategorySlugsForBuild(): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('categories')
    .select('slug')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    // During build, fall back to empty list rather than crashing the build.
    console.error(`getAllCategorySlugsForBuild: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row: { slug: string }) => row.slug);
}
