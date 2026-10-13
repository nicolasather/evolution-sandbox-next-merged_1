'use client';
import { useMemo, useState } from 'react';
import { diffReports, forecast, forecastWithProgramme, type ReportDiff } from '@/lib/civilization/lifelines/engine';
import { districtName } from '@/lib/civilization/lifelines/network';
import { SERVICE_LABEL, formatUnits, ROUTING_FROM_CHAPTER } from '@/lib/civilization/lifelines/rules';
import {
  blockReasonText, councilPreview, degradedProgrammes, districtView, headlineResources, objectiveViews, pressures,
  queueViews, remediesFor, visibleProgrammes, networkTeaching, type PressureView, type Remedy,
} from '@/lib/civilization/lifelines/selectors';
import {
  RESOURCE_IDS, type Command, type ContentIndex, type LifelinesState, type MilliQuantities, type PolicyChoice, type ResourceId,
} from '@/lib/civilization/lifelines/schema';
import { useGuideGlow } from '@/components/guide/GuideProvider';
import { GUIDE_TARGET } from '@/lib/guide/civilization';
import { RES_GLYPH, resColor } from './ui';

export type Dispatch = (c: Command) => { ok: boolean; code?: string };

const costText = (q: MilliQuantities) =>
  Object.entries(q).filter(([, n]) => n).map(([r, n]) => `${formatUnits(n as number)} ${SERVICE_LABEL[r as ResourceId].toLowerCase()}`).join(', ') || 'free';

export function DiffView({ diff, run }: { diff: ReportDiff | null; run: LifelinesState }) {
  if (!diff) return <p className="ll-dim">No change to the forecast.</p>;
  const nothing = !diff.changed.length && !diff.newShortages.length && !diff.clearedShortages.length && !diff.districts.length;
  if (nothing) return <p className="ll-dim">No change to the forecast.</p>;
  return (
    <ul className="ll-diff">
      {diff.clearedShortages.map(r => <li key={'c' + r} className="good">Clears the {SERVICE_LABEL[r].toLowerCase()} warning</li>)}
      {diff.newShortages.map(r => <li key={'n' + r} className="bad">New {SERVICE_LABEL[r].toLowerCase()} warning</li>)}
      {diff.changed.map(c => <li key={c.resource}>{SERVICE_LABEL[c.resource]} reserve at season end: {formatUnits(c.before)} → {formatUnits(c.after)}</li>)}
      {diff.districts.slice(0, 6).map(d => <li key={d.districtId + d.resource}>{districtName(run.layout, d.districtId)}, {SERVICE_LABEL[d.resource].toLowerCase()} unmet: {formatUnits(d.before)} → {formatUnits(d.after)}</li>)}
    </ul>
  );
}

export function Stocks({ index, run }: { index: ContentIndex; run: LifelinesState }) {
  const [all, setAll] = useState(false);
  const cap = index.db.rules.stockCap;
  const list = all ? RESOURCE_IDS : headlineResources(index, run);
  return (
    <section className="ll-panel" aria-label="Shared reserve">
      <h2 className="ll-h3">Shared reserve</h2>
      <ul className="ll-stocks">
        {list.map(r => {
          const low = run.report?.warnings.some(w => w.resource === r);
          return (
            <li key={r} className={low ? 'low' : ''}>
              <span className="ll-glyph" style={{ color: resColor(r) }} aria-hidden="true">{RES_GLYPH[r]}</span>
              <span>{SERVICE_LABEL[r]}</span>
              <b>{formatUnits(run.stocks[r])}<small> / {cap}</small></b>
              {low && <em>warning</em>}
            </li>
          );
        })}
      </ul>
      <button type="button" className="ll-link-btn" onClick={() => setAll(a => !a)}>{all ? 'Show fewer' : 'Show all services'}</button>
    </section>
  );
}

