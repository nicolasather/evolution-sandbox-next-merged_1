'use client';
import type { ReactNode } from 'react';
import { SHAPES, type Shape } from '@/lib/quiz/projector/content/vault-doors';
import type { BossG } from '@/lib/quiz/projector/reducers/boss';
import type { EmpireG } from '@/lib/quiz/projector/reducers/empire';
import { ENERGY_CAP } from '@/lib/quiz/projector/reducers/empire';
import type { EscapeG } from '@/lib/quiz/projector/reducers/escape';
import type { LadderG } from '@/lib/quiz/projector/reducers/ladder';
import type { VaultG } from '@/lib/quiz/projector/reducers/vault';
import { scoreOf as vaultScore } from '@/lib/quiz/projector/reducers/vault';
import type { Core, Evidence, Locale } from '@/lib/quiz/projector/types';
import { CAMPAIGNS } from '@/lib/quiz/projector/content/escape-campaigns';
import { L, tr } from './i18n';
import { ShapeGlyph, teamStyle } from './scenes/shared';

export function TeamSwatch({ i, size = 26 }: { i: number; size?: number }) {
  const t = teamStyle(i);
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden className="pj-swatch">
      <defs><pattern id={`sw${i}`} width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill={t.c} />{t.p === 'dots' && <circle cx="4" cy="4" r="1.4" fill="#fff" opacity=".6" />}{t.p === 'diag' && <path d="M-1 9L9 -1" stroke="#fff" strokeWidth="1.3" opacity=".6" />}{t.p === 'cross' && <path d="M0 4H8M4 0V8" stroke="#fff" strokeWidth="1.1" opacity=".6" />}{t.p === 'horiz' && <path d="M0 3H8M0 7H8" stroke="#fff" strokeWidth="1.3" opacity=".6" />}{t.p === 'vert' && <path d="M3 0V8M7 0V8" stroke="#fff" strokeWidth="1.3" opacity=".6" />}{t.p === 'check' && <path d="M0 0H4V4H0ZM4 4H8V8H4Z" fill="#fff" opacity=".45" />}{t.p === 'waves' && <path d="M0 4Q2 1 4 4T8 4" stroke="#fff" strokeWidth="1.2" fill="none" opacity=".6" />}</pattern></defs>
      <rect x="1.5" y="1.5" width="23" height="23" rx="5" fill={`url(#sw${i})`} stroke="#05080d" strokeWidth="3" />
      <text x="13" y="18.5" textAnchor="middle" fontSize="14" fontWeight="900" fill="#fff" stroke="#05080d" strokeWidth="3" paintOrder="stroke" fontFamily="var(--qz-display)">{i + 1}</text>
    </svg>
  );
}

function Pips({ n, max, label }: { n: number; max: number; label: string }) {
  return <span className="pj-pips" role="img" aria-label={`${label} ${n}/${max}`}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>;
}

