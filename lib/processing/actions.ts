import type { ActionId, Discovery } from '../types';
import { TECHNIQUES, TECH_ORDER } from './techniques';
import { gestureOf } from './techniques';
import type { Capability } from './types';

/* ============================================================================
   ACTIONS — the things a hand can do to ONE resource. The player performs
   them (a gesture on the bench); the data says what each does to what; the
   technique catalogue (techniques.ts) says when each becomes known. This file
   is only their names and, when a material refuses, why — written from tags,
   so a new material gets sensible refusals without new copy.
   ========================================================================== */

export interface ActionInfo {
  id: ActionId;
  label: string;
  /** What the player does. */
  gesture: string;
  /** One line on what it is for. */
  blurb: string;
  /** Keyboard shortcut on the bench. */
  key: string;
}

/** Every action, in the catalogue's order (family by family). */
export const ACTION_ORDER: ActionId[] = TECH_ORDER;

export const ACTIONS: Record<ActionId, ActionInfo> = Object.fromEntries(
  TECHNIQUES.map(t => [t.id, { id: t.id, label: t.label, key: t.key, gesture: gestureOf(t.id), blurb: t.blurb } satisfies ActionInfo]),
) as Record<ActionId, ActionInfo>;

/** What is missing when the hands lack a capability — a kind of thing, never an answer. */
export const CAPABILITY_NOTE: Record<string, string> = {
  edged: 'Something with an edge would do it.',
  digger: 'Something to dig with would do it.',
  hammer: 'Something to strike with would do it.',
  flame: 'It would need fire.',
  kiln: 'It would need a hotter, closed fire.',
  wet: 'It would need water.',
  mold: 'It would need something to hold its shape.',
  metalblade: 'It would need a harder edge than stone.',
  optics: 'It would need an understanding of light.',
  literacy: 'It would need a way of keeping records.',
};
export const capabilityNote = (c: Capability): string => CAPABILITY_NOTE[c] ?? 'Something more would be needed.';

/** The family a tag set belongs to for refusal copy; first match wins. */
function family(tags: ReadonlySet<string>): string {
  const order = ['intangible', 'fluid', 'hot', 'metal', 'glassy', 'fibrous', 'earthy', 'made', 'hard', 'woody'];
  return order.find(t => tags.has(t)) ?? 'default';
}

type Copy = Partial<Record<string, string>> & { default: string };

const REFUSAL: Partial<Record<ActionId, Copy>> = {
  brush: {
    intangible: 'There is nothing to brush. You cannot touch it.',
    fluid: 'You cannot brush a liquid.',
    hot: 'Brushing a flame only feeds it.',
    default: 'Brushed clean. Nothing was hiding under {n}.',
  },
  smash: {
    intangible: 'There is nothing to break. It is not a thing you can hold.',
    fluid: 'A splash — and it is whole again.',
    hot: 'You cannot break a flame.',
    fibrous: 'Fibre only flattens, then springs back.',
    metal: 'It rings, and does not break. Metal wants more than a blow.',
    glassy: 'It breaks, but only into sharp bits you have no use for yet.',
    earthy: 'It crumbles into what it already was.',
    made: 'Breaking {n} only ruins it.',
    default: 'It holds. Smashing {n} gives nothing new.',
  },
  cut: {
    intangible: 'There is nothing to cut.',
    fluid: 'Cut water and it closes again.',
    hot: 'A flame does not care about your edge.',
    metal: 'Nothing you hold has an edge hard enough for {n}.',
    glassy: 'Too hard and brittle to cut. It would only shatter.',
    earthy: 'Soft, but shapeless — a cut leaves no shape.',
    made: 'Cutting {n} would only spoil it.',
    hard: 'Too hard to cut. Something else would break it first.',
    default: 'The cut leaves {n} as it was.',
  },
  separate: {
    intangible: 'There is nothing to pull apart.',
    fluid: 'It flows back together.',
    hot: 'A flame is one thing all through.',
    made: '{n} is made from parts, but you do not yet know how they come apart.',
    default: '{n} is one thing all through. There is nothing to take out of it.',
  },
  dig: {
    intangible: 'You cannot dig into that.',
    fluid: 'The hole fills as fast as you dig.',
    hot: 'You cannot dig into a flame.',
    hard: 'Too hard to dig into.',
    made: 'Digging {n} only wrecks it.',
    default: 'Digging {n} turns up nothing.',
  },
};

