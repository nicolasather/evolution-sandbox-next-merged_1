import type { CampaignManifest } from './campaign';
import type { ContentIndex, LifelinesState } from './schema';

/* ============================================================================
   OPTIONAL LEARNING QUESTIONS — reviewed, authored, never required.
   • Each question restates the lesson of one chapter in the database.
   • Stable ids; a wrong answer is recorded neutrally and never blocks anything,
     changes the simulation, or affects completion or mastery.
   • Selection uses a tiny hash of (runId, turn) — separate from the simulation's
     RNG, so asking never shifts a deterministic outcome.
   ========================================================================== */

export interface LearningQuestion {
  id: string;
  chapterId: string;
  prompt: string;
  choices: [string, string, string];
  correct: 0 | 1 | 2;
  rationale: string;
}

export const QUESTIONS: readonly LearningQuestion[] = [
  { id: 'q-reserve-gap', chapterId: 'second-harvest', prompt: 'What makes a reserve useful?',
    choices: ['It is as large as storage allows', 'It can bridge the gap until supply recovers', 'It is never spent'], correct: 1,
    rationale: 'A reserve is judged by the shortfall it can cover, not by its size alone.' },
  { id: 'q-surplus-system', chapterId: 'first-light', prompt: 'A single season shows a food surplus. What does that prove?',
    choices: ['The food system is dependable', 'Only that this season went well', 'The settlement can stop planning'], correct: 1,
    rationale: 'Dependability comes from a system that keeps working, not from one good season.' },
  { id: 'q-maintenance', chapterId: 'shared-roof', prompt: 'When capacity is already built but declining, what often helps most?',
    choices: ['Maintaining it', 'Adding a monument', 'Waiting'], correct: 0,
    rationale: 'Upkeep of existing capacity can matter more than new additions.' },
  { id: 'q-people-knowledge', chapterId: 'mud-and-memory', prompt: 'What does knowledge need to be useful?',
    choices: ['Only a place to be stored', 'People who can use it', 'To be kept secret'], correct: 1,
    rationale: 'Records without people able to use them do not change what a settlement can do.' },
  { id: 'q-exported-cost', chapterId: 'upstream', prompt: 'A local gain raises costs for a neighbour downstream. What is this called here?',
    choices: ['A local success that exports a cost', 'A free improvement', 'A balanced exchange'], correct: 0,
    rationale: 'The cost did not vanish; it moved to someone else.' },
  { id: 'q-weakest-link', chapterId: 'across-water', prompt: 'What limits a network of shared links?',
    choices: ['Its strongest link', 'Its weakest shared link', 'Its average link'], correct: 1,
    rationale: 'Flow through a chain is capped by its narrowest point.' },
  { id: 'q-storage-supply', chapterId: 'stored-rain', prompt: 'Storage and supply address:',
    choices: ['The same part of a shortage', 'Different parts of a shortage', 'Neither part of a shortage'], correct: 1,
    rationale: 'Storage bridges timing; supply raises the long-run amount available.' },
  { id: 'q-repair-demand', chapterId: 'workshop-street', prompt: 'Repair changes what, besides supply?',
    choices: ['Demand for new materials', 'Nothing', 'The calendar'], correct: 0,
    rationale: 'Mending things reduces the need to produce replacements.' },
  { id: 'q-idle-capacity', chapterId: 'quiet-backup', prompt: 'Why might a community keep capacity idle on purpose?',
    choices: ['It was forgotten', 'It is a deliberate buffer for failures', 'It always indicates waste'], correct: 1,
    rationale: 'Idle capacity can be a public choice that keeps essentials running when something fails.' },
  { id: 'q-concentrated', chapterId: 'power-and-price', prompt: 'A concentrated advantage can become:',
    choices: ['A concentrated vulnerability', 'Always safer', 'Irrelevant'], correct: 0,
    rationale: 'Relying on one source makes one failure matter a great deal.' },
  { id: 'q-averages', chapterId: 'care-within-reach', prompt: 'What can an average hide?',
    choices: ['Nothing', 'Places that have been left behind', 'The total'], correct: 1,
    rationale: 'A healthy-looking average can conceal districts with no access.' },
  { id: 'q-efficiency-continuity', chapterId: 'city-current', prompt: 'Efficiency and continuity are:',
    choices: ['The same goal', 'Different design goals', 'Opposites that cannot coexist'], correct: 1,
    rationale: 'A system can be efficient yet fragile, or continuous yet less efficient.' },
];

/** FNV-1a — deliberately not the simulation's RNG. */
export function questionHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export function validateQuestions(index: ContentIndex, qs: readonly LearningQuestion[] = QUESTIONS): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const q of qs) {
    if (ids.has(q.id)) problems.push(`duplicate:${q.id}`);
    ids.add(q.id);
    if (!index.chapters.has(q.chapterId)) problems.push(`unknown-chapter:${q.id}`);
    if (new Set(q.choices).size !== q.choices.length) problems.push(`duplicate-choice:${q.id}`);
    if (!q.rationale.trim()) problems.push(`no-rationale:${q.id}`);
  }
  return problems;
}

const COOLDOWN_SEASONS = 3;
const MAX_PER_RUN = 3;

/** Is a question allowed to appear right now? Never during an event, never as a gate. */
export function questionAllowed(m: CampaignManifest, s: LifelinesState): boolean {
  if (!m.settings.questionsEnabled) return false;
  if (s.pendingEventId || s.completion.status === 'archived') return false;
  if (s.turn < 3) return false;
  const inRun = m.learning.filter(a => a.runId === s.runId);
  if (inRun.length >= MAX_PER_RUN) return false;
  const last = inRun[inRun.length - 1];
  return !last || s.turn - last.turn >= COOLDOWN_SEASONS;
}

export function pickQuestion(index: ContentIndex, m: CampaignManifest, s: LifelinesState): LearningQuestion | null {
  if (!questionAllowed(m, s)) return null;
  const here = index.chapters.get(s.chapterId)?.order ?? 0;
  const answered = new Set(m.learning.filter(a => a.correct).map(a => a.questionId));
  const eligible = QUESTIONS.filter(q => (index.chapters.get(q.chapterId)?.order ?? 99) <= here);
  if (eligible.length === 0) return null;
  const fresh = eligible.filter(q => !answered.has(q.id));
  const pool = fresh.length > 0 ? fresh : eligible;
  return pool[questionHash(`${s.runId}:${s.turn}`) % pool.length];
}

export function gradeAnswer(q: LearningQuestion, choiceIndex: number): { correct: boolean; label: string; rationale: string } {
  const correct = choiceIndex === q.correct;
  return { correct, label: correct ? 'Noted — that matches the lesson.' : 'Recorded.', rationale: q.rationale };
}
