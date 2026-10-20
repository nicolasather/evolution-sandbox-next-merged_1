import { z } from 'zod';
import { currentUser } from '@/lib/quiz/supabase';
import { failure, rateLimit, success } from '@/lib/quiz/api';
import { swarmReport } from '@/lib/quiz/swarm/server';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await rateLimit(req, 'swarm-report', 120, 600); const user = await currentUser(); const id = z.string().uuid().parse((await ctx.params).id); return success(await swarmReport(id, user.id)); } catch (e) { return failure(e); }
}