/** One chip per team: identity (colour + pattern + number), whose turn, and the stat that matters in this game. */
export function TeamStrip({ core, g, locale }: { core: Core; g: unknown; locale: Locale }) {
  const active = core.askMode === 'all' ? null : core.teams[core.actor % core.teams.length]!.id;
  return (
    <ul className="pj-teams" aria-label={tr(locale, 'teams')}>
      {core.teams.map((t, i) => {
        let stat: ReactNode = null;
        if (core.game === 'empire_race') { const e = g as EmpireG; const own = e.tiles.filter((x) => x.owner === t.id).length; stat = <><b>{own}</b><small>{tr(locale, 'tile', { n: '' }).trim()}</small><Pips n={e.energy[t.id] ?? 0} max={ENERGY_CAP} label={tr(locale, 'energy')} /></>; }
        else if (core.game === 'boss_battle') { const b = (g as BossG).teams[t.id]; stat = b ? <><b>{b.dealt}</b><small>{tr(locale, 'strike')}</small><span className="pj-role">{b.chosen ? tr(locale, b.chosen) : b.role}</span></> : null; }
        else if (core.game === 'escape_room') { const e = g as EscapeG; const inv = e.inv[e.shared ? 'shared' : t.id] ?? []; stat = <><b>{inv.length}</b><small>{tr(locale, 'inventory')}</small></>; }
        else if (core.game === 'treasure_vault') { const v = (g as VaultG).teams[t.id]; stat = v ? <><b>{vaultScore(v)}</b><small>{v.held}+{v.banked}</small><span className="pj-keys">{SHAPES.filter((s) => (v.frags[s] ?? 0) > 0).map((s) => <span key={s} className="pj-key"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><ShapeGlyph shape={s as Shape} x={9} y={9} r={6} /></svg>{v.frags[s]}</span>)}</span></> : null; }
        else { const l = (g as LadderG).teams[t.id]; stat = l ? <><b>{l.tier}</b><small>/{(g as LadderG).summit}</small><span className="pj-role">{l.banked}+{l.unbanked}</span></> : null; }
        return <li key={t.id} className={active === t.id ? 'on' : ''} aria-current={active === t.id ? 'true' : undefined}><TeamSwatch i={i} /><span className="pj-tn">{t.name}</span><span className="pj-st">{stat}</span></li>;
      })}
    </ul>
  );
}

type Q = { kind: string; prompt: string; base_points?: number; payload: { options?: { id: string; text: string }[]; left?: { id: string; label: string }[]; right?: { id: string; label: string }[]; statements?: { id: string; text: string }[]; columns?: string[]; rows?: { text: string; blank: boolean }[][] }; answerKey?: { correctIds?: string[]; accepted?: string[]; explanation?: string } & Record<string, unknown> };
const KIND_EN: Record<string, { en: string; vi: string }> = { multiple_choice: { en: 'Multiple choice', vi: 'Trắc nghiệm' }, answer_forge: { en: 'Say your answer', vi: 'Nói đáp án' }, connection_rush: { en: 'Match the pairs', vi: 'Nối cặp' }, truth_hunt: { en: 'True or false', vi: 'Đúng hay sai' }, fill_table: { en: 'Fill the table', vi: 'Điền bảng' } };

/** The question as the class sees it (no answer key). Large print scales via CSS on .pj[data-large]. */
export function QuestionView({ q, core, locale }: { q: unknown; core: Core; locale: Locale }) {
  const Q = q as Q; const ask = core.ask; const p = Q.payload ?? {};
  return (
    <div className="pj-q">
      <p className="pj-q-meta">
        <span>{L(locale, KIND_EN[Q.kind] ?? KIND_EN.multiple_choice!)}</span>
        {ask?.topic && <span>{tr(locale, 'topic')}: {ask.topic}</span>}
        {ask?.difficulty && <span>{tr(locale, 'difficulty')}: {tr(locale, (['easy', 'medium', 'hard'] as const)[ask.difficulty - 1]!)}</span>}
        {ask?.repeat && <span className="warn">{tr(locale, 'repeatLabel')}</span>}
        {ask?.topicFallback && <span className="warn">{tr(locale, 'topicFallback')}</span>}
      </p>
      <p className="pj-q-prompt">{Q.prompt}</p>
      {Q.kind === 'multiple_choice' && p.options && <ol className="pj-opts">{p.options.map((o, i) => <li key={o.id}><b>{String.fromCharCode(65 + i)}</b> {o.text}</li>)}</ol>}
      {Q.kind === 'connection_rush' && p.left && p.right && <div className="pj-pairs"><ol>{p.left.map((l, i) => <li key={l.id}><b>{i + 1}</b> {l.label}</li>)}</ol><ol>{p.right.map((r, i) => <li key={r.id}><b>{String.fromCharCode(65 + i)}</b> {r.label}</li>)}</ol></div>}
      {Q.kind === 'truth_hunt' && p.statements && <ol className="pj-opts">{p.statements.map((s, i) => <li key={s.id}><b>{i + 1}</b> {s.text}</li>)}</ol>}
      {Q.kind === 'fill_table' && p.columns && p.rows && <table className="pj-table"><thead><tr>{p.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{p.rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}>{c.blank ? '＿＿＿' : c.text}</td>)}</tr>)}</tbody></table>}
    </div>
  );
}

