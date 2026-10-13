'use client';
import { useState } from 'react';
import { GuideHint, GuideScope, useGuideController } from '@/components/guide/GuideProvider';
import { MINPATH_MODE, MP_TARGET, minimumPathGuide } from '@/lib/guide/minimumpath';
import { content, graph } from '@/lib/minimumpath/content';
import { evidence, isComplete, move, neighbors, recordResult, shortest, startRun } from '@/lib/minimumpath/engine';
import { decode, fresh, load, SAVE_KEY, write } from '@/lib/minimumpath/save';
import type { Save } from '@/lib/minimumpath/types';
import styles from './MinimumPathMode.module.css';
export function MinimumPathMode({ onExit }: { onExit: () => void }) {
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
  const mission = content.missions.find(m => m.id === save.run?.missionId);
  const run = save.run;
  const done = Boolean(mission && run && isComplete(mission, run.path));
  const name = (id: string) => graph.items.get(id)?.name ?? id;
  const completedIds = new Set(save.records.map(record => record.missionId));
  const current = run?.path.at(-1) ?? '';
  const options = mission && !done ? neighbors(graph, mission, current) : [];
  const visible = options.filter(id => `${name(id)} ${id}`.toLowerCase().includes(query.toLowerCase()));
  const solution = showSolution && mission ? shortest(graph, mission) : null;
  const mg = minimumPathGuide({ opened, hasRun: Boolean(mission && run), done, steps: run ? run.path.length - 1 : 0, otherCompletions: save.records.filter(r => r.missionId !== run?.missionId).length });
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
      setStatus(navigator.locks ? 'Đã tải. Tự lưu sau mỗi thao tác.' : 'Trình duyệt thiếu khóa lưu: chỉ giữ trong phiên; hãy xuất bản lưu.');
    } else {
      setMemoryOnly(true); setRawBackup(result.raw ?? '');
      setStatus(result.kind === 'invalid' ? 'Bản lưu không tương thích hoặc bị lỗi. Đã giữ nguyên; phiên này không ghi đè.' : 'Không truy cập được bộ nhớ. Phiên này chỉ lưu tạm.');
    }
    setOpened(true); setHint(''); setShowSolution(false);
  }
  async function commit(next: Save) {
    setSave(next);
    if (memoryOnly) { setStatus('Chỉ giữ trong phiên. Dùng Xuất bản lưu để giữ tiến độ.'); return; }
    setBusy(true);
    try {
      if (!navigator.locks) { setMemoryOnly(true); setStatus('Không có khóa lưu. Hãy xuất tiến độ.'); return; }
      const result = await navigator.locks.request(SAVE_KEY, () => write(window.localStorage, next, token));
      if (result.kind === 'ok') { setToken(result.token); setStatus('Đã lưu.'); }
      else {
        setMemoryOnly(true);
        setStatus(result.kind === 'conflict' ? 'Tab khác đã thay đổi bản lưu. Dừng ghi; xuất tiến độ này rồi mở lại mode để đọc bản mới.' : 'Không lưu được. Tiến độ còn trong phiên; hãy xuất bản lưu.');
      }
    } catch { setMemoryOnly(true); setStatus('Không lưu được. Hãy xuất tiến độ trước khi thoát.'); }
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
    setHint(''); setQuery('');
    void commit(recordResult({ ...save, run: next }, mission));
  }
  function requestHint() {
    if (!mission || !run || done) return;
    const route = shortest(graph, mission, run.path);
    setHint(route?.[1] ? `Thử đi tới ${name(route[1])}. Còn ${route.length - 1} bước tối thiểu từ đây.` : 'Nhánh này không tới đích được theo điều kiện hiện tại. Quay lại một bước.');
    void commit({ ...save, run: { ...run, assisted: true } });
  }
  function importSave() {
    const imported = decode(transfer, content, graph);
    if (!imported) { setStatus('Không nhập: bản lưu sai cấu trúc, phiên bản hoặc đường đi.'); return; }
    setHint(''); setShowSolution(false); setQuery('');
    const active = content.missions.find(m => m.id === imported.run?.missionId);
    if (active) { setSelected(active.id); setChapterId(active.chapter); }
    void commit(imported);
  }
  return <GuideScope value={guide}><main className={styles.root} data-motion={save.settings.motion} style={{ fontSize: `${save.settings.textScale}em` }}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>EXTRA MODE / ATLAS</p><h1>Minimum Path</h1></div>
      <button type="button" disabled={busy} onClick={onExit}>Thoát mode</button>
    </header>
    <GuideHint />
    {!opened ? <section className={styles.intro}>
      <h2>Mỗi ý tưởng mở một lối đi.</h2><p>Tìm đường ngắn nhất giữa hai phát minh qua mạng công thức trong game.</p>
      <p>{content.source.note}</p><button type="button" className={guide.glow(MP_TARGET.open)} onClick={open}>Bắt đầu / Tiếp tục</button>
    </section> : <>
      <p role="status" className={styles.status}>{busy ? 'Đang lưu…' : status}</p>
      <fieldset disabled={busy} className={styles.controls}>
        <legend>Hành trình · {completedIds.size}/{content.missions.length} màn hoàn thành</legend>
        <label>Chương<select value={chapterId} onChange={event => {
          const id = event.target.value; setChapterId(id);
          const first = content.missions.find(m => m.chapter === id); if (first) setSelected(first.id);
        }}>{content.chapters.map(chapter => <option value={chapter.id} key={chapter.id}>{chapter.title}</option>)}</select></label>
        <label>Màn<select value={selected} onChange={event => setSelected(event.target.value)}>
          {content.missions.filter(m => m.chapter === chapterId).map(m => <option value={m.id} key={m.id}>{completedIds.has(m.id) ? '✓ ' : ''}{m.id} · {m.title}</option>)}
        </select></label>
        <button type="button" className={guide.glow(MP_TARGET.begin)} onClick={begin}>{run ? 'Bắt đầu màn đã chọn · thay lượt hiện tại' : 'Bắt đầu màn đã chọn'}</button>
        <p>{content.chapters.find(chapter => chapter.id === chapterId)?.lesson}</p>
      </fieldset>
      {mission && run && <section className={styles.board} aria-label="Bàn chơi">
        <p className={styles.eyebrow}>{mission.id} / {mission.direction === 'forward' ? 'NGUYÊN LIỆU → KẾT QUẢ' : 'LIÊN KẾT HAI CHIỀU'}</p>
        <h2>{name(mission.start)} <span>→</span> {name(mission.target)}</h2>
        <p>{mission.briefing}</p>
        <p>Phải qua: {mission.via.map(id => `${run.path.includes(id) ? '✓ ' : ''}${name(id)}`).join(' · ') || 'Không có'} | Cấm: {mission.blocked.map(name).join(' · ') || 'Không có'}</p>
        <div className={styles.metrics}><strong>{run.path.length - 1} bước</strong><span>{run.assisted ? 'Có hỗ trợ' : 'Tự giải'}</span><span>{done ? 'HOÀN THÀNH' : `Hiện tại: ${name(current)}`}</span></div>
        <ol className={styles.path} aria-label="Đường đã đi">{run.path.map((id, i) => <li key={`${i}:${id}`}>{name(id)}</li>)}</ol>
        {!done && <>
          <label>Tìm bước tiếp theo<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên phát minh" /></label>
          <div className={`${styles.neighbors} ${guide.glow(MP_TARGET.neighbors)}`.trim()}>{visible.map(id => <article key={id}>
            <button disabled={busy || run.path.length >= content.limits.maxPath} type="button" onClick={() => step(id)} aria-label={`Đi tới ${name(id)}`}>
              <span aria-hidden="true">↗</span> {save.settings.showNames ? name(id) : id}
            </button>
            <details><summary>Vì sao có liên kết?</summary><ul>{evidence(graph, current, id).map(line => <li key={line}>{line}</li>)}</ul><p>Công thức game; tính đúng lịch sử: chưa kiểm chứng.</p></details>
          </article>)}</div>
          {!visible.length && <p>{options.length ? 'Không khớp từ tìm kiếm.' : 'Không có lối ra hợp lệ. Hãy quay lại.'}</p>}
          {run.path.length >= content.limits.maxPath && <p>Đã chạm giới hạn lượt đi. Quay lại hoặc bắt đầu lại màn.</p>}
          <div className={styles.actions}>
            <button type="button" disabled={busy || run.path.length <= 1} onClick={() => { setHint(''); void commit({ ...save, run: { ...run, path: run.path.slice(0, -1), assisted: true } }); }}>Quay lại một bước</button>
            <button type="button" disabled={busy} onClick={requestHint}>Gợi ý bước tiếp theo</button>
          </div><p aria-live="polite">{hint}</p>
        </>}
        {done && <div className={styles.result} role="status">
          <h3>{run.path.length - 1 === mission.optimal ? 'Đã tìm đường tối ưu' : 'Đã đến đích'}</h3>
          <p>Của bạn: {run.path.length - 1} · Tối ưu: {mission.optimal} · Dư: {run.path.length - 1 - mission.optimal} bước.</p>
          <button type="button" onClick={() => setShowSolution(!showSolution)}>So sánh lời giải</button>
          {solution && <p>{solution.map(name).join(' → ')}</p>}
          <p>Lời giải khác có cùng số bước vẫn được công nhận.</p>
        </div>}
      </section>}
      <details className={styles.panel}><summary>Thành tích ({completedIds.size} màn)</summary>
        <ul>{save.records.map(record => <li key={`${record.missionId}:${record.assisted}`}>{record.missionId} · {record.path.length - 1} bước · {record.assisted ? 'Có hỗ trợ' : 'Tự giải'}</li>)}</ul>
      </details>
      <details className={styles.panel}><summary>Cài đặt & bản lưu</summary>
        <fieldset disabled={busy} className={styles.controls}><legend>Tùy chỉnh giao diện</legend>
          <label><input type="checkbox" checked={save.settings.showNames} onChange={event => void commit({ ...save, settings: { ...save.settings, showNames: event.target.checked } })} />Hiện tên thay mã</label>
          <label><input type="checkbox" checked={save.settings.motion} onChange={event => void commit({ ...save, settings: { ...save.settings, motion: event.target.checked } })} />Chuyển động</label>
          <label>Cỡ chữ<input type="range" min={content.limits.minScale} max={content.limits.maxScale} step={content.limits.scaleStep} value={save.settings.textScale}
            onChange={event => void commit({ ...save, settings: { ...save.settings, textScale: Number(event.target.value) } })} /></label>
          <button type="button" onClick={() => { setTransfer(JSON.stringify(save, null, 2)); setStatus('Đã xuất vào ô bên dưới. Chọn và sao chép toàn bộ để lưu.'); }}>Xuất bản lưu</button>
          <label>Bản lưu JSON<textarea value={transfer} onChange={event => setTransfer(event.target.value)} /></label>
          <button type="button" onClick={importSave}>Nhập bản lưu · thay tiến độ hiện tại</button>
        </fieldset>
        {rawBackup && <label>Bản lỗi được giữ nguyên · sao chép để khôi phục<textarea readOnly value={rawBackup} /></label>}
      </details>
      <button type="button" aria-expanded={help} onClick={() => setHelp(!help)}>Cách chơi & nguồn dữ liệu</button>
      {help && <section className={styles.panel}><p>Chọn chương và màn, rồi chọn một phát minh liền kề. Mỗi bước tính một cạnh. Điểm bắt buộc có thể đi qua theo bất kỳ thứ tự nào. Điểm cấm không được đi vào.</p>
        <p>Nguyên liệu không bị tiêu hao. Đây là mạng quan hệ công thức, không mô phỏng việc sở hữu đủ tất cả nguyên liệu. Không áp dụng khóa thời đại, vùng hay xử lý vật liệu của Main Evolution.</p>
        <p>Gợi ý và quay lại đánh dấu lượt có hỗ trợ. Mỗi màn giữ kỷ lục tự giải và có hỗ trợ riêng. Mọi chương đều mở; không phạt khi thử sai.</p>
        <p>{content.source.note}</p><p>Snapshot: <code>{content.source.commit}</code></p>
      </section>}
    </>}
  </main></GuideScope>;
}
