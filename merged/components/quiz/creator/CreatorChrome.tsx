'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { CREATOR_STEPS, creatorHref, stepIndex, type CreatorStep } from '@/lib/quiz/creator-steps';
import { useCreator } from './CreatorProvider';

/** Banner, clickable stepper, status bar and Back / Save & exit / Continue for one routed step. */
export default function CreatorChrome({ step, children, canContinue = true, continueHint, hideContinue = false }: {
  step: CreatorStep; children: ReactNode; canContinue?: boolean; continueHint?: string; hideContinue?: boolean;
}) {
  const c = useCreator();
  const router = useRouter();
  const idx = stepIndex(step);
  const info = CREATOR_STEPS[idx]!;
  const prev = CREATOR_STEPS[idx - 1];
  const next = CREATOR_STEPS[idx + 1];
  const [leaving, setLeaving] = useState(false);

  const { rememberStep } = c;
  useEffect(() => { if (c.ready && c.draftKey) rememberStep(step); }, [c.ready, c.draftKey, step, rememberStep]);

  const go = (s: CreatorStep) => router.push(creatorHref(s, c.draftKey));
  async function saveAndExit() {
    setLeaving(true);
    const ok = await c.persist('draft');
    setLeaving(false);
    if (ok || !c.title.trim()) router.push('/quiz/my');
  }
  const stateClass = c.save.kind === 'error' ? 'bad' : c.save.kind === 'cloud' ? 'ok' : '';

  return (
    <main className="page cr" id="main">
      <header className="cr-banner">
        <div className="cr-banner-art" aria-hidden="true"><Image src={info.art} alt="" width={1000} height={620} unoptimized priority /></div>
        <div className="cr-banner-text">
          <p className="eyebrow">Step {idx + 1} of {CREATOR_STEPS.length}{info.optional ? ' · optional' : ''}</p>
          <h1>{info.title}</h1>
          <p className="muted-text">{info.help}</p>
        </div>
      </header>

      <nav className="cr-stepper" aria-label="Quiz creation steps">
        <ol>
          {CREATOR_STEPS.map((s, i) => {
            const reachable = i === 0 || !!c.draftKey;
            const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
            const inner = (<><span className="n" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span><span className="t">{s.short}</span></>);
            return (
              <li key={s.slug} data-state={state}>
                {reachable
                  ? <Link href={creatorHref(s.slug, c.draftKey)} aria-current={i === idx ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s.title}${state === 'done' ? ' (done)' : ''}`}>{inner}</Link>
                  : <span aria-disabled="true" title="Choose a game mode first">{inner}</span>}
              </li>
            );
          })}
        </ol>
      </nav>

      {c.recovered && (
        <div className="info stack" role="status" style={{ marginBottom: 16 }}>
          <span>Unsaved changes from {new Date(c.recovered.updatedAt).toLocaleString()} were found on this device.</span>
          <div className="row"><button className="btn small" onClick={c.restore}>Restore them</button><button className="btn small ghost" onClick={c.discard}>Discard them</button></div>
        </div>
      )}
      {c.cloudNote && <p className="info" role="status" style={{ marginBottom: 16 }}>{c.cloudNote} <Link href={`/quiz/login?next=${encodeURIComponent(`/quiz/create/${step}${c.draftKey ? `?draft=${c.draftKey}` : ''}`)}`}>Sign in or create an account</Link> to keep it online.</p>}

      <div className="cr-body">{children}</div>
      {c.error && <p className="error" role="alert" style={{ marginTop: 14 }}>{c.error}</p>}

      <div className="cr-foot" role="region" aria-label="Save and navigation">
        <span className={`state ${stateClass}`} role="status" aria-live="polite">{c.save.msg || (c.draftKey ? 'All changes saved' : 'Nothing to save yet')}</span>
        <div className="cr-foot-actions">
          {prev ? <button className="btn small ghost" onClick={() => go(prev.slug)}>Back</button> : <Link className="btn small ghost" href="/quiz/modes">Game modes</Link>}
          <button className="btn small ghost" onClick={saveAndExit} disabled={leaving || !c.draftKey}>{leaving ? 'Saving…' : 'Save & exit'}</button>
          {!hideContinue && next && (
            <button className="btn small" disabled={!canContinue} title={!canContinue ? continueHint : undefined} onClick={() => go(next.slug)}>Continue</button>
          )}
        </div>
        {!canContinue && continueHint && <p className="note cr-hint" role="note">{continueHint}</p>}
      </div>
    </main>
  );
}
