'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog } from '@/lib/museum/history/data';
import { anchorOf } from '@/lib/museum/history/util';
import { connections, isEligible, pointsOf, primaryRegion, regionAround } from '@/lib/museum/history/selectors';
import { formatYear, interpolateYear, logPosition } from '@/lib/museum/history/timeline';
import type { Year } from '@/lib/museum/history/types';
import { GlobeCanvas, type GlobePoint } from './GlobeCanvas';
import { IMPORTANCE_WEIGHT, categoryColor } from './labels';

/* ============================================================================
   WORLD HISTORY — the Museum's globe room. Every available achievement sits
   where the record places it; arcs show knowledge travelling between
   regions. A time dial (log scale — deep time is long) replays how the world
   filled with human activity, up to the canonical timeline and never past it.
   Choose a place to see what was happening there around the dial's year;
   choose an achievement to walk to it in the hall.
   ========================================================================== */

export function WorldHistory({
  cat, year, focusExhibit, onOpenInHall,
}: {
  cat: Catalog;
  year: Year;
  /** An exhibit to fly to on arrival. */
  focusExhibit: string | null;
  onOpenInHall: (id: string) => void;
}) {
  const start = cat.calendar.start;
  const [dial, setDial] = useState(1);        // 0…1 along a log scale from the start to `year`
  const [playing, setPlaying] = useState(false);
  const [region, setRegion] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(focusExhibit);
  const at = Math.round(interpolateYear(start, year, dial, cat.calendar.present));

  // replay: sweep the dial from the start to now over ~14 s
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let t0 = 0;
    const from = dial >= 0.999 ? 0 : dial;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const f = Math.min(1, from + (t - t0) / 14000);
      setDial(f);
      if (f >= 1) { setPlaying(false); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => cat.exhibits.filter(e => isEligible(e, at)), [cat, at]);
  const points = useMemo<GlobePoint[]>(() => {
    const out: GlobePoint[] = [];
    for (const e of visible) {
      const ps = pointsOf(cat, e).filter(p => p.role !== 'spread');
      ps.slice(0, 3).forEach((p, i) => out.push({
        id: `${e.id}|${i}`, lat: p.lat, lon: p.lon,
        weight: IMPORTANCE_WEIGHT[e.importance], ring: p.role === 'independent',
        color: categoryColor(e.categories[0]), highlight: e.id === picked,
        alpha: e.id === picked ? 1 : picked ? 0.45 : 0.9,
      }));
    }
    return out;
  }, [cat, visible, picked]);
  const arcs = useMemo(() => {
    const present = cat.calendar.present;
    return connections(cat, at).map(c => ({
      from: c.from, to: c.to, kind: c.kind,
      // the more recent the connection, the brighter — the world visibly knits together
      alpha: Math.max(0.15, 1 - logPosition(c.year, at, start, present) * 1.4),
    }));
  }, [cat, at, start]);

  const pickedEx = picked ? cat.byId.get(picked) : undefined;
  const focusPt = pickedEx ? pointsOf(cat, pickedEx).find(p => p.role !== 'spread') : undefined;
  const regionList = useMemo(() => (region ? regionAround(cat, region, at, year, 7) : []), [cat, region, at, year]);

  // tally by part of the world, for the legend
  const tally = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of visible) {
      const g = primaryRegion(cat, e)?.geo ?? 'global';
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  }, [cat, visible]);

  return (
    <div className="wh">
      <div className="wh-globe">
        <GlobeCanvas
          label={`World history globe at ${formatYear(at)}: ${visible.length} achievements shown`}
          points={points}
          arcs={arcs}
          focus={focusPt ? { lat: focusPt.lat, lon: focusPt.lon, key: picked ?? '' } : null}
          onPick={id => {
            const exId = id.split('|')[0];
            setPicked(exId);
            const e = cat.byId.get(exId);
            const r = e ? primaryRegion(cat, e) : undefined;
            if (r) setRegion(r.id);
          }}
        />
      </div>

      <div className="wh-side">
        <p className="mono wh-eyebrow">World history</p>
        <h2 className="wh-year">{formatYear(at)}</h2>
        <p className="wh-sub">{visible.length} achievements on the map · {arcs.length} connections between places</p>

        <div className="wh-dial">
          <button type="button" className="wh-play" onClick={() => { if (dial >= 0.999) setDial(0); setPlaying(p => !p); }}
            aria-label={playing ? 'Pause' : 'Replay history'}>
            {playing
              ? <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2v8M9 2v8" stroke="currentColor" strokeWidth="2" /></svg>
              : <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5l7 4.5-7 4.5z" fill="currentColor" /></svg>}
          </button>
          <input type="range" min={0} max={1000} value={Math.round(dial * 1000)}
            aria-label="Move through time" aria-valuetext={formatYear(at)}
            onChange={e => { setPlaying(false); setDial(Number(e.target.value) / 1000); }} />
        </div>
        <div className="mono wh-dial-ends"><span>{formatYear(start)}</span><span>{formatYear(year)}</span></div>

        <ul className="wh-tally">
          {[...tally.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => (
            <li key={g}><button type="button" onClick={() => {
              const r = cat.regions.find(x => x.geo === g);
              if (r) setRegion(r.id);
            }}><span>{GEO_LABEL[g] ?? g}</span><span className="mono">{n}</span></button></li>
          ))}
        </ul>

        {region && (
          <section className="wh-region">
            <h3 className="mono">Around {formatYear(at)} · {cat.regionById.get(region)?.label}</h3>
            {regionList.length === 0 && <p className="wh-note">Nothing in this Museum is recorded here yet at this point in time.</p>}
            {regionList.map(e => (
              <button key={e.id} type="button" className={'wh-item' + (e.id === picked ? ' on' : '')}
                onClick={() => setPicked(e.id)}>
                <span>{e.title}</span>
                <i className="mono">{formatYear(anchorOf(e))}</i>
              </button>
            ))}
          </section>
        )}

        {pickedEx && (
          <section className="wh-picked">
            <p className="mono">{pickedEx.when.display}</p>
            <h3>{pickedEx.title}</h3>
            <p>{pickedEx.change}</p>
            <button type="button" className="mu-btn" onClick={() => onOpenInHall(pickedEx.id)}>Walk to it in the hall</button>
          </section>
        )}
        <p className="wh-note">Filled marks: where a development began or was concentrated. Rings: independent origins. Arcs: spread and influence between regions.</p>
      </div>
    </div>
  );
}

const GEO_LABEL: Record<string, string> = {
  africa: 'Africa', west_central_asia: 'West & Central Asia', europe: 'Europe', south_asia: 'South Asia',
  east_asia: 'East Asia', americas: 'The Americas', oceania_sea: 'Oceania & Island Southeast Asia', global: 'Worldwide',
};
