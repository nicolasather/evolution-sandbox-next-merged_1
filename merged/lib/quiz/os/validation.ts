import { z } from 'zod';
import { DURATION_MINUTES, MAX_BATCH } from './balance';
import { MAP_IDS, PERK_IDS, ROLES } from './domain';

const id = z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/);
export const osCreateSchema = z.object({
  quizId: z.string().uuid(),
  format: z.enum(['cooperative_escape', 'relay_race']).default('cooperative_escape'),
  mapId: z.enum(MAP_IDS as unknown as [string, ...string[]]).default('chalkyard_circuit'),
  minutes: z.number().int().refine((m) => (DURATION_MINUTES as readonly number[]).includes(m), 'Choose 10, 15, 20, 30 or 45 minutes').default(15),
  teamCount: z.number().int().min(1).max(4).default(1),
  teamNames: z.array(z.string().trim().min(1).max(24)).max(4).optional(),
  teamSizeCap: z.number().int().min(1).max(5).default(5),
  lowPressure: z.boolean().default(false), readAloud: z.boolean().default(false), hideNames: z.boolean().default(false),
  approvalAbove: z.number().int().min(0).max(20).default(0), requireApproval: z.boolean().default(false), allowReviewCycle: z.boolean().default(false),
}).strict().superRefine((v, ctx) => {
  if (v.format === 'cooperative_escape' && v.teamCount !== 1) ctx.addIssue({ code: 'custom', message: 'Cooperative escape uses exactly one squad', path: ['teamCount'] });
  if (v.format === 'relay_race' && v.teamCount < 2) ctx.addIssue({ code: 'custom', message: 'Relay race needs 2–4 squads', path: ['teamCount'] });
  if (v.teamCount * v.teamSizeCap > 20) ctx.addIssue({ code: 'custom', message: 'At most 20 students in one match', path: ['teamSizeCap'] });
  if (v.teamNames && v.teamNames.length !== v.teamCount) ctx.addIssue({ code: 'custom', message: 'Give one name per squad', path: ['teamNames'] });
});
export const osJoinSchema = z.object({ joinCode: z.string().trim().min(4).max(12), displayName: z.string().trim().min(1).max(24), desiredTeam: z.string().max(10).optional() }).strict();
const sample = z.object({ dx: z.union([z.literal(-1), z.literal(0), z.literal(1)]), dy: z.union([z.literal(-1), z.literal(0), z.literal(1)]), hop: z.boolean(), ability: z.boolean().optional() }).strict();
export const osInputSchema = z.object({ commandId: id, fromTick: z.number().int().min(1).max(10_000_000), samples: z.array(sample).min(1).max(MAX_BATCH) }).strict();
export const osActionSchema = z.object({
  commandId: id, expectedRevision: z.number().int().min(0).optional(),
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('role'), role: z.enum(ROLES as unknown as [string, ...string[]]) }).strict(),
    z.object({ kind: z.literal('ready'), ready: z.boolean() }).strict(),
    z.object({ kind: z.literal('purchase'), perk: z.enum(PERK_IDS as unknown as [string, ...string[]]) }).strict(),
    z.object({ kind: z.literal('rename'), name: z.string().trim().min(1).max(24) }).strict(),
  ]),
}).strict();
export const osHostSchema = z.object({
  commandId: id,
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('start') }).strict(), z.object({ kind: z.literal('pause') }).strict(), z.object({ kind: z.literal('resume') }).strict(),
    z.object({ kind: z.literal('end') }).strict(), z.object({ kind: z.literal('skip') }).strict(),
    z.object({ kind: z.literal('lock'), locked: z.boolean() }).strict(),
    z.object({ kind: z.literal('kick'), seatId: z.string().uuid() }).strict(),
    z.object({ kind: z.literal('move_seat'), seatId: z.string().uuid(), teamId: z.string().max(10) }).strict(),
  ]),
}).strict();
export const osAnswerSchema = z.object({ roomQuestionId: z.string().uuid(), response: z.unknown(), commandId: id.optional() }).strict();
export const osPreflightSchema = z.object({ quizId: z.string().uuid(), minutes: z.number().int().default(15), readAloud: z.boolean().default(false), lowPressure: z.boolean().default(false), allowReviewCycle: z.boolean().default(false), mapId: z.enum(MAP_IDS as unknown as [string, ...string[]]).default('chalkyard_circuit') }).strict();
