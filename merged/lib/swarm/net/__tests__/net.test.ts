/** @jest-environment node */
import { signToken, verifyToken } from '../tokens';
import { clientPacket, MAX_PACKET_BYTES } from '../protocol';
import { buildView, diffViews, applyDelta, type Viewer, type ViewParts } from '../view';
import { fixtureQuestions, CANARY } from '../../server/fixtures';
import { mkRoom, drive } from '../../testkit';
import type { Room } from '../../domain';

const SECRET = 'unit-secret-unit-secret-1234';
const Q = new Map(fixtureQuestions(40).map((q) => [q.id, q])); const lookup = (id: string) => Q.get(id) ?? null;

describe('tokens', () => {
  it('round-trips and binds to one room, one kind and one expiry', () => {
    const t = signToken({ typ: 'player', room: 'r1', sub: 'p1', ttlSec: 60 }, SECRET);
    expect(verifyToken(t, SECRET, { room: 'r1', typ: 'player' })).toMatchObject({ ok: true, claims: { sub: 'p1', room: 'r1' } });
    expect(verifyToken(t, SECRET, { room: 'r2' })).toEqual({ ok: false, reason: 'room' });
    expect(verifyToken(t, SECRET, { typ: 'host' })).toEqual({ ok: false, reason: 'kind' });
    expect(verifyToken(t, SECRET, { now: Date.now() + 61_000 })).toEqual({ ok: false, reason: 'expired' });
    expect(verifyToken(t, 'another-secret-another-secret', {})).toEqual({ ok: false, reason: 'signature' });
  });
  it('rejects tampering, junk and oversized input; carries no score, team or role', () => {
    const t = signToken({ typ: 'player', room: 'r1', sub: 'p1', ttlSec: 60 }, SECRET); const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), typ: 'host' })).toString('base64url');
    expect(verifyToken(`${forged}.${sig}`, SECRET).ok).toBe(false);
    for (const bad of ['', 'a', 'a.b.c', '.', 'x'.repeat(601), 42, null, {}]) expect(verifyToken(bad, SECRET).ok).toBe(false);
    const claims = JSON.parse(Buffer.from(body!, 'base64url').toString()); expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'jti', 'room', 'sub', 'typ', 'v']);
    expect(() => signToken({ typ: 'host', room: 'r', sub: 's', ttlSec: 1 }, 'short')).toThrow();
  });
});

describe('client packets are strict', () => {
  const ok = (p: unknown) => clientPacket.safeParse(p).success;
  it('accepts the documented shapes', () => {
    expect(ok({ t: 'move', seq: 1, x: 0.5, y: -1 })).toBe(true); expect(ok({ t: 'ability', id: 'a1' })).toBe(true); expect(ok({ t: 'answer', w: 'w1', id: 'x', r: { kind: 'multiple_choice', selectedIds: ['a'] } })).toBe(true);
    expect(ok({ t: 'host', id: 'h1', cmd: { cmd: 'extend', seconds: 15 } })).toBe(true);
  });
  it('refuses anything a client must never decide: scores, positions, extra fields, out-of-range numbers', () => {
    expect(ok({ t: 'move', seq: 1, x: 0.5, y: 0.5, px: 10 })).toBe(false); expect(ok({ t: 'move', seq: 1, x: 40, y: 0 })).toBe(false); expect(ok({ t: 'move', seq: 0, x: 0, y: 0 })).toBe(false);
    expect(ok({ t: 'answer', w: 'w1', id: 'x', r: {}, score: 100 })).toBe(false); expect(ok({ t: 'score', n: 1 })).toBe(false); expect(ok({ t: 'move', seq: 1.5, x: 0, y: 0 })).toBe(false);
    expect(ok({ t: 'host', id: 'h', cmd: { cmd: 'extend', seconds: 9999 } })).toBe(false); expect(ok({ t: 'vote', d: 'd1', u: 'free_points', id: 'v' })).toBe(false); expect(ok({ t: 'role', role: 'admin' })).toBe(false);
    expect(ok({ t: 'ability', id: '../../etc' })).toBe(false); expect(MAX_PACKET_BYTES).toBeLessThanOrEqual(16384);
  });
});

/** Walk a whole match and look at every viewer's snapshot at every few ticks. */
function walk(fx: ReturnType<typeof mkRoom>, each: (room: Room, viewers: Record<string, Viewer>) => void, step = 3) {
  let n = 0; drive(fx, { accuracy: 0.8, maxMs: 25 * 60_000, onTick: (room) => { if (n++ % step === 0) each(room, viewersOf(room)); } });
}
const viewersOf = (room: Room): Record<string, Viewer> => { const v: Record<string, Viewer> = { host: { kind: 'host' }, screen: { kind: 'screen' } }; for (const id of room.rosterOrder) v[id] = { kind: 'player', pid: id }; for (const t of room.teamOrder) v[`screen:${t}`] = { kind: 'screen', focus: t }; return v; };

