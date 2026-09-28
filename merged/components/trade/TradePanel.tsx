'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Engine } from '@/lib/engine';
import { isTradeRoutesEnabled, setTradeRoutesEnabled, subscribeFlags } from '@/lib/modes/flags';
import { REGIONS } from '@/lib/trade/regions';
import { tradeStore } from '@/lib/trade/store';
import { frontier, listLocked } from '@/lib/trade/summary';
import type { GeoId } from '@/lib/trade/types';

/* ============================================================================
   TRADE — Main Evolution's world-layer trade system. Off by default (see
   lib/modes/flags.ts's 'trade-routes'); this panel is both where a player
   turns it on and where they play it once it is. Same in-page dialog shape
   as the World Progress / Journal panels.

   Three states, in order: off (explain + opt in) → no home region yet
   (choose one) → the network view (reachable regions, the frontier of
   corridors that can be founded next, and which not-yet-made discoveries
   are currently waiting on a route).
   ========================================================================== */

function regionName(id: GeoId): string {
  return REGIONS.find(r => r.id === id)?.name ?? id;
}

export function TradePanel({ open, engine, onClose }: { open: boolean; engine: Engine; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const enabled = useSyncExternalStore(subscribeFlags, isTradeRoutesEnabled, () => false);
  const version = useSyncExternalStore(tradeStore.subscribe, tradeStore.getVersion, () => 0);
  void version;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const { homeRegion, routes } = tradeStore.get();

  return (
    <div id="trade-panel" className="confirm" role="dialog" aria-modal="true" aria-labelledby="tp-t"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="confirm-box trade-box">
        <p className="mono confirm-k" id="tp-t">Trade</p>

        {!enabled && (
          <>
            <p className="confirm-d">
              Discoveries no longer exist everywhere at once. Each one first appears where the record actually
              places it — everywhere else has to reach it by trade, one corridor at a time. This is an optional
              layer on top of Main Evolution; turning it off at any point stops it from blocking anything, and it
              never removes a discovery you already have.
            </p>
            <div className="confirm-row">
              <button className="chip" onClick={() => setTradeRoutesEnabled(true)}>Turn on regional trade</button>
              <button className="chip" ref={closeRef} onClick={onClose}>Not now</button>
            </div>
          </>
        )}

        {enabled && !homeRegion && (
          <>
            <p className="confirm-d">Where is your group? New discoveries native to another region will need a trade route before you can make them.</p>
            <div className="trade-regions">
              {REGIONS.filter(r => r.id !== 'global').map(r => (
                <button key={r.id} className="chip" onClick={() => tradeStore.setHomeRegion(r.id)}>{r.name}</button>
              ))}
            </div>
            <div className="confirm-row">
              <button className="chip" ref={closeRef} onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {enabled && homeRegion && (
          <TradeNetwork engine={engine} homeRegion={homeRegion} routes={routes} closeRef={closeRef} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function TradeNetwork({ engine, homeRegion, routes, closeRef, onClose }: {
  engine: Engine;
  homeRegion: GeoId;
  routes: ReturnType<typeof tradeStore.get>['routes'];
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const edges = frontier(homeRegion, routes);
  const locked = listLocked(engine.db.nodes, id => engine.has(id), homeRegion, routes).slice(0, 8);

  return (
    <>
      <p className="confirm-d">
        Home region: <b>{regionName(homeRegion)}</b>. {routes.length === 0
          ? 'No routes established yet.'
          : `${routes.length} route${routes.length === 1 ? '' : 's'} established, reaching ${1 + new Set(routes.flatMap(r => [r.a, r.b])).size - 1} other region${routes.length === 1 ? '' : 's'}.`}
      </p>

      {edges.length > 0 && (
        <section className="trade-frontier">
          <p className="mono wp-h">Establish a route</p>
          <ul className="trade-edges">
            {edges.map(e => (
              <li key={`${e.from}|${e.to}`}>
                <span>{regionName(e.from)} → {regionName(e.to)}</span>
                <button className="chip" onClick={() => tradeStore.establishRoute(e.from, e.to)}>Establish</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {locked.length > 0 && (
        <section className="trade-locked">
          <p className="mono wp-h">Waiting on a route</p>
          <ul className="trade-locked-list">
            {locked.map(({ discovery, lock }) => (
              <li key={discovery.id}>
                <span className="trade-locked-name">{discovery.n}</span>
                <span className="trade-locked-origin mono">{lock.originLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="confirm-row">
        <button className="chip" onClick={() => setTradeRoutesEnabled(false)}>Turn off</button>
        <button className="chip" ref={closeRef} onClick={onClose}>Close</button>
      </div>
    </>
  );
}
