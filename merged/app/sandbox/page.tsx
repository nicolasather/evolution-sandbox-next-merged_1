import type { Metadata } from 'next';
import { AppRoot } from '@/components/AppRoot';
import CatalystDock from '@/components/quiz/remix/CatalystDock';

export const metadata: Metadata = { alternates: { canonical: '/sandbox' } };

// Static, no user input — describes the game itself for search engines.
const GAME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Evolution Sandbox',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any (runs in a web browser)',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description:
    'An explorable discovery graph. Combine four raw materials — stone, wood, bone, fibre — into 1,917 discoveries, each with its evidence and an honest flag where a source is still missing.',
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(GAME_JSON_LD).replace(/</g, '\\u003c') }}
      />
      <AppRoot />
      <CatalystDock />
    </>
  );
}
