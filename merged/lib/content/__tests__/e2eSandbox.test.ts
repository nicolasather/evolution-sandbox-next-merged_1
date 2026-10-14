import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { Engine } from '../../engine';
import { playDb } from '../../processing';
import { applyProcessing } from '../../processing/overlay';
import type { ProcessingData } from '../../processing/types';
import type { Db, Discovery } from '../../types';
import { planFor, meshFor } from '../../visual3d/plan';
import { silhouette, silhouetteDistance } from '../../visual3d/silhouette';
import { planFromMaterials } from '../../craft/motionPlan';
import { materialOf } from '../../craft/materials';
import { ADAPTERS, resolvePacket } from '../../modeAdapters';
import { adapterGate } from '../../modeAdapters/runtime';
import { pickChallenge } from '../../minpath/daily';
import { generateRun } from '../../reverseevolution/generate';
import { createRng } from '../../seed';

/* END-TO-END, in isolation. The pilot fixture batch goes through the real CLI into a TEMPORARY sandbox copy, the
   sandbox database is built, loaded by the real Engine, crafted, drawn in 3D, given a motion plan, and offered to the
   modes. Then the sandbox is rolled back and deleted. The real tree is hashed before and after: it must not change. */

const ROOT = process.cwd();
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const REAL_FILES = ['data/db.json', 'data/processing.json', 'data/sources.json', 'data/verified/alt_routes.json', 'data/verified/mode_packets.json'];
const realHash = () => Object.fromEntries(REAL_FILES.map(f => [f, sha(path.join(ROOT, f))]));
const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync('python3', ['tools/verified_content.py', ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });

