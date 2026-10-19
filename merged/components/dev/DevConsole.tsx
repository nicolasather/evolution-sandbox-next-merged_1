'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { devBridge } from '@/lib/dev/bridge';
import { buildInfo } from '@/lib/dev/env';
import { SPEEDS, cleanSeed, devOverrides, useDevOverrides, type DevOverrides } from '@/lib/dev/overrides';
import { exportSave, importSave, keysOfMode, resetAll, resetMode, restoreBackup } from '@/lib/dev/saves';
import { SCENARIOS, fastForward, runScenario, type Scenario } from '@/lib/dev/scenarios';
import { betaStorageActive } from '@/lib/dev/storageBoot';
import { lifelinesStore } from '@/lib/civilization/lifelines/store';
import { MODES } from '@/lib/modes/registry';
import type { ModeId } from '@/lib/modes/types';
import { TECHNIQUES } from '@/lib/processing/techniques';
import { playDb } from '@/lib/processing';
import type { Discovery, EraId } from '@/lib/types';
import styles from './DevConsole.module.css';

/* ============================================================================
   DEVELOPER CONSOLE — the Developer Beta's control panel.

   Mounted by components/AppRoot.tsx ONLY in a Developer Beta build (the import
   is behind a build-time constant, so a production bundle does not contain this
   file at all). Even in a beta build it does nothing until the server confirms
   (GET /api/dev/status → 200): until then it shows the reason and every switch
   is inert (lib/dev/overrides.ts).

   Vietnamese on purpose: this panel is for the people testing, not for players.
   ========================================================================== */

type Tab = 'state' | 'switch' | 'mode' | 'scenario' | 'content' | 'save' | 'log';
const TABS: [Tab, string][] = [
  ['state', 'Trạng thái'], ['switch', 'Công tắc'], ['mode', 'Mode'], ['scenario', 'Kịch bản'],
  ['content', 'Nội dung'], ['save', 'Save'], ['log', 'Lỗi'],
];

const UI_KEY = 'evo.dev.ui.v1';

interface LogLine { t: number; m: string }

const fmt = (t: number) => new Date(t).toLocaleTimeString('vi-VN', { hour12: false });

