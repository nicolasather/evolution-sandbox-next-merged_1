import { act, fireEvent, render, screen } from '@testing-library/react';
import TDGame from '../TDGame';
import type { TDClient, TDSnap } from '../useTD';
import { addSeat, advance, createMatch, reduceHost } from '@/lib/quiz/td/engine';
import { project } from '@/lib/quiz/td/public';
import { cfg, pool } from '@/lib/quiz/td/testkit';
import type { TDState } from '@/lib/quiz/td/domain';

// the canvas board is covered by the Playwright run; here the screen logic is what is tested
jest.mock('../Board', () => ({ __esModule: true, default: (p: { label: string }) => <div data-testid="board">{p.label}</div> }));

const P = pool(12);
function lobby(): TDState {
  let s = createMatch(cfg({ format: 'versus', teamCount: 2, teamNames: ['Mint Comets', 'Coral Crew'], teamSizeCap: 3 }), P, ['sq1', 'sq2'], 0);
  for (const [id, name] of [['seat-a', 'Ana'], ['seat-b', 'Ben'], ['seat-c', 'Cy']] as const) { const r = addSeat(s, id, name, 0, id === 'seat-c' ? 'sq2' : 'sq1'); if (!r.ok) throw new Error(r.message); s = r.state; }
  return s;
}
function toPhase(s: TDState, phase: string): { s: TDState; now: number } {
  let now = 1000; const st = reduceHost(s, { kind: 'start', override: true }, now).result; if (!st.ok) throw new Error(st.message); s = st.state;
  for (let i = 0; i < 400 && s.phase !== phase; i++) { now += 500; s = advance(s, { now, seed: 'x', pool: P, answers: [] }).state; }
  return { s, now };
}
const snapOf = (s: TDState, now: number, question: Record<string, unknown> | null = null): TDSnap => ({ ...project(s, 'student', 'seat-a', now), revision: s.seq, room: { id: 'r', code: 'ABC123', status: 'active' }, question });
function client(snap: TDSnap, over: Partial<TDClient> = {}): TDClient {
  return { snap, conn: 'connected', error: '', fatal: false, busy: false, local: false, serverNow: () => snap.serverNow, act: jest.fn(async () => ({ ok: true })), host: jest.fn(async () => ({ ok: true })), answer: jest.fn(async () => ({ accepted: true })), openPersonal: jest.fn(async () => null), refresh: jest.fn(async () => {}), ...over };
}

describe('TDGame (student screen)', () => {
  it('lobby: shows both squads, never another squad’s points, and sends a role pick to the server', async () => {
    const c = client(snapOf(lobby(), 0));
    render(<TDGame client={c} />);
    expect(screen.getByRole('heading', { name: 'Get ready' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mint Comets/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Coral Crew/ })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Tactician/ })); });
    expect(c.act).toHaveBeenCalledWith({ kind: 'role', role: 'tactician' });
    // the rival summary carries no points or towers
    const rival = c.snap!.teams.find((t) => t.id === 'sq2')!;
    expect('points' in rival).toBe(false); expect('towers' in rival).toBe(false);
  });

  it('a refused action shows the server’s reason as an alert', async () => {
    const c = client(snapOf(lobby(), 0), { act: jest.fn(async () => ({ ok: false, code: 'SEAT_FULL', message: 'That squad is full.' })) });
    render(<TDGame client={c} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Coral Crew/ })); });
    expect(screen.getByRole('alert')).toHaveTextContent('That squad is full.');
  });

  it('question phase: the question is the only thing on screen (the board is not drawn)', () => {
    const { s, now } = toPhase(lobby(), 'quiz_open');
    const q = { id: s.rounds.at(-1)!.question!.roomQuestionId, kind: 'answer_forge', prompt: 'What is 7 × 8?', base_points: 100, payload: { placeholder: 'Type a number' } };
    render(<TDGame client={client(snapOf(s, now, q))} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('What is 7 × 8?').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('board')).toBeNull();
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });

  it('build phase: board, pads and the ready control are shown; the HUD shows the squad’s points', () => {
    const { s, now } = toPhase(lobby(), 'build');
    render(<TDGame client={client(snapOf(s, now))} />);
    expect(screen.getByTestId('board')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Match status' })).toHaveTextContent(/POINTS\s*\d+/);
    expect(screen.getByText(/of 2 ready/)).toBeInTheDocument();
  });

  it('a lost connection is announced and a fatal error offers the join page', () => {
    const { rerender } = render(<TDGame client={client(snapOf(lobby(), 0), { conn: 'reconnecting' })} />);
    expect(screen.getByRole('status', { name: '' })).toBeTruthy();
    expect(screen.getByText(/Reconnecting/)).toBeInTheDocument();
    rerender(<TDGame client={client(snapOf(lobby(), 0), { fatal: true, error: 'The teacher removed this device from the match.' })} />);
    expect(screen.getByText('The teacher removed this device from the match.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join with a code' })).toHaveAttribute('href', '/quiz/td/join');
  });
});
