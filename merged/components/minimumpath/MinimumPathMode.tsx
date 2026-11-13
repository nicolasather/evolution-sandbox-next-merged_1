'use client';
import { useEffect, useState } from 'react';
import { emitCrew } from '@/lib/characters/bus';
import { GuideCallout, GuideLive, GuideScope, useGuideController } from '@/components/guide/GuideProvider';
import { ModeBackdrop } from '@/components/ModeBackdrop';
import { ModeStage } from '@/components/ModeStage';
import { MINPATH_MODE, MP_TARGET, minimumPathGuide } from '@/lib/guide/minimumpath';
import { content, graph } from '@/lib/minimumpath/content';
import { evidence, isComplete, move, neighbors, recordResult, shortest, startRun } from '@/lib/minimumpath/engine';
import { DEFAULT_LANG, LANG_KEY, parseLang, t, type Lang } from '@/lib/minimumpath/i18n';
import { localize } from '@/lib/minimumpath/contentText';
import { decode, fresh, load, SAVE_KEY, write } from '@/lib/minimumpath/save';
import type { Save } from '@/lib/minimumpath/types';
import styles from './MinimumPathMode.module.css';

function readLang(): Lang {
  try { return parseLang(window.localStorage.getItem(LANG_KEY)); } catch { return DEFAULT_LANG; }
}

