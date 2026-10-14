import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://sentry.io https://*.sentry.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://sentry.io https://www.google-analytics.com https://www.googletagmanager.com",
  "font-src 'self' data:",
  "connect-src 'self' https://sentry.io https://*.sentry.io https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The deploy environment, recorded at build time so the browser bundle can tell a production
  // deploy from a preview (lib/dev/env.ts). A production deploy always refuses developer tools.
  // NEXT_PUBLIC_ENABLE_DEV_TOOLS is always defined (empty when unset) so the bundler inlines it as a
  // constant and drops the developer console from any build that does not enable it.
  env: {
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV ?? '',
    NEXT_PUBLIC_ENABLE_DEV_TOOLS: process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS ?? '',
  },
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  experimental: { 
    optimizePackageImports: ['framer-motion']
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
