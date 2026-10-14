'use client';

import { useState } from 'react';

/* Owner panel: items that were added to the game and still need their 3D draft and/or alternative routes.
   One button runs a small bounded batch. Nothing here publishes anything: drafts and proposals wait for the owner. */

interface NewItem { itemId: string; name: string; needsAsset: boolean; needsRoutes: boolean }
interface Report { itemId: string; asset: string; routes: string; proposalsCreated: number; rejected: number }

const WORD: Record<string, string> = {
  queued: 'đã xếp hàng tạo mô hình 3D', already_queued: 'mô hình 3D đã có trong hàng đợi', asset_ai_off: 'tạo 3D đang tắt (ASSET_AI_ENABLED)',
  llm_off: 'AI đang tắt hoặc thiếu khóa (CREATIVE_LLM_ENABLED / ANTHROPIC_API_KEY)', none: 'AI không thấy công thức thay thế hợp lý (đây là kết quả đúng)',
  proposals: 'có đề xuất công thức mới, chờ anh duyệt', rejected_response: 'AI trả lời không hợp lệ, đã bỏ', provider_error: 'AI lỗi tạm thời, sẽ thử lại lần sau',
  not_verified: 'vật phẩm chưa có nguồn xác thực nên AI không động vào', no_release: 'chưa có bản phát hành nền', no_pool: 'không đủ nguyên liệu hợp thời đại',
};
const say = (k: string) => (k.startsWith('budget:') ? 'hết hạn mức chi tiêu hôm nay hoặc đang bật kill switch' : WORD[k] ?? k);
const ERR: Record<number, string> = { 401: 'Mã chủ sở hữu sai hoặc chưa nhập.', 404: 'Chức năng đang đóng (cần ENABLE_DEV_TOOLS, OWNER_REVIEW_TOKEN và DATABASE_URL; không bao giờ chạy trên production).' };

export function OnboardPanel() {
  const [token, setToken] = useState('');
  const [items, setItems] = useState<NewItem[] | null>(null);
  const [rep, setRep] = useState<Report[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function call(method: 'GET' | 'POST') {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/creative/onboard', { method, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify({ limit: 3 }) : undefined });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) { setErr(ERR[r.status] ?? `Lỗi ${r.status}.`); return; }
      if (method === 'GET') setItems(j.items as NewItem[]); else { setRep(j.processed as Report[]); const l = await fetch('/api/admin/creative/onboard', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }); if (l.ok) setItems((await l.json()).items); }
    } catch { setErr('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'); } finally { setBusy(false); }
  }

  return (
    <section aria-label="Vật phẩm mới" style={{ maxWidth: 820, margin: '32px auto 0', padding: '0 16px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
      <h2 style={{ fontSize: 20 }}>Vật phẩm mới cần xử lý</h2>
      <p>Sau khi anh thêm vật phẩm (tên, mô tả, nguồn, đúng 1 công thức), AI tạo bản nháp 3D và đề xuất tối đa 3 công thức thay thế. Mọi thứ đều <b>chờ anh duyệt</b>; không có gì tự lên game.</p>
      <label style={{ display: 'block' }}>Mã chủ sở hữu (chỉ giữ trong bộ nhớ trang này)
        <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy || !token} onClick={() => call('GET')}>Xem vật phẩm mới</button>
        <button type="button" disabled={busy || !token} onClick={() => call('POST')}>Xử lý tối đa 3 vật phẩm</button>
      </div>
      {err && <p role="alert" style={{ color: '#b00020' }}>{err}</p>}
      {items && (items.length === 0 ? <p>Không có vật phẩm mới nào cần xử lý.</p> : (
        <ul>{items.map(i => <li key={i.itemId}>{i.name} ({i.itemId}) — {i.needsAsset ? 'chưa có 3D' : '3D đã xếp hàng'}; {i.needsRoutes ? 'chưa tìm công thức thay thế' : 'đã tìm công thức'}</li>)}</ul>
      ))}
      {rep && <ul aria-label="Kết quả">{rep.map(r => <li key={r.itemId}><b>{r.itemId}</b>: {say(r.asset)}; {say(r.routes)}{r.proposalsCreated ? ` (${r.proposalsCreated} đề xuất mới)` : ''}</li>)}</ul>}
    </section>
  );
}
