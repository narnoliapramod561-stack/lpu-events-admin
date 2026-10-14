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

  // 1. Local canonical default images are standalone, deterministic WebP assets — never append phantom suffixes
  if (url.startsWith('/defaults/')) {
    return url;
  }

  // Phase 2: Original image objects must NEVER be rewritten to derivative variants
  if (url.includes('/originals/') || url.includes('/source.') || url.includes('_source.')) {
    return url;
  }

  // 2. Responsive variants resolution for Cloudflare R2
  if (url.includes('/variants/')) {
    if (url.endsWith('hero_desktop.webp') && effectiveWidth <= 640) {
      return url.replace('hero_desktop.webp', 'hero_mobile.webp');
    }
    if (url.endsWith('hero_mobile.webp') && effectiveWidth > 640) {
      return url.replace('hero_mobile.webp', 'hero_desktop.webp');
    }
    if (url.endsWith('card_desktop.webp') && effectiveWidth <= 480) {
      return url.replace('card_desktop.webp', 'card_mobile.webp');
    }
    if (url.endsWith('card_mobile.webp') && effectiveWidth > 480) {
      return url.replace('card_mobile.webp', 'card_desktop.webp');
    }
  }

  // 2b. V2 placement responsive derivatives for Cloudflare R2
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

/**
 * Instant Low-Quality Image Placeholder (LQIP) Generator
 */
export function getLowResPlaceholderUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/defaults/')) return url;
  if (url.includes('images.unsplash.com')) {
    const cleanUrl = url.split('?')[0];
    return `${cleanUrl}?auto=format&fit=crop&w=160&q=35&blur=15`;
  }
  return url;
}

export { getOptimizedImage, getOptimizedImageSrcSet, uploadAndOptimizeImage, resolveDefaultEventImage } from '@lpu-events/shared';
