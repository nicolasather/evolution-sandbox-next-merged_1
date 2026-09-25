'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Engine } from '@/lib/engine';
import { worldFocus } from '@/lib/world/progress';
import { setWorldModePref, subscribeWorldMode, worldModePref, type WorldMode } from '@/lib/world/prefs';
import { prefersReducedMotion } from '@/lib/perf';
import { cn } from '@/lib/utils';
import { WorldMap } from './WorldMap';

/* ============================================================================
   WORLD PROGRESS — one calm page for the whole map: where the current era
   stands, what the next one is waiting on, which parts of the world are lit,
   and how much of the globe cinematic the visitor wants. Read-only, apart
   from that one setting. Same in-page dialog shape as the journal.
   ========================================================================== */

const MODES: { id: WorldMode; label: string; note: string }[] = [
  { id: 'full', label: 'Full', note: 'The whole journey for each major invention, about 3–5 seconds.' },
  { id: 'quick', label: 'Quick', note: 'A shorter reveal every time, about 3 seconds.' },
  { id: 'off', label: 'Off', note: 'No globe. The map and the counters still update.' },
];

export function WorldProgressPanel({ open, engine, onClose }: { open: boolean; engine: Engine; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const mode = useSyncExternalStore(subscribeWorldMode, worldModePref, () => 'full' as WorldMode);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' || ((ev.key === 'm' || ev.key === 'M') && !ev.metaKey && !ev.ctrlKey && !ev.altKey)) {
        ev.preventDefault(); ev.stopPropagation(); onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, onClose]);

  const found = open ? engine.majorsFound() : [];
  const points = found.filter(m => m.precision !== 'unlocated').map(m => ({ id: m.id, lat: m.lat, lon: m.lon, name: m.name }));
  if (!open) return null;

  const f = worldFocus(engine);
  const sum = engine.worldSummary();
  const cur = f.current;
  const latest = found.length ? found[found.length - 1] : null;

  return (
    <div id="world-progress" className="confirm" role="dialog" aria-modal="true" aria-labelledby="wp-t"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="confirm-box wp-box">
        <p className="mono confirm-k" id="wp-t">World progress</p>

        <section className="wp-era" aria-label="Current era">
          <div className="wp-era-top">
            <span className="wp-era-name">{cur.name}</span>
            <span className="num wp-era-n">{cur.requiredDone} <i>/</i> {cur.required}<em className="mono"> required inventions</em></span>
          </div>
          <span className="gate-bar wp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={cur.required} aria-valuenow={cur.requiredDone}
            aria-label={`${cur.name}: ${cur.requiredDone} of ${cur.required} required inventions`}>
            <i style={{ width: `${cur.percent}%` }} />
          </span>
          <p className="wp-era-sub mono">
            {cur.percent}% complete
            {cur.optionalDone + cur.hiddenDone > 0 && <> · {cur.optionalDone + cur.hiddenDone} optional found</>}
            {cur.hidden - cur.hiddenDone > 0 && <> · {cur.hidden - cur.hiddenDone} hidden {cur.hidden - cur.hiddenDone === 1 ? 'major' : 'majors'} remaining</>}
          </p>
          {f.next && (
            <p className={cn('wp-next mono', f.nextLocked ? 'is-locked' : 'is-open')}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" />{f.nextLocked ? <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /> : <path d="M5.5 7V5a2.5 2.5 0 0 1 4.6-1.4" />}
              </svg>
              <span>{f.next.name} · {f.nextLocked ? 'locked' : 'open'}</span>
              {f.nextLocked && <span className="wp-lock-msg">{f.lockMessage}</span>}
            </p>
          )}
        </section>

        <div className="wp-map">
          <WorldMap points={points} latest={latest?.id} label={`World map with ${points.length} major ${points.length === 1 ? 'invention' : 'inventions'} marked`} />
        </div>

        <dl className="wp-stats">
          <div><dt className="mono">Regions represented</dt><dd className="num">{sum.regionsRepresented} / {sum.regionsTotal}</dd></div>
          <div><dt className="mono">Majors on the map</dt><dd className="num">{sum.found} / {sum.total}</dd></div>
          <div><dt className="mono">Required overall</dt><dd className="num">{sum.requiredFound} / {sum.requiredTotal}</dd></div>
          <div><dt className="mono">Hidden majors remaining</dt><dd className="num">{sum.hiddenLeft}</dd></div>
        </dl>

        <div className="wp-cols">
          <section aria-label="Regions">
            <h3 className="wp-h mono">By region</h3>
            <ul className="wp-regions">
              {sum.regions.map(r => (
                <li key={r.id} className={cn(r.found > 0 && 'lit')}>
                  <span>{r.name}</span>
                  <span className="wp-mini" aria-hidden="true"><i style={{ width: `${r.total ? (r.found / r.total) * 100 : 0}%` }} /></span>
                  <span className="num">{r.found}/{r.total}</span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Eras">
            <h3 className="wp-h mono">By era</h3>
            <ul className="wp-eras">
              {f.eras.filter(e => e.required > 0).map(e => (
                <li key={e.era} className={cn(e.complete && 'done', !e.open && 'locked', e.era === cur.era && 'now')}>
                  <span className="wp-tick" aria-hidden="true">{e.complete ? '✓' : !e.open ? '·' : '›'}</span>
                  <span className="wp-en">{e.name}</span>
                  <span className="num">{e.open || e.complete ? `${e.requiredDone}/${e.required}` : 'locked'}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="wp-mode" aria-label="Globe reveals">
          <h3 className="wp-h mono">Globe reveals</h3>
          <div className="wp-seg" role="radiogroup" aria-label="How much of the globe reveal to play">
            {MODES.map(m => (
              <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className="chip"
                onClick={() => setWorldModePref(m.id)}>{m.label}</button>
            ))}
          </div>
          <p className="wp-note mono">
            {MODES.find(m => m.id === mode)?.note}
            {prefersReducedMotion() && mode !== 'off' && ' Your device asks for reduced motion, so the globe appears already turned to the place.'}
          </p>
        </section>

        <div className="confirm-row">
          <button ref={closeRef} type="button" className="chip" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
