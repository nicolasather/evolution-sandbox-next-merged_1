import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = siteUrl();
  const now = new Date();
  return [
    { url: site, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${site}/method`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${site}/faq`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${site}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${site}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
