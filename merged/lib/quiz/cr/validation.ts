/** `cr/1` wire contracts. Every packet is strict (no unknown keys), bounded, and carries only INTENT: never a position, a cooldown, a score or a grade. */
import { z } from 'zod';
import { DURATION_MINUTES, MAX_BATCH } from './balance';
import { FORMATS, MAP_IDS, PERKS, PROTOCOL, ROLES } from './domain';

const id = z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/);
const axis = z.number().finite().min(-1).max(1);
const proto = z.literal(PROTOCOL).optional();
const en = <T extends readonly string[]>(a: T) => z.enum(a as unknown as [string, ...string[]]);
export const MAX_PACKET_BYTES = 8 * 1024; export const MAX_ANSWER_BYTES = 16 * 1024;
export const crCreateSchema = z.object({
  quizId: z.string().uuid(), format: en(FORMATS).default('split_route'), mapId: en(MAP_IDS).default('sunleaf_passage'),
  minutes: z.number().int().refine((m) => (DURATION_MINUTES as readonly number[]).includes(m), 'Choose 10, 15, 20, 30 or 45 minutes (a hosted race needs at least three question windows)').default(15),
  teamCount: z.number().int().min(2).max(4).default(2), teamNames: z.array(z.string().trim().min(1).max(24)).max(4).optional(), teamSizeCap: z.number().int().min(1).max(5).default(5),
  lowPressure: z.boolean().default(false), readAloud: z.boolean().default(false), hideNames: z.boolean().default(false), allowReviewCycle: z.boolean().default(false), requireApproval: z.boolean().default(false),
  difficulty: z.enum(['easy', 'normal', 'challenge']).default('normal'), perks: z.array(en(PERKS)).max(4).default([...PERKS]),
}).strict().superRefine((v, ctx) => {
  if (v.teamCount * v.teamSizeCap > 20) ctx.addIssue({ code: 'custom', message: 'At most 20 students in one match', path: ['teamSizeCap'] });
  if (v.teamNames && v.teamNames.length !== v.teamCount) ctx.addIssue({ code: 'custom', message: 'Give one name per team', path: ['teamNames'] });
});
export const crJoinSchema = z.object({ joinCode: z.string().trim().min(4).max(12), displayName: z.string().trim().min(1).max(24), desiredTeam: z.string().max(10).optional() }).strict();
/** `move`: a direction in [-1,1]² with a strictly increasing sequence number. */
export const crMoveSchema = z.object({ p: proto, seq: z.number().int().min(1).max(2_000_000_000), x: axis, y: axis }).strict();
export const crActionSchema = z.object({
  p: proto, commandId: id, expectedRevision: z.number().int().min(0).optional(),
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('role'), role: en(ROLES) }).strict(), z.object({ kind: z.literal('ready'), ready: z.boolean() }).strict(),
    z.object({ kind: z.literal('rename'), name: z.string().trim().min(1).max(24) }).strict(), z.object({ kind: z.literal('vote'), option: z.enum(['a', 'b', 'c']) }).strict(),
    z.object({ kind: z.literal('buy'), perk: en(PERKS) }).strict(), z.object({ kind: z.literal('ability') }).strict(), z.object({ kind: z.literal('pass') }).strict(),
    z.object({ kind: z.literal('inspect'), siteId: z.number().int().min(0).max(3) }).strict(),
  ]),
}).strict();
export const crHostSchema = z.object({
  p: proto, commandId: id,
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('start') }).strict(), z.object({ kind: z.literal('pause') }).strict(), z.object({ kind: z.literal('resume') }).strict(), z.object({ kind: z.literal('end') }).strict(),
    z.object({ kind: z.literal('skip') }).strict(), z.object({ kind: z.literal('extend') }).strict(), z.object({ kind: z.literal('lock'), locked: z.boolean() }).strict(),
    z.object({ kind: z.literal('kick'), seatId: z.string().uuid() }).strict(), z.object({ kind: z.literal('move_seat'), seatId: z.string().uuid(), teamId: z.string().max(10) }).strict(),
  ]),
}).strict();
export const crAnswerSchema = z.object({ p: proto, roomQuestionId: z.string().uuid(), response: z.unknown(), commandId: id.optional() }).strict();
export const crPreflightSchema = z.object({ quizId: z.string().uuid(), minutes: z.number().int().default(15), readAloud: z.boolean().default(false), lowPressure: z.boolean().default(false), allowReviewCycle: z.boolean().default(false), format: en(FORMATS).default('split_route'), mapId: en(MAP_IDS).default('sunleaf_passage') }).strict();
export { MAX_BATCH };
export const validAxis = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1;