export function MinimumPathMode({ onExit }: { onExit: () => void }) {
  const [lang, setLangState] = useState<Lang>(() => readLang());
  const [save, setSave] = useState<Save>(() => fresh(content));
  const [opened, setOpened] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [memoryOnly, setMemoryOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [rawBackup, setRawBackup] = useState('');
  const [transfer, setTransfer] = useState('');
  const [chapterId, setChapterId] = useState(content.chapters[0].id);
  const [selected, setSelected] = useState(content.missions[0].id);
  const [query, setQuery] = useState('');
  const [hint, setHint] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => { emitCrew('minimum-path', 'minpath-enter'); }, []);
  const T = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) => t(lang, key, vars);
  function setLang(next: Lang) {
    setLangState(next);
    try { window.localStorage.setItem(LANG_KEY, next); } catch { /* private mode: this visit only */ }
  }
  const mission = content.missions.find(m => m.id === save.run?.missionId);
  const run = save.run;
  const done = Boolean(mission && run && isComplete(mission, run.path));
  const name = (id: string) => graph.items.get(id)?.name ?? id;
  const completedIds = new Set(save.records.map(record => record.missionId));
  const current = run?.path.at(-1) ?? '';
  const options = mission && !done ? neighbors(graph, mission, current) : [];
  const visible = options.filter(id => `${name(id)} ${id}`.toLowerCase().includes(query.toLowerCase()));
  const solution = showSolution && mission ? shortest(graph, mission) : null;
  const mg = minimumPathGuide({ opened, hasRun: Boolean(mission && run), done, steps: run ? run.path.length - 1 : 0, otherCompletions: save.records.filter(r => r.missionId !== run?.missionId).length }, lang);
  const guide = useGuideController({ mode: MINPATH_MODE, eligible: mg.eligible, step: mg.step, finished: mg.finished });
  function open() {
    let result;
    try { result = load(window.localStorage, content, graph); }
    catch { result = { kind: 'unavailable' as const, raw: null }; }
    if (result.kind === 'ok') {
      setSave(result.save); setToken(result.token);
      const active = content.missions.find(m => m.id === result.save.run?.missionId);
      if (active) { setSelected(active.id); setChapterId(active.chapter); }
      setMemoryOnly(!navigator.locks);
      setStatus(navigator.locks ? T('loaded') : T('noLocks'));
    } else {
      setMemoryOnly(true); setRawBackup(result.raw ?? '');
      setStatus(result.kind === 'invalid' ? T('invalidSave') : T('storageDown'));
    }
    setOpened(true); setHint(''); setShowSolution(false);
    emitCrew('minimum-path', 'minpath-open-run');
  }
  async function commit(next: Save) {
    setSave(next);
    if (memoryOnly) { setStatus(T('sessionOnly')); return; }
    setBusy(true);
    try {
      if (!navigator.locks) { setMemoryOnly(true); setStatus(T('noLockSave')); return; }
      const result = await navigator.locks.request(SAVE_KEY, () => write(window.localStorage, next, token));
      if (result.kind === 'ok') { setToken(result.token); setStatus(T('saved')); }
      else {
        setMemoryOnly(true);
        setStatus(result.kind === 'conflict' ? T('conflict') : T('saveFailed'));
      }
    } catch { setMemoryOnly(true); setStatus(T('saveFailedExit')); }
    finally { setBusy(false); }
  }
  function begin() {
    const next = content.missions.find(m => m.id === selected);
    if (!next) return;
    setQuery(''); setHint(''); setShowSolution(false);
    void commit({ ...save, run: startRun(next) });
  }
  function step(id: string) {
    if (!run || !mission) return;
    const next = move(graph, mission, run, id, content.limits.maxPath);
    // the graph logic's own verdict on the path so far
    emitCrew('minimum-path', 'minpath-node-choose');
    if (isComplete(mission, next.path)) {
      emitCrew('minimum-path', 'minpath-mission-complete');
      if (next.path.length - 1 === mission.optimal) emitCrew('minimum-path', 'minpath-optimal-path');
    }
    setHint(''); setQuery('');
    void commit(recordResult({ ...save, run: next }, mission));
  }
  function requestHint() {
    if (!mission || !run || done) return;
    emitCrew('minimum-path', 'minpath-hint-request');
    const route = shortest(graph, mission, run.path);
    setHint(route?.[1] ? T('hintRoute', { next: name(route[1]), steps: route.length - 1 }) : T('hintDead'));
    void commit({ ...save, run: { ...run, assisted: true } });
  }
  function importSave() {
    const imported = decode(transfer, content, graph);
    if (!imported) { setStatus(T('importBad')); return; }
    setHint(''); setShowSolution(false); setQuery('');
    const active = content.missions.find(m => m.id === imported.run?.missionId);
    if (active) { setSelected(active.id); setChapterId(active.chapter); }
    void commit(imported);
  }
  return <GuideScope value={guide}><main className={styles.root} data-motion={save.settings.motion} lang={lang} style={{ fontSize: `${save.settings.textScale}em` }}>
    <ModeBackdrop mode="minimum-path" />
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{T('eyebrow')}</p><h1>{T('title')}</h1></div>
      <div>
        <button type="button" aria-pressed={lang === 'vi'} onClick={() => setLang(lang === 'en' ? 'vi' : 'en')}>{T('switchTo')}</button>
        <button type="button" disabled={busy} onClick={onExit}>{T('exit')}</button>
      </div>
    </header>
    <ModeStage mode="minimum-path" title={T('stageTitle')} caption={T('stageCaption')} />
    <GuideLive />
    {!opened ? <section className={styles.intro}>
      <h2>{T('introTitle')}</h2><p>{T('introBody')}</p>
      <p>{localize(lang, content.source.note)}</p><GuideCallout target={MP_TARGET.open} /><button type="button" className={guide.glow(MP_TARGET.open)} onClick={open}>{T('start')}</button>
    </section> : <>
      <p role="status" className={styles.status}>{busy ? T('saving') : status}</p>
      <fieldset disabled={busy} className={styles.controls}>
        <legend>{T('journey', { done: completedIds.size, total: content.missions.length })}</legend>
        <label>{T('chapter')}<select value={chapterId} onChange={event => {
          const id = event.target.value; emitCrew('minimum-path', 'minpath-chapter-select'); setChapterId(id);
          const first = content.missions.find(m => m.chapter === id); if (first) setSelected(first.id);
        }}>{content.chapters.map(chapter => <option value={chapter.id} key={chapter.id}>{localize(lang, chapter.title)}</option>)}</select></label>
        <label>{T('mission')}<select value={selected} onChange={event => { emitCrew('minimum-path', 'minpath-mission-select'); setSelected(event.target.value); }}>
          {content.missions.filter(m => m.chapter === chapterId).map(m => <option value={m.id} key={m.id}>{completedIds.has(m.id) ? '✓ ' : ''}{m.id} · {m.title}</option>)}
        </select></label>
        <GuideCallout target={MP_TARGET.begin} />
        <button type="button" className={guide.glow(MP_TARGET.begin)} onClick={begin}>{run ? T('startSelectedNew') : T('startSelected')}</button>
        <p>{localize(lang, content.chapters.find(chapter => chapter.id === chapterId)?.lesson ?? '')}</p>
      </fieldset>
      {mission && run && <section className={styles.board} aria-label={T('title')}>
        <p className={styles.eyebrow}>{mission.id} / {mission.direction === 'forward' ? T('kindForward') : T('kindTwoWay')}</p>
        <h2>{name(mission.start)} <span>→</span> {name(mission.target)}</h2>
        <p>{localize(lang, mission.briefing)}</p>
        <p>{T('mustPass')}: {mission.via.map(id => `${run.path.includes(id) ? '✓ ' : ''}${name(id)}`).join(' · ') || T('none')} | {T('forbidden')}: {mission.blocked.map(name).join(' · ') || T('none')}</p>
        <div className={styles.metrics}><strong>{run.path.length - 1} {T('steps')}</strong><span>{run.assisted ? T('assisted') : T('solo')}</span><span>{done ? T('complete') : T('current', { name: name(current) })}</span></div>
        <ol className={styles.path} aria-label={T('route')}>{run.path.map((id, i) => <li key={`${i}:${id}`}>{name(id)}</li>)}</ol>
        {!done && <>
          <label>{T('findNext')}<input value={query} onChange={event => setQuery(event.target.value)} placeholder={T('discoveryName')} /></label>
          <GuideCallout target={MP_TARGET.neighbors} />
          <div className={`${styles.neighbors} ${guide.glow(MP_TARGET.neighbors)}`.trim()}>{visible.map(id => <article key={id}>
            <button disabled={busy || run.path.length >= content.limits.maxPath} type="button" onClick={() => step(id)} aria-label={T('goTo', { name: name(id) })}>
              <span aria-hidden="true">↗</span> {save.settings.showNames ? name(id) : id}
            </button>
            <details><summary>{T('why')}</summary><ul>{evidence(graph, current, id).map(line => <li key={line}>{line}</li>)}</ul><p>{T('whyNote')}</p></details>
          </article>)}</div>
          {!visible.length && <p>{options.length ? T('noMatch') : T('noExit')}</p>}
          {run.path.length >= content.limits.maxPath && <p>{T('moveLimit')}</p>}
          <div className={styles.actions}>
            <button type="button" disabled={busy || run.path.length <= 1} onClick={() => { emitCrew('minimum-path', 'minpath-path-backtrack'); setHint(''); void commit({ ...save, run: { ...run, path: run.path.slice(0, -1), assisted: true } }); }}>{T('back')}</button>
            <button type="button" disabled={busy} onClick={requestHint}>{T('hint')}</button>
          </div><p aria-live="polite">{hint}</p>
        </>}
        {done && <div className={styles.result} role="status">
          <h3>{run.path.length - 1 === mission.optimal ? T('found') : T('reached')}</h3>
          <p>{T('scores', { yours: run.path.length - 1, optimal: mission.optimal, extra: run.path.length - 1 - mission.optimal })}</p>
          <button type="button" onClick={() => { if (!showSolution) emitCrew('minimum-path', 'minpath-solution-open'); setShowSolution(!showSolution); }}>{T('compare')}</button>
          {solution && <p>{solution.map(name).join(' → ')}</p>}
          <p>{T('otherOk')}</p>
        </div>}
      </section>}
      <details className={styles.panel}><summary>{T('records', { count: completedIds.size })}</summary>
        <ul>{save.records.map(record => <li key={`${record.missionId}:${record.assisted}`}>{record.missionId} · {record.path.length - 1} {T('steps')} · {record.assisted ? T('assisted') : T('solo')}</li>)}</ul>
      </details>
      <details className={styles.panel}><summary>{T('settings')}</summary>
        <fieldset disabled={busy} className={styles.controls}><legend>{T('displayOptions')}</legend>
          <label><input type="checkbox" checked={save.settings.showNames} onChange={event => void commit({ ...save, settings: { ...save.settings, showNames: event.target.checked } })} />{T('showNames')}</label>
          <label><input type="checkbox" checked={save.settings.motion} onChange={event => void commit({ ...save, settings: { ...save.settings, motion: event.target.checked } })} />{T('motion')}</label>
          <label>{T('textSize')}<input type="range" min={content.limits.minScale} max={content.limits.maxScale} step={content.limits.scaleStep} value={save.settings.textScale}
            onChange={event => void commit({ ...save, settings: { ...save.settings, textScale: Number(event.target.value) } })} /></label>
          <button type="button" onClick={() => { setTransfer(JSON.stringify(save, null, 2)); setStatus(T('exported')); }}>{T('exportSave')}</button>
          <label>{T('saveJson')}<textarea value={transfer} onChange={event => setTransfer(event.target.value)} /></label>
          <button type="button" onClick={importSave}>{T('importSave')}</button>
        </fieldset>
        {rawBackup && <label>{T('brokenSave')}<textarea readOnly value={rawBackup} /></label>}
      </details>
      <button type="button" aria-expanded={help} onClick={() => setHelp(!help)}>{T('howTo')}</button>
      {help && <section className={styles.panel}><p>{T('howTo1')}</p>
        <p>{T('howTo2')}</p>
        <p>{T('howTo3')}</p>
        <p>{localize(lang, content.source.note)}</p><p>{T('snapshot')}: <code>{content.source.commit}</code></p>
      </section>}
    </>}
  </main></GuideScope>;
}
