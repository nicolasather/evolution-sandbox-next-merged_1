'use client';

import { useMemo, useState } from 'react';
import { buildGraph } from '@/lib/minpath/graph';
import { dailyChallenge, pickChallenge, type MinPathChallenge } from '@/lib/minpath/daily';
import {
  isComplete, legalNeighbors, MODIFIER_BLURB, MODIFIER_LABEL, type ModifierKind, type PathModifier,
} from '@/lib/minpath/modifiers';
import { clicksOf, startSession, type MinPathSession } from '@/lib/minpath/session';
import { pickVariantChallenge, type VariantChallenge } from '@/lib/minpath/variantChallenge';
import { createRng } from '@/lib/seed';
import type { Engine } from '@/lib/engine';

/* ============================================================================
   MINIMUM PATH — click from a start discovery to a target one through real
   prerequisite connections only, in as few clicks as possible. One
   well-defined edge type (a discovery ↔ each of its own recipe ingredients)
   so every player's count is comparable. The optimal length is never shown
   until the target is reached — see lib/minpath/daily.ts's doc comments for
   how the daily pair is chosen (deterministic, and never a hub shortcut).

   The 'variant' mode layers one of lib/minpath/modifiers.ts's four rule
   changes (no-backtracking, chronological-only, exactly-n-clicks,
   visit-an-era) on top of the exact same click-through-real-edges mechanic —
   legalNeighbors/isComplete only ever narrow which real edge is legal next
   or add a further win condition, so daily/practice (modifier undefined)
   and variant share one stepping path below rather than two parallel ones.
   ========================================================================== */

type Mode = 'daily' | 'practice' | 'variant';

const MODIFIER_KINDS: ModifierKind[] = ['no-backtracking', 'chronological-only', 'exactly-n-clicks', 'visit-an-era'];

