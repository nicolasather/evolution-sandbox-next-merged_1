import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import OSGame from '../OSGame';
import OSJoin from '../OSJoin';
import type { OSClient, OSSnap } from '../useOS';
import { SEAT, build, snapshot, type Scene } from '@/tests/e2e/os-fixtures';

// the canvas course is covered by the Playwright run; here the screen logic is what is tested
jest.mock('../World', () => ({ __esModule: true, default: (p: { label: string }) => <div data-testid="world">{p.label}</div> }));
const mockPush = jest.fn(); const push = mockPush;
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const B = build({ players: 4 });
const snapOf = (scene: Scene, over: Record<string, unknown> = {}) => ({ ...snapshot(B, scene, 'student', SEAT), ...over }) as unknown as OSSnap;
function client(snap: OSSnap, over: Partial<OSClient> = {}): OSClient {
  return { snap, conn: 'connected', error: '', fatal: false, busy: false, local: false, feed: [], serverNow: () => snap.serverNow, input: { set: jest.fn(), hop: jest.fn(), ability: jest.fn(), clear: jest.fn() },
    act: jest.fn(async () => ({ ok: true })), host: jest.fn(async () => ({ ok: true })), answer: jest.fn(async () => ({ accepted: true })), refresh: jest.fn(async () => {}), frame: () => null, cooldowns: () => ({ hop: 0, ability: 0 }), ...over };
}
beforeEach(() => { localStorage.setItem('qz:os:coach', '1'); sessionStorage.clear(); push.mockClear(); });

