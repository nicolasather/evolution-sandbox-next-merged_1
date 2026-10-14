'use client';

import { useState } from 'react';

/* Owner review of AI-suggested ALTERNATIVE recipes. Phase 1: read-only.
   - Suggestions never create items and are never saved by this page.
   - The token lives only in this component's memory (not stored, not in the URL).
   - To accept one, copy its JSON into the pipeline's alt review (tools/verified_content.py). */

interface Target { id: string; name: string; recipe: string[] }
interface Result { index: number; status: 'schema_valid' | 'rejected'; reasons: string[]; recipeKey?: string; proposal?: { ingredientIds: string[]; action?: string; explanation: string; evidenceClass: string } }
interface Outcome { targetId: string; outcome: 'none' | 'proposals' | 'rejected_response'; results: Result[]; reasons: string[]; provider?: string }

const OUTCOME_VI: Record<Outcome['outcome'], string> = {
  none: 'Không có công thức thay thế hợp lệ (đây là câu trả lời đúng, không phải lỗi).',
  proposals: 'Có đề xuất. Chỉ những mục "hợp lệ về cấu trúc" mới đáng xem xét.',
  rejected_response: 'Toàn bộ phản hồi bị bác bỏ.',
};
const ERR_VI: Record<number, string> = {
  401: 'Mã chủ sở hữu sai hoặc chưa nhập.',
  404: 'Chức năng đang đóng: cần bật ENABLE_DEV_TOOLS=true và OWNER_REVIEW_TOKEN trên môi trường này (không bao giờ chạy trên production).',
  413: 'Yêu cầu quá lớn.',
};

export function RecipeReview({ targets, names }: { targets: Target[]; names: Record<string, string> }) {
  const [token, setToken] = useState('');
  const [target, setTarget] = useState(targets[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [out, setOut] = useState<Outcome | null>(null);
  const [copied, setCopied] = useState(-1);

  async function ask() {
    setBusy(true); setError(''); setOut(null);
    try {
      const r = await fetch('/api/admin/recipe-suggestions', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetId: target }),
      });
      const j = await r.json().catch(() => null) as Outcome | null;
      if (j && typeof j.targetId === 'string' && Array.isArray(j.results)) setOut(j);
      else setError(ERR_VI[r.status] ?? `Lỗi ${r.status}.`);
    } catch {
      setError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    } finally { setBusy(false); }
  }

  const label = (id: string) => names[id] ?? id;
  const copy = async (i: number, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(i); } catch { setError('Không sao chép được. Hãy chọn và copy thủ công.'); }
  };

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 22 }}>Duyệt công thức thay thế (chủ game)</h1>
      <p>Trang này chỉ <b>xem đề xuất</b>. Nó không tạo vật phẩm mới và không lưu gì. Công thức chính (anchor) của mỗi vật phẩm không bị thay đổi.</p>

      {targets.length === 0 ? <p><b>Chưa có vật phẩm nào do quy trình nội dung xuất bản.</b> Hãy chạy publish trước.</p> : (
        <>
          <label style={{ display: 'block', marginTop: 12 }}>Mã chủ sở hữu (chỉ giữ trong bộ nhớ trang này)
            <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)}
              style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>Vật phẩm cần tìm công thức thay thế
            <select value={target} onChange={e => setTarget(e.target.value)} style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}>
              {targets.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
            </select>
          </label>
          <p style={{ fontSize: 13, opacity: .75 }}>Công thức chính hiện tại: {(targets.find(t => t.id === target)?.recipe ?? []).map(label).join(' + ') || '—'}</p>
          <button type="button" onClick={ask} disabled={busy || !token || !target} style={{ padding: '8px 16px' }}>
            {busy ? 'Đang hỏi…' : 'Xin đề xuất'}
          </button>
        </>
      )}

      {error && <p role="alert" style={{ color: '#b00020', marginTop: 12 }}>{error}</p>}

      {out && (
        <section style={{ marginTop: 20 }} aria-live="polite">
          <p><b>Kết quả:</b> {OUTCOME_VI[out.outcome]} {out.provider ? `(nguồn: ${out.provider})` : ''}</p>
          {out.reasons.length > 0 && <p>Lý do bác bỏ chung: {out.reasons.join(', ')}</p>}
          {out.results.map(r => (
            <article key={r.index} style={{ border: '1px solid #8886', borderRadius: 6, padding: 12, marginTop: 10 }}>
              <p style={{ margin: 0 }}><b>#{r.index + 1}</b> — {r.status === 'schema_valid' ? 'Hợp lệ về cấu trúc (chờ chủ game duyệt)' : 'Bị bác bỏ'}</p>
              {r.proposal && <p style={{ margin: '6px 0' }}>{r.proposal.ingredientIds.map(label).join(' + ')}{r.proposal.action ? ` · hành động: ${r.proposal.action}` : ''} · {r.proposal.evidenceClass}</p>}
              {r.proposal && <p style={{ margin: '6px 0' }}>{r.proposal.explanation}</p>}
              {r.reasons.length > 0 && <p style={{ margin: '6px 0', color: '#b00020' }}>Mã lý do: {r.reasons.join(', ')}</p>}
              {r.status === 'schema_valid' && r.proposal && (
                <button type="button" onClick={() => copy(r.index, JSON.stringify({ targetId: out.targetId, ...r.proposal, recipeKey: r.recipeKey }, null, 2))}>
                  {copied === r.index ? 'Đã sao chép' : 'Sao chép JSON để duyệt bằng công cụ'}
                </button>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
