import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { playDb } from '../../processing';
import { ACTIONS_LIST } from '../actionList';
import { allowlistFor, suggestAlternatives } from '../altService';
import { validateAltResponse, type AltContext } from '../altValidation';
import { MockProvider, NoneProvider, HttpProvider, providerFromEnv } from '../../server/aiRecipeProvider';
import { ALT_SYSTEM_PROMPT } from '../../server/aiRecipePrompts';
import { checkOwner } from '../../server/ownerAuth';
import { buildRecipeIndex } from '../strictCraft';
import { ACTIONS } from '../../processing/actions';

const resp = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => body }) as unknown as Response;

const target = playDb.nodes.find(n => n.id === 'axe')!;
const allow = allowlistFor(playDb, 'axe');
const ctx: AltContext = {
  db: playDb, allowlist: new Set(allow), actions: new Set(ACTIONS_LIST),
  knownSourceIds: new Set(Object.keys(playDb.sources)), index: buildRecipeIndex(playDb),
};
const EXPL = 'A stone head is bound to a wooden shaft with plant cord so the head stays fixed when swung.';
const mk = (p: object) => JSON.stringify({ schemaVersion: 1, targetId: 'axe', proposals: [p] });
const good = { ingredientIds: ['stone_flake', 'wood', 'strands', 'bark'], action: 'tie', explanation: EXPL, evidenceClass: 'plausible_reconstruction' };

describe('alternative proposals — trust boundary', () => {
  it('the action list equals the Python one (types.ts + assemble)', () => {
    const py = readFileSync(join(__dirname, '../../../tools/content/causal.py'), 'utf8');
    expect(py).toContain('assemble');
    expect(ACTIONS_LIST).toContain('assemble');
    expect(ACTIONS_LIST.length).toBe(Object.keys(ACTIONS).length + 1);
  });

  it('NONE is a valid, first-class answer', () => {
    const r = validateAltResponse(JSON.stringify({ schemaVersion: 1, targetId: 'axe', proposals: [] }), 'axe', ctx);
    expect(r.outcome).toBe('none');
  });

  it('rejects malformed JSON, wrong target, bad version, extra fields, too many proposals', () => {
    expect(validateAltResponse('not json {', 'axe', ctx).reasons).toContain('MALFORMED_JSON');
    expect(validateAltResponse(JSON.stringify({ schemaVersion: 1, targetId: 'bow', proposals: [] }), 'axe', ctx).reasons).toContain('TARGET_MISMATCH');
    expect(validateAltResponse(JSON.stringify({ schemaVersion: 2, targetId: 'axe', proposals: [] }), 'axe', ctx).reasons).toContain('BAD_SCHEMA_VERSION');
    expect(validateAltResponse(JSON.stringify({ schemaVersion: 1, targetId: 'axe', proposals: [], extra: 1 }), 'axe', ctx).reasons).toContain('UNEXPECTED_FIELD');
    const many = Array(4).fill(good);
    expect(validateAltResponse(JSON.stringify({ schemaVersion: 1, targetId: 'axe', proposals: many }), 'axe', ctx).reasons).toContain('TOO_MANY_PROPOSALS');
    expect(validateAltResponse('x'.repeat(40_000), 'axe', ctx).reasons).toContain('MALFORMED_JSON');
  });

  it('rejects each kind of bad proposal with its own code', () => {
    const code = (p: object) => validateAltResponse(mk(p), 'axe', ctx).results[0].reasons;
    expect(code({ ...good, ingredientIds: ['stone'] })).toContain('BAD_CARDINALITY');
    expect(code({ ...good, ingredientIds: Array(6).fill('stone') })).toContain('BAD_CARDINALITY');
    expect(code({ ...good, ingredientIds: ['stone', 'not_in_allowlist_xyz'] })).toContain('INGREDIENT_NOT_ALLOWED');
    expect(code({ ...good, ingredientIds: ['stone', 'axe', 'wood'] })).toContain('INGREDIENT_NOT_ALLOWED'); // target is not in its own pool
    expect(code({ ...good, action: 'teleport' })).toContain('BAD_ACTION');
    expect(code({ ...good, explanation: 'they go together' })).toContain('EXPLANATION_TOO_SHORT');
    expect(code({ ...good, explanation: 'The stone symbolically represents the spirit of the axe, somehow related to it.' })).toContain('WEAK_ASSOCIATION');
    expect(code({ ...good, evidenceClass: 'certain' })).toContain('BAD_EVIDENCE_CLASS');
    expect(code({ ...good, evidenceClass: 'documented' })).toContain('INFLATED_SOURCES');
    expect(code({ ...good, sourceSupportIds: ['made_up_source'] })).toContain('INFLATED_SOURCES');
    expect(code({ ...good, name: 'Quantum Axe', date: '3000 BCE' })).toContain('NEW_ITEM_ATTEMPT');
  });

  it('rejects a route that already belongs to the target or to another item', () => {
    const own = target.rec![0];
    expect(validateAltResponse(mk({ ...good, ingredientIds: own }), 'axe', ctx).results[0].reasons)
      .toEqual(expect.arrayContaining(['DUPLICATE_ROUTE_SAME_TARGET']));
    const other = playDb.nodes.find(n => n.id === 'stone_flake')!.rec![0];
    const r = validateAltResponse(mk({ ...good, ingredientIds: other }), 'axe', ctx).results[0].reasons;
    expect(r.some(x => x === 'ROUTE_CLAIMED_BY_OTHER_TARGET' || x === 'INGREDIENT_NOT_ALLOWED')).toBe(true);
  });

  it('a schema-valid proposal creates no Discovery and changes no recipe', () => {
    const before = JSON.stringify(playDb.nodes.map(n => [n.id, n.rec]));
    const free = allow.filter(a => !['stone_flake'].includes(a));
    const ids = [free[0], free[1], free[2]];
    const key = new Set(ids);
    expect(key.size).toBe(3);
    const r = validateAltResponse(mk({ ...good, ingredientIds: ids }), 'axe', ctx);
    expect(r.results.length).toBe(1);
    expect(JSON.stringify(playDb.nodes.map(n => [n.id, n.rec]))).toBe(before);
    expect(playDb.nodes.length).toBe(918);
  });
});

