/** The seven creator stages. Each is a real route: /quiz/create/<slug>?draft=<draft key or quiz id>. */
export const CREATOR_STEPS = [
  { slug: 'mode', title: 'Game Mode', short: 'Mode', art: '/quiz/art/ref-mode-cards.svg', optional: false, help: 'Pick the game your quiz is played as.' },
  { slug: 'details', title: 'Title & Cover', short: 'Details', art: '/quiz/art/cover-supplies.svg', optional: false, help: 'Name your quiz and choose its cover.' },
  { slug: 'questions', title: 'Questions', short: 'Questions', art: '/quiz/art/ref-question-media.svg', optional: false, help: 'Write questions. Add a picture, GIF or video if you like.' },
  { slug: 'rules', title: 'Rules', short: 'Rules', art: '/quiz/art/rules-dials.svg', optional: true, help: 'Timers, points and the modifiers that work with your mode.' },
  { slug: 'appearance', title: 'Appearance', short: 'Look', art: '/quiz/art/palette-wall.svg', optional: true, help: 'Choose a colour theme for play screens.' },
  { slug: 'preview', title: 'Preview', short: 'Preview', art: '/quiz/art/preview-arena.svg', optional: true, help: 'Play your quiz yourself before anyone else does.' },
  { slug: 'publish', title: 'Publish & Host', short: 'Publish', art: '/quiz/art/room-ticket.svg', optional: false, help: 'Save, publish, share and host.' },
] as const;
export type CreatorStep = (typeof CREATOR_STEPS)[number]['slug'];
export const isCreatorStep = (x: string): x is CreatorStep => CREATOR_STEPS.some((s) => s.slug === x);
export const stepIndex = (slug: CreatorStep) => CREATOR_STEPS.findIndex((s) => s.slug === slug);
export function creatorHref(step: CreatorStep, draft?: string | null) {
  return `/quiz/create/${step}${draft ? `?draft=${encodeURIComponent(draft)}` : ''}`;
}
