import { failure, success } from '@/lib/quiz/api';
import { replay } from '@/lib/quiz/td/server';
import { hostOf, roomIdOf } from '@/lib/quiz/td/http';

/** Sanitised event log (QA / review): revision, actor class, action, summary. Host only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await roomIdOf(params);
    await hostOf(id);
    const after = Number(new URL(req.url).searchParams.get('after') ?? 0) || 0;
    return success({ events: await replay(id, after) });
  } catch (e) { return failure(e); }
}
