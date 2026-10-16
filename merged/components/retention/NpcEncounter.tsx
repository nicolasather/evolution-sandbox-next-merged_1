'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Engine } from '@/lib/engine';
import { retentionBus, arbiter, type RetentionEvent } from '@/lib/retention/bus';
import { NPC_BY_ID, eligibleNpcs, type NpcDef } from '@/lib/retention/npc';
import { eraIndex } from '@/lib/retention/catalog';
import { hashString } from '@/lib/seed';
import { isWorldBusy } from '@/lib/world/bus';
import { notices } from '@/lib/retention/notices';
import { retention } from '@/lib/retention/store';
import { RArt } from './RArt';
import { useRetention } from './hooks';

/* a tiny external store so the Visitors tab can ask for a revisit */
let shown: string | null = null;
const subs = new Set<() => void>();
export const showNpc = (id: string | null) => { shown = id; subs.forEach(f => f()); };
const useShown = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => shown, () => null);

const COOLDOWN = 4 * 60_000;

/** The target the quest asks about: the first thing from the visitor's field the player holds. */
function targetOf(def: NpcDef, engine: Engine, saved?: string): string | null {
  if (saved && engine.holds(saved)) return saved;
  return def.items.find(id => engine.holds(id)) ?? null;
}

export function NpcEncounter({ engine, visible }: { engine: Engine; visible: boolean }) {
  const r = useRetention();
  const current = useShown();
  const lastAt = useRef(0);
  const finished = useRef(false);

  // a cameo can drop in after a NEW discovery — once the finish has had its moment — when the era is reached and the
  // player holds something from the visitor's field
  const visibleRef = useRef(visible);
  useEffect(() => { visibleRef.current = visible; }, [visible]);
  useEffect(() => {
    let timer = 0;
    const attempt = (discoveryId: string, tries = 0) => {
      // the globe reveal (and anything else the world layer is playing) goes first
      if (isWorldBusy() && tries < 12) { timer = window.setTimeout(() => attempt(discoveryId, tries + 1), 1500); return; }
      const s = retention.get();
      if (!s.prefs.npc || shown || !visibleRef.current) return;
      if (Date.now() - lastAt.current < COOLDOWN || !arbiter.canPlay('npc')) return;
      const idx = Math.max(0, eraIndex(engine.currentEra().id));
      const pool = eligibleNpcs(idx, id => engine.holds(id));
      if (!pool.length) return;
      const fresh = pool.filter(n => !s.npcs[n.id]);
      const list = fresh.length ? fresh : pool.filter(n => s.npcs[n.id]?.quest !== 'done');
      if (!list.length) return;
      // not every discovery: the first one always, then a deterministic third, so it feels like a visit, not a pop-up
      if (s.counters.npcSeen && hashString(`npc|${discoveryId}`) % 3 !== 0) return;
      const pick = list[hashString(`pick|${discoveryId}`) % list.length];
      lastAt.current = Date.now();
      showNpc(pick.id);
      retention.bump('npcSeen', 1);
    };
    const off = retentionBus.on((e: RetentionEvent) => {
      if (e.t !== 'discovery' || e.status !== 'new') return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => attempt(e.id), 2100);
    });
    return () => { off(); window.clearTimeout(timer); };
  }, [engine]);

  // record the meeting when a card opens
  const def = current ? NPC_BY_ID[current] : null;
  useEffect(() => {
    if (!current) return;
    const rec = retention.meetNpc(current, {});
    retentionBus.emit({ t: 'npc', id: current, stage: 'met' });
    const tid = targetOf(NPC_BY_ID[current], engine, rec.target);
    if (tid && !rec.target) retention.patchNpc(current, { target: tid });
    arbiter.request('npc', 60_000);
    finished.current = false;
    return () => arbiter.release('npc');
  }, [current, engine]);

  // the quest: look closely at (or stay with) the target
  useEffect(() => retentionBus.on(e => {
    for (const [nid, rec] of Object.entries(retention.get().npcs)) {
      if (rec.quest !== 'open' || !rec.target) continue;
      const d = NPC_BY_ID[nid]; if (!d) continue;
      const hit = (d.quest === 'inspect' && e.t === 'inspect' && e.id === rec.target && e.owned) || (d.quest === 'study' && e.t === 'study' && e.id === rec.target);
      if (!hit) continue;
      retention.patchNpc(nid, { quest: 'done', doneAt: Date.now() });
      retention.award(`npc:${nid}`, d.coins);
      notices.push({ kind: 'npc', title: `${d.name}: task finished`, sub: 'A small thank-you', coins: d.coins });
      retentionBus.emit({ t: 'npc', id: nid, stage: 'quest-done' });
      finished.current = true;
    }
  }), []);

  if (!def || !current) return null;
  const rec = r.npcs[current];
  const target = rec?.target ? engine.get(rec.target) : null;
  const verb = def.quest === 'inspect' ? 'Open the exhibit of' : 'Stay with the evidence of';
  const done = rec?.quest === 'done';
  return (
    <aside className="rnpc" role="dialog" aria-label={`Visitor: ${def.name}`} key={current}>
      <div className="rnpc-art" data-npc-portrait><RArt kind="npc" id={def.id} size={132} /></div>
      <div className="rnpc-txt">
        <p className="mono rdim">A visitor · {def.kind === 'historical' ? 'a figure from history' : 'an archetype'}</p>
        <h3>{def.name}</h3>
        <p>{def.intro}</p>
        <ul>{def.notes.filter(Boolean).map(n => <li key={n}>{n}</li>)}</ul>
        {target && (
          <p className="rnpc-quest mono" data-done={done ? '1' : '0'}>
            {done ? 'Task finished — thank you.' : rec?.quest === 'open' ? `Task: ${verb.toLowerCase()} “${target.n}” (${def.quest === 'inspect' ? 'press Inspect' : 'keep the exhibit open a few moments'}). Reward ${def.coins} ◈.` : `A small task: ${verb.toLowerCase()} “${target.n}”. Reward ${def.coins} ◈.`}
          </p>
        )}
        <p className="rnpc-fine mono">{def.disclaimer} Source status: {def.sourceStatus.replace(/_/g, ' ')}.</p>
        <div className="rbtns">
          {target && !done && rec?.quest !== 'open' && <button className="chip rbuy" onClick={() => { retention.patchNpc(current, { quest: 'open', target: target.id }); retentionBus.emit({ t: 'npc', id: current, stage: 'quest-open' }); }}>Accept</button>}
          <button className="chip" onClick={() => showNpc(null)}>{done ? 'Goodbye' : 'Not now'}</button>
        </div>
      </div>
    </aside>
  );
}
