import { createHash } from 'node:crypto';
import type { CreativeCatalog } from '../catalog';

/* Ticket 088/089 — what is asked of an asset provider, and the identity of that ask. The brief is built ONLY from
   curated catalogue fields (id, name, material family, curated tags): no player text, no free-form user input. */

export const STYLE_VERSION = 'style-1';

export interface VisualBrief { itemId: string; prompt: string; briefHash: string }

export function briefFor(cat: CreativeCatalog, itemId: string): VisualBrief | null {
  const n = cat.db.nodes.find(x => x.id === itemId);
  const p = cat.profiles.get(itemId);
  if (!n || !p || p.status !== 'verified') return null;
  const tags = [...p.tags].sort().slice(0, 6);
  const name = n.n.replace(/[^\p{L}\p{N} '\-]/gu, '').slice(0, 60);
  // the owner-written description (first line) helps the model draw THIS object; it is curated catalogue text, never player text
  const desc = (n.l1 ?? '').replace(/[^\p{L}\p{N} ,.'\-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  const prompt = `A single simple ${name}, ${p.family} material${tags.length ? `, ${tags.join(', ')}` : ''}${desc ? `. Description: ${desc}` : ''}. Plain stylised museum-study model, no text, no logo, no characters, one object, untextured.`.slice(0, 400);
  return { itemId, prompt, briefHash: createHash('sha256').update(JSON.stringify([itemId, prompt])).digest('hex') };
}

/** Same item + brief + style + provider version => same key (the unique job key). */
export const assetKey = (b: Pick<VisualBrief, 'itemId' | 'briefHash'>, styleVersion: string, providerVersion: string): string =>
  createHash('sha256').update([b.itemId, b.briefHash, styleVersion, providerVersion].join('|')).digest('hex');
