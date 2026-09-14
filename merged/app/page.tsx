import { Sandbox } from '@/components/Sandbox';

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
    'An explorable discovery graph. Combine four raw materials — stone, wood, bone, fibre — into 220 discoveries, each with its evidence and an honest flag where a source is still missing.',
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(GAME_JSON_LD).replace(/</g, '\\u003c') }}
      />
      <Sandbox />
    </>
  );
}
