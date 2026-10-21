'use client';
import type { Loose } from '@/lib/quiz/loose';
import { AGE_BANDS } from '@/lib/quiz/validation';
import { coverSvg } from '@/lib/quiz/art';
import { CURRICULA, GRADES, SUBJECTS, describeGrades } from '@/lib/quiz/taxonomy';

export type Meta = { subject?: string; language?: string; ageBand?: string; subjectIds?: string[]; gradeIds?: string[]; curriculumIds?: string[]; tags?: string[]; cover?: { kind: 'art'; seed: string } | { kind: 'upload'; ref: string; alt?: string }; objectives?: string[]; sourceId?: string; sourceTitle?: string; sourceAuthor?: string };
const LANGS: [string, string][] = [['en', 'English'], ['vi', 'Tiếng Việt'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어']];

/** Quiz-level details: language, subject, age, tags, cover. All optional, none affects grading. */
export default function QuizMetaForm({ meta, onChange, title }: { meta: Meta; onChange: (m: Meta) => void; title: string }) {
  const set = (k: keyof Meta, v: unknown) => { const next: Loose = { ...meta, [k]: v }; if (v === '' || v === undefined || (Array.isArray(v) && !v.length)) delete next[k]; onChange(next); };
  const seed = meta.cover?.kind === 'art' ? meta.cover.seed : (title || 'quiz');
  return (
    <div className="stack">
      <div className="grid2">
        <label>Subject<input maxLength={60} value={meta.subject ?? ''} onChange={(e) => set('subject', e.target.value)} placeholder="Math, History, English…" /></label>
        <label>Language of the quiz<select value={meta.language ?? ''} onChange={(e) => set('language', e.target.value)}><option value="">Not set</option>{LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
        <label>Age group<select value={meta.ageBand ?? ''} onChange={(e) => set('ageBand', e.target.value)}><option value="">Not set</option>{AGE_BANDS.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        <label>Tags (comma separated, up to 8)<input value={(meta.tags ?? []).join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim().slice(0, 24)).filter(Boolean).slice(0, 8))} /></label>
      </div>
      <fieldset className="qz-classify">
        <legend>Classification <small className="note">Optional. Helps teachers find this quiz by subject, exact grade and curriculum. It never changes grading and is never filled in for you.</small></legend>
        <ChipGroup label="Subjects" options={SUBJECTS} value={meta.subjectIds ?? []} max={6} onChange={(v) => set('subjectIds', v)} />
        <ChipGroup label="Grades this quiz suits" options={GRADES} value={meta.gradeIds ?? []} max={16} onChange={(v) => set('gradeIds', v)} summary={(v) => describeGrades(v)} />
        <ChipGroup label="Curricula" options={CURRICULA} value={meta.curriculumIds ?? []} max={8} onChange={(v) => set('curriculumIds', v)} />
      </fieldset>
      <label>Learning objectives (one per line)<textarea rows={2} value={(meta.objectives ?? []).join('\n')} onChange={(e) => set('objectives', e.target.value.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 20))} /></label>
      <div className="row" style={{ alignItems: 'center' }}>
        <div aria-hidden style={{ width: 160, borderRadius: 8, overflow: 'hidden', border: '3px solid var(--qz-outline)' }} dangerouslySetInnerHTML={{ __html: coverSvg(seed, meta.subject ?? '') }} />
        <div className="stack">
          <p className="note" style={{ margin: 0 }}>Cover picture — drawn for you, no upload needed.</p>
          <button type="button" className="btn small ghost" onClick={() => set('cover', { kind: 'art', seed: `${seed}-${Math.random().toString(36).slice(2, 6)}` })}>Try another</button>
        </div>
      </div>
      {meta.sourceTitle && <p className="note">Remixed from “{meta.sourceTitle}”{meta.sourceAuthor ? ` by ${meta.sourceAuthor}` : ''}. Credit stays with the original.</p>}
    </div>
  );
}

function ChipGroup({ label, options, value, onChange, max, summary }: { label: string; options: readonly { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max: number; summary?: (v: string[]) => string }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length >= max ? value : [...value, id]);
  return (
    <div role="group" aria-label={label} className="stack" style={{ gap: 6 }}>
      <b style={{ fontSize: '.9rem' }}>{label}{value.length ? <span className="note"> · {summary ? summary(value) : `${value.length} selected`}</span> : null}</b>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => <button key={o.id} type="button" className={`btn small ${value.includes(o.id) ? '' : 'ghost'}`} aria-pressed={value.includes(o.id)} onClick={() => toggle(o.id)}>{o.label}</button>)}
      </div>
    </div>
  );
}
