/** Strict request schemas for every Tower Defense route. Unknown fields are rejected; numbers are bounded integers; strings are short. */
import { z } from 'zod';
import { TD_BRANCHES, TD_MAPS, TD_ROLES, TD_TARGETING, TD_TOWERS } from './domain';

const id = z.string().min(1).max(60).regex(/^[A-Za-z0-9_:-]+$/);
const uuid = z.string().uuid();
export const tdCreateSchema = z.object({
  quizId: uuid,
  format: z.enum(['coop', 'versus']),
  teamCount: z.number().int().min(1).max(4),
  teamSizeCap: z.number().int().min(1).max(5),
  teamNames: z.array(z.string().trim().min(1).max(24)).min(1).max(4).optional(),
  minutes: z.number().int().min(10).max(45),
  flow: z.enum(['synchronized', 'independent']).default('synchronized'),
  mapId: z.enum(TD_MAPS),
  focus: z.enum(['study', 'balanced', 'game']).default('balanced'),
  lowPressure: z.boolean().default(false),
  readAloud: z.boolean().default(false),
  approvalAbove: z.number().int().min(0).max(1000).default(0),
  hideNames: z.boolean().default(false),
  requireApproval: z.boolean().default(false),
  modifiers: z.array(z.enum(['secret_wager'])).max(1).default([]),
  allowReviewCycle: z.boolean().default(false),
}).strict().superRefine((v, ctx) => {
  if (v.format === 'coop' && v.teamCount !== 1) ctx.addIssue({ code: 'custom', message: 'Co-op uses exactly one squad', path: ['teamCount'] });
  if (v.format === 'versus' && v.teamCount < 2) ctx.addIssue({ code: 'custom', message: 'Competitive needs 2–4 squads', path: ['teamCount'] });
  if (v.teamCount * v.teamSizeCap > 20) ctx.addIssue({ code: 'custom', message: 'At most 20 students in one match', path: ['teamSizeCap'] });
  if (v.modifiers.length && v.format !== 'versus') ctx.addIssue({ code: 'custom', message: 'Secret Wager is only offered for competitive squads', path: ['modifiers'] });
  if (v.teamNames && v.teamNames.length !== v.teamCount) ctx.addIssue({ code: 'custom', message: 'Give one name per squad', path: ['teamNames'] });
});
export const tdPreflightSchema = z.object({ quizId: uuid, minutes: z.number().int().min(10).max(45), flow: z.enum(['synchronized', 'independent']).default('synchronized'), focus: z.enum(['study', 'balanced', 'game']).default('balanced'), readAloud: z.boolean().default(false), allowReviewCycle: z.boolean().default(false) }).strict();
export const tdJoinSchema = z.object({ joinCode: z.string().trim().regex(/^[A-Za-z0-9]{6}$/), displayName: z.string().trim().min(2).max(24), desiredTeam: id.optional() }).strict();

const branch = z.enum(Object.values(TD_BRANCHES).flat() as [string, ...string[]]);
export const tdSeatActionSchema = z.object({
  commandId: z.string().min(8).max(80).regex(/^[A-Za-z0-9_-]+$/),
  expectedRevision: z.number().int().min(0).optional(),
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('build'), padId: id, tower: z.enum(TD_TOWERS) }).strict(),
    z.object({ kind: z.literal('upgrade'), towerId: id, branch: branch.optional() }).strict(),
    z.object({ kind: z.literal('sell'), towerId: id }).strict(),
    z.object({ kind: z.literal('move'), towerId: id, padId: id }).strict(),
    z.object({ kind: z.literal('target'), towerId: id, policy: z.enum(TD_TARGETING) }).strict(),
    z.object({ kind: z.literal('ability'), ability: z.enum(['reinforce', 'scan', 'salvo', 'purify', 'protect']), towerId: id.optional(), at: z.number().int().min(0).max(1000).optional() }).strict(),
    z.object({ kind: z.literal('ready'), ready: z.boolean() }).strict(),
    z.object({ kind: z.literal('role'), role: z.enum(TD_ROLES).nullable() }).strict(),
    z.object({ kind: z.literal('team'), teamId: id }).strict(),
    z.object({ kind: z.literal('wager'), amount: z.number().int().min(0).max(100) }).strict(),
  ]),
}).strict();
export const tdHostActionSchema = z.object({
  commandId: z.string().min(8).max(80).regex(/^[A-Za-z0-9_-]+$/),
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('start'), override: z.boolean().optional() }).strict(),
    z.object({ kind: z.literal('pause') }).strict(), z.object({ kind: z.literal('resume') }).strict(),
    z.object({ kind: z.literal('extend'), seconds: z.number().int().min(10).max(60) }).strict(),
    z.object({ kind: z.literal('advance') }).strict(), z.object({ kind: z.literal('end') }).strict(),
    z.object({ kind: z.literal('kick'), seatId: uuid }).strict(),
    z.object({ kind: z.literal('move_seat'), seatId: uuid, teamId: id.nullable() }).strict(),
    z.object({ kind: z.literal('lock'), locked: z.boolean() }).strict(),
    z.object({ kind: z.literal('approve'), teamId: id, pendingId: id, approve: z.boolean() }).strict(),
    z.object({ kind: z.literal('rename_team'), teamId: id, name: z.string().trim().min(1).max(24) }).strict(),
    z.object({ kind: z.literal('hide_names'), hide: z.boolean() }).strict(),
  ]),
}).strict();
export const tdAnswerSchema = z.object({ roomQuestionId: uuid, response: z.unknown(), commandId: z.string().min(8).max(80).regex(/^[A-Za-z0-9_-]+$/) }).strict();
