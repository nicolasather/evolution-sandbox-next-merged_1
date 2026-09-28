import type { WeeklyScenario } from './types';

/* Authored scenario identities — the "flavour" of a given week. Content
   (which trace modifier, which five discoveries, which three riddles) is
   always procedurally drawn from the real database; only the title/blurb
   framing above it is authored, picked deterministically per ISO week by
   lib/weekly/generate.ts's own weeklyRng('weekly-scenario', date). */
export const SCENARIOS: WeeklyScenario[] = [
  { id: 'long-road', title: 'The Long Road', blurb: 'Three trials tracing how far a single idea can travel before it looks unrecognisable.' },
  { id: 'lost-and-found', title: 'Lost and Found', blurb: 'A week of reconstructing what came from what, and what came first.' },
  { id: 'chain-of-custody', title: 'Chain of Custody', blurb: 'Every step has to be accounted for — no shortcuts, no guessing the order.' },
  { id: 'the-slow-burn', title: 'The Slow Burn', blurb: 'Some inventions took centuries to connect. This week is about seeing the connections.' },
  { id: 'working-backwards', title: 'Working Backwards', blurb: 'Start from what you know, and prove you can get back to what came before it.' },
  { id: 'the-archive-audit', title: 'The Archive Audit', blurb: 'Three checks on the record: a route, an order, and a set of names.' },
  { id: 'signal-and-noise', title: 'Signal and Noise', blurb: 'Real connections, real dates, real names — everything else is a distraction.' },
  { id: 'the-long-memory', title: 'The Long Memory', blurb: 'What one era owes the ones before it, proven three different ways.' },
];
