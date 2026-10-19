/**
 * Database tests for migration 005 (media authorisation, one size cap, retention). Real SQL on a scratch PostgreSQL:
 *   QUIZ_TEST_DATABASE_URL=postgres://… npx jest -c jest.db.config.js --runInBand lib/quiz/__tests__/media-access.db.test.ts
 * The database must already have migrations 001–005 applied. NEVER point this at production: it creates and removes its own users, quizzes and rooms.
 */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const URL = process.env.QUIZ_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite('database: media access, size cap and clean-up (migration 005)', () => {
  const pool = new Pool({ connectionString: URL, max: 4 });
  const q = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows;
  const fn = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0]?.r;
  const users: string[] = []; const quizzes: string[] = [];
  let A = '';
  const assetPath = (owner: string, ext = 'png') => `quiz-media/${owner}/${randomUUID()}.${ext}`;
  const mcWith = (ref: string) => [{ kind: 'multiple_choice', prompt: 'Look', basePoints: 100, payload: { media: { type: 'image', ref, alt: 'a picture' }, options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, answerKey: { correctIds: ['a'] } }];
  async function mkUser() { const id = randomUUID(); await q('insert into auth.users(id,email) values($1,$2)', [id, `${id}@test.invalid`]); users.push(id); return id; }
  async function mkAsset(owner: string, path: string, over: { bytes?: number; status?: string; ageDays?: number } = {}) {
    await q(`insert into media_assets(owner_id,storage_path,mime,bytes,status,created_at) values($1,$2,'image/png',$3,$4, now() - ($5 || ' days')::interval)`, [owner, path, over.bytes ?? 1000, over.status ?? 'ready', String(over.ageDays ?? 0)]);
  }
  async function mkQuiz(owner: string, ref: string, status: 'draft' | 'published') {
    const id = await fn('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [owner, 'M-' + randomUUID().slice(0, 6), 'd', status, JSON.stringify(mcWith(ref))]);
    quizzes.push(id); return id as string;
  }
  const inPub = (p: string) => fn('select media_in_published_quiz($1) as r', [p]);
  const status = async (p: string) => (await q('select status from media_assets where storage_path=$1', [p]))[0].status as string;

  beforeAll(async () => { A = await mkUser(); });
  afterAll(async () => {
    await q('delete from quizzes where id = any($1::uuid[])', [quizzes]);
    await q('delete from auth.users where id = any($1::uuid[])', [users]);
    await pool.end();
  });

  it('uses ONE size cap: 26,214,400 bytes is accepted, one more is rejected, and the old 20,000,000 limit is gone', async () => {
    await mkAsset(A, assetPath(A, 'mp4'), { bytes: 26_214_400 });
    await mkAsset(A, assetPath(A, 'mp4'), { bytes: 20_000_001 });
    await expect(mkAsset(A, assetPath(A, 'mp4'), { bytes: 26_214_401 })).rejects.toThrow(/media_assets_bytes_check/);
    await expect(mkAsset(A, assetPath(A, 'mp4'), { bytes: 0 })).rejects.toThrow(/media_assets_bytes_check/);
  });
  it('knows the pending status and nothing else', async () => {
    await mkAsset(A, assetPath(A), { status: 'pending' });
    await expect(mkAsset(A, assetPath(A), { status: 'public' })).rejects.toThrow(/media_assets_status_check/);
  });
  it('authorises exactly the paths a PUBLISHED quiz references', async () => {
    const used = assetPath(A), other = assetPath(A), draftOnly = assetPath(A);
    await mkAsset(A, used); await mkAsset(A, other); await mkAsset(A, draftOnly);
    const pub = await mkQuiz(A, used, 'published');
    await mkQuiz(A, draftOnly, 'draft');
    expect(await inPub(used)).toBe(true);
    expect(await inPub(other)).toBe(false);        // M03: guessed path of an unrelated asset
    expect(await inPub(draftOnly)).toBe(false);    // M03/M04: media of a draft
    await q("update quizzes set status='draft' where id=$1", [pub]);
    expect(await inPub(used)).toBe(false);         // M13: unpublish removes the public grant
    await q("update quizzes set status='published' where id=$1", [pub]);
    expect(await inPub(used)).toBe(true);
    await q('delete from quizzes where id=$1', [pub]);
    expect(await inPub(used)).toBe(false);         // M13: delete removes it too
  });
  it('rejects malformed or traversal paths outright', async () => {
    for (const p of ['', 'quiz-media/x', `quiz-media/${A}/../${A}/x.png`, '%', `quiz-media/${A}/${randomUUID()}.svg.png`, 'other-bucket/a/b.png'])
      expect(await inPub(p)).toBe(false);
  });
  it('authorises a room only for media in ITS OWN immutable snapshot (M05/M06)', async () => {
    const mine = assetPath(A), notMine = assetPath(A);
    await mkAsset(A, mine); await mkAsset(A, notMine);
    const qz = await mkQuiz(A, mine, 'published');
    const cfg = { durationSeconds: 900, questionSeconds: null, modifiers: [], slotLimit: 3, teamNames: [] };
    const room = await fn('select create_room_with_content($1,$2,$3,$4,$5::jsonb,$6,$7::text[],$8) as r', [A, qz, 'online', 'synchronized', JSON.stringify(cfg), randomUUID().slice(0, 6).toUpperCase(), [], null]);
    const other = await fn('select create_room_with_content($1,$2,$3,$4,$5::jsonb,$6,$7::text[],$8) as r', [A, await mkQuiz(A, notMine, 'published'), 'online', 'synchronized', JSON.stringify(cfg), randomUUID().slice(0, 6).toUpperCase(), [], null]);
    expect(await fn('select media_in_room($1,$2) as r', [room.roomId, mine])).toBe(true);
    expect(await fn('select media_in_room($1,$2) as r', [room.roomId, notMine])).toBe(false);
    expect(await fn('select media_in_room($1,$2) as r', [other.roomId, mine])).toBe(false);
    // the snapshot survives the source quiz being unpublished (a running game must keep its pictures)
    await q("update quizzes set status='draft' where id=$1", [qz]);
    expect(await inPub(mine)).toBe(false);
    expect(await fn('select media_in_room($1,$2) as r', [room.roomId, mine])).toBe(true);
  });
  it('clean-up keeps anything still referenced (quiz, room snapshot, revision) and removes only true orphans and abandoned uploads (M11/M14/M15)', async () => {
    const inQuiz = assetPath(A), orphan = assetPath(A), freshOrphan = assetPath(A), abandoned = assetPath(A), freshPending = assetPath(A);
    await mkAsset(A, inQuiz, { ageDays: 30 }); await mkAsset(A, orphan, { ageDays: 30 }); await mkAsset(A, freshOrphan, { ageDays: 1 });
    await mkAsset(A, abandoned, { status: 'pending', ageDays: 1 }); await mkAsset(A, freshPending, { status: 'pending', ageDays: 0 });
    await mkQuiz(A, inQuiz, 'published');
    const r = await fn('select cleanup_quiz_studio_data() as r');
    expect(r.abandonedUploads).toBeGreaterThanOrEqual(1);
    expect(await status(inQuiz)).toBe('ready');
    expect(await status(orphan)).toBe('deleted');
    expect(await status(freshOrphan)).toBe('ready');     // inside the 7-day grace period
    expect(await status(abandoned)).toBe('deleted');
    expect(await status(freshPending)).toBe('pending');  // upload may still be in flight
  });
  it('the new functions are callable by service_role only', async () => {
    for (const sig of ['media_in_published_quiz(text)', 'media_in_room(uuid,text)', 'cleanup_quiz_studio_data()']) {
      for (const role of ['anon', 'authenticated', 'public']) {
        const [{ ok }] = await q(`select has_function_privilege($1, '${sig}', 'execute') as ok`, [role === 'public' ? 'anon' : role]);
        expect(ok).toBe(false);
      }
      const [{ ok }] = await q(`select has_function_privilege('service_role', '${sig}', 'execute') as ok`);
      expect(ok).toBe(true);
    }
  });
  it('media_assets stays unreadable for anon and authenticated (RLS on, no grants)', async () => {
    for (const role of ['anon', 'authenticated']) {
      const [{ ok }] = await q(`select has_table_privilege($1, 'public.media_assets', 'select') as ok`, [role]);
      expect(ok).toBe(false);
    }
  });
});
