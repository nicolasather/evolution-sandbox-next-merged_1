import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { catalog } from '../history/data';
import { ADAPTERS, resolvePacket } from '../../modeAdapters';
import { playDb } from '../../processing';
import type { ModeId } from '../../modes/types';

/* Package 065: the Humanity Museum stays editorially curated. Mode packets and new items cannot create
   exhibits or move time gates. */
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? (f === '__tests__' ? [] : walk(p)) : p.endsWith('.ts') ? [p] : []; });

describe('museum is isolated from generated content', () => {
  it('no museum source imports modeAdapters, the AI provider or the proposal/alt routes', () => {
    for (const f of walk(join(__dirname, '..'))) {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/modeAdapters|aiRecipe|altService|altValidation|alt_routes|verified_seeds/);
    }
  });
  it('resolving hostile packets for every mode leaves the curated catalogue untouched', () => {
    const before = JSON.stringify(catalog().exhibits.map(e => e.id));
    for (const id of Object.keys(ADAPTERS) as ModeId[]) {
      resolvePacket(id, { schemaVersion: 1, modeId: id, museum: 'inject', exhibits: ['x'] }, 'seed', playDb);
      resolvePacket(id, '{"museum":true}', 'seed', playDb);
    }
    expect(JSON.stringify(catalog().exhibits.map(e => e.id))).toBe(before);
  });
  it('fixture items from the pilot are not museum exhibits', () => {
    expect(JSON.stringify(catalog().exhibits)).not.toContain('"fx_');
  });
});
