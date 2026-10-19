/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true });
const mockState: { published: Set<string>; assets: { storage_path: string; status: string }[]; rpcError?: { code: string } } = { published: new Set(), assets: [] };
jest.mock('../supabase', () => ({
  serviceDB: () => ({
    rpc: async (_n: string, a: { p_path: string }) => (mockState.rpcError ? { data: null, error: mockState.rpcError } : { data: mockState.published.has(a.p_path), error: null }),
    from: () => ({ select: () => ({ in: async (_c: string, paths: string[]) => ({ data: mockState.assets.filter((x) => paths.includes(x.storage_path)), error: null }) }) }),
  }),
}));
import { assertMediaRefsAllowed } from '../media-refs';

const ME = '11111111-1111-1111-1111-111111111111', THEM = '22222222-2222-2222-2222-222222222222';
const mine = `quiz-media/${ME}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
const theirs = `quiz-media/${THEM}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`;
const q = (...refs: string[]) => refs.map((ref) => ({ payload: { media: { type: 'image', ref, alt: 'x' } } }));
beforeEach(() => { mockState.published = new Set(); mockState.assets = []; mockState.rpcError = undefined; });

describe('quiz save/publish media guard (M18)', () => {
  it('allows a draft that points at the saver\'s own uploads, even before they finish (drafts keep their text)', async () => {
    await expect(assertMediaRefsAllowed(q(mine), ME, 'draft')).resolves.toBeUndefined();
  });
  it('refuses a draft that points at someone else\'s private upload', async () => {
    await expect(assertMediaRefsAllowed(q(theirs), ME, 'draft')).rejects.toMatchObject({ status: 400 });
  });
  it('allows copying media that already appears in a PUBLISHED quiz (duplicate/remix)', async () => {
    mockState.published.add(theirs); await expect(assertMediaRefsAllowed(q(theirs), ME, 'draft')).resolves.toBeUndefined();
  });
  it('publishing needs every referenced upload to exist and be ready', async () => {
    await expect(assertMediaRefsAllowed(q(mine), ME, 'published')).rejects.toThrow(/missing or still uploading/);
    mockState.assets.push({ storage_path: mine, status: 'pending' }); await expect(assertMediaRefsAllowed(q(mine), ME, 'published')).rejects.toThrow(/still uploading/);
    mockState.assets = [{ storage_path: mine, status: 'ready' }]; await expect(assertMediaRefsAllowed(q(mine), ME, 'published')).resolves.toBeUndefined();
  });
  it('a quiz without media never touches the database', async () => {
    await expect(assertMediaRefsAllowed([{ payload: { options: [] } }], ME, 'published')).resolves.toBeUndefined();
  });
  it('a missing migration is reported, not ignored', async () => {
    mockState.rpcError = { code: 'PGRST202' }; await expect(assertMediaRefsAllowed(q(theirs), ME, 'draft')).rejects.toMatchObject({ status: 503 });
  });
});
