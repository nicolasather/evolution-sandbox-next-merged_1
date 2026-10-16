import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import rawDb from '@/data/db.json';
import { playDb } from '../../processing';
import { Engine } from '../../engine';

/* V3 PRESERVATION GOLDENS. Content the curators own must not move because the import pipeline exists.
   Hashes are over PARSED JSON (so Windows CRLF checkouts hash the same). If one fails after an
   intended editorial change, update the constant in the same commit and say why in the commit message. */

const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const readJson = (p: string) => JSON.parse(readFileSync(join(__dirname, '../../../', p), 'utf8'));
function walk(dir: string): string[] {
  return readdirSync(dir).sort().flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
  });
}
const root = join(__dirname, '../../../');

describe('V3 preservation goldens', () => {
  it('data/majors.json (110 curated world inventions) is untouched', () => {
    const majors = readJson('data/majors.json');
    // exp28 adds only source-checked majors (data/exp28); the 110 curated ones must not move
    expect(sha({ ...majors, majors: majors.majors.filter((m: { id: string }) => !m.id.startsWith('exp28_')) })).toBe(GOLD.majors);
  });

  it('the curated Humanity Museum data is untouched', () => {
    const files = walk(join(root, 'data/museum'));
    expect(files.length).toBeGreaterThan(3);
    expect(sha(files.map(f => [f.slice(root.length).replace(/\\/g, '/'), JSON.parse(readFileSync(f, 'utf8'))]))).toBe(GOLD.museum);
  });

  it('the original 918 keep their ids, plate numbers and recipes', () => {
    const first = (rawDb.nodes as { id: string; no: number; rec?: string[][] }[]).filter(n => n.no <= 918);
    expect(first.length).toBe(918);
    expect(sha(first.map(n => [n.id, n.no, n.rec ?? []]))).toBe(GOLD.nodes918);
  });

  it('an old save loads and a fresh engine over the playable graph still starts from the same primitives', () => {
    const e = new Engine(playDb);
    expect(playDb.primitives).toEqual(['stone', 'wood', 'bone', 'fiber']);
    expect(e.found.size).toBe(4);
  });
});

const GOLD = {
  majors: '4257ccf9d8680cdb',
  museum: 'de2dc494e35af039',
  nodes918: 'b3c5a5895b97f6b2',
};
