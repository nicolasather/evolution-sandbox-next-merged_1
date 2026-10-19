import { z } from 'zod';
import { isStoragePath, parseEmbed } from './media';

const short = z.string().trim().min(1).max(500);
const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,60}$/, 'Invalid id');

/* ── Optional, additive building blocks (items 021-038). Every field below is optional so quizzes saved
 *    before they existed keep validating exactly as before. Public fields live in `payload`; anything that must
 *    stay hidden until reveal (explanation, hint, distractor notes) lives in `answerKey`, which the server never
 *    sends to players before the reveal. ── */
const unit = z.number().min(0).max(1);
export const mediaSchema = z
  .object({
    type: z.enum(['image', 'video', 'audio', 'embed']),
    /** Storage path (`quiz-media/<owner>/<id>`) for uploads, or a canonical https URL for allow-listed embeds. */
    ref: z.string().trim().min(1).max(600),
    alt: z.string().trim().max(500).optional(),
    decorative: z.boolean().optional(),
    caption: z.string().trim().max(500).optional(),
    transcript: z.string().trim().max(8000).optional(),
    muted: z.boolean().optional(),
    poster: z.string().trim().max(600).optional(),
    focal: z.object({ x: unit, y: unit }).strict().optional(),
    rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
    crop: z.object({ x: unit, y: unit, w: unit, h: unit }).strict().optional(),
    annotations: z.array(z.object({ x: unit, y: unit, label: z.string().trim().min(1).max(80) }).strict()).max(12).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    // A forged reference must never reach a player's browser: uploads are well-formed storage paths, embeds are allow-listed YouTube/Vimeo links.
    if (m.type === 'embed') { if (!parseEmbed(m.ref)) fail('Only YouTube and Vimeo links are supported'); }
    else if (!isStoragePath(m.ref)) fail('This media file is not a valid upload. Upload it again.');
    if (m.poster !== undefined && !isStoragePath(m.poster)) fail('The video poster is not a valid upload');
    if (m.type === 'image' && !m.decorative && !(m.alt && m.alt.length > 0)) fail('Describe the image (alt text), or mark it decorative');
    if ((m.type === 'video' || m.type === 'audio') && !(m.transcript || m.caption)) fail('Add a caption or transcript for this audio or video');
  });
export type Media = z.infer<typeof mediaSchema>;

export const scoringSchema = z
  .object({
    mode: z.enum(['fixed', 'accuracy', 'time_bonus', 'partial']),
    /** Extra points available for the fastest possible correct answer (time_bonus only). */
    timeBonusMax: z.number().int().min(0).max(10000).optional(),
  })
  .strict();
export type Scoring = z.infer<typeof scoringSchema>;

export const metaSchema = z
  .object({
    topic: z.string().trim().max(80).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    objective: z.string().trim().max(200).optional(),
    section: z.string().trim().max(80).optional(),
    /** AI drafts are labelled, never auto-published, and carry the evidence a human must check. */
    aiDraft: z.boolean().optional(),
    verified: z.boolean().optional(),
    evidence: z.string().trim().max(1000).optional(),
  })
  .strict();
export type Meta = z.infer<typeof metaSchema>;

const extras = { media: mediaSchema.optional(), scoring: scoringSchema.optional(), meta: metaSchema.optional() };
const secrets = {
  explanation: z.string().trim().max(2000).optional(),
  hint: z.string().trim().max(500).optional(),
  /** Why a wrong option is wrong, keyed by option id (Multiple Choice) — shown after reveal only. */
  distractorNotes: z.record(safeId, z.string().trim().max(500)).optional(),
  /** Connection Rush / Truth Hunt / Fill the Table: award a fraction of the points per correct part. */
  partial: z.boolean().optional(),
};
export const kind = z.enum(['multiple_choice', 'answer_forge', 'connection_rush', 'truth_hunt', 'fill_table']);
const questionBase = z.object({
  kind,
  prompt: z.string().trim().min(1, 'Every question needs a prompt').max(3000),
  basePoints: z.number().int().min(0).max(10000),
});
const option = z.object({ id: safeId, text: short, image: mediaSchema.optional() }).strict();
const item = z.object({ id: safeId, label: short, image: mediaSchema.optional() }).strict();

