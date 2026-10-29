'use client';
/** Teacher score adjustment for a class list: quick presets, a custom amount, reason pills, a class-wide bonus, and an undoable log.
 *  Controlled: the parent owns the state (see lib/quiz/score-override.ts) and decides where it is saved. */
import { useState } from 'react';
import {
  CLASS_WIDE_REASON, OVERRIDE_PRESETS, OVERRIDE_REASONS, adjustedScore, applyOverride, isValidDelta,
  signed, undoOverride, type OverrideState,
} from '@/lib/quiz/score-override';
import { useQuizMotion } from './useQuizMotion';

export type OverrideStudent = { id: string; name: string; earned: number };

type Props = {
  students: OverrideStudent[];
  value: OverrideState;
  onChange: (next: OverrideState) => void;
  /** Saves one adjustment on the server (an audited correction). Resolves true only when it was stored. */
  persist: (studentIds: string[], delta: number, reason: string) => Promise<boolean>;
};

export default function TeacherScoreOverride({ students, value, onChange, persist }: Props) {
  const { reduced } = useQuizMotion();
  const [openId, setOpenId] = useState<string | null>(null);
  const [delta, setDelta] = useState<number>(250);
  const [custom, setCustom] = useState('');
  const [reason, setReason] = useState<string>(OVERRIDE_REASONS[0]);
  const [logOpen, setLogOpen] = useState(false);
  const [flash, setFlash] = useState<{ id: string; n: number; key: number } | null>(null);

  async function commit(studentIds: string[], amount: number, why: string) {
    if (!isValidDelta(amount) || studentIds.length === 0) return;
    if (!(await persist(studentIds, amount, why))) return;
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, studentIds, delta: amount, reason: why, at: Date.now() };
    onChange(applyOverride(value, entry));
    setFlash({ id: studentIds[0]!, n: amount, key: Date.now() });
  }

  /** Undo is a new, audited correction that reverses the old one. The log keeps both. */
  async function undo(entryId: string) {
    const target = value.log.find((e) => e.id === entryId);
    if (!target || target.undone) return;
    if (!(await persist(target.studentIds, -target.delta, `Undo: ${target.reason}`))) return;
    onChange(undoOverride(value, entryId));
  }

  function applyCustom() {
    const n = Number(custom);
    if (!Number.isInteger(n)) return;
    setDelta(n);
    setCustom('');
  }

  const ranked = [...students].sort((a, b) => adjustedScore(b.earned, value, b.id) - adjustedScore(a.earned, value, a.id));

  return (
    <section className="qz-override" aria-label="Teacher score adjustment">
      <div className="qz-override-bar" role="group" aria-label="Amount">
        {OVERRIDE_PRESETS.map((p) => (
          <button key={p} type="button" className="qz-chip" aria-pressed={delta === p} onClick={() => setDelta(p)}>{signed(p)}</button>
        ))}
        <label className="qz-override-custom">
          <span className="qz-sr">Custom amount</span>
          <input type="number" inputMode="numeric" step={1} value={custom} placeholder="Custom" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyCustom(); }} />
        </label>
        <button type="button" className="qz-chip" onClick={applyCustom} disabled={!custom}>Use</button>
      </div>

      <div className="qz-override-reasons" role="radiogroup" aria-label="Reason">
        {OVERRIDE_REASONS.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={reason === r} className="qz-pill" onClick={() => setReason(r)}>{r}</button>
        ))}
      </div>

      <button type="button" className="btn qz-classwide" onClick={() => commit(students.map((s) => s.id), delta, CLASS_WIDE_REASON)} disabled={students.length === 0}>
        Class-Wide Bonus ({signed(delta)} each)
      </button>

      <ol className="qz-roster">
        {ranked.map((s, i) => {
          const adj = value.adjust[s.id] ?? 0;
          const total = adjustedScore(s.earned, value, s.id);
          const open = openId === s.id;
          return (
            <li key={s.id} className="qz-roster-row" style={{ transition: reduced ? 'none' : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <span className="qz-rank">{i + 1}</span>
              <span className="qz-name">{s.name}</span>
              <span className="qz-odo" key={`${s.id}-${total}`} data-dir={adj >= 0 ? 'up' : 'down'}>{total}</span>
              <button type="button" className="qz-chip" aria-expanded={open} onClick={() => setOpenId(open ? null : s.id)}>Adjust ±</button>
              {open && (
                <div className="qz-override-inline">
                  <button type="button" className="btn" onClick={() => commit([s.id], delta, reason)}>{`Apply ${signed(delta)} · ${reason}`}</button>
                </div>
              )}
              {flash?.id === s.id && (
                <span key={flash.key} className={`qz-bonus-badge ${flash.n < 0 ? 'neg' : 'pos'}`} aria-hidden="true">
                  {flash.n > 0 ? `+${flash.n} HOST BONUS` : `${flash.n} HOST PENALTY`}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <details className="qz-override-log" open={logOpen} onToggle={(e) => setLogOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Host Score Log ({value.log.length})</summary>
        {value.log.length === 0 && <p>No adjustments yet.</p>}
        <ul>
          {value.log.map((e) => {
            const who = students.find((s) => s.id === e.studentIds[0])?.name ?? 'Student';
            const label = e.studentIds.length > 1 ? `${e.studentIds.length} students` : who;
            return (
              <li key={e.id} className={e.undone ? 'undone' : ''}>
                <span>{signed(e.delta)} · {label} · {e.reason}{e.undone ? ' (undone)' : ''}</span>
                {!e.undone && <button type="button" className="qz-chip" onClick={() => void undo(e.id)}>Undo</button>}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
