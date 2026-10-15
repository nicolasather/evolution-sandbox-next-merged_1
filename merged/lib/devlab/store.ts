/* Local file store for the Visual Lab (development only). Everything lives under dev-data/visual-lab/. */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import type { Dataset, Decision, GenRecord, Review } from './types';

export const ID_RE = /^vl_[a-z0-9_]{1,60}$/;

export function labDir(): string {
  return path.resolve(process.env.VISUAL_LAB_DIR || path.join(process.cwd(), 'dev-data', 'visual-lab'));
}

function ensure(dir: string): string { mkdirSync(dir, { recursive: true }); return dir; }

function writeJsonAtomic(file: string, data: unknown): void {
  ensure(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 1));
  renameSync(tmp, file);
}

export function readDataset(dir = labDir()): Dataset {
  return JSON.parse(readFileSync(path.join(dir, 'dataset.json'), 'utf8')) as Dataset;
}

export function resultPath(id: string, dir = labDir()): string {
  if (!ID_RE.test(id)) throw new Error(`invalid resource id: ${id}`);
  return path.join(dir, 'results', `${id}.json`);
}

export function readResult(id: string, dir = labDir()): GenRecord | null {
  const f = resultPath(id, dir);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as GenRecord) : null;
}

/** Writes a record. An existing record is never lost: it is first copied to results/_archive/<id>.v<version>.<n>.json. */
export function writeResult(rec: GenRecord, dir = labDir()): void {
  const f = resultPath(rec.id, dir);
  if (existsSync(f)) {
    const prev = JSON.parse(readFileSync(f, 'utf8')) as GenRecord;
    const arch = ensure(path.join(dir, 'results', '_archive'));
    let n = 0;
    while (existsSync(path.join(arch, `${rec.id}.v${prev.version}.${n}.json`))) n++;
    writeFileSync(path.join(arch, `${rec.id}.v${prev.version}.${n}.json`), JSON.stringify(prev, null, 1));
  }
  writeJsonAtomic(f, rec);
}

export function listResults(dir = labDir()): GenRecord[] {
  const d = path.join(dir, 'results');
  if (!existsSync(d)) return [];
  return readdirSync(d).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(path.join(d, f), 'utf8')) as GenRecord);
}

export function writePreview(id: string, svg: string, dir = labDir()): string {
  if (!ID_RE.test(id)) throw new Error(`invalid resource id: ${id}`);
  const rel = `previews/${id}.svg`;
  ensure(path.join(dir, 'previews'));
  writeFileSync(path.join(dir, rel), svg);
  return rel;
}

/* ── manual review (approve / reject / scores) ─────────────────────────── */

const reviewsFile = (dir: string) => path.join(dir, 'reviews.json');

export function readReviews(dir = labDir()): Record<string, Review> {
  const f = reviewsFile(dir);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Record<string, Review>) : {};
}

export function setReview(id: string, decision: Decision, extra: { scores?: Review['scores']; note?: string } = {}, dir = labDir()): Review {
  if (!ID_RE.test(id)) throw new Error(`invalid resource id: ${id}`);
  const all = readReviews(dir);
  const scores: Review['scores'] = {};
  for (const [k, v] of Object.entries(extra.scores ?? {})) {
    if (['recognizability', 'style', 'detail', 'uniqueness', 'composition'].includes(k) && typeof v === 'number' && v >= 1 && v <= 5) (scores as Record<string, number>)[k] = Math.round(v);
  }
  const rev: Review = { decision, scores: Object.keys(scores).length ? scores : all[id]?.scores, note: (extra.note ?? all[id]?.note)?.slice(0, 500), at: new Date().toISOString() };
  all[id] = rev;
  writeJsonAtomic(reviewsFile(dir), all);
  return rev;
}
