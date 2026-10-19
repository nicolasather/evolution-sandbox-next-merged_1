'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/quiz/client';
import { ensureCloudSession } from '@/lib/quiz/session-client';
import { kindLabels, type QuestionKind } from '@/lib/quiz/types';
import { REPORT_REASONS, REPORT_STATUS_TEXT, isVerified, qualitySignals } from '@/lib/quiz/library';
import { coverSvg } from '@/lib/quiz/art';
import { estimateQuizSeconds, formatDuration, quizMaxPoints } from '@/lib/quiz/scoring';

type Detail = { quiz: { id: string; title: string; description: string; status: string; updated_at: string; isMine: boolean; meta?: Record<string, any> }; questions: { kind: QuestionKind; prompt: string; basePoints: number; payload: Record<string, unknown> }[] };
const REASON_TEXT: Record<(typeof REPORT_REASONS)[number], string> = { incorrect_fact: 'An answer or fact is wrong', broken_media: 'A picture, audio or video does not work', copyright: 'It uses someone else’s work without permission', inappropriate: 'It is not suitable for a school audience', other: 'Something else' };

/** Library details: what the quiz covers, how long it takes, who made it, and ways to play, remix or report it. No answer keys are ever loaded here. */
export default function QuizDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>('incorrect_fact');
  const [detail, setDetail] = useState('');
  const [receipt, setReceipt] = useState('');

  useEffect(() => { api<Detail>(`/api/quiz/quizzes/${id}`).then(setD).catch((e) => setError((e as Error).message)); }, [id]);

  async function remix() {
    setBusy(true); setError('');
    try {
      const s = await ensureCloudSession();
      if (s.status !== 'ready') throw new Error('Copying a quiz needs a session. Sign in or create an account, then try again.');
      const r = await api<{ id: string }>(`/api/quiz/quizzes/${id}/remix`, { method: 'POST', json: {} });
      window.location.href = `/quiz/edit/${r.id}`;
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  async function report() {
    setBusy(true); setError('');
    try {
      await ensureCloudSession();
      const r = await api<{ reference: string; message: string }>('/api/quiz/reports', { method: 'POST', json: { quizId: id, reason, detail } });
      setReceipt(`Thank you. Your report reference is ${r.reference}. ${r.message}`); setReporting(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (error && !d) return <main className="narrow"><section className="panel stack"><h1>Quiz not found</h1><p className="error" role="alert">{error}</p><Link className="btn" href="/quiz/library">Back to the library</Link></section></main>;
  if (!d) return <main className="page"><p className="muted-text" role="status">Loading…</p></main>;
  const q = d.quiz; const meta = q.meta ?? {};
  const qs = d.questions.map((x) => ({ ...x, answerKey: {} }));
  const kinds = [...new Set(d.questions.map((x) => x.kind))];
  const signals = qualitySignals({ id, title: q.title, description: q.description, updatedAt: q.updated_at, questionCount: d.questions.length, meta, reviewState: 'unreviewed' });
  const verified = isVerified({ verified: false });
  return (
    <main className="page" id="main">
      <nav aria-label="Breadcrumb" className="note"><Link href="/quiz">Quiz Studio</Link> › <Link href="/quiz/library">Quiz Library</Link> › {q.title}</nav>
      <header className="page-header">
        <div><p className="eyebrow">Quiz details</p><h1>{q.title}</h1>{verified && <span className="pill published">Reviewed</span>}</div>
        <div className="row"><Link className="btn" href={`/quiz/setup/${id}`}>Play</Link>{q.isMine ? <Link className="btn ghost" href={`/quiz/edit/${id}`}>Edit</Link> : <button className="btn ghost" disabled={busy} onClick={remix}>Copy to my quizzes</button>}</div>
      </header>
      <div aria-hidden style={{ maxWidth: 480, borderRadius: 8, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: coverSvg(meta.cover?.seed || id, meta.subject ?? '') }} />
      <section className="panel stack">
        <p>{q.description || 'No description.'}</p>
        <ul className="row" style={{ listStyle: 'none', padding: 0 }}>
          <li className="pill">{d.questions.length} questions</li><li className="pill">about {formatDuration(estimateQuizSeconds(qs as never))}</li><li className="pill">up to {quizMaxPoints(qs as never, { questionSeconds: 30 })} points</li>
          {meta.subject && <li className="pill">{meta.subject}</li>}{meta.ageBand && <li className="pill">Ages {meta.ageBand}</li>}{meta.language && <li className="pill">{String(meta.language).toUpperCase()}</li>}
        </ul>
        <p className="note">Formats: {kinds.map((k) => kindLabels[k]).join(' · ')}</p>
        {meta.objectives?.length > 0 && <div><h3>Learning objectives</h3><ul>{meta.objectives.map((o: string) => <li key={o}>{o}</li>)}</ul></div>}
        {meta.tags?.length > 0 && <p className="note">Tags: {meta.tags.join(', ')}</p>}
        {meta.sourceTitle && <p className="note">Remixed from “{meta.sourceTitle}”{meta.sourceAuthor ? ` by ${meta.sourceAuthor}` : ''}.</p>}
        <p className="note">Updated {new Date(q.updated_at).toLocaleDateString()}</p>
      </section>
      <section className="panel stack" aria-labelledby="qs-h"><h2 id="qs-h">Quality check</h2>
        <ul>{signals.map((s) => <li key={s.label}>{s.ok ? '✓' : '○'} {s.label}</li>)}</ul>
        <p className="note">Saves and plays are never used to judge whether a quiz is correct.</p></section>
      <section className="panel stack" aria-labelledby="rp-h"><h2 id="rp-h">See a problem?</h2>
        {receipt && <p className="success" role="status">{receipt}</p>}
        {!receipt && !reporting && <div><button className="btn small ghost" onClick={() => setReporting(true)}>Report this quiz</button></div>}
        {reporting && (
          <div className="stack">
            <label>What is wrong?<select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>{REPORT_REASONS.map((r) => <option key={r} value={r}>{REASON_TEXT[r]}</option>)}</select></label>
            <label>Tell us more (optional)<textarea rows={3} maxLength={1000} value={detail} onChange={(e) => setDetail(e.target.value)} /></label>
            <p className="note">{REPORT_STATUS_TEXT.received}</p>
            <div className="row"><button className="btn" disabled={busy} onClick={report}>Send report</button><button className="btn ghost" onClick={() => setReporting(false)}>Cancel</button></div>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
