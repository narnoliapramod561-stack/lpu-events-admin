import { getOptimizedImage as sharedGetOptimizedImage, EVENT_MOCK_FALLBACK_IMAGES, ImageContext } from '@lpu-events/shared';

export const EVENT_MOCK_IMAGES: Record<string, string> = EVENT_MOCK_FALLBACK_IMAGES;

/**
 * Free-Tier Cloudflare CDN & High-DPI Image Optimization Pipeline
 * Delivers razor-sharp Retina/4K clarity with zero bandwidth bloat.
 */
export function getResponsiveImageUrl(url: string, targetWidth: number = 1080): string {
  if (!url || typeof url !== 'string') return url;

  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 2, 3) : 2;
  const effectiveWidth = Math.round(targetWidth * (dpr >= 1.5 ? 1.5 : 1.0));

  // 1. Local default category WebP assets have full responsive sets
  if (url.startsWith('/defaults/events/')) {
    const base = url.replace(/(_desktop|_tablet|_mobile)\.webp$/, '.webp');
    if (effectiveWidth <= 640) {
      return base.replace('.webp', '_mobile.webp');
    }
    if (effectiveWidth <= 1200) {
      return base.replace('.webp', '_tablet.webp');
    }
    return base.replace('.webp', '_desktop.webp');
  }

  // 2. V2 placement responsive derivatives for Cloudflare R2
  if (url.includes('/events/v2/')) {
    if (url.endsWith('/card.webp') && effectiveWidth <= 480) {
      return url.replace('/card.webp', '/card_480w.webp');
    }
    if (url.endsWith('/details.webp')) {
      if (effectiveWidth <= 640) return url.replace('/details.webp', '/details_640w.webp');
      if (effectiveWidth <= 800) return url.replace('/details.webp', '/details_800w.webp');
    }
    if (url.endsWith('/hero.webp')) {
      if (effectiveWidth <= 800) return url.replace('/hero.webp', '/hero_800w.webp');
      if (effectiveWidth <= 1200) return url.replace('/hero.webp', '/hero_1200w.webp');
    }
  }

  // 2b. Multi-slot responsive derivatives for Cloudflare R2
  if (url.includes('_card.webp') && effectiveWidth <= 800) {
    return url.replace('_card.webp', '_card_mobile.webp');
  }
  if (url.includes('_banner.webp') && effectiveWidth <= 960) {
    return url.replace('_banner.webp', '_banner_mobile.webp');
  }

  if (url.includes('images.unsplash.com')) {
    const cleanUrl = url.split('?')[0];
    return `${cleanUrl}?auto=format&fit=crop&w=${Math.max(effectiveWidth, 960)}&q=88&dpr=${dpr >= 2 ? '2' : '1'}`;
  }

  return url;
}

export function getEventImage(
  event: any, 
  context: ImageContext = 'event-card',
  maxWidth?: number
): string {
  const raw = sharedGetOptimizedImage(event, context);
  const defaultWidths: Record<ImageContext, number> = {
    hero: 1920,
    'event-banner': 1440,
    'event-card': 960,
    advertisement: 1280,
    memory: 1440,
    thumbnail: 400,
    'sponsor-logo': 600,
    'admin-preview': 1280,
  };

  const targetWidth = maxWidth ?? (defaultWidths[context] || 1080);
  return getResponsiveImageUrl(raw, targetWidth);
}

export { getOptimizedImage, getOptimizedImageSrcSet, uploadAndOptimizeImage } from '@lpu-events/shared';
