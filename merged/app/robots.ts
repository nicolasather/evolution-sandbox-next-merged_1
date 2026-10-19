import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
import { clientDevToolsEnabled } from '@/lib/dev/env';

export default function robots(): MetadataRoute.Robots {
  // the Developer Beta is private: never offered to crawlers
  if (clientDevToolsEnabled()) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