describe('provider adapters', () => {
  it('no credentials ⇒ NONE provider, and the service returns outcome none', async () => {
    expect(providerFromEnv({})).toBeInstanceOf(NoneProvider);
    const r = await suggestAlternatives(playDb, 'axe', new NoneProvider());
    expect(r.outcome).toBe('none');
  });

  it('mock provider output is validated like any other', async () => {
    const bad = new MockProvider({ axe: mk({ ...good, ingredientIds: ['stone', 'quantum_axe_zz'] }) });
    expect((await suggestAlternatives(playDb, 'axe', bad)).outcome).toBe('rejected_response');
    const junk = new MockProvider({ axe: '<html>sorry</html>' });
    expect((await suggestAlternatives(playDb, 'axe', junk)).reasons).toContain('MALFORMED_JSON');
  });

  it('unknown target is an error, not a throw', async () => {
    const r = await suggestAlternatives(playDb, 'no_such_target', new NoneProvider());
    expect(r.error).toBe('unknown_target');
  });

  it('http provider turns outages, rate limits and bad bodies into NONE (mock fetch only)', async () => {
    const mkP = (f: typeof fetch) => new HttpProvider({ url: 'https://example.invalid', apiKey: 'k', model: 'm', fetchImpl: f, timeoutMs: 50, maxRetries: 0 });
    const input = { targetId: 'axe', targetName: 'Axe', verifiedFacts: [], allowlist: [], existingRoutes: [], actions: [] };
    const noneStr = JSON.stringify({ schemaVersion: 1, targetId: 'axe', proposals: [] });
    expect(await mkP((async () => resp('x', 429)) as typeof fetch).propose(input)).toBe(noneStr);
    expect(await mkP((async () => { throw new Error('offline'); }) as typeof fetch).propose(input)).toBe(noneStr);
    expect(await mkP((async () => resp('y'.repeat(40_000))) as typeof fetch).propose(input)).toBe(noneStr);
    expect(await mkP((async () => resp(JSON.stringify({ content: [{ type: 'text', text: '{"ok":1}' }] }))) as typeof fetch).propose(input)).toBe('{"ok":1}');
  });

  it('the prompt keeps its rejection-first rules', () => {
    expect(ALT_SYSTEM_PROMPT).toMatch(/NO routes is a correct/);
    expect(ALT_SYSTEM_PROMPT).toMatch(/Never invent items/);
    expect(ALT_SYSTEM_PROMPT).toMatch(/similarity|symbolism/);
  });
});

describe('owner gate', () => {
  const H = (v?: string) => ({ get: (k: string) => (k.toLowerCase() === 'authorization' ? v ?? null : null) });
  const open = { ENABLE_DEV_TOOLS: 'true', OWNER_REVIEW_TOKEN: 'secret-token-123' };
  it('is a 404 unless the dev gate AND the token are configured', () => {
    expect(checkOwner(H('Bearer secret-token-123'), {})).toMatchObject({ ok: false, status: 404 });
    expect(checkOwner(H('Bearer secret-token-123'), { ENABLE_DEV_TOOLS: 'true' })).toMatchObject({ ok: false, status: 404 });
    expect(checkOwner(H('Bearer secret-token-123'), { ...open, VERCEL_ENV: 'production' })).toMatchObject({ ok: false, status: 404 });
  });
  it('requires the exact bearer token', () => {
    expect(checkOwner(H(), open)).toMatchObject({ ok: false, status: 401, reason: 'missing_token' });
    expect(checkOwner(H('Bearer wrong'), open)).toMatchObject({ ok: false, status: 401, reason: 'bad_token' });
    expect(checkOwner(H('Bearer secret-token-124'), open)).toMatchObject({ ok: false, status: 401 });
    expect(checkOwner(H('Bearer secret-token-123'), open)).toEqual({ ok: true });
  });
});

describe('approved alternative routes reach the playable graph', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mergeAltRoutes, processingData } = require('../../processing');
  const known = new Set<string>(playDb.nodes.map(n => n.id));

  it('the shipped overlay is empty: no alternative is playable until an editor approves one', () => {
    expect(JSON.parse(readFileSync(join(__dirname, '../../../data/verified/alt_routes.json'), 'utf8')).routes).toEqual([]);
  });

  it('adds a recipe to an existing target and creates no item', () => {
    const merged = mergeAltRoutes(processingData, [{ targetId: 'axe', ingredientIds: ['stone', 'wood', 'bone'] }], known);
    expect(merged.recipes.add.length).toBe(processingData.recipes.add.length + 1);
    expect(merged.recipes.add.at(-1)).toEqual({ id: 'axe', rec: ['stone', 'wood', 'bone'] });
  });

  it('skips unknown targets, unknown ingredients, bad cardinality and junk without throwing', () => {
    const rows = [
      { targetId: 'nope', ingredientIds: ['stone', 'wood'] }, { targetId: 'axe', ingredientIds: ['stone', 'ghost_item'] },
      { targetId: 'axe', ingredientIds: ['stone'] }, { targetId: 'axe', ingredientIds: Array(6).fill('stone') },
      null, { targetId: 'axe' },
    ];
    expect(mergeAltRoutes(processingData, rows, known)).toBe(processingData);
  });
});
