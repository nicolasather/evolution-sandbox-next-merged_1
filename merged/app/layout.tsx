import type { Metadata, Viewport } from 'next';
import { Archivo, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { siteUrl } from '@/lib/site';
import './globals.css';

/* next/font downloads these at build time and serves them from this site, so a
   visitor's browser never contacts Google. The CSS variables feed the design
   system's --fs-* stacks in globals.css. */
const archivo = Archivo({
  subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-archivo', display: 'swap',
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-instrument-serif', display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains-mono', display: 'swap',
});

const SITE = siteUrl();
const DESCRIPTION =
  'Start with a stone, a stick, a bone and a length of fibre. Combine them into 220 discoveries — each with its evidence, and an honest flag wherever a source is still missing.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Evolution Sandbox',
    template: '%s · Evolution Sandbox',
  },
  description: DESCRIPTION,
  applicationName: 'Evolution Sandbox',
  keywords: [
    'human evolution', 'history of technology', 'discovery graph',
    'explorable explanation', 'interactive museum', 'science communication',
  ],
  authors: [{ name: 'Evolution Sandbox' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Evolution Sandbox',
    title: 'Evolution Sandbox',
    description:
      'How did we get here? Combine four raw materials into 220 discoveries, from a knapped stone to a virtual world.',
    url: SITE,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Evolution Sandbox',
    description: 'Combine four raw materials into 220 discoveries, from a knapped stone to a virtual world.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

// WebSite-level structured data — one static object, no user input, so the
// "<" escape is really just a habit carried over from the FAQ page's script.
const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Evolution Sandbox',
  url: SITE,
  description: DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD).replace(/</g, '\\u003c') }}
        />
        {children}
      </body>
    </html>
  );
}
