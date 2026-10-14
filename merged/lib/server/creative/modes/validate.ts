import type { CreativeCatalog } from '../catalog';
import type { ModeContract } from './contracts';
import { MAX_PACKET_ITEMS, type RawModeOutput } from './types';

/* Ticket 093 — strict validation of model output for a mode packet. The model returns two keys; everything else is
   either refused or produced by the server. A refusal is final for that (mode, seed): there is no "try again until it works". */

export type Validated = { ok: true; output: RawModeOutput } | { ok: false; reason: string };

const URLISH = /(https?:|www\.|ftp:|data:|javascript:|mailto:|<\/?[a-z!][^>]*>|\[[^\]]*\]\([^)]*\)|`{1,3}|\{\{|\}\}|\\u[0-9a-f]{4}|[\u0000-\u0008\u000b\u000c\u000e-\u001f​-‏‪-‮⁦-⁩])/i;
const INJECTION = /\b(ignore (all |any |the )?(previous|prior|above)|system prompt|you are now|as an ai|developer message|disregard|override)\b|\bsystem:|\badmin(istrator)?\b/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function validateModeOutput(c: ModeContract, cat: CreativeCatalog, pool: readonly string[], raw: unknown): Validated {
  let data = raw;
  if (typeof raw === 'string') { if (raw.length > 6000) return { ok: false, reason: 'oversized' }; try { data = JSON.parse(raw); } catch { return { ok: false, reason: 'malformed_json' }; } }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'not_object' };
  const o = data as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 3 || !['schemaVersion', 'approvedItemIds', 'flavor'].every(k => keys.includes(k))) return { ok: false, reason: 'unexpected_fields' };
  if (o.schemaVersion !== 1) return { ok: false, reason: 'schema_version' };

  const ids = o.approvedItemIds;
  if (!Array.isArray(ids) || ids.some(x => typeof x !== 'string')) return { ok: false, reason: 'bad_items' };
  if (!c.usesItems && ids.length) return { ok: false, reason: 'items_not_allowed' };
  if (ids.length > MAX_PACKET_ITEMS || new Set(ids).size !== ids.length) return { ok: false, reason: 'item_count' };
  if (c.usesItems && ids.length < 1) return { ok: false, reason: 'items_required' };
  const poolSet = new Set(pool);
  for (const id of ids as string[]) if (!poolSet.has(id)) return { ok: false, reason: 'item_outside_pool' };   // unknown / invented / not offered

  const fl = o.flavor;
  if (!fl || typeof fl !== 'object' || Array.isArray(fl)) return { ok: false, reason: 'bad_flavor' };
  const fo = fl as Record<string, unknown>;
  const allowed = new Map(c.flavor.map(f => [f.key, f.maxLen]));
  if (Object.keys(fo).length !== allowed.size || Object.keys(fo).some(k => !allowed.has(k))) return { ok: false, reason: 'flavor_fields' };

  const { names, secrets } = c.banned(cat, ids as string[]);
  const nameRe = names.length ? new RegExp(`(^|[^\\p{L}\\p{N}])(${[...new Set(names)].map(escapeRe).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu') : null;
  for (const [k, max] of allowed) {
    const v = fo[k];
    if (typeof v !== 'string') return { ok: false, reason: `flavor_${k}_type` };
    const t = v.trim();
    if (t.length < 8 || t.length > max) return { ok: false, reason: `flavor_${k}_length` };
    if (URLISH.test(t)) return { ok: false, reason: `flavor_${k}_markup` };
    if (INJECTION.test(t)) return { ok: false, reason: `flavor_${k}_instruction` };
    if (c.bannedDigits && /\d/.test(t)) return { ok: false, reason: `flavor_${k}_digits` };
    const low = t.toLowerCase();
    for (const s of secrets) if (low.includes(s)) return { ok: false, reason: `flavor_${k}_secret` };
    if (nameRe?.test(t)) return { ok: false, reason: `flavor_${k}_out_of_scope_item` };      // future-era or out-of-pool item named
    fo[k] = t;
  }
  return { ok: true, output: { schemaVersion: 1, approvedItemIds: ids as string[], flavor: fo as Record<string, string> } };
}
