import type { Metadata } from 'next';
import { StaticPage, DocLink } from '@/components/StaticPage';
import db from '@/data/db.json';
import type { Db } from '@/lib/types';
import { formatDate } from '@/lib/format';

const DB = db as unknown as Db;

export const metadata: Metadata = {
  title: 'How this was built',
  description:
    'The sourcing rules, the graph validation, and the scientific hedges behind the 322 discoveries in Evolution Sandbox.',
  alternates: { canonical: '/method' },
};

const TH = 'border-b border-line-2 pr-3 pb-[9px] text-left font-mono text-[10px] font-normal tracking-[.14em] text-bone-4 uppercase';
const TD = 'border-b border-line py-[11px] pr-3 align-top text-bone-2';
const NUM = 'border-b border-line py-[11px] pr-3 text-right font-mono whitespace-nowrap text-bone';

export default function MethodPage() {
  const sources = Object.values(DB.sources);
  const tiers = { S: 0, A: 0, B: 0 } as Record<string, number>;
  sources.forEach(s => { tiers[s.t]++; });
  const topicSources = sources.filter(s => s.scope === 'topic').length;
  const generalSources = sources.length - topicSources;
  const cautions = DB.nodes.filter(n => n.caution).length;
  const alt = DB.nodes.filter(n => (n.rec?.length ?? 0) > 1).length;
  const recipes = DB.nodes.reduce((a, n) => a + (n.rec?.length ?? 0), 0);
  const sourced = DB.counts.total - DB.counts.sourceRequired;

  return (
    <StaticPage
      eyebrow="Methodology"
      title="How this was built"
      lead="A game about knowledge should be able to show its own working. This page is that working."
    >
      <section>
        <h2>Sourcing</h2>
        <p>
          Every source URL in the database was fetched and confirmed to resolve on {formatDate(DB.sourcesChecked)}.
          Plausible-looking URLs that returned errors were dropped, and no invented replacement was
          substituted for them.
        </p>
        <p>
          Sources come in two kinds. A <b>subject-level</b> source is a page about the entry&rsquo;s
          subject or its field — a species page, a museum essay, a Nobel citation, an engineering
          milestone. A <b>general reference</b> is a homepage, a collection search or an index: useful
          background, never evidence for a particular claim, and labelled as such in the exhibit.
        </p>
        <p>
          An entry with only general references says <b>source required</b>. That is deliberate. A
          missing citation is information; a fabricated one is a lie that looks like information. Today{' '}
          {sourced} of {DB.counts.total} entries have at least one subject-level source and{' '}
          {DB.counts.sourceRequired} are still marked source required — the archive can filter to them.
        </p>
        <table className="mt-[18px] w-full border-collapse text-[13.5px]">
          <thead><tr><th className={TH}>Tier</th><th className={TH}>What counts</th><th className={TH}>Count</th></tr></thead>
          <tbody>
            <tr><td className={TD}>S</td><td className={TD}>National museums, universities, scientific and engineering societies, the Nobel Foundation, peer-reviewed journals</td><td className={NUM}>{tiers.S}</td></tr>
            <tr><td className={TD}>A</td><td className={TD}>Major data, standards and public bodies — Our World in Data, the Internet Society, UNESCO, WHO, NASA — and primary announcements</td><td className={NUM}>{tiers.A}</td></tr>
            <tr><td className={TD}>B</td><td className={TD}>Established reference publishers</td><td className={NUM}>{tiers.B}</td></tr>
            <tr><td className={TD} colSpan={2}>Of which subject-level / general reference</td><td className={NUM}>{topicSources} / {generalSources}</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>What the numbers are</h2>
        <table className="w-full border-collapse text-[13.5px]">
          <tbody>
            <tr><td className={TD}>Core discoveries</td><td className={NUM}>{DB.counts.core}</td></tr>
            <tr><td className={TD}>Hidden finds</td><td className={NUM}>{DB.counts.hidden}</td></tr>
            <tr><td className={TD}>Combinations that produce something</td><td className={NUM}>{recipes}</td></tr>
            <tr><td className={TD}>Discoveries reachable by more than one route</td><td className={NUM}>{alt}</td></tr>
            <tr><td className={TD}>Entries carrying an explicit scientific caution</td><td className={NUM}>{cautions}</td></tr>
            <tr><td className={TD}>Entries still marked source required</td><td className={NUM}>{DB.counts.sourceRequired}</td></tr>
            <tr><td className={TD}>Starting materials</td><td className={NUM}>{DB.primitives.length}</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>The graph is checked by a machine, not by eye</h2>
        <p>
          <code>tools/validate.py</code> runs against the node files and fails the build on any of:
          a duplicate id or catalogue number, a recipe naming a node that does not exist, a node
          listing itself as its own ingredient, a missing required field, a source id with no entry
          in the registry, a malformed registry entry, a rarity that disagrees with the hidden flag,
          and — the three that actually matter —
        </p>
        <ul>
          <li>
            <b>an unreachable node.</b> The validator computes the forward closure from the four
            starting materials and asserts that all {DB.counts.total} nodes fall inside it. A
            discovery nobody can reach is a dead entry, and it is invisible on inspection.
          </li>
          <li>
            <b>an ambiguous pair.</b> Two recipes producing different results from the same pair
            of ingredients would make the engine non-deterministic. The first run of this check
            found six such collisions. It was later bypassed when 102 Stone Age entries were
            added straight into the built file: 34 pairs collided again, and only 50 of the
            entries could actually be reached. In September 2026 every pair was made unique
            again, the missing routes were written, and a test now plays the whole graph from
            the four raw materials on every build.
          </li>
          <li>
            <b>an unflagged entry.</b> An entry that cites only general references but does not say
            source required fails validation, so the honesty rule cannot quietly lapse.
          </li>
        </ul>
      </section>

      <section>
        <h2>Where the history is simplified, and where it is not</h2>
        <p>
          The combination mechanic is a game device. It is not a claim that history proceeded by
          combining two things at a time, in that order, once. The graph is a conceptual
          dependency structure, not a chronology — and several nodes sit in it at dates that
          overlap or invert.
        </p>
        <p>
          Where a simplification would leave a false impression, the entry carries a caution.
          Pottery predates farming in some regions. Monumental construction at Göbekli Tepe
          predates established agriculture there. Settlement did not always follow farming.
          Mesoamerican societies knew the wheel and did not use it for transport. Movable type
          was invented in China and Korea well before Gutenberg. Biological evolution has no
          goal and no direction toward complexity. Each of those is in the data, on the node it
          belongs to.
        </p>
      </section>

      <section>
        <h2>Hints, routes and what stays closed</h2>
        <p>
          The game never lists recipes. An undiscovered entry shows no name, no description and
          no ingredients — only its era and how far away it is. When a combination fails, the
          game may say which of the two items still has something to give, never what it
          gives. Hints come in three steps — a direction, then the idea, then one ingredient —
          and each step opens only after a couple more tries of your own. The other half is
          always left for you to find.
        </p>
        <p>
          Recipes are a game&rsquo;s shorthand for how ideas depend on each other. Many entries
          can be reached by two or three routes; a route is a plausible connection, not a claim
          about how, where or in what order something was first made.
        </p>
        <p>
          Every mark in the game is drawn by code from a small shape grammar. No third-party
          images are used, so there is nothing to license or attribute beyond the sources
          listed on each entry.
        </p>
      </section>

      <section>
        <h2>The Stone Age entries</h2>
        <p>
          85 of the Stone Age entries were first added with placeholder text, one false date for
          all of them and a source id that did not exist. They have been rewritten with short
          original descriptions. Where a date is widely established it is given as a wide range;
          otherwise the entry says <i>Date not yet sourced</i>. All of them are marked source
          required and carry a caution that they are gameplay entries, until each is checked
          against a subject-level source.
        </p>
      </section>

      <section>
        <h2>Dates</h2>
        <p>
          Dates are written at the precision the evidence supports —
          <code> ≈ 3.3 million years ago</code>, not a year. Where the field is
          actively split, the entry says so rather than picking a side: the date of first
          controlled fire and the origin of language are both live disputes, and neither has a
          settled answer here.
        </p>
      </section>

      <p className="pt-[34px]">
        <DocLink href="/">← Back to the sandbox</DocLink>
      </p>
    </StaticPage>
  );
}