function useErrorLog(): [LogLine[], () => void] {
  const [lines, setLines] = useState<LogLine[]>([]);
  useEffect(() => {
    const push = (m: string) => setLines(l => [...l.slice(-49), { t: Date.now(), m: m.slice(0, 400) }]);
    const onError = (e: ErrorEvent) => push(`error: ${e.message}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}`);
    const onRej = (e: PromiseRejectionEvent) => push(`promise: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRej);
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      orig.apply(console, args);
      push('console.error: ' + args.map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRej); console.error = orig; };
  }, []);
  return [lines, () => setLines([])];
}

/** Animation speed: scale every running CSS/Web animation. Visual speed only — not a simulation clock. */
function useAnimationSpeed(speed: number): void {
  useEffect(() => {
    if (speed === 1) return;
    const apply = () => { try { document.getAnimations().forEach(a => { if (a.playbackRate !== speed) a.updatePlaybackRate(speed); }); } catch { /* old browser */ } };
    apply();
    const id = window.setInterval(apply, 250);
    return () => {
      window.clearInterval(id);
      try { document.getAnimations().forEach(a => a.updatePlaybackRate(1)); } catch { /* ignore */ }
    };
  }, [speed]);
}

export default function DevConsole({ mode }: { mode: ModeId }) {
  const ov = useDevOverrides();
  const stored = useSyncExternalStore(devOverrides.subscribe, devOverrides.getStored, devOverrides.getStored);
  const phase = useSyncExternalStore(devOverrides.subscribe, devOverrides.authPhase, () => 'off' as const);
  const [info, setInfo] = useState(() => buildInfo());
  const [hidden, setHidden] = useState(() => { try { return window.localStorage.getItem(UI_KEY) === 'hidden'; } catch { return false; } });
  const [tab, setTab] = useState<Tab>('state');
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);
  const [log, clearLog] = useErrorLog();
  const [armed, setArmed] = useState<string | null>(null);

  const setHiddenSaved = useCallback((v: boolean) => {
    setHidden(v);
    try { window.localStorage.setItem(UI_KEY, v ? 'hidden' : 'shown'); } catch { /* ignore */ }
  }, []);

  /* Alt+Shift+D: show / hide instantly. Exists only while this component is mounted (beta builds). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); setHiddenSaved(!hidden); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidden, setHiddenSaved]);

  /* Ask the server. Nothing is authorised until it says yes. */
  useEffect(() => {
    let alive = true;
    devOverrides.setPhase('checking');
    fetch('/api/dev/status', { cache: 'no-store' })
      .then(async r => {
        if (!alive) return;
        if (r.ok) { setInfo({ ...buildInfo(), ...(await r.json()) }); devOverrides.setPhase('ok'); }
        else devOverrides.setPhase('denied');
      })
      .catch(() => { if (alive) devOverrides.setPhase('error'); });
    return () => { alive = false; };
  }, []);

  useAnimationSpeed(ov.speed);

  /* Light polling so the state tab follows the engine and the campaign. */
  useEffect(() => {
    if (hidden || tab !== 'state') return;
    const id = window.setInterval(() => setTick(t => t + 1), 700);
    return () => window.clearInterval(id);
  }, [hidden, tab]);

  const say = useCallback((m: string) => setMsg(`${fmt(Date.now())} · ${m}`), []);
  const active = phase === 'ok';
  const set = (patch: Partial<DevOverrides>) => devOverrides.set(patch);

  /* ---------- actions ---------- */
  const goMain = useCallback((then: (e: NonNullable<ReturnType<typeof devBridge.getEngine>>) => void) => {
    if (mode !== 'main-evolution') devBridge.launch({ mode: 'main-evolution' });
    devBridge.whenEngine(then);
  }, [mode]);

  const doScenario = (sc: Scenario) => {
    say(`Đang chạy kịch bản "${sc.label}"…`);
    goMain(engine => {
      // let the page paint the message first; the run itself takes a moment
      window.setTimeout(() => {
        const r = runScenario(engine, sc);
        say(`Xong "${sc.label}": +${r.made} phát hiện, tới thời đại ${r.reachedEra}.`);
      }, 30);
    });
  };

  const confirm = (key: string, run: () => void) => {
    if (armed === key) { setArmed(null); run(); } else { setArmed(key); say('Bấm lần nữa để xác nhận.'); }
  };

  const reloadSoon = () => window.setTimeout(() => window.location.reload(), 400);

  /* ---------- tabs ---------- */
  const engine = devBridge.getEngine();
  void tick;
  const stats = engine ? engine.stats() : null;
  const civSnap = lifelinesStore().getSnapshot();
  const nsActive = betaStorageActive();

  const banner = phase === 'ok'
    ? <span className={styles.ok}>máy chủ xác nhận ✓</span>
    : phase === 'checking'
      ? <span className={styles.dim}>đang hỏi máy chủ…</span>
      : <span className={styles.warn}>
        {phase === 'denied' ? 'máy chủ KHÔNG xác nhận (thiếu ENABLE_DEV_TOOLS=true?) — mọi công tắc đang vô hiệu' : 'không liên lạc được máy chủ — mọi công tắc đang vô hiệu'}
      </span>;

  if (hidden) {
    return <button type="button" className={styles.pill} data-dev-console="pill" onClick={() => setHiddenSaved(false)} aria-label="Hiện bảng Developer Beta (Alt+Shift+D)">DEV</button>;
  }

  return (
    <aside className={styles.root} data-dev-console="panel" role="complementary" aria-label="Developer Beta console">
      <div className={styles.head}>
        <span>DEV BETA</span>
        <button type="button" onClick={() => setHiddenSaved(true)} title="Ẩn ngay (Alt+Shift+D để hiện lại)">Ẩn</button>
      </div>
      <div className={styles.tabs} role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setArmed(null); }}>{label}{id === 'log' && log.length > 0 ? ` (${log.length})` : ''}</button>
        ))}
      </div>
      <div className={styles.body}>
        {tab === 'state' && (
          <>
            <dl className={styles.kv}>
              <dt>Môi trường</dt><dd>{info.deployEnv} · nhánh {info.branch} · {info.commit}</dd>
              <dt>Xác thực</dt><dd>{banner}</dd>
              <dt>Mode hiện tại</dt><dd>{mode}</dd>
              <dt>Main Evolution</dt>
              <dd>{stats ? `${stats.core}/${stats.coreTotal} phát hiện · thời đại ${engine!.currentEra().id} · ${engine!.states.size} trạng thái · ${engine!.known.length} kỹ thuật` : 'chưa mở (vào mode này để xem)'}</dd>
              <dt>Civilization</dt>
              <dd>{civSnap.phase !== 'ready' ? 'chưa tải' : `${Object.keys(civSnap.manifest.completions).length}/24 chương hoàn thành · ${civSnap.run ? `đang chơi: ${civSnap.run.chapterId} (mùa ${civSnap.run.turn})` : 'không có run'}`}</dd>
              <dt>Lưu trữ beta</dt><dd>{nsActive ? <span className={styles.ok}>vùng riêng &quot;evo-beta:&quot; ✓</span> : <span className={styles.warn}>KHÔNG hoạt động</span>}</dd>
              <dt>Công tắc</dt><dd>{(Object.entries(ov) as [string, unknown][]).map(([k, v]) => `${k}=${String(v)}`).join(' · ')}</dd>
              <dt>Lỗi</dt><dd>{log.length === 0 ? 'chưa có' : `${log.length} (xem tab Lỗi)`}</dd>
            </dl>
            <p className={styles.dim}>Công tắc chỉ đổi cái gì <b>vào được</b>; không ghi gì vào save, không đánh dấu “đã hoàn thành”.</p>
          </>
        )}

        {tab === 'switch' && (
          <>
            {([
              ['unlockAll', 'Mở khóa mọi mode / view / tính năng'],
              ['chronology', 'Bỏ qua tiến trình thời gian (thời đại, tier, thứ tự chương Civilization)'],
              ['skipIntros', 'Bỏ qua intro / cinematic'],
              ['revealAll', 'Hiện mọi node khám phá để kiểm tra (tab Nội dung)'],
            ] as [keyof DevOverrides, string][]).map(([k, label]) => (
              <div className={styles.row} key={k}>
                <input id={`dv-${k}`} type="checkbox" disabled={!active} checked={Boolean(stored[k])} onChange={e => set({ [k]: e.target.checked } as Partial<DevOverrides>)} />
                <label htmlFor={`dv-${k}`}>{label}</label>
              </div>
            ))}
            <div className={styles.row}>
              <label htmlFor="dv-speed">Tốc độ hoạt ảnh</label>
              <select id="dv-speed" disabled={!active} value={stored.speed} onChange={e => set({ speed: Number(e.target.value) })}>
                {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
              </select>
            </div>
            <p className={styles.dim}>Tốc độ chỉ áp cho hiệu ứng hình ảnh (CSS/Web Animations), không phải đồng hồ mô phỏng.</p>
            <SeedRow disabled={!active} current={stored.seed} onApply={s => { set({ seed: s }); say(s ? `Seed cố định: ${s}` : 'Seed: theo thời gian (bình thường)'); }} />
            <div className={styles.row}><button type="button" className={styles.btn} disabled={!active} onClick={() => { devOverrides.restoreDefaults(); say('Đã khôi phục mặc định beta.'); }}>Khôi phục mặc định beta</button></div>
          </>
        )}

        {tab === 'mode' && <ModeTab mode={mode} active={active} say={say} />}

        {tab === 'scenario' && (
          <>
            <p className={styles.h}>Main Evolution (chơi thật bằng engine)</p>
            {SCENARIOS.map(sc => (
              <div className={styles.row} key={sc.id}>
                <button type="button" className={styles.btn} disabled={!active} onClick={() => confirm(`sc-${sc.id}`, () => doScenario(sc))}>
                  {armed === `sc-${sc.id}` ? 'Xác nhận: ' : ''}{sc.label}
                </button>
                <span className={styles.dim}>{sc.description}</span>
              </div>
            ))}
            <p className={styles.dim}>Mỗi kịch bản bắt đầu từ game mới (xóa save Main Evolution của beta). Cần bật “bỏ qua tiến trình” — kịch bản tự bật tạm thời khi chạy.</p>
            <CivSeed active={active} say={say} />
          </>
        )}

        {tab === 'content' && <ContentTab active={active} revealAll={ov.revealAll} say={say} goMain={goMain} />}

        {tab === 'save' && (
          <>
            <p className={styles.h}>Save beta {nsActive ? '' : '(vùng riêng KHÔNG hoạt động: các nút phá hủy bị khóa)'}</p>
            <div className={styles.row}>
              <button type="button" className={styles.btn} onClick={() => {
                const blob = new Blob([exportSave()], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `evolution-sandbox-beta-save-${new Date().toISOString().slice(0, 10)}.json`;
                a.click(); URL.revokeObjectURL(a.href);
                say('Đã xuất save.');
              }}>Xuất save</button>
              <label className={styles.btn} style={{ cursor: 'pointer' }}>
                Nhập save…
                <input type="file" accept="application/json,.json" hidden disabled={!active || !nsActive} onChange={async e => {
                  const f = e.target.files?.[0]; e.target.value = '';
                  if (!f) return;
                  const r = importSave(await f.text());
                  if (r.ok) { say(`${r.detail} Đang tải lại…`); reloadSoon(); } else say(r.error);
                }} />
              </label>
              <button type="button" className={styles.btn} disabled={!active || !nsActive} onClick={() => { const r = restoreBackup(); if (r.ok) { say(`${r.detail} Đang tải lại…`); reloadSoon(); } else say(r.error); }}>Khôi phục bản sao lưu</button>
            </div>
            <div className={styles.row}>
              <button type="button" className={`${styles.btn} ${styles.danger}`} disabled={!active || !nsActive} onClick={() => confirm('reset-all', () => { const r = resetAll(); if (r.ok) { say(`${r.detail} Đang tải lại…`); reloadSoon(); } else say(r.error); })}>
                {armed === 'reset-all' ? 'Xác nhận: xóa TOÀN BỘ save beta' : 'Reset toàn bộ save beta'}
              </button>
            </div>
            <p className={styles.h}>Reset từng mode</p>
            {MODES.filter(m => m.status === 'available').map(m => (
              <div className={styles.row} key={m.id}>
                <button type="button" className={`${styles.btn} ${styles.danger}`} disabled={!active || !nsActive} onClick={() => confirm(`reset-${m.id}`, () => { const r = resetMode(m.id); if (r.ok) { say(`${r.detail} Đang tải lại…`); reloadSoon(); } else say(r.error); })}>
                  {armed === `reset-${m.id}` ? 'Xác nhận' : 'Reset'}
                </button>
                <span>{m.title}</span><span className={styles.dim}>{keysOfMode(m.id).length} mục</span>
              </div>
            ))}
            <p className={styles.dim}>Trước mỗi lần xóa/nhập, save hiện tại được giữ trong một ô sao lưu (nút “Khôi phục bản sao lưu”).</p>
          </>
        )}

        {tab === 'log' && (
          <>
            <div className={styles.row}><button type="button" className={styles.btn} onClick={clearLog}>Xóa nhật ký</button></div>
            <div className={styles.log}>{log.length === 0 ? 'Chưa ghi nhận lỗi nào.' : log.map(l => `${fmt(l.t)}  ${l.m}`).join('\n')}</div>
          </>
        )}

        {msg && <div className={styles.msg} role="status">{msg}</div>}
      </div>
    </aside>
  );
}


function SeedRow({ current, disabled, onApply }: { current: string; disabled: boolean; onApply: (s: string) => void }) {
  const [v, setV] = useState(current);
  const bad = v !== '' && cleanSeed(v) === '';
  return (
    <div className={styles.row}>
      <label htmlFor="dv-seed">Seed cố định</label>
      <input id="dv-seed" type="text" size={12} placeholder="vd: test1" value={v} disabled={disabled} onChange={e => setV(e.target.value)} />
      <button type="button" className={styles.btn} disabled={disabled || bad} onClick={() => onApply(cleanSeed(v))}>Áp dụng</button>
      {bad && <span className={styles.warn}>chỉ chữ, số, - và _ (tối đa 40)</span>}
      <span className={styles.dim}>Áp cho lần bắt đầu run MỚI của Survival, Archaeologist, Decipher, Alien, Reverse.</span>
    </div>
  );
}

function ModeTab({ mode, active, say }: { mode: ModeId; active: boolean; say: (m: string) => void }) {
  const [chapters, setChapters] = useState<{ id: string; label: string }[]>([]);
  const [chapter, setChapter] = useState('');
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !active) return;
    loaded.current = true;
    const store = lifelinesStore();
    void store.init().then(() => {
      const idx = store.getSnapshot().index;
      if (!idx) return;
      const list = idx.chaptersByOrder.map(c => ({ id: c.id, label: `${c.order}. ${c.title} (${idx.eras.get(c.era)?.name ?? c.era})` }));
      setChapters(list);
      setChapter(list[0]?.id ?? '');
    });
  }, [active]);

  return (
    <>
      <p className={styles.h}>Vào thẳng một mode (lấy từ registry thật)</p>
      {MODES.map(m => (
        <div className={styles.row} key={m.id}>
          <button type="button" className={styles.btn} disabled={!active || m.status !== 'available'} onClick={() => { devBridge.launch({ mode: m.id }); say(`Vào ${m.title}.`); }}>
            {mode === m.id ? '● ' : ''}{m.title}
          </button>
          {m.status !== 'available' && <span className={styles.dim}>chưa có giao diện</span>}
        </div>
      ))}
      <p className={styles.h}>Civilization — vào thẳng chương ({chapters.length} chương)</p>
      <div className={styles.row}>
        <select value={chapter} disabled={!active || chapters.length === 0} onChange={e => setChapter(e.target.value)} aria-label="Chương Civilization">
          {chapters.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button type="button" className={styles.btn} disabled={!active || !chapter} onClick={() => {
          devBridge.launch({ mode: 'civilization', civChapterId: chapter });
          say('Bắt đầu chương mới (run đang chơi, nếu có, được sao lưu).');
        }}>Vào chương</button>
      </div>
      <p className={styles.dim}>Không đánh dấu chương trước là đã hoàn thành. Hoàn thành chương này bằng chơi thật mới ghi nhận.</p>
    </>
  );
}

function CivSeed({ active, say }: { active: boolean; say: (m: string) => void }) {
  const [n, setN] = useState(12);
  return (
    <>
      <p className={styles.h}>Civilization (bản ghi hoàn thành)</p>
      <div className={styles.row}>
        <label htmlFor="dv-civn">Đánh dấu hoàn thành</label>
        <input id="dv-civn" type="number" min={0} max={24} value={n} onChange={e => setN(Math.max(0, Math.min(24, Number(e.target.value) || 0)))} style={{ width: 54 }} />
        <span>chương đầu</span>
        <button type="button" className={styles.btn} disabled={!active} onClick={async () => {
          const store = lifelinesStore();
          await store.reopen();
          const idx = store.getSnapshot().index;
          if (!idx) { say('Chưa tải được nội dung Civilization.'); return; }
          const added = store.devSeedCompletions(idx.chaptersByOrder.slice(0, n).map(c => c.id));
          say(`Đã ghi ${added} hoàn thành mới (gắn nhãn dev-scenario).`);
        }}>Ghi</button>
      </div>
      <p className={styles.dim}>Bản ghi này khác bản ghi chơi thật: runId = “dev-scenario”.</p>
    </>
  );
}

const ERA_OPTIONS: EraId[] = playDb.eras.map(e => e.id);

function ContentTab({ active, revealAll, say, goMain }: {
  active: boolean; revealAll: boolean; say: (m: string) => void;
  goMain: (then: (e: NonNullable<ReturnType<typeof devBridge.getEngine>>) => void) => void;
}) {
  const [q, setQ] = useState('');
  const [tech, setTech] = useState<string>(TECHNIQUES[0]?.id ?? '');
  const [era, setEra] = useState<EraId>(ERA_OPTIONS[1] ?? ERA_OPTIONS[0]);
  const [pick, setPick] = useState<Discovery | null>(null);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return [...playDb.nodes, ...(playDb.states ?? [])].filter(n => n.id.includes(s) || n.n.toLowerCase().includes(s)).slice(0, 40);
  }, [q]);

  return (
    <>
      <p className={styles.h}>Cấp phát hiện / vật liệu</p>
      <div className={styles.row}><input type="text" placeholder="tìm theo tên hoặc id" value={q} onChange={e => setQ(e.target.value)} /></div>
      {hits.length > 0 && (
        <ul className={styles.list}>
          {hits.map(n => (
            <li key={n.id}>
              <button type="button" className={styles.btn} style={{ flex: 1, textAlign: 'left' }} onClick={() => setPick(n)} disabled={!revealAll} title={revealAll ? 'Xem chi tiết' : 'Bật “Hiện mọi node” để xem chi tiết'}>
                #{n.no} {n.n}
              </button>
              <button type="button" className={styles.btn} disabled={!active} onClick={() => goMain(e => { const c = e.devGrant([n.id]); say(c ? `Đã cấp ${n.n}.` : `${n.n}: đã có sẵn.`); })}>Cấp</button>
            </li>
          ))}
        </ul>
      )}
      {revealAll && pick && (
        <dl className={styles.kv} aria-label="Chi tiết node">
          <dt>id</dt><dd>{pick.id}</dd>
          <dt>thời đại</dt><dd>{pick.era} · {pick.date}</dd>
          <dt>loại</dt><dd>{pick.cat} · {pick.rar}{pick.hidden ? ' · ẩn' : ''}{pick.state ? ' · trạng thái' : ''}{pick.stone_age_tier ? ` · tier ${pick.stone_age_tier}` : ''}</dd>
          <dt>công thức</dt><dd>{(pick.rec ?? []).map(r => r.map(i => playDb.nodes.find(x => x.id === i)?.n ?? i).join(' + ')).join('  |  ') || '—'}</dd>
          <dt>cách gia công</dt><dd>{(pick.via ?? []).map(v => `${v.from} →${v.action}`).join(', ') || '—'}</dd>
          <dt>dùng cho</dt><dd>{(pick.uses ?? []).length} node</dd>
        </dl>
      )}
      {!revealAll && hits.length > 0 && <p className={styles.dim}>Chi tiết node: bật “Hiện mọi node khám phá” ở tab Công tắc.</p>}
      <div className={styles.row}>
        <button type="button" className={`${styles.btn} ${styles.danger}`} disabled={!active} onClick={() => goMain(e => {
          const n = e.devGrant([...playDb.nodes, ...(playDb.states ?? [])].map(x => x.id));
          say(`Đã cấp ${n} mục (không có bước công thức).`);
        })}>Cấp TẤT CẢ phát hiện</button>
      </div>

      <p className={styles.h}>Kỹ thuật</p>
      <div className={styles.row}>
        <select value={tech} onChange={e => setTech(e.target.value)} aria-label="Kỹ thuật">
          {TECHNIQUES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button type="button" className={styles.btn} disabled={!active} onClick={() => goMain(e => say(e.devGrantTechnique(tech as never) ? 'Đã cấp kỹ thuật.' : 'Đã biết sẵn.'))}>Cấp</button>
        <button type="button" className={styles.btn} disabled={!active} onClick={() => goMain(e => say(`Đã cấp ${TECHNIQUES.filter(t => e.devGrantTechnique(t.id)).length} kỹ thuật.`))}>Cấp tất cả</button>
      </div>

      <p className={styles.h}>Tua nhanh (không xóa save)</p>
      <div className={styles.row}>
        <select value={era} onChange={e => setEra(e.target.value as EraId)} aria-label="Thời đại">
          {ERA_OPTIONS.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
        <button type="button" className={styles.btn} disabled={!active} onClick={() => goMain(e => {
          const r = fastForward(e, era);
          say(`+${r.made} phát hiện, thời đại cao nhất: ${r.reachedEra}.`);
        })}>Tua tới hết thời đại</button>
      </div>
      <p className={styles.dim}>Tua dùng công thức thật của game nên mỗi phát hiện đều có bước công thức.</p>
    </>
  );
}
