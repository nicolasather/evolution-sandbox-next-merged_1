'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { blank } from '@/lib/quiz/editor-model';
import { quizBalance } from '@/lib/quiz/quality';
import { kindLabels, type Question, type QuestionKind } from '@/lib/quiz/types';
import CreatorChrome from '../CreatorChrome';
import { useCreator } from '../CreatorProvider';
import FormatPicker from '../FormatPicker';
import ImportPanel from '../ImportPanel';
import QuestionEditor from '../QuestionEditor';
import QuestionOutline from '../QuestionOutline';
import AdvancedToggle from '../AdvancedToggle';
import BankPanel from '../BankPanel';

type Removed = { q: Question; index: number } | null;
const MAX = 200;

export default function QuestionsStep() {
  const c = useCreator();
  const { questions } = c;
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState(false);
  const [tool, setTool] = useState<null | 'import' | 'bank'>(null);
  const [removed, setRemoved] = useState<Removed>(null);
  const [live, setLive] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idx = Math.min(active, Math.max(0, questions.length - 1));

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);
  const focusEditor = () => setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);

  const add = useCallback((k: QuestionKind) => {
    const q = { ...blank(k), basePoints: c.settings.rules.basePoints };
    c.setQuestions((a) => [...a, q]); setActive(questions.length); setPicking(false); setTool(null); setLive(`Added question ${questions.length + 1}`); focusEditor();
  }, [c, questions.length]);
  const addMany = (qs: Question[]) => { c.setQuestions((a) => [...a, ...qs]); setActive(questions.length); setLive(`Added ${qs.length} question${qs.length === 1 ? '' : 's'}`); };
  const patch = (i: number, p: Partial<Question>) => c.setQuestions((a) => a.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= questions.length || from === to) return;
    c.setQuestions((a) => { const x = [...a]; const [m] = x.splice(from, 1); x.splice(to, 0, m!); return x; });
    setActive(to); setLive(`Question moved to position ${to + 1}`);
  };
  const dup = (i: number) => {
    if (questions.length >= MAX) return;
    c.setQuestions((a) => { const q = JSON.parse(JSON.stringify(a[i])) as Question; delete q.id; const out = [...a]; out.splice(i + 1, 0, q); return out; });
    setActive(i + 1); setLive(`Question ${i + 1} duplicated`);
  };
  const remove = (i: number) => {
    const q = questions[i]!;
    c.setQuestions((a) => a.filter((_, j) => j !== i));
    setActive(Math.max(0, i - 1));
    setRemoved({ q, index: i }); setLive(`Question ${i + 1} removed. Undo is available.`);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemoved(null), 15000);
  };
  const undo = () => {
    if (!removed) return;
    c.setQuestions((a) => { const x = [...a]; x.splice(Math.min(removed.index, x.length), 0, removed.q); return x; });
    setActive(removed.index); setRemoved(null); setLive('Question restored');
  };

  if (!c.ready) return <CreatorChrome step="questions"><p className="muted-text" role="status">Loading your draft…</p></CreatorChrome>;
  if (!c.draftKey) return <CreatorChrome step="questions" canContinue={false} continueHint="Choose a game mode first."><p className="info">Start with <Link href="/quiz/create/mode">choosing a game mode</Link>.</p></CreatorChrome>;

  const balance = quizBalance(questions);
  const aq = questions[idx];
  const noQuestions = questions.length === 0;

  return (
    <CreatorChrome step="questions" canContinue={!noQuestions} continueHint="Add at least one question to continue.">
      <div className="sr-only" role="status" aria-live="polite">{live}</div>
      {removed && (
        <div className="info row spread cr-undo" role="status"><span>Question {removed.index + 1} removed.</span><button className="btn small" onClick={undo}>Undo</button></div>
      )}
      <div className="cr-qtools row">
        <button className="btn" onClick={() => { setPicking((v) => !v); setTool(null); }} disabled={questions.length >= MAX} aria-expanded={picking}>+ Add question</button>
        <button className="btn ghost small" onClick={() => { setTool(tool === 'import' ? null : 'import'); setPicking(false); }} aria-expanded={tool === 'import'}>Import / Smart Paste</button>
        <button className="btn ghost small" onClick={() => { setTool(tool === 'bank' ? null : 'bank'); setPicking(false); }} aria-expanded={tool === 'bank'}>Question Bank</button>
        <span className="spacer" />
        <AdvancedToggle label="Advanced: hints, explanations, per-question timer" />
      </div>
      {picking && <FormatPicker onPick={add} onCancel={() => setPicking(false)} />}
      {tool === 'import' && <ImportPanel points={c.settings.rules.basePoints} existing={questions.length} onAdd={addMany} onClose={() => setTool(null)} />}
      {tool === 'bank' && <BankPanel questions={questions} active={idx} onInsert={addMany} onClose={() => setTool(null)} />}

      {noQuestions && !picking && tool === null ? (
        <div className="panel stack cr-empty">
          <h2>No questions yet</h2>
          <p className="muted-text">Pick a format to write your first question. You can mix all five formats in one quiz, and attach a picture, GIF or video to any of them.</p>
          <FormatPicker onPick={add} />
        </div>
      ) : (
        <div className="qz-editor cr-qlayout">
          <aside className="qz-nav-col" aria-label="Question list">
            <div className="row spread"><h2 style={{ margin: 0, fontSize: '1.6rem' }}>Questions <span className="pill">{questions.length}</span></h2></div>
            <QuestionOutline questions={questions} issues={c.questionIssues} active={idx} onSelect={(i) => { setActive(i); focusEditor(); }} onMove={move} />
            {questions.length > 0 && (
              <details className="cr-balance">
                <summary>Quiz overview</summary>
                <ul className="note">
                  {Object.entries(balance.byKind).map(([k, n]) => <li key={k}>{kindLabels[k as QuestionKind]}: {n}</li>)}
                  <li>About {Math.round(balance.totalReadingSeconds / 60)} min of reading in total · {balance.avgReadingSeconds}s per question</li>
                  <li>{balance.withMedia} with media</li>
                  {balance.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
                <p className="note">An overview of what is in the quiz, not a prediction of how hard players will find it.</p>
              </details>
            )}
          </aside>
          <div className="qz-canvas" ref={editorRef}>
            {aq && (
              <>
                <div className="row cr-qactions">
                  <button className="btn small ghost" onClick={() => dup(idx)} disabled={questions.length >= MAX}>Duplicate</button>
                  <button className="btn small ghost" onClick={() => { setTool('bank'); }}>Save to bank</button>
                  <button className="btn small danger" onClick={() => remove(idx)}>Remove</button>
                </div>
                <QuestionEditor key={aq.id ?? `q${idx}`} q={aq} index={idx} issue={c.questionIssues[idx] ?? null} onChange={(p) => patch(idx, p)} />
              </>
            )}
            <p className="note" style={{ marginTop: 14 }}>{questions.length} question{questions.length === 1 ? '' : 's'}. A draft can be unfinished; publishing needs at least one complete question.</p>
          </div>
        </div>
      )}
    </CreatorChrome>
  );
}
