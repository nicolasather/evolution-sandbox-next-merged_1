'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import sourcesJson from '@/data/sources.json';
import type { Engine } from '@/lib/engine';
import type { Catalog } from '@/lib/museum/history/data';
import { aroundTheWorld, independentOrigins, lineage, pointsOf } from '@/lib/museum/history/selectors';
import { museumStore } from '@/lib/museum/history/store';
import { formatYear } from '@/lib/museum/history/timeline';
import type { HistoricalExhibit, Year } from '@/lib/museum/history/types';
import { personalLinksFor } from '@/lib/museum/personal';
import { GlobeCanvas } from './GlobeCanvas';
import { CATEGORY_LABEL, IMPORTANCE_LABEL, ROLE_LABEL, UNCERTAINTY_LABEL, categoryColor, comparisonLine } from './labels';

/* ============================================================================
   EXHIBIT FOCUS — the layered plaque that stands beside a display in focus.

   Visible by default: title, date, places, one line on what changed, and a
   small globe. Everything else — the full account, why it mattered, what
   came before and after, uncertainty, evidence, the world at the same
   moment, and the player's own path — waits behind a deliberate request, so
   the hall stays visually quiet.
   ========================================================================== */

const SOURCES = (sourcesJson as { sources: Record<string, { title: string; org: string; url: string; scope: string }> }).sources;

type Layer = 'account' | 'world' | null;

function ExhibitLink({ e, onGo }: { e: HistoricalExhibit; onGo: (id: string) => void }) {
  return (
    <button type="button" className="xf-link" onClick={() => onGo(e.id)}>
      <span>{e.title}</span>
      <i className="mono">{e.when.display.length > 30 ? formatYear(e.when.anchor ?? e.when.from) : e.when.display}</i>
    </button>
  );
}

