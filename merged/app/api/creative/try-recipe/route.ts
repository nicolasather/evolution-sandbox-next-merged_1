import { tryRecipeHandler } from '@/lib/server/creative/handler';
import { creativeDeps } from '@/lib/server/creative/runtime';

/* Phase 2 / ticket 071. Node runtime (database driver), never cached. With no DATABASE_URL, no flag or no key
   this answers {kind:"unavailable"} and the base game is unaffected. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return tryRecipeHandler(req, () => creativeDeps());
}
