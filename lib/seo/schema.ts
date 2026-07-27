import type { EventDetail } from '@/lib/db/events';

export const DEFAULT_OG_IMAGE_PATH = '/og-image-default.png';

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function absoluteUrl(siteUrl: string, path: string): string {
  if (path === '/') {
    return siteUrl;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}

function getEventStatusUrl(status: EventDetail['status']) {
  if (status === 'cancelled') {
    return 'https://schema.org/EventCancelled';
  }

  return 'https://schema.org/EventScheduled';
}

/**
 * Build dynamic Event JSON-LD schema payload
 */
export function buildEventJsonLd(event: EventDetail, siteUrl: string) {
  const shortDesc = event.shortDescription || event.description.substring(0, 160);
  const imageUrl = event.bannerUrl || absoluteUrl(siteUrl, DEFAULT_OG_IMAGE_PATH);
  const eventUrl = absoluteUrl(siteUrl, `/events/${event.slug}`);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    'name': event.title,
    'description': shortDesc,
    'startDate': event.startDate,
    'endDate': event.endDate,
    'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
    'eventStatus': getEventStatusUrl(event.status),
    'location': {
      '@type': 'Place',
      'name': event.venueName,
      'address': {
        '@type': 'PostalAddress',
        'streetAddress': event.venueAddress || 'LPU Campus',
        'addressLocality': 'Phagwara',
        'addressRegion': 'Punjab',
        'postalCode': '144411',
        'addressCountry': 'IN',
      },
    },
    'image': [imageUrl],
    'organizer': {
      '@type': 'Organization',
      'name': event.organizer?.name || 'LPU Student Coordinator',
      'url': siteUrl,
    },
    'offers': event.minPrice !== null ? {
      '@type': 'Offer',
      'price': event.minPrice,
      'priceCurrency': 'INR',
      'availability': event.hasAvailableTickets ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      'url': eventUrl,
    } : undefined,
  };

  return jsonLd;
}

/**
 * Build BreadcrumbList JSON-LD schema payload
 */
export function buildBreadcrumbJsonLd(event: EventDetail, siteUrl: string) {
  const categoryName = event.category?.name || 'Events';
  const categorySlug = event.category?.slug || 'all';

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': absoluteUrl(siteUrl, '/'),
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': categoryName,
        'item': absoluteUrl(siteUrl, `/events?category=${categorySlug}`),
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': event.title,
        'item': absoluteUrl(siteUrl, `/events/${event.slug}`),
      },
    ],
  };
}

/**
 * Build Organization JSON-LD schema payload
 */
export function buildOrganizationJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'LPU Events Admin',
    'url': siteUrl,
    'logo': absoluteUrl(siteUrl, '/logo.png'),
    'description': 'Organizer and super admin workspace for managing LPU Events',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'Lovely Professional University',
      'addressLocality': 'Phagwara',
      'addressRegion': 'Punjab',
      'postalCode': '144411',
      'addressCountry': 'IN',
    },
  };
}

/**
 * Build WebSite JSON-LD schema payload
 */
export function buildWebSiteJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'LPU Events Admin',
    'url': siteUrl,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${siteUrl}/dashboard?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