export function ExhibitFocus({
  cat, year, exhibit, engine, onClose, onGo, onShowWorld, storyLine,
}: {
  cat: Catalog;
  year: Year;
  exhibit: HistoricalExhibit;
  engine: Engine;
  onClose: () => void;
  onGo: (id: string) => void;
  onShowWorld: (id: string) => void;
  /** When the story tour is on, the plaque shows only the chapter line. */
  storyLine?: string;
}) {
  const [layer, setLayer] = useState<Layer>(null);
  useEffect(() => { museumStore.markVisited(exhibit.id); }, [exhibit.id]);
  useEffect(() => { if (layer === 'account') museumStore.markDetailOpened(exhibit.id); }, [layer, exhibit.id]);

  const pts = useMemo(() => pointsOf(cat, exhibit), [cat, exhibit]);
  const lin = useMemo(() => lineage(cat, exhibit.id, year, 4), [cat, exhibit.id, year]);
  const around = useMemo(() => aroundTheWorld(cat, exhibit, year), [cat, exhibit, year]);
  const mine = useMemo(() => personalLinksFor(engine, exhibit), [engine, exhibit]);
  const indep = independentOrigins(exhibit);
  const primary = pts.find(p => p.role !== 'spread') ?? pts[0];
  const color = categoryColor(exhibit.categories[0]);
  const regionNames = [...new Set(pts.filter(p => p.role !== 'spread').map(p => cat.regionById.get(p.regionId)?.label ?? p.label))];
  const afterCount = lin.after.flat().length;

  return (
    <aside className={`xf imp-${exhibit.importance}` + (layer ? ' is-deep' : '')} aria-label={exhibit.title}
      style={{ ['--cat' as string]: color } as CSSProperties}>
      <button type="button" className="xf-close" onClick={onClose} aria-label="Back to the hall">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>

      <p className="mono xf-kicker">{IMPORTANCE_LABEL[exhibit.importance]}</p>
      <h2 className="xf-title">{exhibit.title}</h2>
      <p className="mono xf-date">{exhibit.when.display}</p>
      <p className="xf-places">
        {regionNames.slice(0, 4).join(' · ')}
        {indep.length >= 2 && <span className="xf-indep"> — invented independently in {indep.length} regions</span>}
      </p>
      {exhibit.culture && <p className="mono xf-culture">{exhibit.culture}</p>}
      {storyLine && <p className="xf-story">{storyLine}</p>}
      <p className="xf-change">{exhibit.change}</p>

      <div className="xf-globe">
        <GlobeCanvas
          label={`Where: ${regionNames.join(', ')}`}
          points={pts.map((p, i) => ({ id: `${i}`, lat: p.lat, lon: p.lon, weight: p.role === 'spread' ? 0 : 2, ring: p.role === 'independent', color: p.role === 'spread' ? undefined : color, highlight: p === primary }))}
          arcs={primary ? pts.filter(p => p.role === 'spread').map(p => ({ from: primary, to: p, alpha: 0.9, kind: 'spread' as const })) : []}
          focus={primary ? { lat: primary.lat, lon: primary.lon, key: exhibit.id } : null}
          interactive={false}
          autoRotate={false}
        />
        {exhibit.uncertainty && exhibit.uncertainty.level !== 'settled' && (
          <span className={`xf-cert mono lv-${exhibit.uncertainty.level}`}>{UNCERTAINTY_LABEL[exhibit.uncertainty.level]}</span>
        )}
      </div>

      <div className="xf-actions">
        <button type="button" aria-pressed={layer === 'account'} onClick={() => setLayer(layer === 'account' ? null : 'account')}>
          {layer === 'account' ? 'Close the account' : 'Read the full account'}
        </button>
        <button type="button" aria-pressed={layer === 'world'} onClick={() => setLayer(layer === 'world' ? null : 'world')}>
          Around the world at this time
        </button>
        <button type="button" onClick={() => onShowWorld(exhibit.id)}>On the world map</button>
      </div>

      {layer === 'world' && (
        <section className="xf-layer">
          <h3 className="mono">Meanwhile, elsewhere</h3>
          {around.length === 0
            ? <p className="xf-note">No other development in this Museum is dated this close to it — yet.</p>
            : around.map(o => (
              <div key={o.id} className="xf-around">
                <span className="mono">{cat.regionById.get(o.regions.find(r => r.role !== 'spread')?.region ?? o.regions[0].region)?.label}</span>
                <ExhibitLink e={o} onGo={onGo} />
              </div>
            ))}
          <p className="xf-note">History is not one line: these happened within about the same span of time, in other parts of the world.</p>
        </section>
      )}

      {layer === 'account' && (
        <section className="xf-layer">
          <h3 className="mono">What happened</h3>
          <p>{exhibit.context}</p>
          <h3 className="mono">Why it mattered</h3>
          <p>{exhibit.significance}</p>

          {exhibit.regions.length > 0 && (
            <>
              <h3 className="mono">Where</h3>
              <ul className="xf-where">
                {exhibit.regions.map((r, i) => (
                  <li key={i}>
                    <span className="mono">{ROLE_LABEL[r.role]}</span>
                    <span>{r.site?.label ?? cat.regionById.get(r.region)?.label}</span>
                    {r.note && <i>{r.note}</i>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {lin.before.length > 0 && (
            <>
              <h3 className="mono">What came before</h3>
              <div className="xf-links">{lin.before[0].map(e => <ExhibitLink key={e.id} e={e} onGo={onGo} />)}</div>
            </>
          )}
          {(lin.after.length > 0 || lin.afterLocked > 0) && (
            <>
              <h3 className="mono">What it made possible</h3>
              <div className="xf-links">{lin.after[0]?.map(e => <ExhibitLink key={e.id} e={e} onGo={onGo} />)}</div>
              {afterCount > (lin.after[0]?.length ?? 0) && (
                <p className="xf-note">{afterCount} later developments in this Museum trace back to it so far.</p>
              )}
              {lin.afterLocked > 0 && (
                <p className="xf-note xf-ahead">+ {lin.afterLocked} {lin.afterLocked === 1 ? 'development' : 'developments'} still ahead in history.</p>
              )}
            </>
          )}

          {exhibit.uncertainty && (
            <>
              <h3 className="mono">How certain is this</h3>
              <p><b>{UNCERTAINTY_LABEL[exhibit.uncertainty.level]}.</b> {exhibit.uncertainty.note}</p>
            </>
          )}

          <h3 className="mono">Evidence</h3>
          {exhibit.sources.status === 'cited' || exhibit.sources.ids?.length ? (
            <ul className="xf-sources">
              {(exhibit.sources.ids ?? []).map(id => SOURCES[id] && (
                <li key={id}>
                  <a href={SOURCES[id].url} target="_blank" rel="noopener noreferrer">{SOURCES[id].title}</a>
                  <span className="mono">{SOURCES[id].org}{SOURCES[id].scope === 'general' ? ' · background only' : ''}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {exhibit.sources.status === 'source_required' && (
            <p className="xf-note">Source required — no verified subject-level source is attached to this entry yet, and none is invented.{exhibit.sources.note ? ` Reviewer pointer: ${exhibit.sources.note}` : ''}</p>
          )}
          {exhibit.sources.status === 'cited' && exhibit.sources.note && <p className="xf-note">{exhibit.sources.note}</p>}

          <p className="mono xf-cats">{exhibit.categories.map(c => CATEGORY_LABEL[c]).join(' · ')}</p>
          <p className="xf-note">The display is a schematic reconstruction of this kind of object or idea — not a specific surviving artefact.</p>
        </section>
      )}

      {mine.length > 0 && (
        <section className="xf-mine">
          <h3 className="mono">Your own path</h3>
          {mine.map(m => (
            <p key={m.discovery.id}>
              You discovered <b>{m.discovery.node.n}</b> in Main Evolution
              {m.discovery.timelineYear !== null && <> when your timeline stood at about {formatYear(m.discovery.timelineYear)}</>}.
              {m.comparison && <> {comparisonLine(m.comparison)}</>}
            </p>
          ))}
          <p className="xf-note">The game&rsquo;s timeline is simplified, so this comparison is approximate. Your discovery never replaces the historical record here.</p>
        </section>
      )}
    </aside>
  );
}
