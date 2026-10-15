'use client';

/* ============================================================================
   RESOURCE VISUAL LAB — gallery (DEVELOPMENT ONLY, local).

   Shows the 100-resource dataset through the REAL Plate3D renderer, so what you
   judge here is what the game would draw. The page and its API are gated (see
   lib/devlab/gate.ts) and are never deployed. Approve/reject and scores are stored
   in dev-data/visual-lab/reviews.json on this machine only.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plate3D } from '@/components/Plate3D';
import { buildModel } from '@/lib/plate3d';
import { EXTRA_ART } from '@/lib/processing/art';
import type { Dataset, GenRecord, Review, ResourceEntry, Decision } from '@/lib/devlab/types';
import css from './Gallery.module.css';

interface Existing { id: string; n: string; cat: string; vis: string }
interface Payload {
  dataset: Dataset; records: GenRecord[]; reviews: Record<string, Review>; existing: Existing[];
  ollama: { url: string; model: string; health: { ok: boolean; version?: string; modelPresent?: boolean; models?: string[]; error?: string } | null };
}
type StatusFilter = 'all' | 'ok' | 'failed' | 'none' | 'fixture' | 'approved' | 'rejected' | 'pending';
type Tab = 'compare' | 'json' | 'validation' | 'metrics' | 'review';

const SCORE_DIMS = ['recognizability', 'style', 'detail', 'uniqueness', 'composition'] as const;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'x-visual-lab': '1', 'content-type': 'application/json', ...(init?.headers ?? {}) }, cache: 'no-store' });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
  return j as T;
}

/** The lab plate is registered under a versioned key so Plate3D's model cache never serves a stale drawing. */
function labKey(rec: GenRecord): string {
  const key = `lab_${rec.id}_v${rec.version}_${rec.source}`;
  if (rec.markup) EXTRA_ART[key] = rec.markup;
  return key;
}

function InView({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const io = new IntersectionObserver(es => setOn(es.some(e => e.isIntersecting)), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ width: '100%', height: '100%' }}>{on ? children : fallback}</div>;
}

function PlateView({ rec, flat, variant }: { rec: GenRecord; flat: boolean; variant: 'card' | 'exhibit' }) {
  const key = labKey(rec);
  if (flat) return <div dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 100 100" fill="none" stroke="#67f3ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" color="#67f3ff">${rec.markup ?? ''}</svg>` }} />;
  return <Plate3D node={{ id: key, vis: 'lab', cat: 'material' }} variant={variant} label={`${rec.id} drawing`} />;
}

function stateOf(rec: GenRecord | undefined): 'none' | 'ok' | 'failed' | 'fixture' {
  if (!rec) return 'none';
  if (rec.source === 'fixture') return 'fixture';
  return rec.status;
}