/** Copy for the actions that have no table of their own: by what the thing is, then a plain default. */
const GENERIC: Record<ActionId, string> = {
  brush: '', smash: '', cut: '', separate: '', dig: '',
  carve: 'Carving {n} gives nothing new.',
  scrape: 'Scraping {n} only marks it.',
  grind: '{n} will not wear down into anything useful.',
  pull: '{n} does not come away in the hand.',
  twist: 'Twisting {n} only twists it.',
  tie: 'Tying {n} holds nothing together.',
  stretch: '{n} does not stretch. It would tear.',
  mix: 'Stirring does nothing to {n} alone.',
  shape: '{n} will not hold a shape.',
  pour: 'There is nothing in {n} to pour.',
  heat: 'Heat does nothing useful to {n} yet.',
  cool: '{n} is not hot.',
  dry: '{n} has no water to lose.',
  burn: '{n} will not burn to anything new.',
  hammer: 'Hammering {n} only bruises it.',
  split: '{n} has no grain to split along.',
  press: 'Pressing {n} changes nothing.',
  saw: 'Sawing {n} only wears the edge.',
  chisel: 'A chisel finds no way into {n}.',
  polish: 'Polishing {n} makes no difference.',
};
const BY_FAMILY: Partial<Record<ActionId, Partial<Record<string, string>>>> = {
  scrape: { intangible: 'There is nothing to scrape.', fluid: 'You cannot scrape a liquid.', hot: 'You cannot scrape a flame.', metal: 'Scraping only scratches {n}.' },
  heat: { intangible: 'You cannot heat that.', fluid: 'Warm water is just warm water.', hot: 'It is already hot.', fibrous: 'Fibre burns before it changes.', woody: 'Wood chars before it changes.' },
  burn: { intangible: 'You cannot burn that.', fluid: 'Water puts the flame out.', hot: 'It is already burning.', metal: 'Metal glows, but does not burn.', earthy: 'It bakes, and does not burn.', mineral: 'Stone does not burn.', hard: 'It will not burn.' },
  press: { fluid: 'A liquid squeezes out of your hand.', hard: 'It does not give. Pressing {n} does nothing.' },
  hammer: { fluid: 'You cannot hammer a liquid.', intangible: 'There is nothing to strike.', fibrous: 'Fibre only flattens.', hot: 'You cannot hammer a flame.' },
  twist: { hard: '{n} does not bend. It would break before it twisted.', intangible: 'There is nothing to twist.', fluid: 'You cannot twist a liquid.' },
  dry: { hot: 'A flame is not wet.', intangible: 'There is nothing to dry.', fluid: 'Left alone, it would only evaporate.', mineral: 'It is already dry.', hard: 'It is already dry.' },
};

/** Why working `node` with `action` did nothing, in a line. */
export function refusal(action: ActionId, node: Pick<Discovery, 'n'>, tags: ReadonlySet<string>): string {
  const fam = family(tags);
  const copy = REFUSAL[action];
  let text: string | undefined = copy ? (copy[fam] ?? copy.default) : undefined;
  if (!text) text = BY_FAMILY[action]?.[fam] ?? [...tags].map(t => BY_FAMILY[action]?.[t]).find(Boolean) ?? GENERIC[action];
  return text.replace('{n}', node.n);
}

export const isAction = (s: string): s is ActionId => s in ACTIONS;
