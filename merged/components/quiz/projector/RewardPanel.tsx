'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/quiz/client';
import type { Locale } from '@/lib/quiz/projector/types';

type Res = { evidenceId: string; verdict: 'accepted' | 'rejected'; reasons: string[]; amount: number; duplicate: boolean };
const T = {
  title: { en: 'Teacher reward', vi: 'Phần thưởng cho giáo viên' },
  intro: { en: 'A reward is granted only when the server can verify real, unique, non-idle play from this match.', vi: 'Chỉ cấp thưởng khi máy chủ xác minh được lượt chơi thật, không trùng lặp và không bỏ trống.' },
  check: { en: 'Check eligibility', vi: 'Kiểm tra điều kiện' }, ok: { en: 'Accepted', vi: 'Được chấp nhận' }, no: { en: 'Not eligible', vi: 'Chưa đủ điều kiện' },
  appeal: { en: 'Appeal this decision', vi: 'Khiếu nại quyết định' }, why: { en: 'Why should it count? (10+ characters)', vi: 'Vì sao cần xem xét lại? (từ 10 ký tự)' }, send: { en: 'Send appeal', vi: 'Gửi khiếu nại' }, sent: { en: 'Appeal recorded.', vi: 'Đã ghi nhận khiếu nại.' },
} as const;
const REASON: Record<string, { en: string; vi: string }> = {
  too_few_answers: { en: 'Too few verified answers.', vi: 'Có quá ít câu trả lời đã xác minh.' },
  idle: { en: 'Long idle gaps were detected.', vi: 'Phát hiện khoảng trống dài không hoạt động.' },
  overlap: { en: 'Overlaps another reward claim.', vi: 'Trùng với một yêu cầu thưởng khác.' },
  duplicate: { en: 'Already evaluated.', vi: 'Đã được đánh giá trước đó.' },
  not_finished: { en: 'The match is not finished.', vi: 'Trận chưa kết thúc.' },
};
export default function RewardPanel({ roomId, locale }: { roomId: string; locale: Locale }) {
  const [res, setRes] = useState<Res | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(''); const [appealed, setAppealed] = useState(false);
  const check = async () => { setBusy(true); setErr(''); try { setRes(await api<Res>(`/api/quiz/rooms/${roomId}/game/reward`, { method: 'POST', json: {} })); } catch (e) { setErr(e instanceof ApiError ? e.message : String(e)); } finally { setBusy(false); } };
  const appeal = async () => { if (!res) return; setBusy(true); setErr(''); try { await api(`/api/quiz/rooms/${roomId}/game/reward`, { method: 'POST', json: { evidenceId: res.evidenceId, reason } }); setAppealed(true); } catch (e) { setErr(e instanceof ApiError ? e.message : String(e)); } finally { setBusy(false); } };
  return (
    <section className="pj-panel" aria-label={T.title[locale]}>
      <h3>{T.title[locale]}</h3><p className="muted-text">{T.intro[locale]}</p>
      <button className="btn small" disabled={busy} onClick={check}>{T.check[locale]}</button>
      {err && <p className="error" role="alert">{err}</p>}
      {res && <div role="status"><p><b>{res.verdict === 'accepted' ? T.ok[locale] : T.no[locale]}</b>{res.verdict === 'accepted' && ` · +${res.amount}`}</p>
        {res.reasons.length > 0 && <ul>{res.reasons.map((r) => <li key={r}>{REASON[r]?.[locale] ?? r}</li>)}</ul>}
        {res.verdict === 'rejected' && !res.duplicate && (appealed ? <p className="note">{T.sent[locale]}</p> : <div className="stack">
          <label className="pj-field">{T.why[locale]}<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} /></label>
          <button className="btn small ghost" disabled={busy || reason.trim().length < 10} onClick={appeal}>{T.send[locale]}</button></div>)}
      </div>}
    </section>
  );
}
