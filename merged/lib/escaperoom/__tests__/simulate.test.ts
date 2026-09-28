import { BRONZE_WORKSHOP } from '@/lib/escaperoom/episodes/bronzeWorkshop';
import { applyAction, blankState } from '@/lib/escaperoom/simulate';
import type { EpisodeState } from '@/lib/escaperoom/types';

const ep = BRONZE_WORKSHOP;

function solve(state: EpisodeState, id: 'ratio' | 'sequence' | 'match'): EpisodeState {
  if (id === 'ratio') return applyAction(ep, state, { kind: 'submitRatio', puzzleId: 'ratio', value: 10 }).state;
  if (id === 'sequence') return applyAction(ep, state, { kind: 'submitSequence', puzzleId: 'sequence', order: ['model', 'mould', 'meltout', 'pour', 'break'] }).state;
  return applyAction(ep, state, { kind: 'submitMatch', puzzleId: 'match', matches: { crucible: 'melt', tuyere: 'air', ingotmould: 'store', anvil: 'finish' } }).state;
}

describe('applyAction (escape room)', () => {
  it('does not mutate the input state (pure)', () => {
    const s = blankState(ep);
    const before = JSON.stringify(s);
    applyAction(ep, s, { kind: 'submitRatio', puzzleId: 'ratio', value: 10 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('a correct ratio within tolerance solves the station and reveals its fragment', () => {
    const s = blankState(ep);
    const r = applyAction(ep, s, { kind: 'submitRatio', puzzleId: 'ratio', value: 11 }); // within tolerance of 10±2
    expect(r.state.solvedPuzzleIds).toContain('ratio');
    expect(r.events[0].text).toMatch(/"10"/);
  });

  it('a ratio outside tolerance does not solve, and gives a neutral non-punitive message', () => {
    const s = blankState(ep);
    const r = applyAction(ep, s, { kind: 'submitRatio', puzzleId: 'ratio', value: 40 });
    expect(r.state.solvedPuzzleIds).not.toContain('ratio');
    expect(r.events[0].text).toMatch(/not quite/i);
  });

  it('the sequence puzzle only accepts the exact correct order', () => {
    const s = blankState(ep);
    const wrong = applyAction(ep, s, { kind: 'submitSequence', puzzleId: 'sequence', order: ['mould', 'model', 'meltout', 'pour', 'break'] });
    expect(wrong.state.solvedPuzzleIds).not.toContain('sequence');
    const right = applyAction(ep, s, { kind: 'submitSequence', puzzleId: 'sequence', order: ['model', 'mould', 'meltout', 'pour', 'break'] });
    expect(right.state.solvedPuzzleIds).toContain('sequence');
  });

  it('the match puzzle requires every item correctly matched, not just some', () => {
    const s = blankState(ep);
    const partial = applyAction(ep, s, {
      kind: 'submitMatch', puzzleId: 'match',
      matches: { crucible: 'melt', tuyere: 'air', ingotmould: 'finish', anvil: 'store' },
    });
    expect(partial.state.solvedPuzzleIds).not.toContain('match');
  });

  it('the exit code cannot even be attempted until all three stations are solved', () => {
    let s = blankState(ep);
    const r = applyAction(ep, s, { kind: 'submitCode', puzzleId: 'exit', code: '10-5-CT' });
    expect(r.state.solvedPuzzleIds).not.toContain('exit');
    expect(r.state.completed).toBe(false);
    expect(r.events[0].text).toMatch(/other stations/i);

    s = solve(s, 'ratio');
    s = solve(s, 'sequence');
    // still missing 'match'
    const stillBlocked = applyAction(ep, s, { kind: 'submitCode', puzzleId: 'exit', code: '10-5-CT' });
    expect(stillBlocked.state.completed).toBe(false);
  });

  it('solving all three stations then the exit code completes the episode', () => {
    let s = blankState(ep);
    s = solve(s, 'ratio');
    s = solve(s, 'sequence');
    s = solve(s, 'match');
    const r = applyAction(ep, s, { kind: 'submitCode', puzzleId: 'exit', code: '10-5-ct' }); // case-insensitive
    expect(r.state.completed).toBe(true);
    expect(r.state.solvedPuzzleIds).toContain('exit');
  });

  it('revealHint marks a hint revealed and logs it, without counting as an attempt', () => {
    const s = blankState(ep);
    const r = applyAction(ep, s, { kind: 'revealHint', puzzleId: 'ratio' });
    expect(r.state.hintsRevealed.ratio).toBe(true);
    expect(r.state.attempts.ratio ?? 0).toBe(0);
  });

  it('attempts increments on every submit, right or wrong', () => {
    let s = blankState(ep);
    s = applyAction(ep, s, { kind: 'submitRatio', puzzleId: 'ratio', value: 40 }).state; // wrong
    s = applyAction(ep, s, { kind: 'submitRatio', puzzleId: 'ratio', value: 10 }).state; // right
    expect(s.attempts.ratio).toBe(2);
  });

  it('does nothing once the episode is completed', () => {
    let s = blankState(ep);
    s = solve(s, 'ratio'); s = solve(s, 'sequence'); s = solve(s, 'match');
    s = applyAction(ep, s, { kind: 'submitCode', puzzleId: 'exit', code: '10-5-CT' }).state;
    const beforeSolved = [...s.solvedPuzzleIds];
    const r = applyAction(ep, s, { kind: 'revealHint', puzzleId: 'ratio' });
    expect(r.state.solvedPuzzleIds).toEqual(beforeSolved);
    expect(r.events[0].text).toMatch(/already open/i);
  });

  it('resubmitting an already-solved puzzle is a harmless no-op', () => {
    let s = blankState(ep);
    s = solve(s, 'ratio');
    const r = applyAction(ep, s, { kind: 'submitRatio', puzzleId: 'ratio', value: 10 });
    expect(r.state.attempts.ratio).toBe(s.attempts.ratio);
    expect(r.events[0].text).toMatch(/already solved/i);
  });
});
