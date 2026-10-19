import { z } from 'zod';
import { serviceDB } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

const NAMES = ['wizard_step', 'import_failed', 'save_failed', 'room_created', 'join_failed', 'answer_rejected', 'report_opened', 'help_opened'] as const;
const schema = z.object({ name: z.enum(NAMES), props: z.record(z.string().max(30), z.union([z.number(), z.boolean(), z.string().max(40)])).default({}) });

/** Anonymous product telemetry. Only a fixed list of event names; short values only (no free text, no names, no IPs). */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'telemetry', 120, 600);
    const b = schema.parse(await jsonBody(req));
    if (Object.keys(b.props).length > 8) return success({ ok: false });
    await serviceDB().from('quiz_telemetry').insert({ name: b.name, props: b.props });
    return success({ ok: true });
  } catch (e) { return failure(e); }
}