export function Gallery() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [flat, setFlat] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async (health = false) => {
    try { setData(await api<Payload>(`/api/dev/visual-lab${health ? '?health=1' : ''}`)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // deep link: /admin/visual-lab?focus=vl_pagoda opens that resource straight away
  useEffect(() => {
    if (!data) return;
    const f = new URLSearchParams(window.location.search).get('focus');
    if (f && data.dataset.resources.some(r => r.id === f)) setSel(s => s ?? f);
  }, [data]);

  const recById = useMemo(() => new Map((data?.records ?? []).map(r => [r.id, r])), [data]);

  const shown = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.dataset.resources.filter(r => {
      if (cat !== 'all' && r.category !== cat) return false;
      if (needle && !r.name.toLowerCase().includes(needle)) return false;
      const s = stateOf(recById.get(r.id));
      const d = data.reviews[r.id]?.decision ?? 'pending';
      if (status === 'all') return true;
      if (status === 'approved' || status === 'rejected' || status === 'pending') return d === status;
      return s === status;
    });
  }, [data, cat, q, status, recById]);

  const counts = useMemo(() => {
    const all = data?.records ?? [];
    return {
      ok: all.filter(r => r.source === 'qwen' && r.status === 'ok').length,
      failed: all.filter(r => r.source === 'qwen' && r.status === 'failed').length,
      fixture: all.filter(r => r.source === 'fixture').length,
    };
  }, [data]);

  const regenerate = async (id: string) => {
    setBusy(b => new Set(b).add(id)); setNote(null);
    try {
      const { record } = await api<{ record: GenRecord }>('/api/dev/visual-lab', { method: 'POST', body: JSON.stringify({ action: 'regenerate', id }) });
      setData(d => d && { ...d, records: [...d.records.filter(r => r.id !== id), record] });
      setNote(record.status === 'ok' ? `${id}: regenerated (version ${record.version}).` : `${id}: generation FAILED — ${record.failure?.kind}: ${record.failure?.message}`);
    } catch (e) { setNote(`${id}: ${(e as Error).message}`); }
    finally { setBusy(b => { const n = new Set(b); n.delete(id); return n; }); }
  };

  const review = async (id: string, decision: Decision, scores?: Record<string, number>, text?: string) => {
    const { review: rv } = await api<{ review: Review }>('/api/dev/visual-lab', { method: 'POST', body: JSON.stringify({ action: 'review', id, decision, scores, note: text }) });
    setData(d => d && { ...d, reviews: { ...d.reviews, [id]: rv } });
  };

  if (error) return <main className={css.root}><div className={css.banner}>Visual Lab could not load: {error}</div></main>;
  if (!data) return <main className={css.root}>Loading…</main>;

  const h = data.ollama.health;
  const selected = sel ? data.dataset.resources.find(r => r.id === sel) : undefined;

  return (
    <main className={css.root}>
      <div className={css.banner}>
        DEVELOPMENT ONLY — local prototype. Not part of the game catalogue, never deployed. Plates marked FIXTURE are hand-authored references, not AI output.
        Automated numbers are measured by code; approve/reject and 1–5 scores are your own judgement.
      </div>
      <div className={css.top}>
        <h1>Resource Visual Lab</h1>
        <span className={css.stat}><b>{data.dataset.resources.length}</b> resources</span>
        <span className={css.stat}><b>{counts.ok}</b> generated by Qwen</span>
        <span className={css.stat}><b>{counts.failed}</b> failed</span>
        <span className={css.stat}><b>{data.dataset.resources.length - counts.ok - counts.failed}</b> not generated{counts.fixture ? ` (${counts.fixture} fixtures)` : ''}</span>
        <button className={css.btn} onClick={() => void load(true)}>Check Ollama</button>
        <a className={css.btn} href="/api/dev/visual-lab?sheet=1" target="_blank" rel="noreferrer">Contact sheet (SVG)</a>
        {h && <span className={`${css.stat} ${h.ok ? '' : css.err}`}>
          {h.ok ? `Ollama ${h.version} · ${data.ollama.model} ready` : `Ollama NOT ready: ${h.error}`} <i>({data.ollama.url})</i>
        </span>}
      </div>
      {note && <div className={css.banner}>{note}</div>}

      <div className={css.bar}>
        <button className={`${css.btn} ${cat === 'all' ? css.btnOn : ''}`} onClick={() => setCat('all')}>All</button>
        {data.dataset.categories.map(c => (
          <button key={c.id} title={c.name} className={`${css.btn} ${cat === c.id ? css.btnOn : ''}`} onClick={() => setCat(c.id)}>{c.id} · {c.name}</button>
        ))}
      </div>
      <div className={css.bar}>
        <input className={css.input} placeholder="Search by name…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search by name" />
        <select className={css.select} value={status} onChange={e => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status">
          <option value="all">All states</option><option value="ok">Generated (Qwen)</option><option value="failed">Failed</option>
          <option value="none">Not generated</option><option value="fixture">Fixture</option>
          <option value="approved">Approved</option><option value="rejected">Rejected</option><option value="pending">Not reviewed</option>
        </select>
        <label className={css.stat}><input type="checkbox" checked={flat} onChange={e => setFlat(e.target.checked)} /> flat 2D preview (fast)</label>
        <span className={css.stat}>{shown.length} shown</span>
      </div>

      <div className={css.grid}>
        {shown.map(r => <Card key={r.id} r={r} rec={recById.get(r.id)} rv={data.reviews[r.id]} flat={flat} onOpen={() => setSel(r.id)} />)}
      </div>

      {selected && (
        <Detail
          r={selected} rec={recById.get(selected.id)} rv={data.reviews[selected.id]} existing={data.existing}
          busy={busy.has(selected.id)} onClose={() => setSel(null)}
          onRegenerate={() => void regenerate(selected.id)} onReview={(d, s, t) => review(selected.id, d, s, t)}
        />
      )}
    </main>
  );
}

function Card({ r, rec, rv, flat, onOpen }: { r: ResourceEntry; rec?: GenRecord; rv?: Review; flat: boolean; onOpen: () => void }) {
  const s = stateOf(rec);
  return (
    <button className={css.card} onClick={onOpen} aria-label={`Open ${r.name}`}>
      <div className={css.thumb}>
        {(s === 'ok' || s === 'fixture') && rec ? <InView fallback={<div className={css.empty}>…</div>}><PlateView rec={rec} flat={flat} variant="card" /></InView>
          : s === 'failed' ? <div className={`${css.empty} ${css.emptyFail}`}>GENERATION FAILED<br />{rec?.failure?.kind}</div>
            : <div className={css.empty}>NOT GENERATED</div>}
      </div>
      <div className={css.name}>{r.name}</div>
      <div className={css.meta}>
        <span>{r.category}</span>
        <span className={`${css.tag} ${s === 'ok' ? css.tagOk : s === 'failed' ? css.tagFail : s === 'fixture' ? css.tagFix : css.tagNone}`}>
          {s === 'ok' ? 'QWEN' : s === 'failed' ? 'FAILED' : s === 'fixture' ? 'FIXTURE' : 'NONE'}
        </span>
        {rv?.decision === 'approved' && <span className={`${css.tag} ${css.tagApp}`}>APPROVED</span>}
        {rv?.decision === 'rejected' && <span className={`${css.tag} ${css.tagRej}`}>REJECTED</span>}
      </div>
    </button>
  );
}

function Detail({ r, rec, rv, existing, busy, onClose, onRegenerate, onReview }: {
  r: ResourceEntry; rec?: GenRecord; rv?: Review; existing: Existing[]; busy: boolean;
  onClose: () => void; onRegenerate: () => void; onReview: (d: Decision, scores?: Record<string, number>, note?: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('compare');
  const [cmpQ, setCmpQ] = useState('');
  const defaultCmp = existing.find(e => e.n === 'Plant Thread') ?? existing[0];
  const [cmp, setCmp] = useState<Existing | undefined>(defaultCmp);
  const [scores, setScores] = useState<Record<string, number>>(rv?.scores ?? {});
  const [text, setText] = useState(rv?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [perf, setPerf] = useState<string>('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!rec?.markup) { setPerf(''); return; }
    const t0 = performance.now();
    const m = buildModel(`${labKey(rec)}|perf${Date.now()}`, rec.markup);
    const ms = performance.now() - t0;
    setPerf(m ? `3D model build in this browser: ${ms.toFixed(1)} ms, ${m.lines.length} polylines, ${m.dots.length} dots (measured now; not stored)` : '3D model could not be built');
  }, [rec]);

  const matches = cmpQ.trim() ? existing.filter(e => e.n.toLowerCase().includes(cmpQ.trim().toLowerCase())).slice(0, 10) : [];
  const save = async (d: Decision) => { setSaving(true); try { await onReview(d, scores, text); } finally { setSaving(false); } };
  const s = stateOf(rec);

  return (
    <div className={css.overlay} role="dialog" aria-modal="true" aria-label={r.name} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={css.modal}>
        <div className={css.modalHead}>
          <div>
            <h2>{r.name} <small style={{ color: '#7fa4ad', fontWeight: 400 }}>· {r.categoryName} · {r.id}</small></h2>
            <p className={css.facts}>{r.description} <br /><b>Period:</b> {r.period}. <b>Materials:</b> {r.materials.join(', ')}. <b>Shape:</b> {r.shapeFamily}. <b>Complexity:</b> {r.complexity}/5.<br /><b>Features asked for:</b> {r.features.join('; ')}.</p>
          </div>
          <div className={css.row}>
            <button className={css.btn} disabled={busy} onClick={onRegenerate}>{busy ? 'Regenerating… (can take minutes)' : 'Regenerate with Qwen'}</button>
            <button className={css.btn} onClick={onClose}>Close (Esc)</button>
          </div>
        </div>

        <div className={css.cols}>
          <div>
            <div className={css.big}>
              {(s === 'ok' || s === 'fixture') && rec ? <PlateView rec={rec} flat={false} variant="exhibit" />
                : s === 'failed' ? <div className={`${css.empty} ${css.emptyFail}`}>GENERATION FAILED<br />{rec?.failure?.kind}: {rec?.failure?.message}</div>
                  : <div className={css.empty}>NOT GENERATED YET</div>}
            </div>
            <div className={css.cap}>{s === 'fixture' ? 'Hand-authored reference plate (not AI output). ' : ''}{perf}</div>
          </div>
          <div>
            <div className={css.big}>
              {cmp ? <Plate3D node={{ id: cmp.id, vis: cmp.vis, cat: cmp.cat }} variant="exhibit" label={`${cmp.n} (existing)`} /> : null}
            </div>
            <div className={css.cap}>Existing resource: <b>{cmp?.n}</b></div>
            <input className={css.input} style={{ width: '100%', marginTop: 4 }} placeholder="Compare with another existing resource…" value={cmpQ} onChange={e => setCmpQ(e.target.value)} aria-label="Find an existing resource" />
            <div className={css.list}>{matches.map(m => <button key={m.id} className={css.btn} onClick={() => { setCmp(m); setCmpQ(''); }}>{m.n}</button>)}</div>
          </div>
        </div>

        <div className={css.tabs}>
          {(['json', 'validation', 'metrics', 'review'] as Tab[]).map(t => (
            <button key={t} className={`${css.btn} ${tab === t ? css.btnOn : ''}`} onClick={() => setTab(tab === t ? 'compare' : t)}>
              {{ json: 'JSON spec', validation: 'Validation / attempts', metrics: 'Automated metrics', review: 'Review (manual)', compare: '' }[t]}
            </button>
          ))}
        </div>

        {tab === 'json' && <div className={css.pane}>{rec?.spec
          ? <><button className={css.btn} onClick={() => void navigator.clipboard?.writeText(JSON.stringify(rec.spec, null, 2))}>Copy</button><pre className={css.pre}>{JSON.stringify(rec.spec, null, 2)}</pre></>
          : 'No valid spec stored for this resource.'}</div>}

        {tab === 'validation' && <div className={css.pane}>
          {!rec ? 'Nothing generated yet.' : <>
            <div>Status: <b className={rec.status === 'failed' ? css.err : ''}>{rec.status.toUpperCase()}</b> · source: {rec.source} · model: {rec.model} · version {rec.version} · {rec.generatedAt}</div>
            {rec.failure && <p className={css.err}><b>{rec.failure.kind}</b>: {rec.failure.message}{rec.failure.details?.length ? <ul>{rec.failure.details.map((d, i) => <li key={i}>{d}</li>)}</ul> : null}</p>}
            {!!rec.validationWarnings?.length && <div className={css.warn}><b>Warnings (values were clamped / ignored):</b><ul>{rec.validationWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
            {rec.attempts.length > 0 && <table className={css.tbl}><thead><tr><th>#</th><th>wall time</th><th>prompt processing</th><th>generation</th><th>tokens in/out</th><th>result</th></tr></thead><tbody>
              {rec.attempts.map(a => <tr key={a.n}><td>{a.n}</td><td>{(a.ms / 1000).toFixed(1)} s</td><td>{a.promptEvalMs !== undefined ? `${(a.promptEvalMs / 1000).toFixed(1)} s` : '–'}</td><td>{a.evalMs !== undefined ? `${(a.evalMs / 1000).toFixed(1)} s` : '–'}</td><td>{a.promptTokens ?? '–'} / {a.outputTokens ?? '–'}</td><td className={a.error ? css.err : ''}>{a.error ? `${a.error.kind}: ${a.error.message}` : 'accepted'}</td></tr>)}
            </tbody></table>}
            {rec.lastRaw && <details><summary>Last raw model reply (data only, never executed)</summary><pre className={css.pre}>{rec.lastRaw}</pre></details>}
          </>}
        </div>}

        {tab === 'metrics' && <div className={css.pane}>
          {!rec?.metrics ? 'No measurements (nothing valid was generated).' : <>
            <p className={css.cap}>Measured by code. These numbers describe the drawing; they do not say whether it looks like the object.</p>
            <table className={css.tbl}><tbody>
              {Object.entries(rec.metrics).map(([group, vals]) => Object.entries(vals as Record<string, unknown>).map(([k, v]) => (
                <tr key={`${group}.${k}`}><th>{group}</th><td>{k}</td><td>{Array.isArray(v) ? v.join('; ') : String(v)}</td></tr>
              )))}
            </tbody></table>
          </>}
        </div>}

        {tab === 'review' && <div className={css.pane}>
          <p className={css.cap}>Manual judgement, stored in dev-data/visual-lab/reviews.json on this machine. Current decision: <b>{rv?.decision ?? 'pending'}</b></p>
          <div className={css.row}>
            {SCORE_DIMS.map(d => (
              <label key={d} className={css.stat}>{d}{' '}
                <select className={css.select} value={scores[d] ?? ''} onChange={e => setScores(s0 => { const n = { ...s0 }; if (e.target.value) n[d] = Number(e.target.value); else delete n[d]; return n; })}>
                  <option value="">–</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            ))}
          </div>
          <textarea className={css.textarea} placeholder="Note (optional)" value={text} maxLength={500} onChange={e => setText(e.target.value)} />
          <div className={css.row}>
            <button className={`${css.btn} ${css.good}`} disabled={saving || !rec?.markup} onClick={() => void save('approved')}>Approve</button>
            <button className={`${css.btn} ${css.bad}`} disabled={saving} onClick={() => void save('rejected')}>Reject</button>
            <button className={css.btn} disabled={saving} onClick={() => void save('pending')}>Mark not reviewed</button>
          </div>
        </div>}
      </div>
    </div>
  );
}
