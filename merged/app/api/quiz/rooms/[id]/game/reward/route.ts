import { z } from 'zod';
import { isHost } from '@/lib/quiz/rooms';
import { rpc, assertSameOrigin, failure, jsonBody, success } from '@/lib/quiz/api';

const appeal = z.object({ evidenceId: z.string().uuid(), reason: z.string().trim().min(10).max(1000) });
/** POST {} → evaluate the finished match (server-verified evidence only). POST {evidenceId, reason} → appeal a rejected evaluation. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = z.string().uuid().parse((await params).id);
    const { user } = await isHost(id);
    const body = (await jsonBody(req)) as Record<string, unknown>;
    if ('evidenceId' in body) { const a = appeal.parse(body); return success(await rpc('projector_appeal_reward', { p_owner: user.id, p_evidence: a.evidenceId, p_reason: a.reason })); }
    return success(await rpc('projector_evaluate_reward', { p_room: id, p_host: user.id }));
  } catch (e) { return failure(e); }
}