const choice = questionBase.extend({
  kind: z.literal('multiple_choice'),
  payload: z.object({ options: z.array(option).min(2, 'Add at least two options').max(8), multi: z.boolean().optional(), ...extras }).strict(),
  answerKey: z.object({ correctIds: z.array(safeId).min(1).max(8), ...secrets }).strict(),
});
const forge = questionBase.extend({
  kind: z.literal('answer_forge'),
  payload: z
    .object({
      placeholder: z.string().max(120).default('Your answer'),
      caseSensitive: z.boolean().default(false),
      /** 'ignore' drops punctuation before comparing; 'strict' (default) keeps it. */
      punctuation: z.enum(['strict', 'ignore']).optional(),
      /** 'ignore' lets "cafe" match "café". Off by default so Vietnamese tone marks are enforced unless the creator relaxes them. */
      diacritics: z.enum(['strict', 'ignore']).optional(),
      ...extras,
    })
    .strict(),
  answerKey: z
    .object({
      accepted: z.array(short).min(1, 'Add at least one accepted answer').max(20),
      numericTolerance: z.number().min(0).max(1_000_000).optional(),
      /** Relative tolerance in percent (e.g. 2 = ±2 %). */
      numericTolerancePct: z.number().min(0).max(100).optional(),
      /** Accepted unit spellings, e.g. ["cm", "centimetres"]. */
      units: z.array(z.string().trim().min(1).max(24)).max(12).optional(),
      unitRequired: z.boolean().optional(),
      /** Round the player's number to this many decimals before comparing. */
      roundTo: z.number().int().min(0).max(8).optional(),
      ...secrets,
    })
    .strict(),
});
const match = questionBase.extend({
  kind: z.literal('connection_rush'),
  payload: z.object({ left: z.array(item).min(2).max(12), right: z.array(item).min(2).max(12), ...extras }).strict(),
  answerKey: z.object({ pairs: z.array(z.object({ leftId: safeId, rightId: safeId }).strict()).min(2).max(12), ...secrets }).strict(),
});
const truth = questionBase.extend({
  kind: z.literal('truth_hunt'),
  payload: z.object({ statements: z.array(z.object({ id: safeId, text: short, image: mediaSchema.optional() }).strict()).min(1).max(20), ...extras }).strict(),
  answerKey: z.object({ truth: z.record(safeId, z.boolean()), statementNotes: z.record(safeId, z.string().trim().max(500)).optional(), ...secrets }).strict(),
});
const table = questionBase.extend({
  kind: z.literal('fill_table'),
  payload: z.object({
    columns: z.array(short).min(1).max(12),
    rows: z.array(z.array(z.object({ text: z.string().max(500), blank: z.boolean(), image: mediaSchema.optional() }).strict())).min(1).max(30),
    ...extras,
  }).strict(),
  answerKey: z.object({ cells: z.record(z.string().regex(/^\d{1,2}:\d{1,2}$/), z.array(short).min(1).max(20)), ...secrets }).strict(),
});

export const questionSchema = z
  .discriminatedUnion('kind', [choice, forge, match, truth, table])
  .superRefine((q, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (a: string[]) => new Set(a).size === a.length;
    const scoring = (q.payload as { scoring?: { mode: string; timeBonusMax?: number } }).scoring;
    if (scoring?.mode === 'partial' && (q.kind === 'multiple_choice' || q.kind === 'answer_forge')) fail('Partial credit needs a format with several parts');
    if (scoring?.mode === 'time_bonus' && !scoring.timeBonusMax) fail('Set how many bonus points the fastest answer earns');
    if (q.kind === 'multiple_choice') {
      const ids = q.payload.options.map((o) => o.id);
      const c = q.answerKey.correctIds;
      if (!unique(ids) || !unique(c) || c.some((id) => !ids.includes(id)) || (!q.payload.multi && c.length !== 1) || (q.payload.multi && (c.length < 1 || c.length >= ids.length))) {
        fail(q.payload.multi ? 'Pick at least one correct option, but not every option' : 'Pick exactly one correct option from distinct options');
      }
      if (q.answerKey.distractorNotes && Object.keys(q.answerKey.distractorNotes).some((id) => !ids.includes(id))) fail('A note refers to an option that does not exist');
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

/** Quiz-level discovery metadata (items 012, 051, 052). Stored in `quizzes.meta`; every field is optional. */
export const AGE_BANDS = ['5-7', '8-10', '11-13', '14-17', '18+'] as const;
export const quizMetaSchema = z
  .object({
    subject: z.string().trim().max(60).optional(),
    language: z.string().trim().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, 'Use a language code such as en or vi').optional(),
    ageBand: z.enum(AGE_BANDS).optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
    cover: z.discriminatedUnion('kind', [z.object({ kind: z.literal('art'), seed: z.string().max(60) }).strict(), z.object({ kind: z.literal('upload'), ref: z.string().max(600), alt: z.string().max(300).optional() }).strict()]).optional(),
    objectives: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    sourceId: z.string().uuid().optional(),
    sourceTitle: z.string().max(160).optional(),
    sourceAuthor: z.string().max(80).optional(),
  })
  .strict();
export type QuizMeta = z.infer<typeof quizMetaSchema>;

export const saveQuizSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, 'Give the quiz a title').max(160),
    description: z.string().max(2000).default(''),
    status: z.enum(['draft', 'published']),
    meta: quizMetaSchema.optional(),
    questions: z.array(questionSchema).max(200),
  })
  .refine((v) => v.status === 'draft' || v.questions.length > 0, { message: 'Publishing needs at least one question' });

