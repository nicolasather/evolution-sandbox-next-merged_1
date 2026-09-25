'use client';

import { useEffect, useRef, useState } from 'react';
import { Glyph } from './Glyph';
import { Plate3D } from './Plate3D';
import { cn } from '@/lib/utils';
import { routePaths } from '@/lib/routes';
import { revealedPhysics } from '@/lib/processing/reveal';
import type { Engine } from '@/lib/engine';
import type { Discovery, Source } from '@/lib/types';

const MATERIAL_WORD: Record<string, string> = {
  mineral: 'stone-like', wood: 'woody', bone: 'bony', fibre: 'stringy', earth: 'earthy', liquid: 'runny',
  flame: 'fiery', metal: 'metallic', glass: 'glassy', made: 'made', living: 'living', abstract: 'abstract',
};

/** A short, shareable line — never a claim, never a spoiler for anyone reading it. */
function shareText(node: Discovery, core: number, coreTotal: number): string {
  return `I discovered ${node.n} in Evolution Sandbox — ${core} of ${coreTotal} so far.`;
}

/** Share, if the browser offers it (mostly phones); otherwise copy to the clipboard.
 *  Never load-bearing: a failure or a declined share is quietly swallowed. */
function ShareButton({ node, engine }: { node: Discovery; engine: Engine }) {
  const [state, setState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const onShare = async () => {
    const text = shareText(node, engine.stats().core, engine.stats().coreTotal);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text, title: 'Evolution Sandbox' });
        setState('shared');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setState('copied');
      }
    } catch { /* the person cancelled, or the browser refused — never load-bearing */ return; }
    window.setTimeout(() => setState('idle'), 2200);
  };
  return (
    <button type="button" className="chip" onClick={onShare}>
      {state === 'idle' ? 'Share this find' : state === 'copied' ? 'Copied' : 'Shared'}
    </button>
  );
}

const RARITY_LABEL: Record<string, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', hidden: 'Hidden find',
};

function Pill({ node, engine, onOpen }: { node?: Discovery; engine: Engine; onOpen: (id: string) => void }) {
  if (!node) return null;
  const known = engine.has(node.id);
  return (
    <button className={cn('pill', !known && 'locked')} onClick={() => onOpen(node.id)}>
      <Glyph node={node} locked={!known} />
      <span>{known ? node.n : 'Undiscovered'}</span>
    </button>
  );
}

function SourceLink({ s }: { s: Source }) {
  const general = s.scope === 'general';
  return (
    <a className={cn('src', general && 'gen')} href={s.url} target="_blank" rel="noopener noreferrer">
      <span className="src-o mono">
        <span className={`tier ${s.t}`}>{s.t}</span>{s.org}
        {general && <span className="src-scope">· general reference</span>}
      </span>
      <span className="src-t">{s.title} ↗</span>
    </a>
  );
}

function Closed({
  engine, node, onHint,
}: { engine: Engine; node: Discovery; onHint: (id: string) => string | null }) {
  const [msg, setMsg] = useState<string | null>(null);
  const eraName = engine.db.eras.find(e => e.id === node.era)?.name ?? node.era;
  const d = engine.distance(node.id);
  const tier = node.stone_age_tier ? engine.gate(node.stone_age_tier) : null;
  const status = tier && !tier.open
    ? `Opens with the ${tier.name} stage.`
    : d === 0 ? 'Within reach — you already hold what it takes.'
    : d === 1 ? 'Close — one piece is still missing.'
    : `Further off — ${d} pieces are still missing.`;
  return (
    <div className="exh-body">
      <section className="sec">
        <h3>Not yet discovered</h3>
        <p className="lead">Somewhere in {eraName}. What it is — and how to make it — stays closed until you find it.</p>
        <p className="mono" style={{ color: 'var(--bone-3)' }}>{status}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="chip" onClick={() => setMsg(onHint(node.id))}>Aim my hints here</button>
        </div>
        {msg && <p className="mono" style={{ color: 'var(--ochre)', marginTop: 10 }}>{msg}</p>}
      </section>
      <section className="sec">
        <h3>Position</h3>
        <div className="evline">
          <span className="mono" style={{ color: 'var(--bone-4)', flex: 'none' }}>ROUTES</span>
          <span>{node.rec.length === 1 ? 'One way in' : `${node.rec.length} different ways in`}</span>
        </div>
        <div className="evline">
          <span className="mono" style={{ color: 'var(--bone-4)', flex: 'none' }}>DEPTH</span>
          <span>{node.depth} {node.depth === 1 ? 'step' : 'steps'} from a bare stone</span>
        </div>
      </section>
    </div>
  );
}