describe('per-viewer redaction (every phase, every question kind)', () => {
  it('never puts an answer key or explanation in any snapshot before the reveal, and does include it after', () => {
    const fx = mkRoom({ mode: 'versus', sizes: [3, 2], minutes: 10, seed: 5 }); const revealedKinds = new Set<string>(); let preChecks = 0, openSeen = 0;
    walk(fx, (room, viewers) => {
      for (const [name, v] of Object.entries(viewers)) {
        const view = buildView(room, v, 0, lookup); const json = JSON.stringify(view);
        const q = room.quiz; const open = !!q && !q.revealed && (room.phase === 'question' || room.phase === 'freeze');
        if (open || !q) { expect(json).not.toContain(CANARY); expect(json).not.toContain('answerKey'); preChecks++; if (open) openSeen++; }
        if (q?.revealed && room.phase === 'grade' && name === 'host') { expect(json).toContain(CANARY); revealedKinds.add(q.questionId); }
      }
    });
    expect(preChecks).toBeGreaterThan(500); expect(openSeen).toBeGreaterThan(50);
    expect(new Set([...revealedKinds].map((id) => Q.get(id)!.kind)).size).toBe(5); // all five formats were revealed and checked
    expect(fx.room.phase).toBe('results');
  });
  it('shows a student only their own team: no rival wallet, upgrades, offers, roster or avatars', () => {
    const fx = mkRoom({ mode: 'versus', sizes: [2, 2], minutes: 10, seed: 6 }); let checked = 0;
    walk(fx, (room) => {
      const me = room.rosterOrder.find((id) => room.roster[id]!.teamId === 't1')!; const v = buildView(room, { kind: 'player', pid: me }, 0, lookup); const s = v.s as Record<string, unknown>;
      const rival = (s.teams as { id: string; wallet?: number; upgrades?: unknown }[]).find((t) => t.id === 't2'); if (rival) { expect(rival.wallet).toBeUndefined(); expect(rival.upgrades).toBeUndefined(); }
      for (const r of s.roster as { team: string }[]) expect(r.team).toBe('t1'); if (s.draft) expect(JSON.stringify(s.draft)).not.toContain('t2');
      const rivals = room.rosterOrder.filter((id) => room.roster[id]!.teamId === 't2'); for (const id of rivals) expect(v.e.p![id]).toBeUndefined(); checked++;
    }, 7);
    expect(checked).toBeGreaterThan(100);
  });
  it('hides team names from the projector only when the teacher asked, never from the teacher', () => {
    const fx = mkRoom({ mode: 'versus', sizes: [1, 1], seed: 8, config: { hideTeamNames: true, teamNames: ['Mint Comets', 'Coral Crew'] } });
    const screen = buildView(fx.room, { kind: 'screen' }, 0, lookup); const host = buildView(fx.room, { kind: 'host' }, 0, lookup);
    expect(JSON.stringify(screen.s)).not.toContain('Mint Comets'); expect((screen.s.teams as { name: string }[]).map((t) => t.name)).toEqual(['Team 1', 'Team 2']);
    expect((host.s.teams as { name: string }[]).map((t) => t.name)).toEqual(['Mint Comets', 'Coral Crew']);
    drive(fx, { maxMs: 25 * 60_000, stopAt: (r) => r.phase === 'results' || r.phase === 'ending' }); drive(fx, { maxMs: 30_000 });
    if (fx.room.results) expect(JSON.stringify(buildView(fx.room, { kind: 'screen' }, 0, lookup).s.results)).not.toContain('Mint Comets');
  });
});

describe('delta snapshots', () => {
  it('reproduce the full view exactly after every step of a match, for every viewer kind', () => {
    const fx = mkRoom({ mode: 'versus', sizes: [3, 3], minutes: 10, seed: 9 }); const state: Record<string, { prev: ViewParts | null; cur: ViewParts }> = {}; let steps = 0, deltas = 0, bytesDelta = 0, bytesFull = 0;
    walk(fx, (room, viewers) => {
      for (const name of ['host', 'screen', room.rosterOrder[0]!]) {
        const next = buildView(room, viewers[name]!, 0, lookup); const st = state[name] ?? { prev: null, cur: { s: {}, e: {}, fx: [] } };
        const { full, delta } = diffViews(st.prev, next); st.cur = applyDelta(st.cur, delta, full); st.prev = next; state[name] = st;
        expect(st.cur.s).toEqual(next.s); for (const g of Object.keys(next.e)) expect(st.cur.e[g]).toEqual(next.e[g]); steps++;
        if (!full) { deltas++; bytesDelta += JSON.stringify(delta).length; bytesFull += JSON.stringify({ s: next.s, e: next.e }).length; }
      }
    }, 2);
    expect(steps).toBeGreaterThan(300); expect(deltas).toBeGreaterThan(300); expect(bytesDelta).toBeLessThan(bytesFull * 0.5); // deltas are materially smaller than full snapshots
  });
});
