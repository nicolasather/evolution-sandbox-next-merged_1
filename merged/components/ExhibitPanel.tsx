'use client';

import { useEffect, useRef } from 'react';
import { Glyph } from './Glyph';
import { cn } from '@/lib/utils';
import type { Engine } from '@/lib/engine';
import type { Discovery, Source } from '@/lib/types';

const RARITY_LABEL: Record<string, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', hidden: 'Hidden find',
};

function Pill({ node, engine, onOpen }: { node?: Discovery; engine: Engine; onOpen: (id: string) => void }) {
  if (!node) return null;
  const known = engine.has(node.id);
  return (
    <button className={cn('pill', !known && 'locked')} onClick={() => onOpen(node.id)}>
      <Glyph node={node} locked={!known} />
      <span>{node.n}</span>
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

export function ExhibitPanel({
  engine, node, open, onOpen, onClose,
}: {
  engine: Engine;
  node: Discovery | null;
  /** Drawer (graph, archive) or sheet (phone) is showing. Beside the bench the
   *  panel is a plain column and ignores this. */
  open: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
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
      <aside id="panel" ref={panelRef} className={cn(open && 'open')} aria-label="Exhibit">
        <div className="pan-empty">
          <div style={{ width: 52, height: 52, margin: '0 auto 16px', opacity: 0.4 }}>
            <Glyph node={{ id: 'placeholder', vis: 'cobble', cat: 'material' }} />
          </div>
          <p className="mono">Select a discovery<br />to open its exhibit</p>
        </div>
      </aside>
    );
  }

  const known = engine.has(node.id);
  const eraName = engine.db.eras.find(e => e.id === node.era)?.name ?? node.era;
  const recipes = engine.availableRecipes(node.id);
  const uses = (node.uses || []).slice(0, 14);

  // subject-level sources first, general references after — and say so when
  // there is nothing but general references
  const refs = node.src
    .filter(sid => sid !== 'source_required')
    .map(sid => engine.db.sources[sid])
    .filter((s): s is Source => !!s);
  const topic = refs.filter(s => s.scope !== 'general');
  const general = refs.filter(s => s.scope === 'general');
  const sourceRequired = node.src.includes('source_required');

  return (
    <aside id="panel" ref={panelRef} className={cn(open && 'open')} aria-label="Exhibit">
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
          <Glyph node={node} plate locked={!known} sw={1.6} />
        </div>
        <h2 className="exh-name">{node.n}</h2>
        <div className="exh-meta mono">
          <span>{node.date}</span><span className="sep">·</span>
          <span>{node.cat}</span><span className="sep">·</span>
          <span className="rarity-tag"><i className={`dot ${node.rar}`} />{RARITY_LABEL[node.rar]}</span>
          {!known && (<><span className="sep">·</span><span style={{ color: 'var(--ochre)' }}>Undiscovered</span></>)}
        </div>
      </div>

      <div className="exh-body">
        <section className="sec">
          <h3>Discovery</h3>
          <p className="lead">{node.l1}</p>
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
          {refs.length === 0 && !sourceRequired && <p>—</p>}
        </section>

        <section className="sec">
          <h3>What came before{recipes.length > 1 ? ` · ${recipes.length} routes` : ''}</h3>
          {recipes.length === 0 ? (
            <p>Nothing. This is where you start.</p>
          ) : (
            recipes.map(r => (
              <div className="reqrow" key={`${r.a?.id}+${r.b?.id}`}>
                <Pill node={r.a} engine={engine} onOpen={onOpen} />
                <span className="plus">+</span>
                <Pill node={r.b} engine={engine} onOpen={onOpen} />
              </div>
            ))
          )}
          {recipes.length > 1 && <p className="alt-note mono">More than one way to get here.</p>}
        </section>

        {uses.length > 0 && (
          <section className="sec">
            <h3>What it enabled</h3>
            <div className="reqrow">
              {uses.map(uid => <Pill key={uid} node={engine.get(uid)} engine={engine} onOpen={onOpen} />)}
            </div>
          </section>
        )}

        <section className="sec">
          <h3>Position</h3>
          <div className="evline">
            <span className="mono" style={{ color: 'var(--bone-4)', flex: 'none' }}>DEPTH</span>
            <span>{node.depth} steps from a bare stone</span>
          </div>
          <div className="evline">
            <span className="mono" style={{ color: 'var(--bone-4)', flex: 'none' }}>CHAIN</span>
            <span>at least {node.need} distinct discoveries stand behind it</span>
          </div>
        </section>
      </div>
    </aside>
  );
}
