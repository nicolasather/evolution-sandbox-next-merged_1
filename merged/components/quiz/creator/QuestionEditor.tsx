'use client';
import { useMemo, useState } from 'react';
import { blank } from '@/lib/quiz/editor-model';
import { questionWarnings } from '@/lib/quiz/quality';
import { kindLabels, QUESTION_KINDS, type Question, type QuestionKind } from '@/lib/quiz/types';
import KindEditor from '@/components/quiz/KindEditor';
import MediaAttach from '@/components/quiz/media/MediaAttach';
import QuestionPreview from './QuestionPreview';
import { useCreator } from './CreatorProvider';

/** Edits one question: prompt, optional media, the format's own answer editor, and (in Advanced) hint, explanation and timer. */
export default function QuestionEditor({ q, index, issue, onChange }: { q: Question; index: number; issue: string | null; onChange: (patch: Partial<Question>) => void }) {
  const c = useCreator();
  const [preview, setPreview] = useState(false);
  const pl: any = q.payload; const ak: any = q.answerKey;
  const adv = c.settings.advanced;
  const warnings = useMemo(() => (issue ? [] : questionWarnings(q, c.settings.rules.questionSeconds)), [q, issue, c.settings.rules.questionSeconds]);
  const setPayload = (patch: Record<string, unknown>) => onChange({ payload: cleanup({ ...pl, ...patch }) });
  const setKey = (patch: Record<string, unknown>) => onChange({ answerKey: cleanup({ ...ak, ...patch }) });

  return (
    <section className="qcard active" aria-labelledby={`q-h-${index}`}>
      <header>
        <h2 id={`q-h-${index}`}>Question {index + 1} · {kindLabels[q.kind]}</h2>
        <div className="row"><button className="btn small ghost" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>{preview ? 'Back to editing' : 'Preview'}</button></div>
      </header>
      {issue && <p className="info" role="status" style={{ marginBottom: 12 }}>Needs attention before it can be published: {issue}</p>}
      {preview ? <QuestionPreview q={q} /> : (
        <div className="stack">
          <div className="grid2">
            <label>Answer format
              <select value={q.kind} onChange={(e) => { if (q.prompt || window.confirm('Changing the format resets this question’s answers. Keep the question text?')) onChange({ ...blank(e.target.value as QuestionKind), prompt: q.prompt, basePoints: q.basePoints, id: q.id }); }}>
                {QUESTION_KINDS.map((k) => <option key={k} value={k}>{kindLabels[k]}</option>)}
              </select>
            </label>
            <label>Points for a correct answer<input type="number" min={0} max={10000} value={q.basePoints} onChange={(e) => onChange({ basePoints: Math.max(0, Math.min(10000, Number(e.target.value) || 0)) })} /></label>
          </div>
          <label>Question<textarea rows={3} value={q.prompt} maxLength={3000} placeholder="Write your question" onChange={(e) => onChange({ prompt: e.target.value })} /></label>
          <MediaAttach label="Add image, GIF or video" value={pl.media} onChange={(m) => setPayload({ media: m })} role="question" />
          <KindEditor q={q} onChange={onChange} />
          {adv && (
            <fieldset className="cr-fieldset stack">
              <legend>Advanced for this question</legend>
              <label>Hint (optional, players can see it)<input value={pl.hint ?? ''} maxLength={300} onChange={(e) => setPayload({ hint: e.target.value || undefined })} /></label>
              <label>Explanation (optional, shown after the answer is revealed)<textarea rows={2} value={ak.explanation ?? ''} maxLength={600} onChange={(e) => setKey({ explanation: e.target.value || undefined })} /></label>
              <label>Time for this question (seconds, optional — overrides the quiz timer)
                <input type="number" min={5} max={600} value={pl.timeSeconds ?? ''} onChange={(e) => setPayload({ timeSeconds: e.target.value === '' ? undefined : Math.max(5, Math.min(600, Number(e.target.value) || 5)) })} placeholder={c.settings.rules.questionSeconds ? String(c.settings.rules.questionSeconds) : 'No limit'} />
              </label>
            </fieldset>
          )}
          {warnings.length > 0 && (
            <div className="cr-warnings" role="status" aria-label="Suggestions for this question">
              <h3>Suggestions</h3>
              <ul>{warnings.map((w) => <li key={w.code} data-level={w.level}>{w.message}</li>)}</ul>
              <p className="note">These are rules of thumb, not a prediction of how players will find it.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Drop keys that are undefined so strict schemas never see them. */
function cleanup<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}
