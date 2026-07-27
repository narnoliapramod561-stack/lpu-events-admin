import { Metadata } from 'next';
import type { EventDetail } from '@/lib/db/events';
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/seo/schema';

export const DEFAULT_DESCRIPTION =
  'Discover, register, and participate in academic, cultural, and sports events at Lovely Professional University.';

export function buildCanonicalUrl(siteUrl: string, path = '/'): string {
  const [pathname, query = ''] = path.split('?');
  const normalizedPath =
    pathname === '/'
      ? ''
      : `/${pathname
          .replace(/^\/+|\/+$/g, '')
          .toLowerCase()}`;

  return `${siteUrl}${normalizedPath}${query ? `?${query}` : ''}`;
}

/**
 * Truncate description text cleanly at word boundaries
 */
export function truncateDescription(text: string, maxLength: number = 155): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  const sub = text.substring(0, maxLength);
  const lastSpace = sub.lastIndexOf(' ');
  return lastSpace > 0 ? `${sub.substring(0, lastSpace)}...` : `${sub}...`;
}

/**
 * Build dynamic Next.js Metadata object for a given Event
 */
export function buildEventMetadata(event: EventDetail, siteUrl: string): Metadata {
  const isCancelled = event.status === 'cancelled';
  const categoryName = event.category?.name || event.category?.slug || 'Events';

  // Title templates
  const title = isCancelled
    ? `[CANCELLED] ${event.title} | LPU Events`
    : `${event.title} | ${categoryName} | LPU Events`;

  // Description builder
  const rawDesc = event.shortDescription || event.description || DEFAULT_DESCRIPTION;
  const description = isCancelled
    ? truncateDescription(`This event has been cancelled: ${rawDesc}`)
    : truncateDescription(rawDesc);

  const canonicalUrl = buildCanonicalUrl(siteUrl, `/events/${event.slug}`);
  const defaultOgImage = buildCanonicalUrl(siteUrl, DEFAULT_OG_IMAGE_PATH);
  const ogImageUrl = event.bannerUrl || defaultOgImage;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: isCancelled
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'LPU Events',
      type: 'article', // per IMP-008 target specification
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    other: {
      'theme-color': '#fa5e29', // Brand accent color for Discord & browser highlights
    },
  };
}