export const statusSchema = z.object({ status: z.enum(['draft', 'published']) });

export const modifierEnum = z.enum(['limited_slots', 'secret_wager', 'steal_question', 'lose_all', 'go_to_first', 'steal_points', 'give_points', 'swap_points', 'potluck']);
export const roomCreateSchema = z.object({
  quizId: z.string().uuid(),
  mode: z.enum(['solo', 'classroom', 'online']),
  flow: z.enum(['synchronized', 'round_robin', 'independent']),
  durationSeconds: z.number().int().min(60).max(14400),
  questionSeconds: z.number().int().min(5).max(600).nullable(),
  modifiers: z.array(modifierEnum).max(9),
  slotLimit: z.number().int().min(1).max(100).default(3),
  teamNames: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  // Quiz Studio extras — all optional, so older clients keep working
  lowPressure: z.boolean().optional(),
  quietClassroom: z.boolean().optional(),
  untimed: z.boolean().optional(),
  readAloud: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
  fairPlay: z.boolean().optional(),
  showIdentity: z.boolean().optional(),
  cosmeticsEnabled: z.boolean().optional(),
  access: z.object({ requireApproval: z.boolean().optional(), lockedAfterStart: z.boolean().optional(), hideIdentity: z.boolean().optional() }).strict().optional(),
  rotateSpeaker: z.boolean().optional(),
  projector: z.object({ game: z.enum(['empire_race', 'boss_battle', 'escape_room', 'treasure_vault', 'risk_ladder']), minutes: z.number().int().min(5).max(180).nullable(), focus: z.enum(['study', 'balanced', 'game']) }).strict().optional(),
});
export const joinSchema = z.object({
  joinCode: z.string().trim().length(6).regex(/^[A-Za-z0-9]{6}$/),
  displayName: z.string().trim().min(1).max(40),
  icon: z.string().max(80).optional(),
});

const id = z.string().min(1).max(60);
export const answerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('multiple_choice'), selectedIds: z.array(id).min(1).max(8) }).strict(),
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
  confirmed: z.boolean().optional(),
});

export const controlSchema = z.object({ action: z.enum(['start', 'next', 'pause', 'resume', 'reveal', 'end', 'skip', 'replay', 'cancel']) });

export type ParsedQuestion = z.output<typeof questionSchema>;
export function parseQuestion(x: unknown): ParsedQuestion {
  return questionSchema.parse(x);
}

/** Projector game creation: the game is chosen first; the server derives everything else (rooms, questions, plan, state). */
export const projectorCreateSchema = z.object({
  quizId: z.string().uuid(),
  game: z.enum(['empire_race', 'boss_battle', 'escape_room', 'treasure_vault', 'risk_ladder']),
  flow: z.enum(['round_robin', 'synchronized']).default('round_robin'),
  teamNames: z.array(z.string().trim().min(1).max(40)).min(2).max(8),
  minutes: z.number().int().min(5).max(180).nullable(),
  focus: z.enum(['study', 'balanced', 'game']).default('balanced'),
  modifiers: z.array(modifierEnum).max(9).default([]),
  allowRepeats: z.boolean().default(false),
  lowPressure: z.boolean().default(false),
  readAloud: z.boolean().optional(),
  settings: z.object({
    world: z.enum(['archipelago', 'river_kingdom', 'desert_crossing']).optional(), objective: z.enum(['territory', 'capital', 'expedition']).optional(),
    boss: z.enum(['clockwork_leviathan', 'library_colossus', 'storm_engine']).optional(), campaign: z.enum(['clockhouse', 'celestial_archive', 'glass_garden']).optional(),
    mission: z.enum(['highest', 'first', 'group']).optional(), comeback: z.boolean().optional(),
  }).strict().default({}),
  seed: z.string().min(4).max(64).optional(),
});
export const gameActionSchema = z.object({
  commandId: z.string().min(8).max(80),
  expectedRevision: z.number().int().min(0),
  action: z.string().regex(/^[a-z_]{2,32}$/),
  payload: z.record(z.string(), z.unknown()).default({}),
});
