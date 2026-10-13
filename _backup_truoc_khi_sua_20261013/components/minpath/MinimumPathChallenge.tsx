'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { buildGraph } from '@/lib/minpath/graph';
import { dailyChallenge, pickChallenge, type MinPathChallenge } from '@/lib/minpath/daily';
import {
  isComplete, legalNeighbors, MODIFIER_BLURB, MODIFIER_LABEL, type ModifierKind, type PathModifier,
} from '@/lib/minpath/modifiers';
import { clicksOf, startSession, type MinPathSession } from '@/lib/minpath/session';
import { pickVariantChallenge, type VariantChallenge } from '@/lib/minpath/variantChallenge';
import { createRng } from '@/lib/seed';
import { SCENES, paletteVars } from '@/lib/cinematic/scenes';
import { Stage } from '../cinematic/CinematicStage';
import { Signature } from '../cinematic/CinematicSignature';
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

   PRESENTATION: a deck, one idea per slide, as few words as the game allows.
   The opening title + Space is the CinematicGate's job (Sandbox.tsx); from
   there Space steps through the slides:

       route  →  (rule, variant only)  →  play  →  (result, on arrival)

   Each slide speaks one caption line as it arrives. The game logic above is
   untouched: only what is drawn, and how the player moves between the parts.
   ========================================================================== */

type Mode = 'daily' | 'practice' | 'variant';
type Slide = 'route' | 'rule' | 'play' | 'done';

const MODIFIER_KINDS: ModifierKind[] = ['no-backtracking', 'chronological-only', 'exactly-n-clicks', 'visit-an-era'];
const MODE_NAME: Record<Mode, string> = { daily: 'Today', practice: 'Practice', variant: 'Twist' };
const MODE_LINE: Record<Mode, string> = {
  daily: 'Today, everyone walks the same road.',
  practice: 'No one is watching. Wander as you like.',
  variant: 'The rules have changed.',
};

/* ── icons: one drawn language, stroked in the scene's darkest colour ───── */
function Icon({ kind, className }: { kind: string; className?: string }): ReactNode {
  let body: ReactNode = null;
  switch (kind) {
    case 'start': body = <><circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="7" className="f" /></>; break;
    case 'target': body = <><circle cx="24" cy="24" r="17" /><circle cx="24" cy="24" r="9" /><circle cx="24" cy="24" r="2.5" className="f" /></>; break;
    case 'daily': body = <><circle cx="24" cy="24" r="8" /><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M37.4 10.6l-4.2 4.2M14.8 33.2l-4.2 4.2" /></>; break;
    case 'practice': body = <><rect x="7" y="7" width="34" height="34" rx="8" /><circle cx="17" cy="17" r="2.6" className="f" /><circle cx="24" cy="24" r="2.6" className="f" /><circle cx="31" cy="31" r="2.6" className="f" /></>; break;
    case 'variant': body = <path d="M27 4 12 27h11l-3 17 16-24H25z" />; break;
    case 'no-backtracking': body = <><path d="M8 24h30M28 13l11 11-11 11" /><path d="M12 10l24 28" /></>; break;
    case 'chronological-only': body = <><circle cx="24" cy="24" r="17" /><path d="M24 13v11l8 5" /></>; break;
    case 'exactly-n-clicks': body = <path d="M10 17h28M10 31h28M30 8l-4 32" />; break;
    case 'visit-an-era': body = <><path d="M24 43S9 29 9 19a15 15 0 0 1 30 0c0 10-15 24-15 24z" /><circle cx="24" cy="19" r="5" /></>; break;
    case 'dice': body = <><rect x="7" y="7" width="34" height="34" rx="8" /><circle cx="17" cy="17" r="2.6" className="f" /><circle cx="31" cy="17" r="2.6" className="f" /><circle cx="17" cy="31" r="2.6" className="f" /><circle cx="31" cy="31" r="2.6" className="f" /></>; break;
    case 'crown': body = <path className="f" d="M5 38 3 14l10 10 11-14 11 14 10-10-2 24z" />; break;
    default: break;
  }
  return <svg className={className} viewBox="0 0 48 48" aria-hidden="true">{body}</svg>;
}