export function Objectives({ index, run }: { index: ContentIndex; run: LifelinesState }) {
  const rows = objectiveViews(index, run);
  return (
    <section className="ll-panel" aria-label="Chapter goals">
      <h2 className="ll-h3">Goals</h2>
      <ul className="ll-goals">
        {rows.map(o => <li key={o.id} className={o.done ? 'done' : ''}><span aria-hidden="true">{o.done ? '■' : '□'}</span> {o.text} <small>{o.done ? 'met' : o.progress}</small></li>)}
      </ul>
    </section>
  );
}

export function PressuresPanel({ index, run, dispatch, onSelectDistrict }: { index: ContentIndex; run: LifelinesState; dispatch: Dispatch; onSelectDistrict: (id: string) => void }) {
  const list = pressures(run);
  const [open, setOpen] = useState<string | null>(null);
  const remedies = useMemo(() => (open ? remediesFor(index, run, list.find(p => p.id === open) as PressureView) : []), [open, index, run, list]);
  const degraded = degradedProgrammes(index, run);
  const teach = networkTeaching(index, run);
  if (!list.length && !degraded.length) return null;
  return (
    <section className="ll-panel warn" aria-label="Pressures">
      <h2 className="ll-h3">Pressures</h2>
      <p className="ll-dim">Warnings only — nothing here ends your settlement.</p>
      <ul className="ll-pressures">
        {list.map((p, i) => (
          <li key={p.id}>
            <b>{p.title}</b>{i === 0 && list.length > 1 ? <em> · most important</em> : null}
            <p>{p.explanation}</p>
            <div className="ll-row">
              {p.districtIds.slice(0, 2).map(id => <button key={id} type="button" className="ll-btn small ghost" onClick={() => onSelectDistrict(id)}>Show {districtName(run.layout, id)}</button>)}
              <button type="button" className="ll-btn small" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Hide options' : 'Options'}</button>
            </div>
            {open === p.id && (
              <ul className="ll-remedies">
                {remedies.length === 0 && <li className="ll-dim">No distinct options are available yet. Advancing and tending the reserve may help.</li>}
                {remedies.map((r: Remedy) => (
                  <li key={r.id}>
                    <b>{r.label}</b> <small>cost {costText(r.cost)}</small>
                    <p>{r.description}</p>
                    <DiffView diff={r.diff} run={run} />
                    <button type="button" className="ll-btn small" disabled={!r.legal} onClick={() => dispatch(r.command)}>{r.legal ? 'Do this (1 action)' : (r.reasonText ?? 'Not available')}</button>
                  </li>
                ))}
                {!teach.repair && p.cause === 'network' && <li className="ll-dim">Repairs and second routes are taught in a later chapter.</li>}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {degraded.length > 0 && (
        <ul className="ll-pressures">
          {degraded.map(d => (
            <li key={d.built.instanceId}>
              <b>{d.name} is worn ({Math.round(d.built.condition / 10)}%)</b> <small>in {d.district}</small>
              <p>Unmet upkeep lowers condition. Repair costs {costText(d.repairCost)}.</p>
              <button type="button" className="ll-btn small" onClick={() => dispatch({ type: 'repair-programme', instanceId: d.built.instanceId })}>Repair (1 action)</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ForecastPanel({ index, run, onClose }: { index: ContentIndex; run: LifelinesState; onClose: () => void }) {
  const [all, setAll] = useState(false);
  const rep = useMemo(() => forecast(index, run), [index, run]);
  const rows = (all ? RESOURCE_IDS : headlineResources(index, run)).map(r => rep.ledger.find(l => l.resource === r)).filter(Boolean);
  return (
    <section className="ll-panel" aria-label="Season forecast">
      <div className="ll-row spread"><h2 className="ll-h3">Forecast for season {rep.turn}</h2><button type="button" className="ll-btn small ghost" onClick={onClose}>Close</button></div>
      <p className="ll-dim">What happens if you advance now with no further changes. This is the same calculation the season uses.</p>
      <table className="ll-table">
        <caption className="ll-sr">Forecast ledger, in units</caption>
        <thead><tr><th>Service</th><th>Start</th><th>Plans</th><th>Made</th><th>Needed</th><th>Unmet</th><th>End</th></tr></thead>
        <tbody>
          {rows.map(l => l && (
            <tr key={l.resource} className={l.unmetDemand + l.unmetUpkeep > 0 ? 'low' : ''}>
              <th scope="row">{SERVICE_LABEL[l.resource]}</th>
              <td>{formatUnits(l.start)}</td><td>{formatUnits(l.transfers)}</td><td>{formatUnits(l.produced + l.effects)}</td>
              <td>{formatUnits(l.demand + l.upkeep)}</td><td>{formatUnits(l.unmetDemand + l.unmetUpkeep)}</td><td>{formatUnits(l.end)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="ll-link-btn" onClick={() => setAll(a => !a)}>{all ? 'Show fewer' : 'Show all services'}</button>
      {rep.work.length > 0 && (
        <ul className="ll-dim">{rep.work.map(w => { const q = run.queue.find(x => x.queueId === w.queueId); return <li key={w.queueId}>{index.projects.get(q?.projectId ?? '')?.name ?? 'Programme'}: {formatUnits(w.effort)} work, {formatUnits(w.remaining)} remaining</li>; })}</ul>
      )}
      {rep.completed.length > 0 && <p>Completing: {rep.completed.map(c => index.projects.get(c.projectId)?.name).join(', ')}</p>}
      {rep.warnings.length === 0 ? <p className="good">No shortages expected.</p> : <ul>{rep.warnings.map(w => <li key={w.resource}>{SERVICE_LABEL[w.resource]} {w.cause === 'network' ? 'may not reach' : 'may run short in'} {w.districts.map(d => districtName(run.layout, d.districtId)).join(', ')}</li>)}</ul>}
    </section>
  );
}

export function QueuePanel({ index, run, dispatch }: { index: ContentIndex; run: LifelinesState; dispatch: Dispatch }) {
  const rows = queueViews(index, run);
  if (!rows.length) return null;
  return (
    <section className="ll-panel" aria-label="Construction queue">
      <h2 className="ll-h3">In progress</h2>
      <ul className="ll-queue">
        {rows.map(r => (
          <li key={r.item.queueId}>
            <div><b>{r.name}</b> <small>{r.district} · {r.item.status}</small></div>
            <div className="ll-meter" role="progressbar" aria-valuenow={r.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.name} progress`}><i style={{ width: `${r.percent}%` }} /></div>
            <small>{r.etaSeasons === null ? 'Waiting for a free crew' : `About ${r.etaSeasons} season${r.etaSeasons === 1 ? '' : 's'} left`}</small>
            <button type="button" className="ll-btn small ghost" onClick={() => dispatch({ type: 'cancel-queue', queueId: r.item.queueId })}>
              {r.started ? 'Cancel (partial refund)' : 'Cancel (full refund)'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DistrictPanel({ index, run, districtId, onProgrammes }: { index: ContentIndex; run: LifelinesState; districtId: string | null; onProgrammes: () => void }) {
  const v = districtId ? districtView(index, run, districtId, run.report) : null;
  if (!v) return <section className="ll-panel"><p className="ll-dim">Select a district to see what it has, what it needs and how it connects.</p></section>;
  return (
    <section className="ll-panel" aria-label={`District: ${v.district.name}`}>
      <h2 className="ll-h3">{v.district.name}</h2>
      <p className="ll-dim">{v.district.terrain.join(', ')}{v.district.storage ? ' · holds the shared reserve' : ''}</p>
      {v.built.length > 0 && <ul>{v.built.map(b => <li key={b.instanceId}>{b.name}{b.condition < 1000 ? ` — ${Math.round(b.condition / 10)}%` : ''}</li>)}</ul>}
      {v.needs.length > 0 && <p className="warn-text">Unmet: {v.needs.map(n => `${n.label} (${formatUnits(n.unmet)})`).join(', ')}</p>}
      <ul className="ll-dim">{v.links.map(l => <li key={l.link.id}>{l.label} to {l.otherName}{l.worn ? ` — worn (${Math.round(l.link.condition / 10)}%)` : ''}</li>)}</ul>
      <button type="button" className="ll-btn" onClick={onProgrammes} disabled={run.completion.status === 'archived'}>Plan a programme here</button>
    </section>
  );
}

export interface ProgrammePreview { projectId: string; districtId: string }

export function ProgrammeDrawer({ index, run, districtId, dispatch, onClose, onPreview }: {
  index: ContentIndex; run: LifelinesState; districtId: string | null; dispatch: Dispatch; onClose: () => void; onPreview: (p: ProgrammePreview | null) => void;
}) {
  const [all, setAll] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const glow = useGuideGlow();
  const options = useMemo(() => visibleProgrammes(index, run, all), [index, run, all]);
  const sel = options.find(o => o.project.id === pick) ?? null;
  const here = sel && districtId ? sel.districts.find(d => d.id === districtId) : null;
  const afterReport = sel && districtId ? forecastWithProgramme(index, run, sel.project.id, districtId) : null;
  const after = afterReport ? diffReports(forecast(index, run), afterReport) : null;
  const choose = (id: string) => { setPick(id); onPreview(districtId ? { projectId: id, districtId } : null); };
  return (
    <aside className="ll-drawer" aria-label="Programmes">
      <div className="ll-row spread"><h2 className="ll-h3">Programmes{districtId ? ` · ${districtName(run.layout, districtId)}` : ''}</h2><button type="button" className="ll-btn small ghost" onClick={onClose}>Close</button></div>
      {!districtId && <p className="warn-text">Select a district first, then choose a programme.</p>}
      <ul className="ll-proglist">
        {options.map(o => (
          <li key={o.project.id}>
            <button type="button" className={'ll-prog' + (pick === o.project.id ? ' sel' : '') + (o.reason ? ' blocked' : '') + (o.reason ? '' : ' ' + glow(GUIDE_TARGET.programme(o.project.id)))} aria-pressed={pick === o.project.id} onClick={() => choose(o.project.id)}>
              <b>{o.project.name}</b>
              <span>{costText(quantitiesOf(o.project.cost))} · ~{o.seasons} season{o.seasons === 1 ? '' : 's'}</span>
              {o.reasonText && <em>{o.reasonText}</em>}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ll-link-btn" onClick={() => setAll(a => !a)}>{all ? 'Only this chapter’s services' : 'Show every service'}</button>
      {sel && (
        <div className="ll-detail">
          <h3 className="ll-h3">{sel.project.name}</h3>
          <p>{sel.project.purpose}</p>
          <p className="ll-dim">Trade-off: {sel.project.tradeoff}</p>
          <p className="ll-dim">Provides {costText(quantitiesOf(sel.project.output)) || '—'} per season; upkeep {costText(quantitiesOf(sel.project.upkeep))}.</p>
          {sel.missingPrerequisites.length > 0 && <p className="warn-text">Needs first: {sel.missingPrerequisites.map(id => index.projects.get(id)?.name).join(', ')}</p>}
          {Object.keys(sel.shortfall).length > 0 && <p className="warn-text">Reserve is short by {costText(sel.shortfall)}.</p>}
          {districtId && <><h4 className="ll-h4">Forecast once established here</h4><DiffView diff={after} run={run} /></>}
          <button type="button" className={'ll-btn primary ' + (!districtId || here?.reason ? '' : glow(GUIDE_TARGET.plan))} disabled={!districtId || !!here?.reason}
            onClick={() => { if (districtId && dispatch({ type: 'queue-programme', projectId: sel.project.id, districtId }).ok) { onPreview(null); setPick(null); } }}>
            {!districtId ? 'Select a district' : here?.reason ? blockReasonText(here.reason) : 'Plan it (1 action, cost reserved once)'}
          </button>
        </div>
      )}
    </aside>
  );
}
const quantitiesOf = (q: Partial<Record<ResourceId, number>>): MilliQuantities => {
  const o: MilliQuantities = {};
  for (const [r, n] of Object.entries(q)) if (n) o[r as ResourceId] = Math.round((n as number) * 1000);
  return o;
};

export function CouncilPanel({ index, run, dispatch, onClose }: { index: ContentIndex; run: LifelinesState; dispatch: Dispatch; onClose: () => void }) {
  const [draft, setDraft] = useState<PolicyChoice[]>(() => run.policies.map(p => ({ ...p })));
  const groups = useMemo(() => RESOURCE_IDS.map(g => ({ g, rows: index.db.policies.filter(p => p.exclusiveGroup === g) })).filter(x => x.rows.length), [index]);
  const preview = useMemo(() => councilPreview(index, run, draft), [index, run, draft]);
  const teach = networkTeaching(index, run);
  const setGroup = (g: ResourceId, id: string) => {
    const rest = draft.filter(d => index.policies.get(d.id)?.exclusiveGroup !== g);
    setDraft(id ? [...rest, { id, districtId: draft.find(d => index.policies.get(d.id)?.exclusiveGroup === g)?.districtId ?? null }] : rest);
  };
  const setScope = (g: ResourceId, districtId: string) =>
    setDraft(draft.map(d => (index.policies.get(d.id)?.exclusiveGroup === g ? { ...d, districtId: districtId || null } : d)));
  return (
    <aside className="ll-drawer" aria-label="Council">
      <div className="ll-row spread"><h2 className="ll-h3">Council</h2><button type="button" className="ll-btn small ghost" onClick={onClose}>Cancel</button></div>
      <p className="ll-dim">Up to {index.db.rules.policySlots} standing policies, one per service group. Preview first; nothing changes until you confirm.</p>
      <ul className="ll-policies">
        {groups.map(({ g, rows }) => {
          const cur = draft.find(d => index.policies.get(d.id)?.exclusiveGroup === g);
          return (
            <li key={g}>
              <label><span>{SERVICE_LABEL[g]}</span>
                <select value={cur?.id ?? ''} onChange={e => setGroup(g, e.target.value)}>
                  <option value="">None</option>
                  {rows.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              {cur && <label className="ll-scope"><span>Applies to</span>
                <select value={cur.districtId ?? ''} onChange={e => setScope(g, e.target.value)}>
                  <option value="">Whole settlement</option>
                  {run.layout.districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>}
              {cur && <small className="ll-dim">{index.policies.get(cur.id)?.tradeoff}</small>}
            </li>
          );
        })}
      </ul>
      {teach.routing && (
        <label className="ll-scope"><span>When links are tight, serve first</span>
          <select value={run.routingPriority ?? ''} onChange={e => dispatch({ type: 'set-routing', service: (e.target.value || null) as ResourceId | null })}>
            <option value="">Even sharing</option>
            {RESOURCE_IDS.map(r => <option key={r} value={r}>{SERVICE_LABEL[r]}</option>)}
          </select>
        </label>
      )}
      {!teach.routing && <p className="ll-dim">Routing priorities are introduced in chapter {ROUTING_FROM_CHAPTER}.</p>}
      {preview.error ? <p className="warn-text">{preview.error}</p> : (
        <>
          {(preview.incoming.length > 0 || preview.outgoing.length > 0) && <p>{preview.incoming.length ? `Adopting: ${preview.incoming.join(', ')}. ` : ''}{preview.outgoing.length ? `Retiring: ${preview.outgoing.join(', ')}.` : ''}</p>}
          <DiffView diff={preview.diff} run={run} />
        </>
      )}
      <button type="button" className="ll-btn primary" disabled={!preview.valid || (!preview.incoming.length && !preview.outgoing.length && JSON.stringify(draft) === JSON.stringify(run.policies))}
        onClick={() => { if (dispatch({ type: 'set-policies', policies: draft }).ok) onClose(); }}>Confirm council decision</button>
    </aside>
  );
}
