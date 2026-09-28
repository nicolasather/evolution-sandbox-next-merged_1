import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import { autoExhibits } from '@/lib/museum/registry';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;

describe('autoExhibits', () => {
  it('is empty for a fresh engine (no majors found yet)', () => {
    const e = new Engine(db);
    expect(autoExhibits(e)).toEqual([]);
  });

  it('produces one honestly-labelled exhibit per found major', () => {
    const e = new Engine(db);
    const r = e.combine('stone', 'stone'); // sharp_stone — a required major invention
    expect(r.status).toBe('new');
    const exhibits = autoExhibits(e);
    expect(exhibits).toHaveLength(1);
    const ex = exhibits[0];
    expect(ex.discoveryId).toBe('sharp_stone');
    expect(ex.provenance.kind).toBe('reference-reconstruction');
    expect(ex.provenance.note).toMatch(/[Rr]econstruction/);
    expect(ex.provenance.sourceIds?.length).toBeGreaterThan(0);
    expect(ex.sourceMode).toBe('main-evolution');
    expect(ex.createdAt).toBeGreaterThan(0);
  });

  it('never invents a source id — source_required is filtered out', () => {
    const e = new Engine(db);
    e.combine('stone', 'stone');
    const ex = autoExhibits(e)[0];
    expect(ex.provenance.sourceIds).not.toContain('source_required');
  });

  it('is stable and idempotent for the same engine state', () => {
    const e = new Engine(db);
    e.combine('stone', 'stone');
    expect(autoExhibits(e)).toEqual(autoExhibits(e));
  });
});
