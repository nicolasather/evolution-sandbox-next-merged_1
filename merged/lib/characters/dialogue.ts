/* Sparse, authored, character-specific lines. No generation, no network. Each carries a `voiceCueId` for a future voice
   pass (playback is disabled today). Policy: 1-5 words for ordinary lines, 6 at most for help. */
import type { CharacterId, DialogueLine } from './types';

export const MAX_WORDS = 6;
export const LINE_MIN_MS = 1200;
export const LINE_MAX_MS = 2200;

const L = (speakerId: CharacterId, id: string, text: string): DialogueLine => ({ id, speakerId, text, voiceCueId: `vc.${speakerId}.${id}` });

export const DIALOGUE: readonly DialogueLine[] = [
  L('kip', 'kip.found', 'We made a thing!'), L('kip', 'kip.oops', 'Oops. Sorry!'), L('kip', 'kip.help', 'Still helping!'),
  L('kip', 'kip.hmm', 'Hmm? Hmm!'), L('kip', 'kip.hi', 'Hello again!'), L('kip', 'kip.poke', 'Hee! That tickles.'),
  L('kip', 'kip.worry', 'Oh no, oh no.'), L('kip', 'kip.done', 'We did it!'), L('kip', 'kip.hint', 'Try this one?'), L('kip', 'kip.try', 'Let me try!'), L('kip', 'kip.gift', 'For me? Thank you!'),
  L('vex', 'vex.innocent', 'Wasn\u2019t me.'), L('vex', 'vex.prank', 'Trust me. Don\u2019t.'), L('vex', 'vex.found', 'Obviously. I helped.'),
  L('vex', 'vex.fail', 'Called it.'), L('vex', 'vex.poke', 'Hands off.'), L('vex', 'vex.bored', 'Bored. Do something.'),
  L('vex', 'vex.done', 'Too easy.'), L('vex', 'vex.worry', 'Not funny. Okay, a bit.'), L('vex', 'vex.hint', 'Pick this. Probably.'), L('vex', 'vex.back', 'Miss me?'), L('vex', 'vex.gift', 'Mine now. Thanks.'),
  L('orra', 'orra.interest', 'Interesting. Mostly.'), L('orra', 'orra.putback', 'Put that back.'), L('orra', 'orra.found', 'As predicted.'),
  L('orra', 'orra.fail', 'Noted. Again.'), L('orra', 'orra.poke', 'Yes? I am busy.'), L('orra', 'orra.done', 'A tidy result.'),
  L('orra', 'orra.worry', 'Concerning. Be careful.'), L('orra', 'orra.hint', 'Look at the evidence.'), L('orra', 'orra.pattern', 'There is a pattern.'), L('orra', 'orra.hello', 'Good. You are here.'), L('orra', 'orra.gift', 'How thoughtful. Noted.'),
];

const BY_ID = new Map(DIALOGUE.map(d => [d.id, d]));
export const getLine = (id: string): DialogueLine | undefined => BY_ID.get(id);
export const wordCount = (t: string) => t.trim().split(/\s+/).length;

/** Which line (if any) a speaking character reaches for, by tone. */
export const LINE_BY_TONE: Record<CharacterId, Partial<Record<string, string>>> = {
  kip: { greet: 'kip.hi', poke: 'kip.poke', big: 'kip.found', celebrate: 'kip.found', fail: 'kip.oops', worry: 'kip.worry', complete: 'kip.done', hint: 'kip.hint', question: 'kip.hmm', confused: 'kip.hmm', locked: 'kip.help', work: 'kip.try' },
  vex: { greet: 'vex.back', poke: 'vex.poke', big: 'vex.found', celebrate: 'vex.found', fail: 'vex.fail', worry: 'vex.worry', complete: 'vex.done', hint: 'vex.hint', question: 'vex.prank', idle: 'vex.bored', work: 'vex.innocent' },
  orra: { greet: 'orra.hello', poke: 'orra.poke', big: 'orra.found', celebrate: 'orra.found', fail: 'orra.fail', worry: 'orra.worry', complete: 'orra.done', hint: 'orra.hint', question: 'orra.interest', observe: 'orra.pattern', confused: 'orra.interest' },
};

