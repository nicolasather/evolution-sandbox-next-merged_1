/** @jest-environment node */
/* HTTP-level tests of /api/quiz/media with an in-memory stand-in for Supabase (no network). They exercise the REAL route code:
 * authorisation of reads (M01–M06, M13, M16), upload authorisation + verification (M08–M12, M15), and idempotent finalize. */
import type { Loose } from '@/lib/quiz/loose';
jest.mock('server-only', () => ({}), { virtual: true });

type Row = Record<string, Loose>;
const mockDb: { tables: Record<string, Row[]>; files: Map<string, Uint8Array>; removed: string[]; rooms: Row[]; players: Row[] } = { tables: {}, files: new Map(), removed: [], rooms: [], players: [] };
const resetDb = () => { mockDb.tables = { media_assets: [], quizzes: [], quiz_questions: [], room_questions: [] }; mockDb.files = new Map(); mockDb.removed = []; mockDb.rooms = []; mockDb.players = []; };

class Q {
  private f: ((r: Row) => boolean)[] = []; private mode: 'select' | 'insert' | 'update' = 'select'; private patch: Row = {}; private row: Row = {}; private head = false; private lim = Infinity; private wantRows = false;
  constructor(private t: string) {}
  select(_c?: string, o?: { count?: string; head?: boolean }) { this.head = !!o?.head; if (this.mode === 'update') this.wantRows = true; return this; }
  insert(row: Row) { this.mode = 'insert'; this.row = row; return this; }
  update(p: Row) { this.mode = 'update'; this.patch = p; return this; }
  eq(c: string, v: unknown) { this.f.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.f.push((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { this.f.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: unknown) { this.f.push((r) => (r[c] ?? null) === v); return this; }
  limit(n: number) { this.lim = n; return this; }
  private run(): Loose {
    const rows = mockDb.tables[this.t]!;
    if (this.mode === 'insert') { rows.push({ status: 'ready', purged_at: null, alt_text: '', ...this.row }); return { data: null, error: null }; }
    const hit = rows.filter((r) => this.f.every((x) => x(r)));
    if (this.mode === 'update') { hit.forEach((r) => Object.assign(r, this.patch)); return { data: this.wantRows ? hit.map((r) => ({ id: r.id })) : null, error: null }; }
    if (this.head) return { count: hit.length, error: null };
    return { data: hit.slice(0, this.lim), error: null };
  }
  async maybeSingle() { const r = this.run(); return { data: r.data?.[0] ?? null, error: r.error }; }
  then(res: (v: Loose) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(this.run()).then(res, rej); }
}
const included = (path: string, tableName: string, pred: (r: Row) => boolean = () => true) => mockDb.tables[tableName]!.filter(pred).some((r) => JSON.stringify(r.payload).includes(path));
const mockFake = {
  from: (t: string) => new Q(t),
  rpc: async (name: string, a: Row) => {
    if (name === 'hit_rate_limit') return { data: true, error: null };
    if (name === 'media_in_published_quiz') return { data: mockDb.tables.quiz_questions!.some((qq) => JSON.stringify(qq.payload).includes(a.p_path) && mockDb.tables.quizzes!.find((q) => q.id === qq.quiz_id)?.status === 'published'), error: null };
    if (name === 'media_in_room') return { data: included(a.p_path, 'room_questions', (r) => r.room_id === a.p_room), error: null };
    return { data: null, error: { code: 'PGRST202', message: 'could not find the function' } };
  },
  storage: { from: () => ({
    createSignedUrl: async (key: string) => ({ data: { signedUrl: `https://sb.test/storage/v1/object/sign/quiz-media/${key}?token=t` }, error: null }),
    createSignedUploadUrl: async (key: string) => ({ data: { signedUrl: `https://sb.test/upload/${key}`, token: 'tok', path: key }, error: null }),
    list: async (folder: string, o: { search: string }) => ({ data: [...mockDb.files.entries()].filter(([k]) => k === `${folder}/${o.search}`).map(([k, v]) => ({ name: k.split('/')[1], metadata: { size: v.length } })), error: null }),
    download: async (key: string) => { const v = mockDb.files.get(key); return v ? { data: new Blob([v as BlobPart]), error: null } : { data: null, error: { message: 'nf' } }; },
    remove: async (keys: string[]) => { keys.forEach((k) => { mockDb.files.delete(k); mockDb.removed.push(k); }); return { data: null, error: null }; },
    upload: async () => ({ error: null }),
  }) },
};
let mockUserId: string | null = null;
jest.mock('@/lib/quiz/supabase', () => ({
  serviceDB: () => mockFake,
  currentUser: async () => { if (!mockUserId) { const { AppError } = jest.requireActual('@/lib/quiz/errors'); throw new AppError('Sign in required', 401); } return { id: mockUserId }; },
  maybeUser: async () => (mockUserId ? { id: mockUserId } : null),
}));
jest.mock('@/lib/quiz/rooms', () => ({
  getRoom: async (id: string) => { const r = mockDb.rooms.find((x) => x.id === id); if (!r) { const { AppError } = jest.requireActual('@/lib/quiz/errors'); throw new AppError('Room not found', 404); } return r; },
  verifyPlayer: async (room: Row, token: string) => { const p = mockDb.players.find((x) => x.room_id === room.id && x.token === token); if (!p) { const { AppError } = jest.requireActual('@/lib/quiz/errors'); throw new AppError('Invalid player token', 403); } return p; },
}));

import { GET, POST } from '../route';

const A = '11111111-1111-1111-1111-111111111111', B = '33333333-3333-3333-3333-333333333333';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pathOf = (owner: string, n: number, ext = 'png') => `quiz-media/${owner}/${uuid(n)}.${ext}`;
const seedAsset = (owner: string, n: number, status = 'ready', ext = 'png') => { mockDb.tables.media_assets!.push({ id: uuid(n), owner_id: owner, storage_path: pathOf(owner, n, ext), mime: 'image/png', bytes: 100, status }); return pathOf(owner, n, ext); };
const get = (path: string, extra = '', headers: Record<string, string> = {}) => GET(new Request(`http://app.test/api/quiz/media?path=${encodeURIComponent(path)}${extra}`, { headers }));
const post = (body: unknown) => POST(new Request('http://app.test/api/quiz/media', { method: 'POST', headers: { 'content-type': 'application/json', host: 'app.test' }, body: JSON.stringify(body) }));
const png = (w: number, h: number, size = 64) => { const b = new Uint8Array(size); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); const dv = new DataView(b.buffer); dv.setUint32(16, w); dv.setUint32(20, h); return b; };

beforeEach(() => { resetDb(); mockUserId = null; });

describe('GET /api/quiz/media — read authorisation', () => {
  it('M01 the owner (signed in) reads their own private file', async () => {
    const p = seedAsset(A, 1); mockUserId = A;
    const r = await get(p); expect(r.status).toBe(200); expect((await r.json()).url).toContain('sb.test');
  });
  it('M02 a visitor with NO Supabase session reads media of a published quiz', async () => {
    const p = seedAsset(A, 2);
    mockDb.tables.quizzes!.push({ id: 'q1', status: 'published' }); mockDb.tables.quiz_questions!.push({ quiz_id: 'q1', payload: { media: { type: 'image', ref: p } } });
    const r = await get(p); expect(r.status).toBe(200); expect((await r.json()).expiresInSeconds).toBe(300);
  });
  it('M03 a visitor guessing the path of a draft quiz\'s media gets the same 404 as a missing file', async () => {
    const p = seedAsset(A, 3); mockDb.tables.quizzes!.push({ id: 'q1', status: 'draft' }); mockDb.tables.quiz_questions!.push({ quiz_id: 'q1', payload: { media: { type: 'image', ref: p } } });
    const hit = await get(p); const miss = await get(pathOf(A, 99));
    expect(hit.status).toBe(404); expect(miss.status).toBe(404); expect(await hit.json()).toEqual(await miss.json());
  });
  it('M04 a different signed-in user cannot read it', async () => {
    const p = seedAsset(A, 4); mockUserId = B; expect((await get(p)).status).toBe(404);
  });
  it('M05 a player with only a room token reads media in that room\'s snapshot (even though the source quiz is now a draft)', async () => {
    const p = seedAsset(A, 5); mockDb.rooms.push({ id: uuid(900), host_id: A }); mockDb.players.push({ room_id: uuid(900), token: 'good' });
    mockDb.tables.room_questions!.push({ room_id: uuid(900), payload: { media: { type: 'image', ref: p } } });
    const r = await get(p, `&room=${uuid(900)}`, { 'x-player-token': 'good' }); expect(r.status).toBe(200);
  });
  it('M05b the signed-in host reads the room\'s media', async () => {
    const p = seedAsset(A, 6); mockDb.rooms.push({ id: uuid(901), host_id: B }); mockDb.tables.room_questions!.push({ room_id: uuid(901), payload: { media: { type: 'image', ref: p } } });
    mockUserId = B; expect((await get(p, `&room=${uuid(901)}`)).status).toBe(200);
    mockUserId = '44444444-4444-4444-4444-444444444444'; expect((await get(p, `&room=${uuid(901)}`)).status).toBe(404); // a different user is not the host
  });
  it('M06 wrong token, token of another room, or media outside the snapshot are all denied', async () => {
    const p = seedAsset(A, 7), other = seedAsset(A, 8);
    mockDb.rooms.push({ id: uuid(902), host_id: A }, { id: uuid(903), host_id: A }); mockDb.players.push({ room_id: uuid(902), token: 'good' });
    mockDb.tables.room_questions!.push({ room_id: uuid(902), payload: { media: { type: 'image', ref: p } } });
    expect((await get(p, `&room=${uuid(902)}`, { 'x-player-token': 'forged' })).status).toBe(404);
    expect((await get(p, `&room=${uuid(903)}`, { 'x-player-token': 'good' })).status).toBe(404); // token belongs to room 902
    expect((await get(other, `&room=${uuid(902)}`, { 'x-player-token': 'good' })).status).toBe(404); // not in this room's snapshot
    expect((await get(p, '', { 'x-player-token': 'good' })).status).toBe(404); // a token without naming the room unlocks nothing
  });
  it('M13 unpublishing a quiz removes the public grant', async () => {
    const p = seedAsset(A, 9); mockDb.tables.quizzes!.push({ id: 'q1', status: 'published' }); mockDb.tables.quiz_questions!.push({ quiz_id: 'q1', payload: { media: { type: 'image', ref: p } } });
    expect((await get(p)).status).toBe(200); mockDb.tables.quizzes![0]!.status = 'draft'; expect((await get(p)).status).toBe(404);
  });
  it('a pending or deleted file is never served', async () => {
    mockUserId = A; for (const [n, s] of [[10, 'pending'], [11, 'deleted'], [12, 'quarantined']] as const) expect((await get(seedAsset(A, n, s))).status).toBe(404);
  });
  it('malformed and traversal paths are 400, before any lookup', async () => {
    for (const bad of ['', 'quiz-media/x', `quiz-media/${A}/../${B}/a.png`, 'https://evil.example/a.png', `quiz-media/${A}/${uuid(1)}.svg`]) expect((await get(bad)).status).toBe(400);
  });
  it('without migration 005 the failure is explicit, not a silent public grant', async () => {
    const orig = mockFake.rpc; (mockFake as unknown as { rpc: unknown }).rpc = async (n: string) => (n === 'hit_rate_limit' ? { data: true, error: null } : { data: null, error: { code: 'PGRST202', message: 'could not find the function' } });
    const p = seedAsset(A, 13); const r = await get(p); (mockFake as unknown as { rpc: unknown }).rpc = orig;
    expect(r.status).toBe(503); expect((await r.json()).error).toMatch(/migration 005/);
  });
});

describe('POST /api/quiz/media — direct upload', () => {
  beforeEach(() => { mockUserId = A; });
  it('init requires sign-in', async () => { mockUserId = null; expect((await post({ action: 'init', size: 100, ext: 'png' })).status).toBe(401); });
  it('init authorises an owner-scoped path and records a PENDING row', async () => {
    const r = await post({ action: 'init', size: 4_000_000, ext: 'png' }); expect(r.status).toBe(201);
    const j = await r.json(); expect(j.path.startsWith(`quiz-media/${A}/`)).toBe(true); expect(j.token).toBe('tok');
    expect(mockDb.tables.media_assets![0]).toMatchObject({ owner_id: A, status: 'pending', bytes: 4_000_000 });
  });
  it('M08 init refuses one byte over the single published cap, and accepts exactly the cap', async () => {
    expect((await post({ action: 'init', size: 26_214_401, ext: 'mp4' })).status).toBe(400);
    expect((await post({ action: 'init', size: 26_214_400, ext: 'mp4' })).status).toBe(201);
  });
  it('init refuses a disallowed extension (svg, html, exe) and unknown keys', async () => {
    for (const ext of ['svg', 'html', 'exe', 'js']) expect((await post({ action: 'init', size: 100, ext })).status).toBe(400);
    expect((await post({ action: 'init', size: 100, ext: 'png', owner: B })).status).toBe(400);
  });
  it('M11 over quota is refused with no pending row left behind', async () => {
    seedAsset(A, 20); mockDb.tables.media_assets![0]!.bytes = 199 * 1024 * 1024;
    const r = await post({ action: 'init', size: 2 * 1024 * 1024, ext: 'png' }); expect(r.status).toBe(400);
    expect(mockDb.tables.media_assets!.filter((x) => x.status === 'pending')).toHaveLength(0);
  });
  it('limits how many uploads may be pending at once', async () => {
    for (let i = 0; i < 10; i++) expect((await post({ action: 'init', size: 100, ext: 'png' })).status).toBe(201);
    expect((await post({ action: 'init', size: 100, ext: 'png' })).status).toBe(429);
  });
  async function started(ext = 'png') { const j = await (await post({ action: 'init', size: 100, ext })).json(); return j as { id: string; path: string }; }
  const put = (path: string, bytes: Uint8Array) => mockDb.files.set(path.slice('quiz-media/'.length), bytes);
  it('finalize verifies the REAL bytes, then marks the file ready — and is idempotent (M15)', async () => {
    const { id, path } = await started(); put(path, png(640, 480));
    const r = await post({ action: 'finalize', id, alt: 'A map' }); expect(r.status).toBe(200);
    expect(mockDb.tables.media_assets![0]).toMatchObject({ status: 'ready', mime: 'image/png', bytes: 64, alt_text: 'A map' });
    const again = await post({ action: 'finalize', id }); expect(again.status).toBe(200); // retry after a lost response
    expect(mockDb.tables.media_assets!.filter((x) => x.status === 'ready')).toHaveLength(1);
  });
  it('M10 a renamed HTML / SVG / executable is rejected at finalize and its stored object is removed', async () => {
    for (const body of ['<html><script>alert(1)</script></html>' + ' '.repeat(40), '<svg xmlns="http://www.w3.org/2000/svg"/>' + ' '.repeat(40), 'MZ' + '\u0090'.repeat(50)]) {
      const { id, path } = await started(); put(path, new TextEncoder().encode(body));
      const r = await post({ action: 'finalize', id }); expect(r.status).toBe(400);
      expect(mockDb.files.has(path.slice(11))).toBe(false); expect(mockDb.tables.media_assets!.find((x) => x.id === id)).toMatchObject({ status: 'deleted' });
    }
  });
  it('M10b a real PNG announced as .mp4 is rejected (type must match what was announced)', async () => {
    const { id, path } = await started('mp4'); put(path, png(10, 10)); expect((await post({ action: 'finalize', id })).status).toBe(400);
  });
  it('M12 an oversized image is refused from its own header — nothing the browser sent can change that', async () => {
    const { id, path } = await started(); put(path, png(9000, 9000)); const r = await post({ action: 'finalize', id }); expect(r.status).toBe(400); expect((await r.json()).error).toMatch(/9000 × 9000/);
  });
  it('an object larger than the cap is rejected from storage metadata without being downloaded', async () => {
    const { id, path } = await started(); put(path, png(10, 10, 26_214_401)); const r = await post({ action: 'finalize', id }); expect(r.status).toBe(413);
    expect(mockDb.files.has(path.slice(11))).toBe(false);
  });
  it('finalize before the PUT lands is a retryable 409, not a failure that destroys the record', async () => {
    const { id } = await started(); const r = await post({ action: 'finalize', id }); expect(r.status).toBe(409);
    expect(mockDb.tables.media_assets!.find((x) => x.id === id)).toMatchObject({ status: 'pending' });
  });
  it('M18 another user cannot finalize (or claim) my upload', async () => {
    const { id, path } = await started(); put(path, png(10, 10)); mockUserId = B;
    expect((await post({ action: 'finalize', id })).status).toBe(404);
    expect(mockDb.tables.media_assets!.find((x) => x.id === id)).toMatchObject({ owner_id: A, status: 'pending' });
  });
  it('unknown steps and unknown fields are refused', async () => {
    expect((await post({ action: 'shout' })).status).toBe(400);
    expect((await post({ action: 'finalize', id: 'not-a-uuid' })).status).toBe(400);
  });
  it('a cross-site request is blocked (CSRF)', async () => {
    const r = await POST(new Request('http://app.test/api/quiz/media', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example', host: 'app.test' }, body: JSON.stringify({ action: 'init', size: 1, ext: 'png' }) }));
    expect(r.status).toBe(403);
  });
});
