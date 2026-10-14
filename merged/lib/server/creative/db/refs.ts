import { createHash } from 'node:crypto';
import type { CreativeCatalog } from '../catalog';
import type { Sql } from './sql';

/* Ticket 076/074 — approved item identities come from the reviewed canonical catalogue (never from a client).
   Verified entries are flagged; legacy placeholders and pending-evidence entries are stored but NOT verified, so
   they can never be a proposal target or a route target (the guard triggers enforce it in SQL as well). */

export async function importApprovedRefs(db: Sql, cat: CreativeCatalog): Promise<{ verified: number; quarantined: number }> {
  let verified = 0, quarantined = 0;
  for (const n of cat.db.nodes) {
    const p = cat.profiles.get(n.id)!;
    const isVerified = p.status === 'verified';
    const hash = createHash('sha256').update(JSON.stringify([n.id, n.src, n.date, n.ds, n.era])).digest('hex');
    await db.query(
      `INSERT INTO creative.approved_item_ref(id, approved_source_hash, is_verified, canonical_era)
       VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`, [n.id, hash, isVerified, n.era]);
    if (isVerified) verified++; else quarantined++;
  }
  return { verified, quarantined };
}
