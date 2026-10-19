'use client';
import { SCORING_MODES, explainScoring, scoringOf } from '@/lib/quiz/scoring';
import type { Question } from '@/lib/quiz/types';
import type { Media } from '@/lib/quiz/validation';
import MediaField from './MediaField';

type Patch = Partial<Question>;
const clean = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length) && !(v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length))) as T;

/** Teaching notes, scoring, classification and media for one question. Everything here is optional. */
export default function QuestionExtras({ q, index, onChange }: { q: Question; index: number; onChange: (p: Patch) => void }) {
  const pl: any = q.payload, ak: any = q.answerKey;
  const meta = (pl.meta ?? {}) as Record<string, any>;
  const setPl = (k: string, v: unknown) => onChange({ payload: clean({ ...pl, [k]: v }) });
  const setAk = (k: string, v: unknown) => onChange({ answerKey: clean({ ...ak, [k]: v }) });
  const setMeta = (k: string, v: unknown) => setPl('meta', clean({ ...meta, [k]: v }));
  const multiPart = q.kind === 'connection_rush' || q.kind === 'truth_hunt' || q.kind === 'fill_table';
  const scoring = scoringOf(q);
  const modes = SCORING_MODES.filter((m) => m.mode !== 'partial' || multiPart);
  const id = `qf-${index}`;
  return (
    <div className="stack">
      <details>
        <summary>Teaching notes — explanation and hint</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <label>Explanation shown after the answer is revealed<textarea id={`${id}-explanation`} rows={2} maxLength={2000} value={ak.explanation ?? ''} onChange={(e) => setAk('explanation', e.target.value)} /></label>
          <label>Hint (players ask for it; it is never sent with the question)<input id={`${id}-hint`} maxLength={500} value={ak.hint ?? ''} onChange={(e) => setAk('hint', e.target.value)} /></label>
          {q.kind === 'multiple_choice' && (
            <div className="stack">
              <p className="note" style={{ margin: 0 }}>Why a wrong option is wrong (shown after reveal):</p>
              {(pl.options as { id: string; text: string }[]).filter((o) => !(ak.correctIds as string[]).includes(o.id)).map((o, j) => (
                <label key={o.id}>{o.text || `Option ${j + 1}`}<input maxLength={500} value={ak.distractorNotes?.[o.id] ?? ''} onChange={(e) => setAk('distractorNotes', { ...(ak.distractorNotes ?? {}), [o.id]: e.target.value })} /></label>
              ))}
            </div>
          )}
        </div>
      </details>
      <details>
        <summary>Scoring — {SCORING_MODES.find((m) => m.mode === scoring.mode)?.label}</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <label>How points are earned
            <select value={scoring.mode} onChange={(e) => { const mode = e.target.value; setPl('scoring', mode === 'fixed' ? undefined : mode === 'time_bonus' ? { mode, timeBonusMax: scoring.timeBonusMax ?? 50 } : { mode }); setAk('partial', mode === 'partial' ? true : undefined); }}>
              {modes.map((m) => <option key={m.mode} value={m.mode}>{m.label}</option>)}
            </select>
          </label>
          <p className="note">{SCORING_MODES.find((m) => m.mode === scoring.mode)?.help}</p>
          {scoring.mode === 'time_bonus' && <label>Largest speed bonus<input type="number" min={0} max={q.basePoints} value={scoring.timeBonusMax ?? 50} onChange={(e) => setPl('scoring', { mode: 'time_bonus', timeBonusMax: Math.max(0, Math.min(q.basePoints, Number(e.target.value) || 0)) })} /></label>}
          <p className="note" role="status"><strong>Preview:</strong> {explainScoring(q, { questionSeconds: 30 })}</p>
        </div>
      </details>
      <details>
        <summary>Topic, difficulty and learning objective</summary>
        <div className="grid2" style={{ marginTop: 10 }}>
          <label>Topic<input maxLength={80} value={meta.topic ?? ''} onChange={(e) => setMeta('topic', e.target.value)} /></label>
          <label>Difficulty<select value={meta.difficulty ?? ''} onChange={(e) => setMeta('difficulty', e.target.value || undefined)}><option value="">Not set</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label>Learning objective<input maxLength={200} value={meta.objective ?? ''} onChange={(e) => setMeta('objective', e.target.value)} /></label>
          <label>Section (groups questions)<input maxLength={80} value={meta.section ?? ''} onChange={(e) => setMeta('section', e.target.value)} /></label>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          <label className="inline"><input type="checkbox" checked={!!meta.aiDraft} onChange={(e) => setMeta('aiDraft', e.target.checked || undefined)} /> This question was drafted with AI help</label>
          {meta.aiDraft && (
            <>
              <label>Where can the facts be checked?<input maxLength={1000} value={meta.evidence ?? ''} onChange={(e) => setMeta('evidence', e.target.value)} /></label>
              <label className="inline"><input type="checkbox" checked={!!meta.verified} onChange={(e) => setMeta('verified', e.target.checked || undefined)} /> I checked this myself</label>
              <p className="note">AI-drafted questions cannot be published until you have checked them.</p>
            </>
          )}
        </div>
      </details>
      <MediaField idPrefix={`${id}-media`} media={pl.media as Media | undefined} onChange={(m) => setPl('media', m)} />
    </div>
  );
}
