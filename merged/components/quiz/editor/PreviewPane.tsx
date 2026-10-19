'use client';
import { useMemo, useState } from 'react';
import { questionSchema } from '@/lib/quiz/validation';
import { explainIssue } from '@/lib/quiz/explain';
import { gradeDetailed } from '@/lib/quiz/grading';
import { computeAward } from '@/lib/quiz/scoring';
import { publicPayload } from '@/lib/quiz/public';
import { prepare } from '@/lib/quiz/editor-model';
import type { Question } from '@/lib/quiz/types';
import QuestionPlay from '../QuestionPlay';
import AnswerView from '../AnswerView';

export const DEVICES = [
  { id: 'phone', label: 'Phone', width: 375 },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'desktop', label: 'Laptop', width: 1100 },
  { id: 'projector', label: 'Projector', width: 1280 },
] as const;
export type DeviceId = (typeof DEVICES)[number]['id'];

/** Uses the real player component and the real grader, so what the author sees is what players get. Nothing is saved or scored. */
export default function PreviewPane({ q, device = 'desktop' }: { q: Question; device?: DeviceId }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<null | { ok: boolean; points: number; fraction: number }>(null);
  const [hintShown, setHintShown] = useState(false);
  const parsed = useMemo(() => questionSchema.safeParse(prepare(q)), [q]);
  const width = DEVICES.find((d) => d.id === device)!.width;
  if (!parsed.success) {
    const is = parsed.error.issues[0]!;
    return <p className="info" role="status">Finish this question to preview it: {explainIssue({ path: is.path as (string | number)[], message: is.message, code: is.code })}</p>;
  }
  const v = parsed.data as Question;
  const pq = { id: `preview-${attempt}`, kind: v.kind, prompt: v.prompt, payload: publicPayload(v.kind, v.payload, 'preview'), base_points: v.basePoints };
  const hint = (v.answerKey as { hint?: string }).hint;
  return (
    <div className="stack">
      <p className="note">This is exactly how a player sees the question at {width}px wide. Answers are checked against your key; nothing is saved or scored.</p>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ width, maxWidth: '100%', margin: '0 auto', border: '3px solid var(--qz-outline)', padding: 12, borderRadius: 10, background: 'var(--qz-panel2)', fontSize: device === 'projector' ? '1.25rem' : undefined }} data-device={device}>
          <QuestionPlay key={attempt} question={pq} submitLabel="Check answer" onSubmit={async (resp) => {
            try { const g = gradeDetailed(v, resp); setResult({ ok: g.correct, fraction: g.fraction, points: computeAward(v, g, { questionSeconds: 30, elapsedMs: 10_000 }).points }); } catch { setResult({ ok: false, fraction: 0, points: 0 }); }
          }} />
          {hint && !hintShown && <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => setHintShown(true)}>Show hint</button>}
          {hint && hintShown && <p className="info" role="status">Hint: {hint}</p>}
        </div>
      </div>
      {result && (
        <div className="stack" role="status">
          <p className={result.ok ? 'success' : 'error'} style={{ margin: 0 }}>{result.ok ? `Correct — ${result.points} points.` : result.points > 0 ? `Partly correct — ${result.points} points.` : 'Not correct.'}</p>
          <AnswerView kind={v.kind} payload={v.payload} answerKey={v.answerKey} />
          <div><button className="btn small ghost" onClick={() => { setResult(null); setHintShown(false); setAttempt((n) => n + 1); }}>Try again</button></div>
        </div>
      )}
    </div>
  );
}
