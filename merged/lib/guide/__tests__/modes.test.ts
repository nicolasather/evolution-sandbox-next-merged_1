import { playDb } from '@/lib/processing';
import { TARGETS } from '@/lib/reverseevolution/catalog';
import { generateRun } from '@/lib/reverseevolution/generate';
import { generateSite as arch } from '@/lib/archaeology/generate';
import { applyAction as archAct } from '@/lib/archaeology/simulate';
import { generateSite as alien } from '@/lib/alienarchaeology/generate';
import { ALL_AXES } from '@/lib/alienarchaeology/generate';
import { generateCamp } from '@/lib/survival/generate';
import { generateTutorial } from '@/lib/decipher/tutorial';
import { assignGlyph, blankAttempt } from '@/lib/decipher/simulate';
import { DEFAULT_EPISODE_ID, getEpisode } from '@/lib/escaperoom/registry';
import { blankState } from '@/lib/escaperoom/simulate';
import { reverseGuide, REV_TARGET } from '../reverse';
import { archaeologyGuide, ARCH_TARGET } from '../archaeology';
import { alienGuide, XA_TARGET } from '../alien';
import { survivalGuide, SV_TARGET } from '../survival';
import { decipherGuide, DEC_TARGET } from '../decipher';
import { escapeRoomGuide, ER_TARGET } from '../escaperoom';
import { minimumPathGuide, MP_TARGET } from '../minimumpath';

describe('Reverse Evolution guide', () => {
  const run = generateRun(playDb, 'g', TARGETS[0].id);
  it('picks a discovery, then ticks, then submits; ends after two answers', () => {
    expect(reverseGuide(null, 0).step?.targets).toEqual([REV_TARGET.card]);
    expect(reverseGuide(run, 0).step?.targets).toEqual([REV_TARGET.option]);
    expect(reverseGuide(run, 2).step?.targets).toEqual([REV_TARGET.submit]);
    expect(reverseGuide({ ...run, correctCount: 1, revealedCount: 1 }, 0).finished).toBe(true);
  });
});

describe('Archaeologist guide', () => {
  it('survey → dig → analyze → function → report, only with budget left', () => {
    let s = arch('g');
    expect(archaeologyGuide(s, false).step?.id).toBe('survey');
    const sq = s.squares.flat()[0];
    s = archAct(s, { kind: 'survey', x: sq.x, y: sq.y }).state;
    expect(archaeologyGuide(s, false).step?.id).toBe('dig');
    expect(archaeologyGuide({ ...s, spent: { ...s.spent, excavate: s.budgets.excavate } }, false).step?.id).toBe('function');
    expect(archaeologyGuide(s, true).eligible).toBe(false);
    expect(archaeologyGuide({ ...s, hypotheses: { ...s.hypotheses, function: 'workshop' }, spent: { ...s.spent, excavate: s.budgets.excavate } }, false).step?.targets).toEqual([ARCH_TARGET.report]);
  });
});

describe('Decipher guide', () => {
  it('walks the mystery glyphs then Check; only for the tutorial puzzle', () => {
    const p = generateTutorial();
    let a = blankAttempt(p);
    const nouns = p.glyphs.filter(g => g.role === 'noun');
    expect(decipherGuide(p, a, false).step?.targets).toEqual([DEC_TARGET.row(nouns[0].id)]);
    expect(decipherGuide(p, a, false).eligible).toBe(true);
    nouns.forEach((g, i) => { a = assignGlyph(a, g.id, (['stone', 'water', 'fire', 'tree', 'bird', 'fish'] as const)[i] as never); });
    expect(decipherGuide(p, a, false).step?.targets).toEqual([DEC_TARGET.check]);
    expect(decipherGuide(p, { ...a, solved: true }, false).finished).toBe(true);
  });
});

describe('Escape room guide', () => {
  it('points at the first open station and the door last', () => {
    const ep = getEpisode(DEFAULT_EPISODE_ID)!;
    let st = blankState(ep);
    const first = ep.puzzles.find(p => p.id !== ep.finalPuzzleId)!;
    expect(escapeRoomGuide(ep, st, false).step?.targets).toEqual([ER_TARGET.station(first.id)]);
    st = { ...st, solvedPuzzleIds: ep.puzzles.filter(p => p.id !== ep.finalPuzzleId).map(p => p.id) };
    expect(escapeRoomGuide(ep, st, false).step?.targets).toEqual([ER_TARGET.station(ep.finalPuzzleId)]);
    expect(escapeRoomGuide(ep, { ...st, completed: true }, false).finished).toBe(true);
  });
});

describe('Alien archaeology guide', () => {
  it('study → readings → confidences → report', () => {
    const s = alien('g');
    expect(alienGuide(s, false).step?.id).toBe('study');
    const studied = { ...s, specimens: s.specimens.map((x, i) => ({ ...x, revealed: i === 0 })) };
    expect(alienGuide(studied, false).step?.targets).toEqual([XA_TARGET.reading(ALL_AXES[0])]);
    const read = { ...studied, hypotheses: Object.fromEntries(ALL_AXES.map(a => [a, studied.truth ? 'x' : 'x'])) as never };
    expect(alienGuide(read, false).step?.targets).toEqual([XA_TARGET.confidence(ALL_AXES[0])]);
    const all = { ...read, confidences: Object.fromEntries(ALL_AXES.map(a => [a, 0.5])) as never };
    expect(alienGuide(all, false).step?.targets).toEqual([XA_TARGET.report]);
  });
});

describe('Survival guide', () => {
  it('assign each member, advance, then stop after the first period', () => {
    const c = generateCamp('g');
    const who = c.members.filter(m => !m.injured);
    expect(survivalGuide(c, {}, false).step?.targets).toEqual([SV_TARGET.member(who[0].id)]);
    const all = Object.fromEntries(who.map(m => [m.id, 'rest']));
    expect(survivalGuide(c, all, false).step?.targets).toEqual([SV_TARGET.advance]);
    expect(survivalGuide({ ...c, period: 'day' }, {}, false).finished).toBe(true);
  });
});

describe('Minimum Path guide', () => {
  it('open → begin → walk → done, never eligible after other completions', () => {
    const b = { opened: false, hasRun: false, done: false, steps: 0, otherCompletions: 0 };
    expect(minimumPathGuide(b).step?.targets).toEqual([MP_TARGET.open]);
    expect(minimumPathGuide({ ...b, opened: true }).step?.targets).toEqual([MP_TARGET.begin]);
    expect(minimumPathGuide({ ...b, opened: true, hasRun: true }).step?.targets).toEqual([MP_TARGET.neighbors]);
    expect(minimumPathGuide({ ...b, opened: true, hasRun: true, done: true }).finished).toBe(true);
    expect(minimumPathGuide({ ...b, otherCompletions: 1 }).eligible).toBe(false);
  });
});
