'use client';
import type { Loose } from '@/lib/quiz/loose';
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { kindLabels, type QuestionKind } from '@/lib/quiz/types';
import MediaView from './MediaView';

export type PlayQuestion = { id: string; kind: QuestionKind; prompt: string; payload: Loose; base_points: number };

const KEYCAP_LETTERS = 'ABCDEFGH';
const STRIKE_LIMIT = 3;

/** Renders one question in any of the five formats and returns the player's response. It never knows the answer.
 *  `liveRound` turns on the live-round protections: copy/context-menu guard and the focus-loss curtain. */
export default function QuestionPlay({ question: q, onSubmit, busy = false, disabled = false, submitLabel = 'Submit answer', onHint, readAloud = true, liveRound = false, onFocusLost }: {
  question: PlayQuestion; onSubmit: (response: unknown) => Promise<unknown>; busy?: boolean; disabled?: boolean; submitLabel?: string;
  /** Asks the server for this question's hint. Hints are never part of the question itself. */
  onHint?: () => Promise<string | null>; readAloud?: boolean;
  /** Live rounds only: blocks copy and context menus on the question, and shows a curtain when the player leaves the window. */
  liveRound?: boolean;
  /** Called with the running strike count each time the player leaves the game window during a live round. */
  onFocusLost?: (strikes: number) => void;
}) {
  const p = q.payload;
  const [choice, setChoice] = useState('');
  const [multi, setMulti] = useState<string[]>([]);
  const [hint, setHint] = useState<string | null | undefined>(undefined);
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [forge, setForge] = useState('');
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [truth, setTruth] = useState<Record<string, boolean>>({});
  const [cells, setCells] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const leftIds: string[] = useMemo(() => (q.kind === 'connection_rush' ? p.left.map((a: Loose) => a.id) : []), [q.kind, p]);
  // Pre-read curtain: answers stay locked for 1.5s on each new question so nobody clicks in a panic.
  const [reading, setReading] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the 1.5s pre-read window for each new question
    setReading(true);
    const t = setTimeout(() => setReading(false), 1500);
    return () => clearTimeout(t);
  }, [q.id]);
  const off = disabled || sent || reading;
  const [pressed, setPressed] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [lost, setLost] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const guarded = liveRound && !disabled && !sent;

  function flashToast(text: string) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }

  // Keyboard hotkeys for single-choice questions: 1-4 or A-D pick an option; the matching keycap depresses.
  useEffect(() => {
    if (q.kind !== 'multiple_choice' || off) return undefined;
    const opts: Loose[] = p.options;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const idx = /^[1-9]$/.test(k) ? Number(k) - 1 : KEYCAP_LETTERS.toLowerCase().indexOf(k);
      if (idx < 0 || idx >= opts.length) return;
      e.preventDefault();
      const id = opts[idx].id as string;
      setPressed(id);
      setTimeout(() => setPressed((cur) => (cur === id ? null : cur)), 140);
      if (p.multi) setMulti((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
      else setChoice(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // `off` and the payload shape are the only inputs; `p` is stable for one question
  }, [q.kind, p, off]);

  // Live-round focus guard: leaving the window shows the curtain at once; returning waits a 1.5s cooldown.
  useEffect(() => {
    if (!guarded) return undefined;
    const leave = () => {
      clearTimeout(returnTimer.current);
      setLost(true);
      setStrikes((s) => {
        const next = s + 1;
        onFocusLost?.(next);
        return next;
      });
    };
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(returnTimer.current);
      returnTimer.current = setTimeout(() => setLost(false), 1500);
    };
    const onVis = () => (document.visibilityState === 'hidden' ? leave() : back());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', leave);
    window.addEventListener('focus', back);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', back);
      clearTimeout(returnTimer.current);
    };
  }, [guarded, onFocusLost]);

  function guardCopy(e: SyntheticEvent) {
    if (!guarded) return;
    e.preventDefault();
    flashToast('Copy Protected During Live Round');
  }

  const response = (): unknown => {
    switch (q.kind) {
      case 'multiple_choice': return { kind: q.kind, selectedIds: p.multi ? multi : choice ? [choice] : [] };
      case 'answer_forge': return { kind: q.kind, text: forge };
      case 'connection_rush': return { kind: q.kind, pairs: leftIds.map((l) => ({ leftId: l, rightId: pairs[l] ?? '' })) };
      case 'truth_hunt': return { kind: q.kind, truth };
      case 'fill_table': return { kind: q.kind, cells };
    }
  };
  const valid =
    q.kind === 'multiple_choice' ? (p.multi ? multi.length > 0 : !!choice) :
    q.kind === 'answer_forge' ? !!forge.trim() :
    q.kind === 'connection_rush' ? leftIds.every((x) => pairs[x]) && new Set(Object.values(pairs)).size === leftIds.length :
    q.kind === 'truth_hunt' ? p.statements.every((x: Loose) => x.id in truth) :
    p.rows.every((row: Loose[], r: number) => row.every((cell: Loose, c: number) => !cell.blank || (cells[`${r}:${c}`] ?? '').trim().length > 0));

  async function submit() {
    if (!valid || disabled || busy || sent) return;
    setSent(true);
    try { await onSubmit(response()); } catch { setSent(false); } // the parent shows the error; allow another try
  }
  const spoken = () => [q.prompt, ...(q.kind === 'multiple_choice' ? p.options.map((o: Loose, i: number) => `${String.fromCharCode(65 + i)}. ${o.text}`) : q.kind === 'truth_hunt' ? p.statements.map((x: Loose) => x.text) : [])].join('. ');
  function speak() {
    if (!canSpeak) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(spoken()); u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    setSpeaking(true); window.speechSynthesis.speak(u);
  }
  const usedRights = new Set(Object.values(pairs));

  return (
    <div
      className={`stack${liveRound ? ' qz-protect' : ''}`}
      onCopy={guardCopy}
      onCut={guardCopy}
      onContextMenu={guardCopy}
    >
      {guarded && lost && (
        <div className="qz-curtain" role="alertdialog" aria-modal="true" aria-labelledby="qz-curtain-title">
          <div>
            <p id="qz-curtain-title">FOCUS LOST — Return to Game Window</p>
            <small>Strike {Math.min(strikes, STRIKE_LIMIT)}/{STRIKE_LIMIT}. Answers unlock 1.5 seconds after you return.</small>
          </div>
        </div>
      )}
      {toast && <p className="qz-toast" role="status">{toast}</p>}
      <div>
        <p className="eyebrow">{kindLabels[q.kind]} · {q.base_points} points</p>
        <p className="prompt">
          {reading
            ? q.prompt.split(/\s+/).filter(Boolean).map((w, i) => (
              <span key={`${i}-${w}`} className="qz-word" style={{ animationDelay: `${i * 18}ms` }}>{w} </span>
            ))
            : q.prompt}
        </p>
        {reading && (
          <div className="qz-tension" role="status" aria-live="polite">
            <span>Read carefully… answers unlock in a moment</span>
            <div className="qz-tension-track" aria-hidden="true"><div className="qz-tension-fill" /></div>
          </div>
        )}
        {p.media && <MediaView media={p.media} />}
        {readAloud && (
          <div className="row">
            {canSpeak && <button type="button" className="btn small ghost" onClick={speak} aria-pressed={speaking}>{speaking ? 'Stop reading' : '🔊 Read aloud'}</button>}
            {!canSpeak && <details><summary>Text version (read aloud is not available in this browser)</summary><p className="note">{spoken()}</p></details>}
          </div>
        )}
      </div>
      {q.kind === 'multiple_choice' && (
        <div className="answers" data-reading={reading} role="radiogroup" aria-label="Answer options">
          {p.multi && <p className="note">Choose every correct option.</p>}
          {p.options.map((o: Loose) => {
            const on = p.multi ? multi.includes(o.id) : choice === o.id;
            return (
              <button key={o.id} role={p.multi ? 'checkbox' : 'radio'} aria-checked={on} className="choice" data-selected={on} data-pressed={pressed === o.id}onClick={() => (p.multi ? setMulti((m) => (m.includes(o.id) ? m.filter((x) => x !== o.id) : [...m, o.id])) : setChoice(o.id))} disabled={off}>
                <span className="qz-keycap" aria-hidden="true">{KEYCAP_LETTERS[p.options.indexOf(o)] ?? ''}</span>
                {o.image && <MediaView media={o.image} compact />}{o.text}
              </button>
            );
          })}
        </div>
      )}
      {q.kind === 'answer_forge' && (
        <label>Your answer<input value={forge} onChange={(e) => setForge(e.target.value)} disabled={off} maxLength={500} autoComplete="off" placeholder={p.placeholder ?? 'Your answer'} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} /></label>
      )}
      {q.kind === 'connection_rush' && (
        <div className="stack">
          <p className="note">Connect every item on the left to one item on the right. Each can be used once.</p>
          {p.left.map((l: Loose) => (
            <div className="grid2" key={l.id} style={{ alignItems: 'center' }}>
              <strong>{l.label}</strong>
              <select aria-label={`Match for ${l.label}`} disabled={off} value={pairs[l.id] ?? ''} onChange={(e) => setPairs((s) => ({ ...s, [l.id]: e.target.value }))}>
                <option value="">Choose a match…</option>
                {p.right.map((r: Loose) => <option key={r.id} value={r.id} disabled={usedRights.has(r.id) && pairs[l.id] !== r.id}>{r.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {q.kind === 'truth_hunt' && (
        <div className="stack">
          <p className="note">Decide whether each statement is true or false.</p>
          {p.statements.map((s: Loose) => (
            <div className="row spread" key={s.id}>
              <span style={{ flex: '1 1 260px' }}>{s.text}</span>
              <div className="row" role="group" aria-label={`Is this true? ${s.text}`}>
                <button className="btn small ghost" aria-pressed={truth[s.id] === true} disabled={off} onClick={() => setTruth((v) => ({ ...v, [s.id]: true }))}>True</button>
                <button className="btn small ghost" aria-pressed={truth[s.id] === false} disabled={off} onClick={() => setTruth((v) => ({ ...v, [s.id]: false }))}>False</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {q.kind === 'fill_table' && (
        <div className="tablewrap"><table>
          <thead><tr>{p.columns.map((c: string, i: number) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>{p.rows.map((row: Loose[], r: number) => (
            <tr key={r}>{row.map((cell: Loose, c: number) => (
              <td key={c}>{cell.blank
                ? <input aria-label={`Fill row ${r + 1}, column ${c + 1}`} placeholder="Fill in" disabled={off} maxLength={500} value={cells[`${r}:${c}`] ?? ''} onChange={(e) => setCells((s) => ({ ...s, [`${r}:${c}`]: e.target.value }))} />
                : cell.text}</td>
            ))}</tr>
          ))}</tbody>
        </table></div>
      )}
      <div className="row" style={{ alignItems: 'center' }}>
        <button className="btn" onClick={submit} disabled={!valid || off || busy} aria-busy={busy}>{sent ? '✓ Answer sent' : busy ? 'Checking…' : submitLabel}</button>
        {onHint && !off && hint === undefined && <button type="button" className="btn small ghost" onClick={async () => { try { setHint(await onHint()); } catch { setHint(null); } }}>Show hint</button>}
        <span className="sr-only" role="status" aria-live="polite">{sent ? 'Your answer was sent.' : ''}</span>
      </div>
      {hint !== undefined && <p className="info" role="status">{hint ? `Hint: ${hint}` : 'There is no hint for this question.'}</p>}
    </div>
  );
}