export function MinimumPathChallenge({ engine, active }: { engine: Engine; active: boolean }) {
  const graph = useMemo(() => buildGraph(engine.db), [engine.db]);
  const [mode, setMode] = useState<Mode>('daily');
  const [practiceSeed, setPracticeSeed] = useState(() => Date.now());
  const [variantKind, setVariantKind] = useState<ModifierKind>('no-backtracking');
  const [variantSeed, setVariantSeed] = useState(() => Date.now());
  const [slide, setSlide] = useState<Slide>('route');
  const rootRef = useRef<HTMLElement>(null);

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

  // Opening the view again starts the deck from its first slide.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setSlide('route');
  }

  const slides: Slide[] = mode === 'variant' ? ['route', 'rule', 'play'] : ['route', 'play'];
  const cur: Slide = session?.done ? 'done' : slides.includes(slide) ? slide : 'route';

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

  // Space / → forward, ← / Backspace back. Only while this view is on screen and
  // nothing modal (the opening gate included) is up.
  const stepRef = useRef({ cur, slides, mode });
  useEffect(() => { stepRef.current = { cur, slides, mode }; });
  useEffect(() => {
    if (!active) return;
    const isSpace = (e: KeyboardEvent) => e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar';
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('[aria-modal="true"]:not([hidden])')) return;
      const fwd = isSpace(e) || e.key === 'ArrowRight';
      const back = e.key === 'ArrowLeft' || e.key === 'Backspace';
      if (!fwd && !back) return;
      e.preventDefault();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const { cur: c, slides: list } = stepRef.current;
      const i = list.indexOf(c as Slide);
      if (fwd) {
        if (c === 'done') { setMode('practice'); setPracticeSeed(Date.now()); setSlide('route'); }
        else if (c !== 'play' && i >= 0 && i < list.length - 1) setSlide(list[i + 1]);
      } else if (c !== 'done' && i > 0) {
        setSlide(list[i - 1]);
      }
    };
    // Space on a focused button fires its click on keyup — swallow that too.
    const onUp = (e: KeyboardEvent) => {
      if (!isSpace(e)) return;
      if (document.querySelector('[aria-modal="true"]:not([hidden])')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onUp); };
  }, [active]);

  if (!active) return null;

  const scene = SCENES.minpath;
  const at = Math.max(0, slides.indexOf(cur));
  const vars = { ...paletteVars(scene), '--si': at, '--sf': slides.length > 1 ? at / (slides.length - 1) : cur === 'done' ? 1 : 0 } as CSSProperties;

  const onMove = (e: PointerEvent<HTMLElement>) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };

  const doneClicks = session ? clicksOf(session) : 0;
  const caption =
    cur === 'route' ? MODE_LINE[mode]
    : cur === 'rule' ? MODIFIER_BLURB[variantKind]
    : cur === 'play' ? 'Only real connections. Every step counts.'
    : challenge && doneClicks <= challenge.optimalLength
      ? 'No shorter road exists. You found the one.'
      : 'There was a shorter road. Can you find it?';
  const showKey = cur !== 'play';

  return (
    <section
      ref={rootRef}
      className={'view' + (active ? ' on' : '')}
      id="v-minpath"
      role="tabpanel"
      aria-label="Minimum Path"
      onPointerMove={onMove}
    >
      <div className="dk" style={vars}>
        <Stage shape={scene.shape} />
        <Signature id="minpath" />

        {cur === 'play' && session && challenge && (
          <div className="dk-hud">
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="dk-mini" title="Target">
                <Icon kind="target" />
                <span>{targetNode?.n}</span>
              </div>
              {modifier && (
                <div className="dk-mini" style={{ '--pc': 'var(--k6)' } as CSSProperties} title={MODIFIER_BLURB[modifier.kind]}>
                  <Icon kind={modifier.kind} />
                  <span>
                    {MODIFIER_LABEL[modifier.kind]}
                    {modifier.kind === 'visit-an-era' && <> · {engine.world.eraName(modifier.era)}{eraVisited ? ' ✓' : ''}</>}
                  </span>
                </div>
              )}
            </div>
            <div className="dk-count" aria-label="Clicks" key={clicksOf(session)}>
              {modifier?.kind === 'exactly-n-clicks'
                ? <>{clicksOf(session)}<small> / {modifier.n}</small></>
                : clicksOf(session)}
            </div>
          </div>
        )}

        <div className="dk-stage">
          {!challenge || !session ? (
            <p className="dk-empty">No pair today.</p>
          ) : (
            <div className="dk-slide" key={cur + ':' + mode}>
              {cur === 'route' && (
                <>
                  <div className="dk-route">
                    <div className="dk-plate from"><Icon kind="start" className="dk-ico" />{startNode?.n}</div>
                    <div className="dk-road" aria-hidden="true" />
                    <div className="dk-plate to"><Icon kind="target" className="dk-ico" />{targetNode?.n}</div>
                  </div>
                  <div className="dk-picks" role="group" aria-label="Mode">
                    <button className="dk-pick" aria-pressed={mode === 'daily'} aria-label="Today’s pair" title="Today’s pair"
                      onClick={() => setMode('daily')}><Icon kind="daily" /></button>
                    <button className="dk-pick" aria-pressed={mode === 'practice'} aria-label="New practice pair" title="New practice pair"
                      onClick={newPractice}><Icon kind="practice" /></button>
                    <button className="dk-pick" aria-pressed={mode === 'variant'} aria-label="Challenge modifier" title="Challenge modifier"
                      onClick={newVariant}><Icon kind="variant" /></button>
                  </div>
                  <div className="dk-pick-name">{MODE_NAME[mode]}</div>
                </>
              )}

              {cur === 'rule' && (
                <>
                  <div className="dk-picks" role="group" aria-label="Rule">
                    {MODIFIER_KINDS.map(k => (
                      <button key={k} className="dk-pick" aria-pressed={variantKind === k} aria-label={MODIFIER_LABEL[k]} title={MODIFIER_LABEL[k]}
                        onClick={() => { setVariantKind(k); setVariantSeed(Date.now()); }}>
                        <Icon kind={k} />
                      </button>
                    ))}
                    <button className="dk-pick" aria-label="New pair" title="New pair" onClick={() => setVariantSeed(Date.now())}>
                      <Icon kind="dice" />
                    </button>
                  </div>
                  <div className="dk-pick-name">
                    {MODIFIER_LABEL[variantKind]}
                    {modifier?.kind === 'exactly-n-clicks' && <> · {modifier.n}</>}
                    {modifier?.kind === 'visit-an-era' && <> · {engine.world.eraName(modifier.era)}</>}
                  </div>
                </>
              )}

              {cur === 'play' && (
                <div className="dk-play">
                  <div className="dk-trail" aria-hidden="true">
                    {session.path.map((id, i) => <i key={id + i} />)}
                  </div>
                  <div className="dk-plate dk-now">{curNode?.n}</div>
                  <p className="dk-desc"><span className="mono">{curNode?.era}</span> {curNode?.l1}</p>
                  <div className="dk-links">
                    {neighbors.map(id => {
                      const n = engine.get(id);
                      if (!n) return null;
                      return <button key={id} className="dk-link" onClick={() => clickNeighbor(id)}>{n.n}</button>;
                    })}
                  </div>
                </div>
              )}

              {cur === 'done' && (
                <>
                  <div className="dk-big" aria-label={`${doneClicks} clicks`}>{doneClicks}</div>
                  <div className="dk-best" title="Shortest possible"><Icon kind="crown" />{challenge.optimalLength}</div>
                  <div className="dk-chain" aria-hidden="true">
                    {session.path.map((id, i) => (
                      <span key={id + i} style={{ display: 'contents' }}>
                        {i > 0 && <b />}
                        <i title={engine.get(id)?.n ?? id} />
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="dk-wipe" key={'w' + cur + mode} aria-hidden="true" />
        <p className="dk-line" key={'l' + cur + mode} role="status">{caption}</p>
        {showKey && <div className="dk-key" aria-hidden="true"><i /></div>}
      </div>
    </section>
  );
}
