import { z } from 'zod';

const short = z.string().trim().min(1).max(500);
const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,60}$/, 'Invalid id');
export const kind = z.enum(['multiple_choice', 'answer_forge', 'connection_rush', 'truth_hunt', 'fill_table']);
const questionBase = z.object({
  kind,
  prompt: z.string().trim().min(1, 'Every question needs a prompt').max(3000),
  basePoints: z.number().int().min(0).max(10000),
});
const option = z.object({ id: safeId, text: short }).strict();
const item = z.object({ id: safeId, label: short }).strict();

const choice = questionBase.extend({
  kind: z.literal('multiple_choice'),
  payload: z.object({ options: z.array(option).min(2, 'Add at least two options').max(8) }).strict(),
  answerKey: z.object({ correctIds: z.array(safeId).length(1) }).strict(),
});
const forge = questionBase.extend({
  kind: z.literal('answer_forge'),
  payload: z.object({ placeholder: z.string().max(120).default('Your answer'), caseSensitive: z.boolean().default(false) }).strict(),
  answerKey: z.object({ accepted: z.array(short).min(1, 'Add at least one accepted answer').max(20), numericTolerance: z.number().min(0).max(1_000_000).optional() }).strict(),
});
const match = questionBase.extend({
  kind: z.literal('connection_rush'),
  payload: z.object({ left: z.array(item).min(2).max(12), right: z.array(item).min(2).max(12) }).strict(),
  answerKey: z.object({ pairs: z.array(z.object({ leftId: safeId, rightId: safeId }).strict()).min(2).max(12) }).strict(),
});
const truth = questionBase.extend({
  kind: z.literal('truth_hunt'),
  payload: z.object({ statements: z.array(z.object({ id: safeId, text: short }).strict()).min(1).max(20) }).strict(),
  answerKey: z.object({ truth: z.record(safeId, z.boolean()) }).strict(),
});
const table = questionBase.extend({
  kind: z.literal('fill_table'),
  payload: z.object({
    columns: z.array(short).min(1).max(12),
    rows: z.array(z.array(z.object({ text: z.string().max(500), blank: z.boolean() }).strict())).min(1).max(30),
  }).strict(),
  answerKey: z.object({ cells: z.record(z.string().regex(/^\d{1,2}:\d{1,2}$/), z.array(short).min(1).max(20)) }).strict(),
});

export const questionSchema = z
  .discriminatedUnion('kind', [choice, forge, match, truth, table])
  .superRefine((q, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (a: string[]) => new Set(a).size === a.length;
    if (q.kind === 'multiple_choice') {
      const ids = q.payload.options.map((o) => o.id);
      if (!unique(ids) || q.answerKey.correctIds.some((id) => !ids.includes(id))) fail('Pick exactly one correct option from distinct options');
    } else if (q.kind === 'connection_rush') {
      const l = q.payload.left.map((o) => o.id);
      const r = q.payload.right.map((o) => o.id);
      const p = q.answerKey.pairs;
      if (l.length !== r.length || !unique(l) || !unique(r) || p.length !== l.length || !unique(p.map((x) => x.leftId)) || !unique(p.map((x) => x.rightId)) || p.some((x) => !l.includes(x.leftId) || !r.includes(x.rightId))) {
        fail('Match every left item to a different right item exactly once');
      }
    } else if (q.kind === 'truth_hunt') {
      const ids = q.payload.statements.map((s) => s.id);
      if (!unique(ids) || Object.keys(q.answerKey.truth).length !== ids.length || ids.some((id) => !(id in q.answerKey.truth))) fail('Every statement needs a truth value');
    } else if (q.kind === 'fill_table') {
      const { rows, columns } = q.payload;
      if (rows.some((r) => r.length !== columns.length)) fail('Every table row needs the same number of cells as there are columns');
      const blanks = new Set<string>();
      rows.forEach((r, i) => r.forEach((c, j) => { if (c.blank) blanks.add(`${i}:${j}`); }));
      if (!blanks.size || Object.keys(q.answerKey.cells).length !== blanks.size || [...blanks].some((k) => !(k in q.answerKey.cells))) {
        fail('Mark at least one blank cell and give every blank an accepted answer');
      }
    }
  })
  // A blank cell must never carry its answer in the player-visible payload.
  .transform((q) => {
    if (q.kind !== 'fill_table') return q;
    return { ...q, payload: { ...q.payload, rows: q.payload.rows.map((row) => row.map((c) => (c.blank ? { text: '', blank: true } : c))) } };
  });

export const saveQuizSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, 'Give the quiz a title').max(160),
    description: z.string().max(2000).default(''),
    status: z.enum(['draft', 'published']),
    questions: z.array(questionSchema).max(200),
  })
  .refine((v) => v.status === 'draft' || v.questions.length > 0, { message: 'Publishing needs at least one question' });

export const statusSchema = z.object({ status: z.enum(['draft', 'published']) });

export const modifierEnum = z.enum(['limited_slots', 'secret_wager', 'steal_question', 'lose_all', 'go_to_first', 'steal_points', 'give_points', 'swap_points', 'potluck']);
export const roomCreateSchema = z.object({
  quizId: z.string().uuid(),
  mode: z.enum(['solo', 'classroom', 'online']),
  flow: z.enum(['synchronized', 'round_robin', 'independent']),
  durationSeconds: z.number().int().min(60).max(7200),
  questionSeconds: z.number().int().min(5).max(600).nullable(),
  modifiers: z.array(modifierEnum).max(9),
  slotLimit: z.number().int().min(1).max(100).default(3),
  teamNames: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
});
export const joinSchema = z.object({
  joinCode: z.string().trim().length(6).regex(/^[A-Za-z0-9]{6}$/),
  displayName: z.string().trim().min(1).max(40),
});

const id = z.string().min(1).max(60);
export const answerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('multiple_choice'), selectedIds: z.array(id).length(1) }).strict(),
  z.object({ kind: z.literal('answer_forge'), text: z.string().max(500) }).strict(),
  z.object({ kind: z.literal('connection_rush'), pairs: z.array(z.object({ leftId: id, rightId: id }).strict()).max(12) }).strict(),
  z.object({ kind: z.literal('truth_hunt'), truth: z.record(z.string().max(60), z.boolean()) }).strict(),
  z.object({ kind: z.literal('fill_table'), cells: z.record(z.string().max(10), z.string().max(500)) }).strict(),
]);

export const submissionSchema = z.object({
  roomId: z.string().uuid(),
  roomQuestionId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
  token: z.string().max(160).optional(),
  response: z.unknown().optional(),
  wager: z.number().int().min(0).max(10000).default(0),
  override: z.boolean().optional(),
});

export const authSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const modifierRequestSchema = z.object({
  kind: z.enum(['lose_all', 'go_to_first', 'steal_points', 'give_points', 'swap_points', 'potluck', 'steal_question', 'undo']),
  target: z.string().uuid().optional(),
  other: z.string().uuid().optional(),
  amount: z.number().int().min(0).max(10000).default(100),
});

export const controlSchema = z.object({ action: z.enum(['start', 'next', 'pause', 'resume', 'reveal', 'end']) });

export type ParsedQuestion = z.output<typeof questionSchema>;
export function parseQuestion(x: unknown): ParsedQuestion {
  return questionSchema.parse(x);
}