export function MinimumPathChallenge({ engine, active }: { engine: Engine; active: boolean }) {
  const graph = useMemo(() => buildGraph(engine.db), [engine.db]);
  const [mode, setMode] = useState<Mode>('daily');
  const [practiceSeed, setPracticeSeed] = useState(() => Date.now());
  const [variantKind, setVariantKind] = useState<ModifierKind>('no-backtracking');
  const [variantSeed, setVariantSeed] = useState(() => Date.now());

  // Both dailyChallenge and pickChallenge are pure and deterministic given
  // their inputs — a plain memo, no effect needed to "compute" a challenge.
  const variant = useMemo<VariantChallenge | null>(
    () => (mode === 'variant' ? pickVariantChallenge(engine.db, createRng(variantSeed), variantKind) : null),
    [engine.db, mode, variantSeed, variantKind],
  );
  const challenge = useMemo<MinPathChallenge | null>(() => {
    if (mode === 'daily') return dailyChallenge(engine.db);
    if (mode === 'practice') return pickChallenge(engine.db, createRng(practiceSeed));
    return variant ? { startId: variant.startId, targetId: variant.targetId, optimalLength: variant.optimalLength } : null;
  }, [engine.db, mode, practiceSeed, variant]);
  const modifier: PathModifier | undefined = mode === 'variant' ? variant?.modifier : undefined;

  const [session, setSession] = useState<MinPathSession | null>(
    () => (challenge ? startSession(challenge.startId, challenge.targetId) : null),
  );
  // When `challenge` changes identity (a new mode or a fresh practice/variant
  // pull), reset the session — adjusted during render, per React's guidance
  // for resetting state when a computed value changes, rather than in an effect.
  const [sessionChallenge, setSessionChallenge] = useState(challenge);
  if (challenge !== sessionChallenge) {
    setSessionChallenge(challenge);
    setSession(challenge ? startSession(challenge.startId, challenge.targetId) : null);
  }

  if (!active) return null;

  const startNode = challenge ? engine.get(challenge.startId) : undefined;
  const targetNode = challenge ? engine.get(challenge.targetId) : undefined;
  const curNode = session ? engine.get(session.path[session.path.length - 1]) : undefined;
  const neighbors = session && !session.done ? legalNeighbors(engine.db, graph, session, modifier) : [];

  const clickNeighbor = (id: string) => {
    if (!session || !neighbors.includes(id)) return;
    const path = [...session.path, id];
    const next: MinPathSession = { ...session, path, done: isComplete(engine.db, { ...session, path }, modifier) };
    setSession(next);
  };

  const newPractice = () => { setMode('practice'); setPracticeSeed(Date.now()); };
  const newVariant = () => { setMode('variant'); setVariantSeed(Date.now()); };
  const eraVisited = modifier?.kind === 'visit-an-era' && !!session?.path.some(id => engine.get(id)?.era === modifier.era);

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-minpath" role="tabpanel" aria-label="Minimum Path">
      <div className="mp-wrap">
        <header className="mp-head">
          <p className="mono mp-eyebrow">Evolution Sandbox — Challenge</p>
          <h1 className="mp-title">Minimum Path</h1>
          <p className="mp-sub">Click from the start to the target through real connections only. Fewest clicks wins.</p>
          <div className="mp-modes">
            <button className="chip" aria-pressed={mode === 'daily'} onClick={() => setMode('daily')}>Today&rsquo;s pair</button>
            <button className="chip" aria-pressed={mode === 'practice'} onClick={newPractice}>New practice pair</button>
            <button className="chip" aria-pressed={mode === 'variant'} onClick={newVariant}>Challenge modifier</button>
          </div>
          {mode === 'variant' && (
            <div className="mp-variant-bar">
              <div className="mp-modes">
                {MODIFIER_KINDS.map(k => (
                  <button
                    key={k}
                    className="chip"
                    aria-pressed={variantKind === k}
                    onClick={() => { setVariantKind(k); setVariantSeed(Date.now()); }}
                  >
                    {MODIFIER_LABEL[k]}
                  </button>
                ))}
                <button className="chip" onClick={() => setVariantSeed(Date.now())}>New pair</button>
              </div>
              <p className="mp-variant-blurb">{MODIFIER_BLURB[variantKind]}</p>
            </div>
          )}
        </header>

        {!challenge || !session ? (
          <p className="mp-empty">No pair available right now.</p>
        ) : (
          <>
            <div className="mp-endpoints">
              <div className="mp-endpoint"><span className="mono">Start</span><b>{startNode?.n}</b></div>
              <div className="mp-endpoint"><span className="mono">Target</span><b>{targetNode?.n}</b></div>
              <div className="mp-clicks">
                <span className="mono">Clicks</span>
                <b>{modifier?.kind === 'exactly-n-clicks' ? `${clicksOf(session)} / ${modifier.n}` : clicksOf(session)}</b>
              </div>
            </div>

            {modifier && (
              <p className="mp-modifier-tag mono">
                {MODIFIER_LABEL[modifier.kind]}
                {modifier.kind === 'visit-an-era' && (
                  <> — visit {engine.world.eraName(modifier.era)}{eraVisited ? ' (visited)' : ''}</>
                )}
              </p>
            )}

            {!session.done ? (
              <>
                <article className="mp-page">
                  <p className="mono mp-page-kicker">{curNode?.era}</p>
                  <h2 className="mp-page-title">{curNode?.n}</h2>
                  <p className="mp-page-desc">{curNode?.l1}</p>
                </article>
                <div className="mp-links">
                  {neighbors.map(id => {
                    const n = engine.get(id);
                    if (!n) return null;
                    return (
                      <button key={id} className="mp-link" onClick={() => clickNeighbor(id)}>{n.n}</button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="mp-done">
                <p className="mp-done-headline">Reached {targetNode?.n} in {clicksOf(session)} clicks.</p>
                <p className="mp-done-optimal">Shortest possible: {challenge.optimalLength} clicks.</p>
                <p className="mono mp-path">{session.path.map(id => engine.get(id)?.n ?? id).join(' → ')}</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
