import type { ActionId, Discovery } from '../types';
import type { Capability } from './types';

/* ============================================================================
   ACTIONS — the five things a hand can do to ONE resource. The player performs
   them (a gesture on the bench); the data says what each does to what. This
   file is only their names and, when a material refuses, why — written from
   tags, so a new material gets sensible refusals without new copy.
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

export const ACTION_ORDER: ActionId[] = ['brush', 'smash', 'cut', 'separate', 'dig'];

export const ACTIONS: Record<ActionId, ActionInfo> = {
  brush:    { id: 'brush',    label: 'Brush',    key: 'b', gesture: 'Sweep back and forth', blurb: 'Clean a thing to see what is under it.' },
  smash:    { id: 'smash',    label: 'Smash',    key: 's', gesture: 'Strike hard, once or twice', blurb: 'Break a hard thing into what it is made of.' },
  cut:      { id: 'cut',      label: 'Cut',      key: 'c', gesture: 'Draw a line across it', blurb: 'Shape a thing with an edge.' },
  separate: { id: 'separate', label: 'Separate', key: 'p', gesture: 'Pull apart from the middle', blurb: 'Take one thing out of a mixture.' },
  dig:      { id: 'dig',      label: 'Dig',      key: 'd', gesture: 'Scoop down and out', blurb: 'Uncover what is buried.' },
};

export const CAPABILITY_NOTE: Record<Capability, string> = {
  edged: 'Something with an edge would do it.',
  digger: 'Something to dig with would do it.',
};

/** The family a tag set belongs to for refusal copy; first match wins. */
function family(tags: ReadonlySet<string>): string {
  const order = ['intangible', 'fluid', 'hot', 'metal', 'glassy', 'fibrous', 'earthy', 'made', 'hard', 'woody'];
  return order.find(t => tags.has(t)) ?? 'default';
}

type Copy = Partial<Record<string, string>> & { default: string };

const REFUSAL: Record<ActionId, Copy> = {
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

/** Why working `node` with `action` did nothing, in a line. */
export function refusal(action: ActionId, node: Pick<Discovery, 'n'>, tags: ReadonlySet<string>): string {
  const copy = REFUSAL[action];
  const text = copy[family(tags)] ?? copy.default;
  return text.replace('{n}', node.n);
}

export const isAction = (s: string): s is ActionId => s in ACTIONS;
