'use client';
import { useMemo, useState } from 'react';
import { chapterStatuses, feasibleMastery, nextChapter, sandboxTiers } from '@/lib/civilization/lifelines/campaign';
import { generateLayout } from '@/lib/civilization/lifelines/layout';
import type { Chapter } from '@/lib/civilization/lifelines/schema';
import { Banners, exportNow } from './Banners';
import { useLifelines } from './ui';

type Tab = 'campaign' | 'replay' | 'sandbox' | 'chronicle';

export function ChapterSelect({ onPlay, onExit, onLegacy }: { onPlay: () => void; onExit: () => void; onLegacy: (() => void) | null }) {
  const { store, snap } = useLifelines();
  const { index, manifest, run } = snap;
  const [tab, setTab] = useState<Tab>('campaign');
  const [pickId, setPickId] = useState<string | null>(null);
  const [biome, setBiome] = useState<string | null>(null);
  const [mastery, setMastery] = useState<string[]>([]);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [error, setError] = useState('');

  const statuses = useMemo(() => (index ? chapterStatuses(index, manifest) : []), [index, manifest]);
  const next = index ? nextChapter(index, manifest) : null;
  const chapter: Chapter | null = index ? index.chapters.get(pickId ?? next?.id ?? '') ?? null : null;
  const hasRun = !!run && run.completion.status !== 'archived';

  if (!index) return null;
  const variants = chapter ? index.db.variants.filter(v => v.chapterId === chapter.id) : [];
  const variant = chapter ? variants.find(v => v.biomeId === (biome ?? chapter.recommendedBiome)) ?? variants[0] : null;
  const options = chapter && variant ? feasibleMastery(chapter, generateLayout(variant.seed, chapter, index)) : [];
  const mode = tab === 'sandbox' ? 'sandbox' : 'campaign';

  const begin = () => {
    if (!variant) return;
    if (hasRun && !confirmReplace) { setConfirmReplace(true); return; }
    const r = store.startRun(variant.id, mode, mode === 'campaign' ? mastery : [], hasRun);
    if (r.ok) { setConfirmReplace(false); onPlay(); } else setError(r.code);
  };
  const choose = (id: string) => { setPickId(id); setBiome(null); setMastery([]); setConfirmReplace(false); setError(''); };
  const selectable = (c: { unlocked: boolean }) => c.unlocked;

  const detail = chapter && (
    <section className="ll-detail" aria-label={chapter.title}>
      <p className="ll-eyebrow">Chapter {chapter.order} · {index.eras.get(chapter.era)?.name}</p>
      <h2 className="ll-h2">{chapter.title}</h2>
      <p>{chapter.brief}</p>
      {statuses.find(s => s.chapter.id === chapter.id)?.completed && <p className="ll-dim">Lesson: {chapter.lesson}</p>}
      {(tab === 'replay' || tab === 'sandbox') && (
        <label className="ll-field"><span>Environment</span>
          <select value={variant?.biomeId ?? ''} onChange={e => setBiome(e.target.value)}>
            {variants.map(v => <option key={v.id} value={v.biomeId}>{index.biomes.get(v.biomeId)?.name ?? v.biomeId}{v.biomeId === chapter.recommendedBiome ? ' (recommended)' : ''}</option>)}
          </select>
          <small className="ll-dim">{index.biomes.get(variant?.biomeId ?? '')?.pressure}</small>
        </label>
      )}
      {tab === 'campaign' && <p className="ll-dim">Environment: {index.biomes.get(chapter.recommendedBiome)?.name}. Generated layout, fixed by the seed.</p>}
      {mode === 'campaign' && options.length > 0 && (
        <fieldset className="ll-field"><legend>Optional mastery (declare before you begin)</legend>
          {options.map(o => (
            <label key={o.id}><input type="checkbox" checked={mastery.includes(o.id)} onChange={e => setMastery(e.target.checked ? [...mastery, o.id] : mastery.filter(x => x !== o.id))} /> {o.label} — <small>{o.description}</small></label>
          ))}
        </fieldset>
      )}
      {mode === 'sandbox' && <p className="ll-dim">Sandbox: a fictional experiment. It never counts toward the campaign or earns a card.</p>}
      {confirmReplace && (
        <div className="ll-callout" role="alert">
          <p>This replaces your current attempt. A copy is kept in the browser&rsquo;s backup key, and you can export it first.</p>
          <button type="button" className="ll-btn small" onClick={() => exportNow(store)}>Export current attempt</button>
        </div>
      )}
      {error && <p className="warn-text" role="alert">Could not begin: {error}</p>}
      <button type="button" className="ll-btn primary" onClick={begin} disabled={snap.readOnly || !variant}>{confirmReplace ? 'Replace and begin' : 'Begin'}</button>
    </section>
  );

  return (
    <div className="ll-screen">
      <header className="ll-head">
        <button type="button" className="ll-btn ghost" onClick={onExit}>← Hub</button>
        <div><p className="ll-eyebrow">Civilization</p><h1 className="ll-h1">Lifelines</h1></div>
        {onLegacy && <button type="button" className="ll-btn ghost" onClick={onLegacy}>Legacy settlements</button>}
      </header>
      <Banners store={store} snap={snap} />
      {hasRun && run && (
        <div className="ll-callout"><p><b>Continue:</b> {index.chapters.get(run.chapterId)?.title} · season {run.turn}{run.mode === 'sandbox' ? ' (sandbox)' : ''}</p>
          <button type="button" className="ll-btn primary" onClick={onPlay}>Continue</button></div>
      )}
      <div className="ll-tabs" role="tablist">
        {(['campaign', 'replay', 'sandbox', 'chronicle'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={'ll-tab' + (tab === t ? ' on' : '')} onClick={() => { setTab(t); setPickId(null); setBiome(null); }}>
            {t === 'campaign' ? 'Campaign' : t === 'replay' ? 'Replay' : t === 'sandbox' ? 'Sandbox' : 'Chronicle'}
          </button>
        ))}
      </div>

      {tab === 'campaign' && (
        <>
          <ol className="ll-ribbon" aria-label="Stages">
            {[...index.eras.values()].sort((a, b) => a.index - b.index).map(e => {
              const rows = statuses.filter(s => s.chapter.era === e.index);
              return <li key={e.id} className={rows.some(r => r.unlocked) ? 'open' : ''}><b>{e.name}</b><small>{rows.filter(r => r.completed).length}/{rows.length}</small></li>;
            })}
          </ol>
          <div className="ll-split">
            <ul className="ll-chapters">
              {statuses.map(s => (
                <li key={s.chapter.id}>
                  <button type="button" disabled={!selectable(s)} aria-pressed={chapter?.id === s.chapter.id} className={'ll-chap' + (chapter?.id === s.chapter.id ? ' sel' : '') + (s.completed ? ' done' : '')} onClick={() => choose(s.chapter.id)}>
                    <i>{s.chapter.order}</i><b>{s.chapter.title}</b><small>{s.completed ? 'Completed' : s.unlocked ? (s.chapter.id === next?.id ? 'Next' : 'Open') : 'Locked'}</small>
                  </button>
                </li>
              ))}
            </ul>
            {detail}
          </div>
        </>
      )}

      {tab === 'replay' && (
        <div className="ll-split">
          <ul className="ll-chapters">
            {statuses.filter(s => s.completed).length === 0 && <li className="ll-dim">Complete a chapter to replay it in another environment.</li>}
            {statuses.filter(s => s.completed).map(s => (
              <li key={s.chapter.id}><button type="button" className={'ll-chap' + (chapter?.id === s.chapter.id ? ' sel' : '')} onClick={() => choose(s.chapter.id)}><i>{s.chapter.order}</i><b>{s.chapter.title}</b></button></li>
            ))}
          </ul>
          {statuses.some(s => s.completed) && detail}
        </div>
      )}

      {tab === 'sandbox' && (
        <div className="ll-split">
          <ul className="ll-chapters">
            {sandboxTiers(index, manifest).map(t => (
              <li key={t.era.id}><button type="button" disabled={!t.unlocked || !t.firstChapter} className={'ll-chap' + (chapter?.id === t.firstChapter?.id ? ' sel' : '')} onClick={() => t.firstChapter && choose(t.firstChapter.id)}>
                <i>{t.era.index + 1}</i><b>{t.era.name}</b><small>{t.unlocked ? 'Open' : 'Locked'}</small></button></li>
            ))}
          </ul>
          {detail}
        </div>
      )}

      {tab === 'chronicle' && (
        <section aria-label="Chronicle">
          <p className="ll-dim">Your own record of attempts. Simulated settlements; no rankings.</p>
          {manifest.archives.length === 0 ? <p>No archived attempts yet.</p> : (
            <ul className="ll-archives">
              {manifest.archives.map(a => (
                <li key={a.runId}><b>{a.chapterTitle}</b> · {index.biomes.get(a.biomeId)?.name ?? a.biomeId}{a.mode === 'sandbox' ? ' · sandbox' : ''}<p>{a.headline}</p>
                  {a.mastery.length > 0 && <small>Mastery: {a.mastery.join(', ')}</small>}</li>
              ))}
            </ul>
          )}
          <button type="button" className="ll-btn" onClick={() => exportNow(store)}>Export progress</button>
        </section>
      )}
    </div>
  );
}
