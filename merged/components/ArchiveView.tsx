'use client';

import { useState } from 'react';
import { Glyph } from './Glyph';
import { StatsCounter } from './vengeance/stats-counter';
import { LineHoverLink } from './vengeance/line-hover-link';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { dailyPick } from '@/lib/daily';
import type { Engine } from '@/lib/engine';
import type { StoneAgeTier } from '@/lib/types';

type Filter = 'all' | 'found' | 'missing' | 'reach' | 'routes' | 'rare' | 'hidden' | 'req';
type Tab = 'collection' | 'history';
const STAGES: StoneAgeTier[] = ['olduvai', 'middle', 'late'];

function Stages({ engine }: { engine: Engine }) {
  const prog = engine.getTierProgress();
  return (
    <div className="stages" aria-label="Stone Age stages">
      {STAGES.map(t => {
        const g = engine.gate(t);
        const p = prog[t];
        const pct = p.total ? Math.round((p.unlocked / p.total) * 100) : 0;
        return (
          <div key={t} className={cn('stage', !g.open && 'closed')}>
            <div className="stage-top mono">
              <span>{g.name}</span>
              <span className="num">{p.unlocked}/{p.total}</span>
            </div>
            <span className="gate-bar"><i style={{ width: `${pct}%` }} /></span>
            <span className="stage-note mono">
              {g.open ? 'Open' : `Opens after ${g.need} ${g.prevName} finds · ${g.have}/${g.need}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Today({ engine, onOpen }: { engine: Engine; onOpen: (id: string) => void }) {
  const n = dailyPick(engine.db);
  if (!n) return null;
  const have = engine.has(n.id);
  const d = engine.distance(n.id);
  const era = engine.db.eras.find(e => e.id === n.era)?.name;
  return (
    <button className="today" onClick={() => onOpen(n.id)}>
      <span className="today-k mono">Today&rsquo;s find</span>
      <span className="today-g"><Glyph node={n} locked={!have} /></span>
      <span className="today-t">
        {have ? <><b>{n.n}</b> — already in your collection. A new one tomorrow.</>
          : <>“{engine.riddle(n)}”</>}
      </span>
      <span className="today-m mono">
        {era} · {have ? 'found' : d === 0 ? 'within reach' : `${d} piece${d === 1 ? '' : 's'} missing`}
      </span>
    </button>
  );
}

export function ArchiveView({
  engine, active, onOpen,
}: { engine: Engine; version: number; active: boolean; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>('collection');
  const [filter, setFilter] = useState<Filter>('all');
  const [era, setEra] = useState<string | null>(null);
  const s = engine.stats();
  const { counts } = engine.db;
  const reach = new Set(engine.withinReach().map(n => n.id));

  let list = engine.db.nodes.slice();
  if (era) list = list.filter(n => n.era === era);
  if (filter === 'found') list = list.filter(n => engine.has(n.id));
  else if (filter === 'missing') list = list.filter(n => !engine.has(n.id));
  else if (filter === 'reach') list = list.filter(n => reach.has(n.id));
  else if (filter === 'routes') list = list.filter(n => { const r = engine.routeCount(n.id); return engine.has(n.id) && r.found < r.total; });
  else if (filter === 'rare') list = list.filter(n => n.rar === 'rare' && engine.has(n.id));
  else if (filter === 'hidden') list = list.filter(n => n.hidden && engine.has(n.id));
  else if (filter === 'req') list = list.filter(n => n.src.includes('source_required') && engine.has(n.id));
  list.sort((a, b) => a.no - b.no);

  const stats: [string, React.ReactNode][] = [
    ['discoveries', <StatsCounter key="c" value={s.core} suffix={` / ${s.coreTotal}`} />],
    ['hidden finds', <StatsCounter key="h" value={s.hidden} suffix={` / ${s.hiddenTotal}`} />],
    ['routes found', <StatsCounter key="r" value={s.routesFound} suffix={` / ${s.routesTotal}`} />],
    ['within reach', <StatsCounter key="w" value={reach.size} />],
    ['eras reached', <StatsCounter key="e" value={s.eras} suffix={` / ${s.eraTotal}`} />],
  ];

  const filters: [Filter, string][] = [
    ['all', 'Everything'], ['found', 'Found'], ['missing', 'Not found'],
    ['reach', `Within reach · ${reach.size}`], ['routes', 'Routes left to find'],
    ['rare', 'Rare'], ['hidden', 'Hidden'], ['req', 'Source required'],
  ];

  const history = engine.history().slice().reverse();
  const eraProgress = engine.db.eras.map(e => {
    const all = engine.db.nodes.filter(n => n.era === e.id && !n.hidden);
    return { e, have: all.filter(n => engine.has(n.id)).length, total: all.length };
  });

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-arch" role="tabpanel" aria-label="Archive">
      <div className="arch-head">
        <h2 className="arch-title">Archive</h2>
        <div className="arch-stats">
          {stats.map(([k, v]) => (
            <div className="stat" key={k}><b>{v}</b><span className="mono">{k}</span></div>
          ))}
        </div>
        <div className="arch-row">
          <Today engine={engine} onOpen={onOpen} />
          <Stages engine={engine} />
        </div>
      </div>

      <div className="arch-filters" id="arch-filters">
        <div className="arch-tabs" role="tablist" aria-label="Archive sections">
          <button role="tab" className="chip" aria-selected={tab === 'collection'} onClick={() => setTab('collection')}>Collection</button>
          <button role="tab" className="chip" aria-selected={tab === 'history'} onClick={() => setTab('history')}>Your history · {history.length}</button>
        </div>
        {tab === 'collection' && (
          <>
            <div className="chip-row">
              {filters.map(([f, label]) => (
                <button key={f} className="chip" data-af={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
              ))}
            </div>
            <div className="chip-row">
              <button className="chip" aria-pressed={!era} onClick={() => setEra(null)}>Every era</button>
              {eraProgress.map(({ e, have, total }) => (
                <button key={e.id} className="chip" aria-pressed={era === e.id} onClick={() => setEra(e.id)}>
                  {e.name} <span className="num" style={{ opacity: 0.7 }}>{have}/{total}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {tab === 'collection' ? (
        <div className="arch-grid" id="arch-grid">
          {list.length === 0 && <p className="arch-note mono">Nothing here yet.</p>}
          {list.map((n, i) => {
            const known = engine.has(n.id);
            const r = engine.routeCount(n.id);
            // a hidden find stays a mystery: no number, no name, no era until it is found
            const mystery = !!n.hidden && !known;
            return (
              <button
                key={n.id}
                className={cn('card', !known && 'locked', reach.has(n.id) && 'reach', mystery && 'mystery', known && n.rar === 'rare' && 'rare')}
                data-id={n.id}
                style={{ ['--i' as string]: Math.min(i, 30) }}
                onClick={() => onOpen(n.id)}
              >
                <Glyph node={n} locked={!known} />
                <span className="cm mono">NO. {mystery ? '???' : String(n.no).padStart(3, '0')}</span>
                <span className="cn">{known ? n.n : mystery ? '?????????' : reach.has(n.id) ? 'Within reach' : '—'}</span>
                <span className="cm mono">
                  {mystery ? 'Unknown' : engine.db.eras.find(e => e.id === n.era)?.name}
                  {known && r.total > 1 && <> · {r.found}/{r.total} routes</>}
                </span>
                {known && n.src.includes('source_required') && <span className="card-flag mono">Source needed</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <ol className="history">
          {history.length === 0 && <li className="arch-note mono">Nothing yet. Your first discovery will appear here.</li>}
          {history.map(st => {
            const r = engine.get(st.r)!, a = engine.get(st.a)!, b = engine.get(st.b)!;
            const t = engine.foundAt(st.r);
            return (
              <li key={st.r}>
                <button className="hist" onClick={() => onOpen(st.r)}>
                  <Glyph node={r} />
                  <span className="hist-n">{r.n}</span>
                  <span className="hist-r mono">{a.n} + {b.n}</span>
                  {t && <span className="hist-t mono">{new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mono arch-note">
        Undiscovered entries stay closed: no names, no recipes. {counts.sourceRequired} entries are marked
        <b> source required</b> — no subject-level source has been verified for them yet, and none is invented.
        Sources last checked <span id="src-checked">{formatDate(engine.db.sourcesChecked)}</span>.{' '}
        <LineHoverLink href="/method" variant="slide" className="text-ochre">How this was built →</LineHoverLink>
      </p>
    </section>
  );
}
