import type { NextConfig } from 'next';

// No inline scripts other than this app's own two JSON-LD blocks (FAQPage,
// WebSite/WebApplication), which take no user input and are escaped against
// "<" at the point they're written — see app/layout.tsx and app/faq/page.tsx.
// No third-party origin is ever contacted at runtime (fonts and data are
// bundled at build time), so every fetch/connect directive can stay 'self'.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Only takes effect over HTTPS; harmless (ignored) over plain http:// in local dev.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The discovery database is a build-time JSON import, not a runtime fetch.
  experimental: { optimizePackageImports: ['framer-motion'] },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
