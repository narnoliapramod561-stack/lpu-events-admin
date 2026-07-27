import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';
import { buildCanonicalUrl } from '@/lib/seo/metadata';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  return [
    {
      url: buildCanonicalUrl(baseUrl, '/'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: buildCanonicalUrl(baseUrl, '/apply'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
