import { z } from 'zod';
import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, success } from '@/lib/quiz/api';
import { deleteMedia } from '@/lib/quiz/media/server';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    await deleteMedia(user.id, id);
    return success({ ok: true });
  } catch (e) { return failure(e); }
}
