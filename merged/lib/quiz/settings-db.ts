import 'server-only';
import { serviceDB } from './supabase';
import { parseSettings, type QuizSettings, type Visibility } from './settings';

/** True when PostgREST says the table/column does not exist yet: migration 004 has not been run on this database. */
export function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (error.code === 'PGRST205' || error.code === '42P01' || error.code === '42703' || /does not exist|schema cache/i.test(error.message ?? ''));
}

/** Settings for several quizzes at once. Quizzes saved before the seven-step creator (or on a database without migration 004) have none. */
export async function loadSettings(ids: string[]): Promise<Map<string, QuizSettings>> {
  const out = new Map<string, QuizSettings>();
  if (!ids.length) return out;
  const { data, error } = await serviceDB().from('quiz_settings').select('quiz_id,settings').in('quiz_id', ids);
  if (error) {
    if (!isMissingRelation(error)) console.error('[quiz] settings load', error.code);
    return out;
  }
  for (const r of data ?? []) out.set(r.quiz_id as string, parseSettings(r.settings));
  return out;
}

export async function loadOneSettings(id: string): Promise<QuizSettings | null> {
  return (await loadSettings([id])).get(id) ?? null;
}

/** Upsert after save_owned_quiz has proven ownership. Returns false (not an error) when migration 004 is missing, so saving still works. */
export async function saveSettings(quizId: string, ownerId: string, settings: QuizSettings): Promise<boolean> {
  const { error } = await serviceDB().from('quiz_settings').upsert(
    { quiz_id: quizId, owner_id: ownerId, settings, visibility: settings.visibility, game_mode: settings.gameMode, updated_at: new Date().toISOString() },
    { onConflict: 'quiz_id' },
  );
  if (error) {
    if (!isMissingRelation(error)) console.error('[quiz] settings save', error.code);
    return false;
  }
  return true;
}

/** Library rule: a published quiz is listed only when its creator chose Public. No settings row = legacy quiz = public. */
export function listedInLibrary(s: QuizSettings | undefined): boolean {
  return !s || s.visibility === 'public';
}
/** Opening a quiz by its link: Public and Unlisted work for anyone; Private is the owner only. */
export function openByLink(v: Visibility | undefined): boolean {
  return v !== 'private';
}
