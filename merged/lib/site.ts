/**
 * The public origin of the deployed site — used for metadataBase (canonical and
 * Open Graph URLs), robots.txt and sitemap.xml.
 *
 * Order: NEXT_PUBLIC_SITE_URL (set it for any real deployment; see .env.example)
 *     →  the production domain Vercel exposes at build time
 *     →  localhost, which is only correct for `next dev` / `next start` locally.
 *
 * There is deliberately no invented placeholder domain: a wrong absolute URL in a
 * sitemap is worse than a local one.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}
