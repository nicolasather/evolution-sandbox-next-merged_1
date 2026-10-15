import { ALTERNATE_FROM_CHAPTER, MASTERY_DEFS, type MasteryDef, type MasteryKind } from './rules';
import {
  RESOURCE_IDS, type Chapter, type ContentIndex, type Layout, type LifelinesState, type ResourceId, type RunMode,
} from './schema';

/* ============================================================================
   LIFELINES CAMPAIGN — progress that outlives a run, kept in its own manifest
   (`evo.civilization.lifelines.campaign.v2`), separate from the active run.

   • Completion history is written ONCE per (chapter, rules version). A later
     experiment that spends the reserve never removes a recorded completion.
   • Unlocking is by explicit previous-chapter id, never by list position.
   • Mastery is a clearly separate optional layer, declared before the run.
   • A personal chronicle: archived summaries, no ranking, no leaderboards.
   Pure functions only; persistence lives in save.ts and store.ts.
   ========================================================================== */

export type NarrationMode = 'off' | 'subtitles' | 'browser';
export type MotionSpeed = 'normal' | 'slow' | 'instant';

export interface Settings {
  narration: NarrationMode;
  /** Subtitles stay on unless the player turns them off; they are a complete no-audio experience. */
  subtitles: boolean;
  narrationSpeed: number;
  volume: number;
  voiceURI: string | null;
  motionSpeed: MotionSpeed;
  overlay: ResourceId | 'none';
  questionsEnabled: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  narration: 'subtitles', subtitles: true, narrationSpeed: 0.92, volume: 0.8, voiceURI: null,
  motionSpeed: 'normal', overlay: 'none', questionsEnabled: true,
};

export interface CompletionRecord {
  chapterId: string;
  firstRunId: string;
  firstCompletedAtTurn: number;
  firstCompletedAt: number;
  count: number;
  mastery: MasteryKind[];
}
export interface RewardRecord {
  /** none: no verified exhibit exists for this chapter, so no museum card is made. */
  status: 'none' | 'pending' | 'delivered';
  exhibitId: string | null;
  updatedAt: number;
}
export interface ArchiveSummary {
  runId: string;
  chapterId: string;
  chapterTitle: string;
  biomeId: string;
  mode: RunMode;
  seed: string;
  turn: number;
  completed: boolean;
  completionKey: string | null;
  mastery: MasteryKind[];
  programmes: string[];
  policiesUsed: string[];
  headline: string;
  archivedAt: number;
}
export interface LearningAnswer { questionId: string; runId: string; turn: number; choiceIndex: number; correct: boolean; answeredAt: number }

export interface CampaignManifest {
  format: 'civilization-lifelines-campaign';
  schemaVersion: 2;
  contentVersion: string;
  completions: Record<string, CompletionRecord>;
  rewards: Record<string, RewardRecord>;
  archives: ArchiveSummary[];
  learning: LearningAnswer[];
  settings: Settings;
  /** The first-entry cinematic has been played; later entries use the short return transition. */
  entrySeen: boolean;
  /** Set once the player has chosen Start Lifelines at the legacy prompt (never touches the legacy save). */
  legacyPromptAnswered: boolean;
}

export const MAX_ARCHIVES = 20;
export const MAX_LEARNING = 200;

export function blankManifest(contentVersion: string): CampaignManifest {
  return {
    format: 'civilization-lifelines-campaign', schemaVersion: 2, contentVersion, completions: {}, rewards: {},
    archives: [], learning: [], settings: { ...DEFAULT_SETTINGS }, entrySeen: false, legacyPromptAnswered: false,
  };
}

/* ------------------------------ unlocking -------------------------------- */

export function completionKeyFor(chapterId: string, rulesVersion: string): string { return `${chapterId}@${rulesVersion}`; }

export function isChapterCompleted(m: CampaignManifest, chapterId: string): boolean {
  return Object.values(m.completions).some(c => c.chapterId === chapterId);
}
/** Options that only the Developer Beta ever passes. `openAll` ignores the chapter order; it never records a completion. */
export interface UnlockOptions { openAll?: boolean }

