'use client';
import { useMemo, useState } from 'react';
import { prepare } from '@/lib/quiz/editor-model';
import { explainIssue } from '@/lib/quiz/explain';
import { gradeQuestion } from '@/lib/quiz/grading';
import { publicPayload } from '@/lib/quiz/public';
import type { Question } from '@/lib/quiz/types';
import { questionSchema } from '@/lib/quiz/validation';
import AnswerView from '@/components/quiz/AnswerView';
import QuestionPlay from '@/components/quiz/QuestionPlay';

/** Uses the real player component and the real grader, so what the author sees is what players get. */
export default function QuestionPreview({ q }: { q: Question }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<null | boolean>(null);
  const parsed = useMemo(() => questionSchema.safeParse(prepare(q)), [q]);
  if (!parsed.success) {
    const is = parsed.error.issues[0]!;
    return <p className="info" role="status">Finish this question to preview it: {explainIssue({ path: is.path as (string | number)[], message: is.message, code: is.code })}</p>;
  }
  const v = parsed.data as Question;
  const pq = { id: `preview-${attempt}`, kind: v.kind, prompt: v.prompt, payload: publicPayload(v.kind, v.payload, 'preview'), base_points: v.basePoints };
  return (
    <div className="stack">
      <p className="note">This is exactly how a player sees the question. Answers are checked against your key; nothing is saved or scored.</p>
      <QuestionPlay key={attempt} question={pq} submitLabel="Check answer" onSubmit={async (resp) => { try { setResult(gradeQuestion(v, resp)); } catch { setResult(false); } }} />
      {result !== null && (
        <div className="stack" role="status">
          <p className={result ? 'success' : 'error'} style={{ margin: 0 }}>{result ? `Correct — ${v.basePoints} points.` : 'Not correct.'}</p>
          <AnswerView kind={v.kind} payload={v.payload} answerKey={v.answerKey} />
          <div><button className="btn small ghost" onClick={() => { setResult(null); setAttempt((n) => n + 1); }}>Try again</button></div>
        </div>
      )}
    </div>
  );
}
