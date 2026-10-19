import { z } from 'zod';
import { currentUser, serviceDB } from '@/lib/quiz/supabase';
import { equip } from '@/lib/quiz/cosmetics/ledger';
import { loadCosmetics as load } from '@/lib/quiz/cosmetics/server';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

/** The signed-in player's collection. Items are earned only from server-recorded learning events — never bought, never granted by the browser. */
export async function GET() {
  try { const user = await currentUser(); const s = await load(user.id); return success({ unlocked: s.ledger.unlocked, equipped: s.equipped, optedOut: s.optedOut }); }
  catch (e) { return failure(e); }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('equip'), itemId: z.string().max(80) }),
  z.object({ action: z.literal('opt_out'), value: z.boolean() }),
]);

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'cosmetics', 120, 600, user.id);
    const b = schema.parse(await jsonBody(req));
    const s = await load(user.id);
    const db = serviceDB();
    if (b.action === 'opt_out') {
      await db.from('cosmetic_profiles').upsert({ owner_id: user.id, opted_out: b.value, equipped: s.equipped, updated_at: new Date().toISOString() });
      return success({ optedOut: b.value });
    }
    const r = equip(s.equipped as never, s.ledger, b.itemId);
    if (r.error) throw new AppError(r.error, 400);
    await db.from('cosmetic_profiles').upsert({ owner_id: user.id, equipped: r.eq, opted_out: s.optedOut, updated_at: new Date().toISOString() });
    return success({ equipped: r.eq });
  } catch (e) { return failure(e); }
}