/** Teacher-only: the key, the explanation and the marking buttons for each team that still needs grading. */
export function MarkPanel({ q, core, locale, busy, onMark }: { q: unknown; core: Core; locale: Locale; busy: boolean; onMark: (teamId: string, verdict: 'correct' | 'wrong') => void }) {
  const Q = q as Q | null; const ask = core.ask; if (!ask) return null;
  const key = Q?.answerKey; const opts = Q?.payload?.options ?? [];
  const correct = key?.correctIds?.map((id) => opts.find((o) => o.id === id)?.text).filter(Boolean).join(' · ') || (key?.accepted ?? []).join(' / ');
  return (
    <section className="pj-panel" aria-label={tr(locale, 'answerKey')}>
      <h3>{tr(locale, 'answerKey')}</h3>
      {correct ? <p className="pj-key-line"><strong>{correct}</strong></p> : <p className="muted-text">—</p>}
      {key?.explanation && <p className="muted-text"><b>{tr(locale, 'whyAnswer')}:</b> {key.explanation}</p>}
      <div className="pj-mark">
        {ask.teamIds.filter((id) => !ask.answered.includes(id)).map((id) => { const i = core.teams.findIndex((t) => t.id === id); return (
          <div key={id} className="pj-mark-row"><span className="pj-mark-who"><TeamSwatch i={i} size={22} /> {tr(locale, 'markFor', { team: core.teams[i]!.name })}</span>
            <button className="btn good" disabled={busy} onClick={() => onMark(id, 'correct')}>{tr(locale, 'correct')}</button>
            <button className="btn danger" disabled={busy} onClick={() => onMark(id, 'wrong')}>{tr(locale, 'wrong')}</button></div>
        ); })}
      </div>
    </section>
  );
}

/** Per-topic picture of the lesson, built only from committed team answers (never individual students). */
export function topicBreakdown(evidence: Evidence[]) {
  const by = new Map<string, { n: number; score: number }>();
  for (const e of evidence) { if (e.purpose === 'review') continue; const k = e.topic ?? '—'; const r = by.get(k) ?? { n: 0, score: 0 }; r.n++; r.score += e.fraction; by.set(k, r); }
  return [...by.entries()].map(([topic, r]) => ({ topic, n: r.n, pct: Math.round((r.score / r.n) * 100) })).sort((a, b) => a.pct - b.pct);
}

export function Summary({ core, locale, host }: { core: Core; locale: Locale; host: boolean }) {
  const f = core.finished!; const coop = core.game === 'boss_battle' || core.game === 'escape_room';
  const win = f.outcome === 'victory' || f.outcome === 'escaped' || (!coop && f.outcome !== 'defeat');
  const topics = host && core.evidence ? topicBreakdown(core.evidence) : [];
  return (
    <section className="pj-summary" aria-label={tr(locale, 'finished')}>
      <h2>{coop ? (win ? tr(locale, 'victory') : tr(locale, 'defeat')) : tr(locale, 'finished')}</h2>
      <ol className="pj-standings">{f.standings.map((s) => { const i = core.teams.findIndex((t) => t.id === s.team); return <li key={s.team}><b>{s.rank}</b><TeamSwatch i={i} /><span>{core.teams[i]?.name}</span><strong>{s.score}</strong></li>; })}</ol>
      {topics.length > 0 && <div className="pj-topics"><h3>{tr(locale, 'byTopic')}</h3><ul>{topics.map((t) => <li key={t.topic}><span>{t.topic}</span><span className="pj-bar" aria-hidden><i style={{ width: `${t.pct}%` }} /></span><b>{tr(locale, 'accuracy', { p: t.pct })}</b><small>{tr(locale, 'answered', { n: t.n })}</small></li>)}</ul></div>}
    </section>
  );
}
export const escapeCampaignName = (id: keyof typeof CAMPAIGNS, locale: Locale) => L(locale, CAMPAIGNS[id].name);
