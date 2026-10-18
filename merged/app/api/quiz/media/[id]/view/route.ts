import { z } from 'zod';
import { maybeUser } from '@/lib/quiz/supabase';
import { failure, rateLimit, success } from '@/lib/quiz/api';
import { signedViewUrl } from '@/lib/quiz/media/server';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    await rateLimit(req, 'quiz-media-view', 300, 60);
    return success(await signedViewUrl((await maybeUser())?.id ?? null, id));
  } catch (e) { return failure(e); }
}
