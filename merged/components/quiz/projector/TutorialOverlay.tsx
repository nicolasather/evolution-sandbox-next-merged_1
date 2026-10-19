'use client';
/** English-only, replayable, keyboard-friendly tutorial with a NONPERSISTENT practice turn: choose an action, answer a sample question, see what
 *  would have happened. Only a "seen" flag is kept in this browser; nothing touches a room, a score, a reward or a quiz. */
import { useEffect, useRef, useState } from 'react';
import type { GameKey } from '@/lib/quiz/projector/types';
import { TUTORIALS } from '@/lib/quiz/projector/tutorials';

const STORAGE = 'quiz:projector:tutorials:v1';
type Props = { game: GameKey; name: string; auto?: boolean; label?: string; className?: string };
const seen = (game: GameKey) => { try { return !!(JSON.parse(localStorage.getItem(STORAGE) || '{}') as Record<string, boolean>)[game]; } catch { return true; } };
const markSeen = (game: GameKey) => { try { const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') as Record<string, boolean>; localStorage.setItem(STORAGE, JSON.stringify({ ...saved, [game]: true })); } catch { /* storage disabled */ } };

export default function TutorialOverlay({ game, name, auto = true, label = 'How to play', className = 'btn small ghost pj-tutorial-launch' }: Props) {
  const [open, setOpen] = useState(false); const [step, setStep] = useState(0);
  const [pick, setPick] = useState<number | null>(null); const [ans, setAns] = useState<number | null>(null);
  const guide = TUTORIALS[game]; const dialog = useRef<HTMLDivElement>(null); const opener = useRef<HTMLButtonElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- first visit on this device opens the guide once
  useEffect(() => { if (auto && !seen(game)) setOpen(true); }, [auto, game]);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null; dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); markSeen(game); }
      if (e.key === 'Tab' && dialog.current) { const f = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled])')]; if (!f.length) return; const first = f[0]!, last = f[f.length - 1]!; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    window.addEventListener('keydown', onKey); return () => { window.removeEventListener('keydown', onKey); (prev ?? opener.current)?.focus?.(); };
  }, [open, game]);
  const close = () => { setOpen(false); markSeen(game); };
  const reset = () => { setStep(0); setPick(null); setAns(null); };
  const pr = guide.practice; const choice = pick === null ? null : pr.choices[pick]; const right = ans === pr.correct;
  return <>
    <button ref={opener} type="button" className={className} onClick={() => { reset(); setOpen(true); }} aria-haspopup="dialog">{label}</button>
    {open && <div className="pj-tutorial-shade" role="presentation">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`How to play ${name}`} className="pj-tutorial-dialog">
        <div className="pj-tutorial-head"><p className="eyebrow">How to play · {name}</p><button type="button" aria-label="Close tutorial" className="btn small ghost" onClick={close}>Close</button></div>
        <p className="pj-tutorial-objective"><b>Goal:</b> {guide.objective} <b>Winning:</b> {guide.win}</p>
        <nav aria-label="Tutorial steps" className="pj-tutorial-steps">{guide.steps.map((s, i) => <button type="button" key={s.title} onClick={() => setStep(i)} className={i === step ? 'active' : ''} aria-current={i === step ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s.title}`}>{i + 1}</button>)}</nav>
        <div className="pj-tutorial-content"><span className="pj-tutorial-index">STEP {step + 1} / {guide.steps.length}</span><h2>{guide.steps[step]!.title}</h2><p>{guide.steps[step]!.detail}</p></div>
        <div className="pj-tutorial-demo"><p className="eyebrow">Practice turn · sample only</p>
          {pick === null && <><p>Choose what to do this turn:</p><div className="row">{pr.choices.map((c, i) => <button key={c.label} type="button" className="btn small primary" onClick={() => setPick(i)}>{c.label}</button>)}</div></>}
          {pick !== null && ans === null && <><p><i>{choice!.setup}</i></p><p><b>Sample question:</b> {pr.prompt}</p><div className="row" role="group" aria-label="Sample answers">{pr.options.map((o, i) => <button key={o} type="button" className="btn small ghost" onClick={() => setAns(i)}>{String.fromCharCode(65 + i)}. {o}</button>)}</div></>}
          {pick !== null && ans !== null && <><p><b>{right ? 'Correct.' : `Not quite — the answer was ${pr.options[pr.correct]}.`}</b> {pr.why}</p><p>{right ? choice!.ifRight : choice!.ifWrong}</p><button type="button" className="btn small ghost" onClick={() => { setPick(null); setAns(null); }}>Try another practice turn</button></>}
          <p className="pj-tutorial-disclaimer">This practice does not change your room, scores, rewards or quiz.</p>
        </div>
        <ul className="pj-tutorial-tips">{guide.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        <div className="pj-tutorial-actions"><button type="button" className="btn ghost" onClick={close}>Skip tutorial</button>
          <div className="row"><button type="button" className="btn ghost" disabled={step === 0} onClick={() => setStep((v) => v - 1)}>Back</button>
            <button type="button" className="btn primary" onClick={() => (step === guide.steps.length - 1 ? close() : setStep((v) => v + 1))}>{step === guide.steps.length - 1 ? 'Start playing' : 'Next'}</button></div></div>
      </div>
    </div>}
  </>;
}
