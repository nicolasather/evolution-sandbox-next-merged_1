import type { Metadata } from 'next';
import { StaticPage, DocLink } from '@/components/StaticPage';
import { FaqAccordion } from '@/components/vengeance/faq-accordion';

export const metadata: Metadata = {
  title: 'Questions',
  description: 'What Evolution Sandbox is, how the combinations work, and how far it can be trusted as history.',
  alternates: { canonical: '/faq' },
};

/** Each answer is plain text, so the same words feed the page and the
 *  FAQPage structured data; `more` is an optional follow-up link. */
const QA: { q: string; a: string; more?: { href: string; label: string } }[] = [
  {
    q: 'Is this how history actually happened?',
    a: 'No, and it does not claim to be. Combining two things at a time is a game mechanic. The graph encodes dependency — what had to exist before something else was possible — not chronology. Several nodes overlap in time or invert. Where the simplification would mislead, the entry carries an explicit caution, and the longer text restores the nuance the interface flattens.',
  },
  {
    q: 'Why can I reach the same thing two different ways?',
    a: 'Because that is closer to the truth than a single line. Engineering can be arrived at from mathematics and construction, from mechanism and construction, or from physics and mechanism. Cities can come from planning, from population, or from trade and infrastructure. Agriculture appeared independently in several regions, with different crops on different timelines. A tech tree with one path through it would be a worse model of how any of this went.',
  },
  {
    q: 'Some combinations produce nothing. Is that a bug?',
    a: 'No. Most pairs produce nothing — that is what makes the ones that work worth finding. The failure message tells you roughly why: how far apart the two things sit, or that a step in between is still missing. Dead ends are counted in the archive; they are part of the record, not a penalty.',
  },
  {
    q: 'What are the hidden discoveries?',
    a: 'Sixteen entries outside the main 204 that are only reachable by experimenting — things like music, glass, printing, money, the compass, and satellite positioning. They are not required to finish anything. They are there because the graph should reward curiosity, and because several of them are quietly load-bearing: without glass there is no lens, and without lenses there are no spectacles and no refracting telescope.',
  },
  {
    q: 'Is GTA VI the point of this?',
    a: 'It is one endpoint out of several, and it is a placeholder for whatever the current frontier happens to be. The interesting part is the shape behind it: reaching it needs a minimum of 101 distinct combinations from four raw materials, and it depends on semiconductor fabrication, real-time rendering research, animation principles worked out for hand-drawn film, and roughly three million years of accumulated technique. No single invention is doing the work. The game was unreleased when this was last checked, so nothing here is a claim about the finished product.',
  },
  {
    q: 'How were the sources chosen, and can I check them?',
    a: 'Every source link was fetched and confirmed to resolve before it went into the data, and candidates that returned errors were dropped. They are weighted toward primary institutional material: the Smithsonian, the Natural History Museum, the British Museum, the Met, the Computer History Museum, the IEEE-backed engineering history wiki, the Nobel Foundation, peer-reviewed journals. Each exhibit separates sources about its subject from general references, and where no subject-level source has been verified yet it says source required instead of inventing one. Every link opens from the exhibit panel.',
    more: { href: '/method', label: 'The method page has the full rules →' },
  },
  {
    q: 'Does it save my progress?',
    a: 'In your own browser, yes — in local storage on the device you are using. It never leaves that browser, so it does not follow you to another device, and clearing site data or using a private window will lose it. There is no account and nothing is sent anywhere.',
    more: { href: '/privacy', label: 'What is stored, exactly →' },
  },
];

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QA.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <StaticPage
      eyebrow="Questions"
      title="What this is, and what it isn't"
      lead={`${COUNT_WORDS[QA.length] ?? QA.length} things worth knowing before you take anything here as settled.`}
    >
      <script
        type="application/ld+json"
        // escape "<" so no answer text can ever close this script element
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <section>
        <FaqAccordion
          defaultOpen={0}
          items={QA.map(({ q, a, more }) => ({
            question: q,
            answer: (
              <>
                {a}
                {more && <>{' '}<DocLink href={more.href}>{more.label}</DocLink></>}
              </>
            ),
          }))}
        />
      </section>
      <p className="pt-[34px]"><DocLink href="/">← Back to the sandbox</DocLink></p>
    </StaticPage>
  );
}
