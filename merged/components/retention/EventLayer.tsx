'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Engine } from '@/lib/engine';
import { retentionBus } from '@/lib/retention/bus';
import { EVENT_BY_ID, activeEvent, eventKey, type EventArt } from '@/lib/retention/events';
import { eraIndex } from '@/lib/retention/catalog';
import { notices } from '@/lib/retention/notices';
import { retention } from '@/lib/retention/store';
import { createRng } from '@/lib/seed';
import { getForced, subscribeForced, clearForced } from './eventBridge';
import { useRetention } from './hooks';

const rnd = (seed: string) => createRng(seed);

/** One small engraved scene per scenario: stroke-only, CSS-animated, drawn from a seeded layout so it is stable. */
export function EventArtView({ art, slot }: { art: EventArt; slot: number }) {
  const els = useMemo(() => {
    const g = rnd(`ev-${art}-${slot}`);
    const out: React.ReactNode[] = [];
    const f = (n: number) => Math.round(n * 10) / 10;
    const N = (n: number) => Array.from({ length: n }, (_, i) => i);
    switch (art) {
      case 'meteors': N(9).forEach(i => { const x = g.int(10, 95), y = g.int(2, 40); out.push(<path key={i} className="ev-streak" style={{ animationDelay: `${f(g.next() * 6)}s` }} d={`M${x} ${y}l-9 6M${x - 3} ${y + 2}l-7 4`} />); }); break;
      case 'frost': N(14).forEach(i => { const x = g.int(3, 97), y = g.int(5, 95); out.push(<path key={i} className="ev-frost" style={{ animationDelay: `${f(g.next() * 5)}s` }} d={`M${x} ${y - 2}v4M${x - 2} ${y}h4M${x - 1.4} ${y - 1.4}l2.8 2.8M${x + 1.4} ${y - 1.4}l-2.8 2.8`} />); }); break;
      case 'cracks': N(7).forEach(i => { const x = g.int(5, 90), y = g.int(70, 96); out.push(<path key={i} className="ev-crack" style={{ animationDelay: `${i * 0.5}s` }} d={`M${x} ${y}l${g.int(2, 5)} ${-g.int(2, 5)}l${g.int(2, 6)} ${g.int(1, 3)}l${g.int(2, 5)} ${-g.int(1, 4)}`} />); }); break;
      case 'shore': N(5).forEach(i => out.push(<path key={i} className="ev-wave" style={{ animationDelay: `${i * 0.9}s` }} d={`M0 ${88 + i * 2.4}q6 -3 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0`} />)); break;
      case 'lanterns': N(8).forEach(i => { const x = g.int(6, 94), y = g.int(20, 80); out.push(<g key={i} className="ev-lantern" style={{ animationDelay: `${f(g.next() * 6)}s` }}><path d={`M${x - 1.6} ${y - 2.4}h3.2l.8 4.8h-4.8z`} /><path d={`M${x} ${y - 2.4}v-1.6M${x - 1.2} ${y + 2.4}h2.4`} /></g>); }); break;
      case 'inkmarks': N(12).forEach(i => { const x = g.int(5, 95), y = g.int(15, 90); out.push(<path key={i} className="ev-ink" style={{ animationDelay: `${f(g.next() * 7)}s` }} d={`M${x} ${y}q2 -3 4 0t4 0M${x} ${y + 2}h7`} />); }); break;
      case 'caravan': N(5).forEach(i => out.push(<g key={i} className="ev-cara" style={{ animationDelay: `${-i * 4}s` }}><path d={`M0 ${86 - (i % 2)}c1 -4 3 -5 5 -4l3 -3c2 0 2 2 1 3v6M2 ${86 - (i % 2)}v5M7 ${86 - (i % 2)}v5`} /></g>)); break;
      case 'sparks': N(16).forEach(i => { const x = g.int(15, 40), y = g.int(70, 94); out.push(<path key={i} className="ev-spark" style={{ animationDelay: `${f(g.next() * 3)}s`, ['--dx' as string]: `${g.int(-8, 14)}vw` }} d={`M${x} ${y}l1 -1.6`} />); }); break;
      case 'starlines': N(9).forEach(i => { const x = g.int(8, 92), y = g.int(6, 44); out.push(<path key={i} className="ev-sline" style={{ animationDelay: `${i * 0.7}s` }} d={`M${x} ${y}l${g.int(6, 14)} ${g.int(-6, 8)}`} />); }); break;
      case 'steam': N(7).forEach(i => { const x = g.int(8, 92); out.push(<path key={i} className="ev-steam" style={{ animationDelay: `${i * 0.8}s` }} d={`M${x} 96q3 -8 0 -16t0 -16`} />); }); break;
      case 'branches': N(3).forEach(i => { const x = g.int(15, 85); out.push(<path key={i} className="ev-bolt" style={{ animationDelay: `${i * 2.6}s` }} d={`M${x} 0l-3 12l5 4l-4 12l4 3M${x - 3} 12l-6 6M${x + 2} 16l5 6`} />); }); break;
      case 'pulses': N(4).forEach(i => out.push(<circle key={i} className="ev-pulse" style={{ animationDelay: `${i * 1.1}s` }} cx="86" cy="12" r="4" />)); break;
      case 'pixels': N(16).forEach(i => { const x = g.int(2, 96); out.push(<rect key={i} className="ev-pix" style={{ animationDelay: `${f(g.next() * 5)}s`, animationDuration: `${4 + g.int(0, 4)}s` }} x={x} y="-4" width="2" height="2" />); }); break;
      case 'glitch': N(5).forEach(i => out.push(<path key={i} className="ev-gl" style={{ animationDelay: `${i * 1.7}s` }} d={`M0 ${g.int(12, 88)}h${g.int(30, 70)}M${g.int(20, 60)} ${g.int(12, 88)}h${g.int(10, 30)}`} />)); break;
    }
    return out;
  }, [art, slot]);
  return (
    <svg className={`rev rev-${art}`} viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="0.35" vectorEffect="non-scaling-stroke" aria-hidden="true">
      {els}
    </svg>
  );
}

