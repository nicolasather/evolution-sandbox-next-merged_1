/** Find and rewrite every media reference inside a quiz. Pure; shared by the editor, the save route and the import/export code. */
import type { Question } from '../types';
import type { QuizSettings } from '../settings';

type Media = { id: string; posterId?: string } | undefined;

function eachMedia(q: Question, fn: (m: NonNullable<Media>, set: (next: unknown) => void) => void) {
  const pl: any = q.payload;
  const visit = (holder: any) => { if (holder?.media) fn(holder.media, (n) => { holder.media = n; }); };
  visit(pl);
  for (const key of ['options', 'left', 'right', 'statements'] as const) if (Array.isArray(pl[key])) pl[key].forEach(visit);
}

export function collectMediaIds(questions: Question[], settings?: Pick<QuizSettings, 'coverMediaId'>): string[] {
  const ids = new Set<string>();
  for (const q of questions) eachMedia(JSON.parse(JSON.stringify(q)) as Question, (m) => { ids.add(m.id); if (m.posterId) ids.add(m.posterId); });
  if (settings?.coverMediaId) ids.add(settings.coverMediaId);
  return [...ids];
}

/** Replace media ids (e.g. a queued offline upload's temporary id becoming the real asset id). Returns new objects; input untouched. */
export function rewriteMediaIds(questions: Question[], map: Record<string, string>): Question[] {
  return questions.map((q) => {
    const copy = JSON.parse(JSON.stringify(q)) as Question;
    eachMedia(copy, (m) => { if (map[m.id]) m.id = map[m.id]!; if (m.posterId && map[m.posterId]) m.posterId = map[m.posterId]; });
    return copy;
  });
}

/** Remove every reference to media ids the account cannot use (e.g. after importing a backup made in another account). */
export function stripMedia(questions: Question[], keep: (id: string) => boolean): { questions: Question[]; removed: number } {
  let removed = 0;
  const out = questions.map((q) => {
    const copy = JSON.parse(JSON.stringify(q)) as Question;
    eachMedia(copy, (m, set) => { if (!keep(m.id)) { set(undefined); removed++; } });
    const strip = (o: any) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; };
    const pl: any = copy.payload; strip(pl);
    for (const key of ['options', 'left', 'right', 'statements']) if (Array.isArray(pl[key])) pl[key].forEach(strip);
    return copy;
  });
  return { questions: out, removed };
}