describe('pilot fixture → sandbox → engine → 3D → motion → modes → rollback', () => {
  const before = realHash();
  const realNodeFiles = readdirSync(path.join(ROOT, 'data/nodes')).sort();
  let sandbox = '';
  let db: Db;
  let backupDir = '';
  const fx = (id: string) => db.nodes.find(n => n.id === id)!;

  beforeAll(() => {
    sandbox = path.join(mkdtempSync(path.join(tmpdir(), 'evo-e2e-')), 'sandbox');
    const dry = run(['publish', '--batch', 'pilot', '--dry-run', '--sandbox', sandbox]);
    expect(dry.status).toBe(0);
    const pub = run(['publish', '--batch', 'pilot', '--apply', '--sandbox', sandbox]);
    expect(pub.status).toBe(0);
    backupDir = (pub.stdout.match(/Backup:\s*(\S+)/) ?? [])[1] ?? '';
    const build = spawnSync('python3', ['tools/build_db.py'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, EVO_ROOT: sandbox } });
    expect(build.status).toBe(0);
    const raw = JSON.parse(readFileSync(path.join(sandbox, 'build/db.json'), 'utf8')) as Db;
    const proc = JSON.parse(readFileSync(path.join(sandbox, 'data/processing.json'), 'utf8')) as ProcessingData;
    db = applyProcessing(raw, proc);
  }, 180_000);

  afterAll(() => { if (sandbox) rmSync(path.dirname(sandbox), { recursive: true, force: true }); });

  it('publishes exactly the 5 valid fixture items; blocked and unsourced ones stay out', () => {
    const ids = db.nodes.filter(n => n.id.startsWith('fx_')).map(n => n.id).sort();
    expect(ids).toEqual(['fx_ground_bone_point', 'fx_ground_pebble', 'fx_hafted_bone_awl', 'fx_lashed_flake_knife', 'fx_twisted_fibre_loop']);
    for (const blocked of ['fx_stone_age_microchip', 'fx_early_copper_ingot', 'fx_fired_clay_bowl', 'fx_sun_dried_block', 'fx_unsourced_charm']) expect(fx(blocked)).toBeUndefined();
  });

  it('the original 918 items keep their ids, numbers and recipes; new ones continue the numbering', () => {
    expect(db.nodes.length).toBe(923);
    for (const o of playDb.nodes) {
      const n = db.nodes.find(x => x.id === o.id)!;
      expect(n).toBeDefined(); expect(n.no).toBe(o.no); expect(n.rec).toEqual(o.rec);
    }
    expect(db.nodes.filter(n => n.id.startsWith('fx_')).map(n => n.no).sort()).toEqual([919, 920, 921, 922, 923]);
  });

  it('the real game data was not touched', () => {
    expect(realHash()).toEqual(before);
    expect(readdirSync(path.join(ROOT, 'data/nodes')).sort()).toEqual(realNodeFiles);
    expect(existsSync(path.join(ROOT, 'data/verified/backups'))).toBe(false);
  });

  describe('real Engine', () => {
    let eng: Engine;
    beforeEach(() => { window.localStorage.clear(); eng = new Engine(db); });

    it('crafts a 3-slot recipe with repeats, then reports it known', () => {
      const r = eng.combineMany(['stone', 'stone', 'stone']);
      expect(r.status).toBe('new');
      if (r.status === 'new') expect(r.node.id).toBe('fx_ground_pebble');
      expect(eng.combineMany(['stone', 'stone', 'stone']).status).toBe('known');
      expect(eng.has('fx_ground_pebble')).toBe(true);
    });
    it('order does not matter, multiplicity does', () => {
      expect(eng.combineMany(['bone', 'stone', 'stone']).status).toBe('new');
      expect(eng.combineMany(['stone', 'bone', 'stone']).status).toBe('known');
      expect(eng.combineMany(['bone', 'bone', 'stone']).status).toBe('fail');
    });
    it('a chain works: the second item needs the first', () => {
      expect(eng.combineMany(['fiber', 'fx_ground_bone_point', 'wood']).status).not.toMatch(/new|known/);
      eng.combineMany(['bone', 'stone', 'stone']);
      const r = eng.combineMany(['fiber', 'fx_ground_bone_point', 'wood']);
      expect(['new', 'tier_locked', 'era_locked']).toContain(r.status);
    });
    it('random combinations overwhelmingly make nothing (player owns everything, 1500 random 2–5 sets)', () => {
      const all = db.nodes.map(n => n.id);
      (eng as unknown as { found: Set<string> }).found = new Set(all);
      const rng = createRng('random-combos');
      let made = 0;
      const N = 1500;
      for (let i = 0; i < N; i++) {
        const k = 2 + Math.floor(rng.next() * 4);
        const r = eng.combineMany(Array.from({ length: k }, () => all[Math.floor(rng.next() * all.length)]));
        if (r.status === 'new' || r.status === 'known') made++;
      }
      expect(made / N).toBeLessThan(0.02);
    });
    it('the old 2-ingredient recipes still work exactly as before', () => {
      const n = db.nodes.find(x => x.rec?.some(r => r.length === 2 && r.every(i => db.primitives.includes(i))) && !x.id.startsWith('fx_'))!;
      const r = n.rec!.find(x => x.length === 2 && x.every(i => db.primitives.includes(i)))!;
      expect(['new', 'tier_locked', 'era_locked']).toContain(eng.combine(r[0], r[1]).status);
    });
  });

  describe('procedural 3D', () => {
    const items = () => db.nodes.filter(n => n.id.startsWith('fx_'));
    it('every published item has an archetype and builds a valid mesh at every LOD', () => {
      for (const n of items()) {
        expect(n.visualArchetype).toBeTruthy();
        for (const lod of [0, 1, 2] as const) {
          const m = meshFor(planFor({ itemId: n.id, archetype: n.visualArchetype!, family: String(n.physicalProperties?.family ?? 'stone') }), lod);
          expect(m.positions.length).toBeGreaterThan(0); expect(m.indices.length % 3).toBe(0);
          expect([...m.positions].every(Number.isFinite)).toBe(true);
          expect(Math.max(...m.indices)).toBeLessThan(m.positions.length / 3);
        }
      }
    });
    it('different archetypes have clearly different silhouettes', () => {
      const sil = items().map(n => ({ id: n.id, a: n.visualArchetype!, s: silhouette(meshFor(planFor({ itemId: n.id, archetype: n.visualArchetype!, family: String(n.physicalProperties?.family) }), 0)) }));
      for (let i = 0; i < sil.length; i++) for (let j = i + 1; j < sil.length; j++) {
        if (sil[i].a !== sil[j].a) expect(silhouetteDistance(sil[i].s, sil[j].s)).toBeGreaterThan(0.03);
      }
    });
    it('is deterministic', () => {
      const n = items()[0];
      const mk = () => silhouette(meshFor(planFor({ itemId: n.id, archetype: n.visualArchetype!, family: 'stone' }), 0)).grid;
      expect(mk()).toBe(mk());
    });
  });

  describe('motion plan', () => {
    it('the pebble (stone×3) and the fibre loop (fibre×3) move differently and stay within the caps', () => {
      const mats = (id: string) => fx(id).rec![0].map(i => materialOf(db.nodes.find(n => n.id === i) ?? { id: i, cat: 'material', era: 'origins' } as Discovery));
      const a = planFromMaterials(mats('fx_ground_pebble'), []);
      const b = planFromMaterials(mats('fx_twisted_fibre_loop'), []);
      expect(a.family).not.toBe(b.family);
      for (const p of [a, b]) { expect(p.particles.count).toBeLessThanOrEqual(48); expect(p.phases.reduce((t, x) => t + x.ms, 0)).toBeLessThanOrEqual(2400); expect(p.reduced.particles).toBe(0); }
    });
  });

  describe('modes', () => {
    it('pipeline items pass the gate only in opt-in modes whose rules they meet; excluded modes say no', () => {
      for (const n of db.nodes.filter(x => x.id.startsWith('fx_'))) {
        for (const m of ['civilization', 'decipher', 'alien-archaeology', 'escape-room'] as const) expect(adapterGate(m, n, db)).toBe(false);
        expect(adapterGate('minimum-path', n, db)).toBe(true);
        expect(adapterGate('reverse-evolution', n, db)).toBe(true);
      }
    });
    it('a reverse-evolution packet for a new item is accepted and the real run generator produces a run', () => {
      const r = resolvePacket('reverse-evolution', { schemaVersion: 1, modeId: 'reverse-evolution', targetId: 'fx_hafted_bone_awl' }, 's', db);
      expect(r.source).toBe('generated');
      expect(() => generateRun(db, 'seed', 'fx_hafted_bone_awl')).not.toThrow();
    });
    it('a minimum-path packet between a new item and an old one is solvable; an unconnected one is refused', () => {
      const ok = resolvePacket('minimum-path', { schemaVersion: 1, modeId: 'minimum-path', start: 'stone', target: 'fx_hafted_bone_awl' }, 's', db);
      expect(['generated', 'fallback']).toContain(ok.source);
      const bad = resolvePacket('minimum-path', { schemaVersion: 1, modeId: 'minimum-path', start: 'stone', target: 'nope' }, 's', db);
      expect(bad.source).not.toBe('generated');
    });
    it('Minimum Path still builds a challenge on the grown database', () => {
      expect(pickChallenge(db, createRng('e2e'))).not.toBeNull();
    });
    it('excluded modes never produce a packet', () => {
      for (const m of ['civilization', 'decipher', 'alien-archaeology', 'escape-room'] as const) {
        expect(ADAPTERS[m].policy).toBe('excluded');
        expect(resolvePacket(m, { schemaVersion: 1 }, 's', db).packet).toBeNull();
      }
    });
  });

  it('rolls the sandbox back: the fixture items disappear again', () => {
    expect(backupDir).not.toBe('');
    const rb = run(['--root', sandbox, 'rollback', '--backup', path.isAbsolute(backupDir) ? backupDir : path.join(sandbox, backupDir)]);
    expect(rb.status).toBe(0);
    const after = readdirSync(path.join(sandbox, 'data/nodes')).join(' ');
    expect(after).not.toMatch(/pilot/);
    expect(realHash()).toEqual(before);
  });
});
