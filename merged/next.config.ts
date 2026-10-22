import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

/** Quiz Studio media lives in a PRIVATE Supabase Storage bucket and is read through short-lived signed URLs on the project's own origin, and uploaded straight to it.
 *  Without these origins the browser blocks every uploaded image, video and audio clip, and the YouTube/Vimeo embeds. Only the exact project origin is added. */
function supabaseOrigin(): string {
  try { const u = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(); return u ? new URL(u).origin : ''; } catch { return ''; }
}
const SB = supabaseOrigin();
/** Swarm Survival talks to its own persistent worker over WebSocket: allow exactly that origin (http→ws, https→wss) and nothing else. */
function swarmOrigins(): string {
  const raw = process.env.NEXT_PUBLIC_SWARM_URL; if (!raw) return '';
  try { const u = new URL(raw); const host = u.host; return u.protocol === 'https:' || u.protocol === 'wss:' ? `https://${host} wss://${host}` : `http://${host} ws://${host}`; } catch { return ''; }
}
const SW = swarmOrigins();
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://sentry.io https://*.sentry.io",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: https://sentry.io https://www.google-analytics.com https://www.googletagmanager.com ${SB}`.trim(),
  `media-src 'self' ${SB}`.trim(),
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
  "font-src 'self' data:",
  `connect-src 'self' ${SB} ${SW} https://sentry.io https://*.sentry.io https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
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
