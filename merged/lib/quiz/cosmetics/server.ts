import 'server-only';
import { serviceDB } from '../supabase';
import { AppError } from '../errors';
import { applyEvent, emptyLedger, refreshUnlocks, type Ledger, type LedgerEvent } from './ledger';

/** Rebuilds a person's collection from the append-only event table. Unlocks are never stored as a balance, so they can always be re-derived and audited. */
export async function loadCosmetics(userId: string) {
  const db = serviceDB();
  const [{ data: ev, error }, { data: prof }] = await Promise.all([
    db.from('cosmetic_events').select('id,kind,payload,created_at').eq('owner_id', userId).order('created_at').limit(2000),
    db.from('cosmetic_profiles').select('equipped,opted_out').eq('owner_id', userId).maybeSingle(),
  ]);
  if (error) throw new AppError('Collectibles are not available yet on this deployment.', 503);
  let ledger: Ledger = emptyLedger();
  for (const e of ev ?? []) ledger = applyEvent(ledger, { id: e.id, kind: e.kind, at: e.created_at, ...(e.payload as object) } as LedgerEvent).ledger;
  ledger = refreshUnlocks(ledger, new Date().toISOString());
  return { ledger, equipped: (prof?.equipped ?? {}) as Record<string, unknown>, optedOut: !!prof?.opted_out };
}

