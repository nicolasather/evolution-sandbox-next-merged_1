'use client';
import { useMemo, useState } from 'react';
import type { Engine } from '@/lib/engine';
import { ACHIEVEMENTS, DAILY_BY_ID } from '@/lib/retention/catalog';
import { dailyLine, dailyName, todayKey } from '@/lib/retention/daily';
import { achievementProgress, runtime, snapshot } from '@/lib/retention/runtime';
import { EVENTS, activeEvent, eventEligible } from '@/lib/retention/events';
import { NPCS, eligibleNpcs } from '@/lib/retention/npc';
import { buildJourney, groupJourney } from '@/lib/retention/timeline';
import { nextSilhouettes } from '@/lib/retention/silhouettes';
import { EGGS } from '@/lib/retention/eggs';
import { retention, type Prefs } from '@/lib/retention/store';
import { eraIndex } from '@/lib/retention/catalog';
import { Glyph } from '../Glyph';
import { RArt } from './RArt';
import { useRetention } from './hooks';
import { forceEvent } from './eventBridge';

const when = (at: number) => (at > 0 ? new Date(at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Before tracking began');

/* ── goals: today's three, and the seventy achievements ─────────────────── */
export function GoalsTab({ engine }: { engine: Engine }) {
  const r = useRetention();
  const day = todayKey();
  const st = r.daily[day];
  const sn = snapshot(engine, runtime.currentRoutes);
  const [only, setOnly] = useState<'all' | 'done' | 'todo'>('all');
  const rows = ACHIEVEMENTS.map(a => ({ a, p: achievementProgress(a, sn), at: r.achievements[a.id] }));
  const doneN = rows.filter(x => x.at !== undefined).length;
  const shown = rows.filter(x => only === 'all' || (only === 'done') === (x.at !== undefined));
  return (
    <div className="rgoals">
      <section>
        <h3>Today <span className="mono rdim">{day} · resets at midnight UTC · no streaks</span></h3>
        {!st ? <p className="mono rdim">Make your first discovery and today’s three objectives appear.</p> : (
          <ul className="rdaily">
            {st.picks.map(id => {
              const d = DAILY_BY_ID[id]; if (!d) return null;
              const have = st.progress[id] ?? 0, done = st.done.includes(id);
              return (
                <li key={id} data-done={done ? '1' : '0'}>
                  <b>{dailyName(d)}</b><span>{dailyLine(d)}</span>
                  <i className="mono">{done ? `Done · +${d.coins} ◈` : `${have}/${d.target} · ${d.coins} ◈`}</i>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h3>Achievements <span className="mono rdim">{doneN} of {ACHIEVEMENTS.length}</span></h3>
        <div className="rsub">
          {(['all', 'todo', 'done'] as const).map(k => <button key={k} className="chip" aria-pressed={only === k} onClick={() => setOnly(k)}>{k === 'all' ? 'All' : k === 'todo' ? 'To do' : 'Earned'}</button>)}
        </div>
        <ul className="rach">
          {shown.map(({ a, p, at }) => (
            <li key={a.id} data-done={at !== undefined ? '1' : '0'}>
              <b>{a.name}</b><span>{a.description}</span>
              <i className="mono">{at !== undefined ? `${when(at)} · +${a.coins} ◈` : `${Math.min(p.have, p.need)}/${p.need} · ${a.coins} ◈`}</i>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ── events ───────────────────────────────────────────────────────────── */
export function EventsTab({ engine }: { engine: Engine }) {
  const r = useRetention();
  const idx = Math.max(0, eraIndex(engine.currentEra().id));
  const live = activeEvent(idx);
  return (
    <div>
      <p className="rnote mono">Fictional scenarios: ambience and one gentle challenge inside things you already have. They never touch crafting, nothing is lost by missing one, and nothing runs online.</p>
      <ul className="revents">
        {EVENTS.map(e => {
          const ok = eventEligible(e, idx), isLive = live?.def.id === e.id;
          const done = Object.keys(r.events).some(k => k.startsWith(e.id + '@') && r.events[k].done);
          return (
            <li key={e.id} data-ok={ok ? '1' : '0'} data-live={isLive ? '1' : '0'}>
              <b>{e.name}</b>
              <span>{e.description}</span>
              <em className="mono">{ok ? e.goal : `Opens in the ${engine.db.eras.find(x => x.id === e.minEra)?.name ?? e.minEra} era`}</em>
              <i className="mono">{isLive ? 'Happening now' : done ? 'Challenge finished' : ok ? 'Available' : 'Locked'}</i>
              {ok && !isLive && <button className="chip" onClick={() => forceEvent(e.id)}>Watch now</button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── cameos ───────────────────────────────────────────────────────────── */
export function CameosTab({ engine }: { engine: Engine }) {
  const r = useRetention();
  const idx = Math.max(0, eraIndex(engine.currentEra().id));
  const ready = new Set(eligibleNpcs(idx, id => engine.holds(id)).map(n => n.id));
  const met = Object.keys(r.npcs).length;
  return (
    <div>
      <p className="rnote mono">Stylised, hand-drawn interpretations of people and archetypes from history — not likenesses. Their notes are our own short captions, not quotations. {met} of {NPCS.length} met.</p>
      <ul className="rcameos">
        {NPCS.map(n => {
          const rec = r.npcs[n.id];
          return (
            <li key={n.id} data-met={rec ? '1' : '0'} data-ready={ready.has(n.id) ? '1' : '0'}>
              <span className="rcameo-art">{rec ? <RArt kind="npc" id={n.id} size={72} /> : <RArt kind="npc" id={n.id} size={72} className="rsil" title="Not met yet" />}</span>
              <b>{rec ? n.name : 'Not met yet'}</b>
              <span className="mono rdim">{engine.db.eras.find(e => e.id === n.era)?.name ?? n.era}{rec?.quest === 'done' ? ' · task finished' : rec ? ' · met' : ready.has(n.id) ? ' · may appear soon' : ''}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── journey ──────────────────────────────────────────────────────────── */
export function JourneyTab({ engine }: { engine: Engine }) {
  const r = useRetention();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupJourney(buildJourney(engine)), [engine, r]);
  const n = groups.reduce((s, g) => s + g.items.length, 0);
  return (
    <div className="rjourney">
      <p className="rnote mono">Your own timeline, from times the game really recorded. Anything that predates tracking says so instead of showing a made-up date.</p>
      {n === 0 && <p className="mono rdim">Nothing here yet. Make a discovery.</p>}
      {groups.map(g => (
        <section key={g.label}>
          <h3>{g.label} <span className="mono rdim">{g.items.length}</span></h3>
          <ul>{g.items.map(e => <li key={e.key} data-kind={e.kind}><b>{e.title}</b><span className="mono rdim">{e.sub}</span></li>)}</ul>
        </section>
      ))}
    </div>
  );
}

/* ── whispers: opt-in silhouettes ─────────────────────────────────────── */
export function WhispersTab({ engine, version }: { engine: Engine; version: number }) {
  const r = useRetention();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shadows = useMemo(() => (r.prefs.hints ? nextSilhouettes(engine, 3) : []), [engine, version, r.prefs.hints]);
  return (
    <div>
      <p className="rnote mono">Off by default. When on, up to three shadows show what you could make right now: only the outline, its era and field — never a name, a recipe or an ingredient.</p>
      <label className="rtoggle"><input type="checkbox" checked={r.prefs.hints} onChange={e => retention.setPref('hints', e.target.checked)} /> Show whispers</label>
      {r.prefs.hints && (shadows.length === 0 ? <p className="mono rdim">Nothing is within reach right now — keep exploring.</p> : (
        <ul className="rshadows">
          {shadows.map(s => (
            <li key={s.id}><span className="rshadow"><Glyph node={s.node} locked /></span><span className="mono rdim">{s.era} · {s.field}</span></li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/* ── settings ─────────────────────────────────────────────────────────── */
const PREF_ROWS: { k: keyof Prefs; label: string; hint: string }[] = [
  { k: 'companion', label: 'Silent companion', hint: 'A small engraved creature that reacts to what you do, never speaks.' },
  { k: 'tactile', label: 'Material touch', hint: 'Pieces answer the hand: sparks off stone, threads off fibre, ripples on liquid.' },
  { k: 'failGags', label: 'Failure micro-animations', hint: 'A quick visual joke when a combination goes nowhere.' },
  { k: 'successFx', label: 'Success finishes', hint: 'A hand-drawn flourish when you discover something new.' },
  { k: 'npc', label: 'Visitors from history', hint: 'Stylised cameos that may drop in with a small task.' },
  { k: 'events', label: 'Fictional scenarios', hint: 'Short ambient scenarios with a gentle challenge.' },
  { k: 'eggs', label: 'Secrets', hint: 'Small hidden things to find. Turn off to keep the game plain.' },
  { k: 'stickers', label: 'Reaction stickers', hint: 'A local sticker wheel; nothing is sent anywhere.' },
];
export function SettingsTab() {
  const r = useRetention();
  const [confirm, setConfirm] = useState(false);
  return (
    <div>
      <p className="rnote mono">All of this is optional and cosmetic. Reduced-motion and mute settings are always respected. {EGGS.length} secrets exist; {Object.keys(r.eggs).length} found.</p>
      <ul className="rprefs">
        {PREF_ROWS.map(p => (
          <li key={p.k}>
            <label className="rtoggle"><input type="checkbox" checked={!!r.prefs[p.k]} onChange={e => retention.setPref(p.k, e.target.checked as never)} /> <b>{p.label}</b></label>
            <span className="mono rdim">{p.hint}</span>
          </li>
        ))}
      </ul>
      <h3 className="rh3">Secrets <span className="mono rdim">{Object.keys(r.eggs).length} of {EGGS.length}</span></h3>
      <ul className="rsecrets">
        {EGGS.map(e => (
          <li key={e.id} data-found={r.eggs[e.id] !== undefined ? '1' : '0'}>
            {r.eggs[e.id] !== undefined ? <><b>{e.note}</b><span className="mono rdim">{e.hint}</span></> : <span className="mono rdim">Hidden · {e.area}</span>}
          </li>
        ))}
      </ul>
      <div className="rdanger">
        {!confirm ? <button className="chip" onClick={() => setConfirm(true)}>Reset coins, achievements and cosmetics…</button> : (
          <>
            <span className="mono">This clears only this optional layer in this browser. Your game progress is untouched.</span>
            <button className="chip" onClick={() => { retention.resetAll(); setConfirm(false); }}>Yes, reset it</button>
            <button className="chip" onClick={() => setConfirm(false)}>Keep it</button>
          </>
        )}
      </div>
    </div>
  );
}