/** Chapter 1 is open; every other chapter opens when the chapter named by its previousChapterId is completed. */
export function isChapterUnlocked(_index: ContentIndex, m: CampaignManifest, chapter: Chapter, opts?: UnlockOptions): boolean {
  if (opts?.openAll) return true;
  return chapter.previousChapterId === null || isChapterCompleted(m, chapter.previousChapterId);
}
export function chapterStatuses(index: ContentIndex, m: CampaignManifest, opts?: UnlockOptions) {
  return index.chaptersByOrder.map(chapter => {
    const earned = isChapterUnlocked(index, m, chapter);
    return {
      chapter,
      unlocked: earned || !!opts?.openAll,
      /** Open only because a developer override is on (the real order would still lock it). */
      viaOverride: !earned && !!opts?.openAll,
      completed: isChapterCompleted(m, chapter.id),
      stage: index.eras.get(chapter.era)?.name ?? `Tier ${chapter.era + 1}`,
    };
  });
}
/** The next chapter's situation may be previewed (its brief), never its solution. */
export function nextChapter(index: ContentIndex, m: CampaignManifest): Chapter | null {
  return index.chaptersByOrder.find(c => !isChapterCompleted(m, c.id)) ?? null;
}
/** Sandbox can offer any tier whose first chapter is unlocked — clearly fictional, no campaign reward. */
export function sandboxTiers(index: ContentIndex, m: CampaignManifest, opts?: UnlockOptions) {
  return [...index.eras.values()].sort((a, b) => a.index - b.index).map(era => {
    const first = index.chaptersByOrder.find(c => c.era === era.index);
    return { era, firstChapter: first ?? null, unlocked: first ? isChapterUnlocked(index, m, first, opts) : false };
  });
}

/* ------------------------------ completion ------------------------------- */

/** Record a completion exactly once; a repeat only increments the count and unions mastery. Pure: returns a new manifest. */
export function recordCompletion(
  m: CampaignManifest,
  input: { key: string; chapterId: string; runId: string; turn: number; at: number; mastery: MasteryKind[] },
): CampaignManifest {
  const existing = m.completions[input.key];
  const record: CompletionRecord = existing
    ? { ...existing, count: existing.count + 1, mastery: [...new Set([...existing.mastery, ...input.mastery])].sort() as MasteryKind[] }
    : { chapterId: input.chapterId, firstRunId: input.runId, firstCompletedAtTurn: input.turn, firstCompletedAt: input.at, count: 1, mastery: [...input.mastery].sort() as MasteryKind[] };
  return { ...m, completions: { ...m.completions, [input.key]: record } };
}

export function addArchive(m: CampaignManifest, summary: ArchiveSummary): CampaignManifest {
  const rest = m.archives.filter(a => a.runId !== summary.runId);
  return { ...m, archives: [summary, ...rest].slice(0, MAX_ARCHIVES) };
}

/* -------------------------------- mastery -------------------------------- */

/** Mastery offered for a scenario: only conditions that are feasible there, declared before the run begins. */
export function feasibleMastery(chapter: Chapter, layout: Layout): MasteryDef[] {
  const out: MasteryDef[] = [MASTERY_DEFS['no-emergency'], MASTERY_DEFS['diverse-policies'], MASTERY_DEFS['no-hints']];
  if (layout.potentialLinks.length > 0 && chapter.order >= ALTERNATE_FROM_CHAPTER) out.push(MASTERY_DEFS['alternate-route']);
  return out;
}
/** Which DECLARED mastery conditions the run met. Hint use only counts if 'no-hints' was declared beforehand. */
export function evaluateMastery(s: LifelinesState): MasteryKind[] {
  const met: MasteryKind[] = [];
  for (const id of s.masteryDeclared as MasteryKind[]) {
    if (id === 'no-emergency' && s.emergencyCount === 0) met.push(id);
    if (id === 'diverse-policies' && s.policyGroupsUsed.length >= 3) met.push(id);
    if (id === 'alternate-route' && s.alternateBuilt) met.push(id);
    if (id === 'no-hints' && s.hintsUsed === 0) met.push(id);
  }
  return met;
}

export function summarizeRun(index: ContentIndex, s: LifelinesState, archivedAt: number): ArchiveSummary {
  const chapter = index.chapters.get(s.chapterId);
  const completed = s.completion.completedAtTurn !== null;
  const policiesUsed = [...new Set(s.decisions.filter(d => d.kind === 'policies').flatMap(d => d.ids))]
    .map(id => index.policies.get(id)?.name ?? id);
  return {
    runId: s.runId, chapterId: s.chapterId, chapterTitle: chapter?.title ?? s.chapterId, biomeId: s.biomeId,
    mode: s.mode, seed: s.seed, turn: s.turn, completed, completionKey: s.completion.completionKey,
    mastery: evaluateMastery(s),
    programmes: s.built.map(b => index.projects.get(b.projectId)?.name ?? b.projectId),
    policiesUsed,
    headline: completed
      ? `A simulated settlement met the goals of "${chapter?.title ?? s.chapterId}" in season ${s.completion.completedAtTurn}.`
      : `A simulated settlement was tended for ${s.turn} seasons in "${chapter?.title ?? s.chapterId}".`,
    archivedAt,
  };
}

export const SERVICE_IDS: readonly ResourceId[] = RESOURCE_IDS;
