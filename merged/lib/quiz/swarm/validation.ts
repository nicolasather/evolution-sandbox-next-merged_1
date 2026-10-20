import { z } from 'zod';
import { configSchema } from '@/lib/swarm/domain';

const uuid = z.string().uuid();
export const swarmCreateSchema = z.object({ quizId: uuid, config: z.unknown() }).strict().transform((v, ctx) => {
  const c = configSchema.safeParse(v.config);
  if (!c.success) { for (const i of c.error.issues) ctx.addIssue({ code: 'custom', message: i.message, path: ['config', ...i.path] }); return z.NEVER; }
  return { quizId: v.quizId, config: c.data };
});
export const swarmPreflightSchema = z.object({
  quizId: uuid, minutes: z.number().int().min(5).max(45), focus: z.enum(['study', 'balanced', 'game']).default('balanced'),
  difficulty: z.enum(['easy', 'normal', 'challenge']).default('normal'), allowReviewCycle: z.boolean().default(false),
}).strict();
export const swarmReviewSchema = z.object({ token: z.string().min(10).max(600) }).strict();
