'use client';
import { useMemo, useState } from 'react';
import { fieldErrors } from '@/lib/quiz/editor-ops';
import { canPublish, checkQuality, evidenceWarnings, findDuplicates } from '@/lib/quiz/content';
import { estimateQuizSeconds, formatDuration, quizMaxPoints } from '@/lib/quiz/scoring';
import { prepare } from '@/lib/quiz/editor-model';
import { explainIssue } from '@/lib/quiz/explain';
import { kindLabels, type Question } from '@/lib/quiz/types';
import PreviewPane, { DEVICES, type DeviceId } from './PreviewPane';

/** The pre-publish check: everything that blocks saving online, everything worth a second look, and a preview on any screen size. */
export default function ReviewPanel({ title, qs, onJump }: { title: string; qs: Question[]; onJump: (index: number, anchor?: string) => void }) {
  const [device, setDevice] = useState<DeviceId>('phone');
  const [previewIdx, setPreviewIdx] = useState(0);
  const prepared = useMemo(() => qs.map(prepare), [qs]);
  const errors = useMemo(() => fieldErrors(prepared), [prepared]);
  const warnings = useMemo(() => {
    const out: { index: number; text: string }[] = [];
    prepared.forEach((q, i) => {
      checkQuality(q).forEach((w) => out.push({ index: i, text: w.message }));
      evidenceWarnings(q).forEach((w) => out.push({ index: i, text: w }));
      const m = (q.payload as { media?: { alt?: string; decorative?: boolean } }).media;
      if (m && !m.decorative && !(m.alt ?? '').trim()) out.push({ index: i, text: 'The media has no text description.' });
    });
    findDuplicates(prepared).forEach((d) => out.push({ index: d.index, text: `${d.note} (see question ${typeof d.other === 'number' ? d.other + 1 : d.other})` }));
    return out;
  }, [prepared]);
  const pub = canPublish(prepared);
  const total = quizMaxPoints(prepared, { questionSeconds: 30 });
  const secs = estimateQuizSeconds(prepared);
  const q = qs[Math.min(previewIdx, qs.length - 1)];

  return (
    <section className="panel stack" aria-labelledby="rv-h">
      <h2 id="rv-h">Review</h2>
      <ul className="row" style={{ listStyle: 'none', padding: 0, gap: 8 }} aria-label="Quiz summary">
        <li className="pill">{qs.length} question{qs.length === 1 ? '' : 's'}</li>
        <li className="pill">Up to {total} points</li>
        <li className="pill">About {formatDuration(secs)}</li>
        <li className={`pill ${errors.length ? 'draft' : 'published'}`}>{errors.length ? `${errors.length} to fix` : 'Ready to save online'}</li>
      </ul>
      {!title.trim() && <p className="error" role="alert">Give the quiz a title (step 1).</p>}
      {qs.length === 0 && <p className="info">Add at least one question to publish.</p>}

      {errors.length > 0 && (
        <div className="stack" role="region" aria-label="Problems to fix">
          <h3>Fix before saving online or publishing</h3>
          <ul>
            {errors.slice(0, 40).map((e, i) => (
              <li key={i}>
                <button className="btn small ghost" onClick={() => onJump(e.questionIndex, e.anchor)}>Question {e.questionIndex + 1}</button>{' '}
                {explainIssue({ path: ['questions', e.questionIndex, ...e.path], message: e.message, code: 'custom' })}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!pub.ok && <p className="error" role="alert">Question{pub.blocked.length > 1 ? 's' : ''} {pub.blocked.map((i) => i + 1).join(', ')} {pub.blocked.length > 1 ? 'were' : 'was'} drafted with AI and not yet marked as checked by you, so publishing is blocked.</p>}

      {warnings.length > 0 && (
        <div className="stack" role="region" aria-label="Suggestions">
          <h3>Worth a second look <span className="pill">{warnings.length}</span></h3>
          <ul>{warnings.slice(0, 40).map((w, i) => <li key={i}><button className="btn small ghost" onClick={() => onJump(w.index)}>Question {w.index + 1}</button> {w.text}</li>)}</ul>
          <p className="note">These are suggestions. You decide; nothing is changed for you.</p>
        </div>
      )}
      {errors.length === 0 && warnings.length === 0 && qs.length > 0 && <p className="success" role="status">No problems found.</p>}

      {q && (
        <div className="stack">
          <h3>Preview</h3>
          <div className="row">
            <label>Question
              <select value={Math.min(previewIdx, qs.length - 1)} onChange={(e) => setPreviewIdx(Number(e.target.value))}>
                {qs.map((x, i) => <option key={i} value={i}>{i + 1}. {x.prompt.slice(0, 40) || kindLabels[x.kind]}</option>)}
              </select>
            </label>
            <div role="group" aria-label="Screen size" className="row">
              {DEVICES.map((d) => <button key={d.id} className="btn small ghost" aria-pressed={device === d.id} onClick={() => setDevice(d.id)}>{d.label}</button>)}
            </div>
          </div>
          <PreviewPane key={`${previewIdx}-${device}`} q={q} device={device} />
        </div>
      )}
    </section>
  );
}