describe('OSGame (student screen)', () => {
  it('lobby: five roles, a role pick goes to the server, ready toggles, all twelve hazards are explained', async () => {
    const c = client(snapOf('lobby')); render(<OSGame client={c} />);
    expect(screen.getByTestId('os-lobby')).toBeInTheDocument();
    const roles = screen.getAllByRole('button', { pressed: undefined }).filter((b) => b.classList.contains('os-role')); expect(roles).toHaveLength(5);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Medic/ })); }); expect(c.act).toHaveBeenCalledWith({ kind: 'role', role: 'medic' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /I.m ready/ })); }); expect(c.act).toHaveBeenCalledWith({ kind: 'ready', ready: true });
    fireEvent.click(screen.getByText('Hazard guide (12)')); expect(document.querySelectorAll('.os-legend li')).toHaveLength(12);
    expect(screen.getByTestId('os-code')).toHaveTextContent('QZ4K7P');
  });
  it('a rival squad’s points and perks never reach a student', () => {
    const rel = build({ format: 'relay_race', squads: 2, players: 4 }); const s = snapshot(rel, 'traversing', 'student', SEAT) as unknown as OSSnap;
    const rival = s.teams.find((t) => t.id !== s.you!.teamId)!; expect('points' in rival).toBe(false); expect('perks' in rival).toBe(false);
  });
  it('traversing: the HUD shows chapter and squad, controls are enabled, and the page announces the phase', () => {
    render(<OSGame client={client(snapOf('traversing'))} />);
    expect(screen.getByRole('group', { name: 'Match status' })).toHaveTextContent(/CHAPTER\s*1 \/ 4/); expect(screen.getByTestId('world')).toHaveTextContent(/Run/);
    expect(screen.getByRole('button', { name: /^Hop/ })).toBeEnabled(); expect(screen.getByRole('group', { name: 'Move pad' })).toBeInTheDocument();
  });
  it('touch buttons are one-shot: tapping Hop and the ability each call the input once', () => {
    const c = client(snapOf('traversing')); render(<OSGame client={c} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: /^Hop/ })); fireEvent.pointerDown(screen.getByRole('button', { name: /Dash line/ }));
    expect(c.input.hop).toHaveBeenCalledTimes(1); expect(c.input.ability).toHaveBeenCalledTimes(1);
  });
  it('keyboard: arrows move, space hops, E uses the ability', () => {
    const c = client(snapOf('traversing')); render(<OSGame client={c} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' }); expect(c.input.set).toHaveBeenLastCalledWith(1, 0);
    fireEvent.keyDown(window, { key: 'w' }); expect(c.input.set).toHaveBeenLastCalledWith(1, -1); fireEvent.keyUp(window, { key: 'ArrowRight' }); expect(c.input.set).toHaveBeenLastCalledWith(0, -1);
    fireEvent.keyDown(window, { key: ' ' }); expect(c.input.hop).toHaveBeenCalledTimes(1); fireEvent.keyDown(window, { key: 'e' }); expect(c.input.ability).toHaveBeenCalledTimes(1);
  });
  it('keys are ignored while typing in a field and while the world is frozen', () => {
    const c = client(snapOf('barrier')); render(<OSGame client={c} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' }); expect(c.input.set).not.toHaveBeenCalledWith(1, 0);
  });
  it('barrier: the class question is a dialog, says the course is frozen, and the answer goes to the server once', async () => {
    const c = client(snapOf('barrier')); render(<OSGame client={c} />);
    const dlg = screen.getByRole('dialog'); expect(within(dlg).getByText(/Course frozen/)).toBeInTheDocument(); expect(within(dlg).getAllByText('What is 7 × 8?').length).toBeGreaterThan(0);
    // the 1.5s pre-read lock keeps answers closed at first; wait for it to lift
    await waitFor(() => expect(within(dlg).getByRole('textbox')).toBeEnabled(), { timeout: 3000 });
    fireEvent.change(within(dlg).getByRole('textbox'), { target: { value: '56' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: /Submit answer/ })); });
    expect(c.answer).toHaveBeenCalledTimes(1); expect(c.answer).toHaveBeenCalledWith(expect.any(String), expect.anything());
    expect(await screen.findByText(/Answer sent/)).toBeInTheDocument();
  });
  it('barrier: an answered question stays answered after a reload (no second submit offered)', () => {
    const s = snapOf('barrier'); sessionStorage.setItem(`qz:os:ans:${s.room.id}:${s.barrier!.phaseId}`, '1'); render(<OSGame client={client(s)} />);
    expect(screen.getByText(/Answer sent/)).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Submit answer/ })).toBeNull();
  });
  it('reveal: verdict, squad award and the explanation', () => {
    render(<OSGame client={client(snapOf('reveal'))} />); const r = screen.getByTestId('os-reveal');
    expect(r).toHaveTextContent('Correct!'); expect(r).toHaveTextContent('+40 points for your squad');
  });
  it('shop: eight upgrades, reasons for the unavailable ones, and a purchase goes to the server', async () => {
    const c = client(snapOf('build_choice')); render(<OSGame client={c} />); const shop = screen.getByTestId('os-shop');
    expect(within(shop).getAllByRole('button', { name: 'Buy' })).toHaveLength(8); expect(shop).toHaveTextContent('210 points to spend');
    expect(within(shop).getAllByText('Available')).toHaveLength(8); // 210 points buys any single upgrade
    await act(async () => { fireEvent.click(within(shop).getAllByRole('button', { name: 'Buy' })[5]); }); expect(c.act).toHaveBeenCalledWith({ kind: 'purchase', perk: 'team_dash_pad' });
  });
  it('shop: a perk at its limit and one that costs too much are disabled with different reasons', () => {
    const s = snapOf('build_choice'); s.teams = s.teams.map((t) => (t.id === s.you!.teamId ? { ...t, points: 50 } : t)); s.perks = { safety_rail: 3 };
    render(<OSGame client={client(s)} />); const shop = screen.getByTestId('os-shop');
    expect(within(shop).getByText('Limit reached')).toBeInTheDocument(); expect(within(shop).getAllByText(/Need \d+ more points/).length).toBeGreaterThan(3);
    expect(within(shop).getAllByRole('button', { name: 'Buy' })[0]).toBeDisabled();
  });
  it('countdown shows the number; paused shows a banner and disables the touch controls', () => {
    const { unmount } = render(<OSGame client={client(snapOf('countdown'))} />); expect(screen.getByTestId('os-countdown')).toBeInTheDocument(); unmount();
    render(<OSGame client={client(snapOf('traversing', { paused: true }))} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Paused by the teacher'); expect(screen.getByRole('button', { name: /^Hop/ })).toBeDisabled();
  });
  it('finished: results, no student is ranked by name, and the formula is explained for a relay', async () => {
    const rel = build({ format: 'relay_race', squads: 2, players: 4 }); const s = snapshot(rel, 'finished', 'student', SEAT) as unknown as OSSnap;
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ review: [] }) }) as Response) as never;
    await act(async () => { render(<OSGame client={client(s)} />); }); const r = screen.getByTestId('os-results'); expect(r).toHaveTextContent(/45% progress/); expect(r).not.toHaveTextContent('Ada');
  });
  it('errors: a removed device gets a clear message; reconnecting shows a status', () => {
    const { unmount } = render(<OSGame client={client(snapOf('lobby'), { fatal: true, error: 'The teacher removed this device from the match.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('removed this device'); unmount();
    render(<OSGame client={client(snapOf('traversing'), { conn: 'reconnecting' })} />); expect(screen.getByTestId('os-conn')).toHaveTextContent(/Reconnecting/);
  });
  it('first visit shows the four-step coach and remembers it was seen', () => {
    localStorage.removeItem('qz:os:coach'); render(<OSGame client={client(snapOf('lobby'))} />);
    expect(screen.getByRole('dialog', { name: 'Move' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Skip' })); expect(localStorage.getItem('qz:os:coach')).toBe('1');
  });
});
describe('OSJoin', () => {
  beforeEach(() => { global.fetch = jest.fn(async () => ({ ok: true, status: 201, json: async () => ({ roomId: 'room-1' }) }) as Response) as never; });
  it('validates before calling the server, then posts to the OS endpoint and opens the room', async () => {
    render(<OSJoin initialCode="" />); const btn = screen.getByRole('button', { name: 'Join the match' }); expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'abc234' } }); fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ann' } }); expect(btn).toBeEnabled();
    await act(async () => { fireEvent.click(btn); });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/quiz/os/join'); expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ joinCode: 'ABC234', displayName: 'Ann' }); expect(push).toHaveBeenCalledWith('/quiz/os/room-1');
  });
  it('shows the server’s reason when the room is full or locked', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: 'The teacher has closed this room to new players.' }) }) as Response) as never;
    render(<OSJoin initialCode="ABC234" />); fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ann' } }); await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Join the match' })); });
    expect(await screen.findByRole('alert')).toHaveTextContent('closed this room'); expect(push).not.toHaveBeenCalled();
  });
});