export function ExhibitPanel({
  engine, node, open, onOpen, onClose, onHint,
}: {
  engine: Engine;
  node: Discovery | null;
  /** The drawer (a bottom sheet on a phone) is showing. It starts closed and
   *  takes no room until the player asks for it. */
  open: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  /** Point the hint system at an undiscovered entry; returns an error line or null. */
  onHint: (id: string) => string | null;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // when the drawer opens, or shows a different entry, start at the top with
  // focus on its close button — keyboard users land inside what just opened
  const nodeId = node?.id;
  useEffect(() => {
    if (!open) return;
    if (panelRef.current) panelRef.current.scrollTop = 0;
    closeRef.current?.focus({ preventScroll: true });
  }, [open, nodeId]);

  if (!node) {
    return (
      <aside id="panel" ref={panelRef} className={cn(open && 'open')} aria-label="Exhibit" aria-hidden={!open} inert={!open}>
        <div className="pan-empty">
          <div style={{ width: 52, height: 52, margin: '0 auto 16px', opacity: 0.4 }}>
            <Glyph node={{ id: 'stone', vis: 'cobble', cat: 'material' }} />
          </div>
          <p className="mono">Select a discovery<br />to open its exhibit</p>
        </div>
      </aside>
    );
  }

  const known = engine.has(node.id);
  const eraName = engine.db.eras.find(e => e.id === node.era)?.name ?? node.era;
  const recipes = engine.availableRecipes(node.id);
  const foundRoutes = recipes.filter(r => r.found);
  const openRoutes = recipes.length - foundRoutes.length;
  const paths = routePaths(engine, node);
  const uses = engine.usesOf(node.id);
  const usesFound = uses.filter(u => engine.has(u)).slice(0, 16);
  const usesOpen = uses.filter(u => !engine.has(u)).length;

  // subject-level sources first, general references after — and say so when
  // there is nothing but general references
  const refs = node.src
    .filter(sid => sid !== 'source_required')
    .map(sid => engine.db.sources[sid])
    .filter((s): s is Source => !!s);
  const topic = refs.filter(s => s.scope !== 'general');
  const general = refs.filter(s => s.scope === 'general');
  const sourceRequired = node.src.includes('source_required');
  // a source id the database cannot resolve is said so, never silently dropped
  const unavailable = node.src.filter(sid => sid !== 'source_required' && !engine.db.sources[sid]).length;

  return (
    <aside id="panel" ref={panelRef} className={cn(open && 'open')} aria-label="Exhibit" aria-hidden={!open} inert={!open}
      role="dialog" aria-modal="false">
      <div className="panel-grab" aria-hidden="true" onClick={onClose} />
      <button ref={closeRef} className="panel-close" aria-label="Close exhibit" onClick={onClose}>
        <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M1 1l10 10M11 1L1 11" />
        </svg>
      </button>

      <div className="exh-head">
        <div className="exh-plate mono">
          <span>NO. {String(node.no).padStart(3, '0')}</span>
          <span>{eraName}</span>
        </div>
        <div className="exh-art">
          <Plate3D node={node} locked={!known} label={known ? node.n : 'Undiscovered entry'} />
        </div>
        <h2 className="exh-name">{known ? node.n : 'Undiscovered'}</h2>
        <div className="exh-meta mono">
          {known ? (
            <>
              <span>{node.date}</span><span className="sep">·</span>
              <span>{node.cat}</span><span className="sep">·</span>
              <span className="rarity-tag"><i className={`dot r-${node.rar}`} />{RARITY_LABEL[node.rar]}</span>
            </>
          ) : (
            <span style={{ color: 'var(--ochre)' }}>Not found yet</span>
          )}
        </div>
      </div>

      {!known ? <Closed key={node.id} engine={engine} node={node} onHint={onHint} /> : (

      <div className="exh-body" key={node.id}>
        <section className="sec">
          <h3>Discovery</h3>
          <p className="lead">{node.l1}</p>
          <ShareButton node={node} engine={engine} />
        </section>

        <section className="sec">
          <h3>What it&rsquo;s like</h3>
          {(() => {
            const { ph, reveals, unknownCount } = revealedPhysics(engine, node);
            return (
              <>
                <p className="mono" style={{ color: 'var(--bone-4)' }}>{MATERIAL_WORD[ph.materialClass]}</p>
                <div className="reqrow" style={{ flexWrap: 'wrap' }}>
                  {reveals.map(r => (
                    <span key={r.id} className="chip" style={!r.known ? { opacity: 0.45 } : undefined}>
                      {r.known ? r.word : '???'}
                    </span>
                  ))}
                  {reveals.length === 0 && <span className="chip" style={{ opacity: 0.45 }}>???</span>}
                </div>
                <p className="alt-note mono" style={{ marginTop: 8 }}>
                  {usesFound.length} known {usesFound.length === 1 ? 'reaction' : 'reactions'}
                  {usesOpen > 0 && ` · ${usesOpen} more not yet found`}
                  {unknownCount > 0 && ` · ${unknownCount} ${unknownCount === 1 ? 'property' : 'properties'} still unknown`}
                </p>
              </>
            );
          })()}
        </section>

        <section className="sec">
          <h3>Why it matters</h3>
          <p>{node.l2}</p>
          {node.caution && (
            <div className="caution">
              <span className="tag mono">Careful here</span>
              <p>{node.caution}</p>
            </div>
          )}
        </section>

        <section className="sec">
          <h3>How we know</h3>
          <p>{node.l3}</p>
          <div className="evline">
            <span className="mono" style={{ color: 'var(--bone-4)', flex: 'none' }}>EVIDENCE</span>
            <span>{node.ev}</span>
          </div>
        </section>

        <section className="sec">
          <h3>Sources</h3>
          {sourceRequired && (
            <div className="src src-req">
              <span className="src-o mono">Source required</span>
              <span className="src-t">
                No subject-level source has been verified for this entry yet.
                {general.length > 0 && ' The references below are general background, not evidence for these specific claims.'}
              </span>
            </div>
          )}
          {topic.map(s => <SourceLink key={s.url} s={s} />)}
          {general.map(s => <SourceLink key={s.url} s={s} />)}
          {unavailable > 0 && (
            <div className="src src-req">
              <span className="src-o mono">Source unavailable</span>
              <span className="src-t">
                {unavailable === 1 ? 'One cited source' : `${unavailable} cited sources`} could not be loaded from the archive.
              </span>
            </div>
          )}
          {refs.length === 0 && !sourceRequired && unavailable === 0 && <p>—</p>}
        </section>

        <section className="sec sec-routes">
          <h3>Routes here{recipes.length > 1 ? ` · ${foundRoutes.length} of ${recipes.length} walked` : ''}</h3>
          {recipes.length === 0 ? (
            <p>Nothing. This is where you start.</p>
          ) : (
            paths.map(p => (
              <div className={cn('path', !p.found && 'closed')} key={`${p.items.map(i => i.id).join('+')}${p.action ? `:${p.action}` : ''}`}>
                <div className="path-h mono">
                  <span>PATH {String(p.index).padStart(2, '0')}</span>
                  <span>{p.found ? 'walked' : 'not yet walked'}</span>
                </div>
                <div className="reqrow">
                  {p.items.map((it, k) => (
                    <span key={`${it.id}:${k}`} style={{ display: 'contents' }}>
                      {k > 0 && <span className="plus">+</span>}
                      <Pill node={it} engine={engine} onOpen={onOpen} />
                    </span>
                  ))}
                  {p.action && <span className="plus mono">→ {p.action}</span>}
                </div>
                {p.found && p.chain.length > 0 && (
                  <details className="path-chain">
                    <summary className="mono">Trace it back · {p.chain.length} {p.chain.length === 1 ? 'step' : 'steps'}</summary>
                    <ol>
                      {p.chain.map((c, i) => (
                        <li key={c.id} style={{ ['--i' as string]: i }}>
                          <button onClick={() => onOpen(c.id)}>
                            <Glyph node={c} locked={!engine.has(c.id)} />
                            <span>{engine.has(c.id) ? c.n : 'Undiscovered'}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            ))
          )}
          {recipes.length > 0 && foundRoutes.length === 0 && (
            <p className="alt-note mono">Found before routes were recorded — make it again to log a route.</p>
          )}
          {openRoutes > 0 && (
            <p className="alt-note mono">
              {openRoutes === 1 ? 'One more way to get here.' : `${openRoutes} more ways to get here.`} Find them.
            </p>
          )}
          <p className="alt-note" style={{ textTransform: 'none', letterSpacing: 0 }}>
            Recipes are a game&rsquo;s shorthand for how ideas connect — not a claim about how,
            where or in what order anything was first made.
          </p>
        </section>

        {uses.length > 0 && (
          <section className="sec">
            <h3>What it led to</h3>
            <div className="reqrow">
              {usesFound.map(uid => <Pill key={uid} node={engine.get(uid)} engine={engine} onOpen={onOpen} />)}
            </div>
            {usesOpen > 0 && (
              <p className="alt-note mono">
                {usesFound.length ? '+ ' : ''}{usesOpen} {usesOpen === 1 ? 'thing' : 'things'} you have not found yet
              </p>
            )}
          </section>
        )}

        <section className="sec">
          <h3>Position</h3>
          <div className="evline">
            <span className="mono" style={{ color: 'var(--bone-4)', flex: 'none' }}>DEPTH</span>
            <span>{node.depth} {node.depth === 1 ? 'step' : 'steps'} from a bare stone</span>
          </div>
          <div className="evline">
            <span className="mono" style={{ color: 'var(--bone-4)', flex: 'none' }}>CHAIN</span>
            <span>at least {node.need} distinct discoveries stand behind it</span>
          </div>
          {engine.foundAt(node.id) && (
            <div className="evline">
              <span className="mono" style={{ color: 'var(--bone-4)', flex: 'none' }}>FOUND</span>
              <span>{new Date(engine.foundAt(node.id)!).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          )}
        </section>
      </div>
      )}
    </aside>
  );
}