/** The scenario layer: ambience + a one-line banner with the gentle challenge. Fictional, labelled, optional. */
export function EventLayer({ engine, visible }: { engine: Engine; visible: boolean }) {
  const r = useRetention();
  const forced = useSyncExternalStore(subscribeForced, getForced, () => null);
  const [now, setNow] = useState(() => Date.now());
  const idx = Math.max(0, eraIndex(engine.currentEra().id));
  const live = useMemo(() => activeEvent(idx, now, forced), [idx, forced, now]);
  const seen = useRef(new Set<string>());
  const lookedRef = useRef<{ key: string; ids: string[] }>({ key: '', ids: [] });
  const [lookedAt, setLookedAt] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] });
  const day = new Date().toISOString().slice(0, 10);
  const key = live ? eventKey(live.def.id, day) : '';
  const looked = lookedAt.key === key ? lookedAt.ids : [];

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  // a scenario that ends releases its forced start
  useEffect(() => { if (forced && forced.until <= now) clearForced(); }, [now, forced]);

  useEffect(() => {
    if (!live || !r.prefs.events || !visible || seen.current.has(key)) return;
    seen.current.add(key);
    retention.startEvent(key);
    retentionBus.emit({ t: 'event', id: live.def.id, stage: 'seen' });
  }, [live, key, r.prefs.events, visible]);

  useEffect(() => retentionBus.on(e => {
    if (e.t !== 'inspect' || !e.owned || !live || !retention.get().prefs.events) return;
    const n = engine.get(e.id);
    if (!n || !live.def.cats.includes(n.cat)) return;
    const prev = lookedRef.current.key === key ? lookedRef.current.ids : [];
    if (prev.includes(e.id)) return;
    const next = [...prev, e.id];
    lookedRef.current = { key, ids: next };
    setLookedAt(lookedRef.current);
    if (next.length >= live.def.need && !retention.get().events[key]?.done) {
      retention.startEvent(key);
      retention.finishEvent(key);
      if (retention.award(`event:${key}`, 20)) notices.push({ kind: 'event', title: `${live.def.name}: challenge finished`, sub: 'A fictional scenario — nothing was lost or gained in the real game', coins: 20 });
      retentionBus.emit({ t: 'event', id: live.def.id, stage: 'done' });
    }
  }), [engine, live, key]);

  if (!live || !r.prefs.events || !visible) return null;
  const def = EVENT_BY_ID[live.def.id];
  const done = !!r.events[key]?.done;
  const mins = Math.max(1, Math.ceil((live.endsAt - now) / 60_000));
  return (
    <>
      <div className="rev-wrap" aria-hidden="true" data-art={def.art}><EventArtView art={def.art} slot={live.slot} /></div>
      <p className="rev-banner mono" role="status">
        <b>{def.name}</b> <em>fictional scenario</em> · {done ? 'challenge finished' : `${def.goal} ${looked.length}/${def.need}`} · {mins} min left
      </p>
    </>
  );
}
