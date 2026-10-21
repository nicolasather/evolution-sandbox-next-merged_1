'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONTEXTS, CURRICULA, GOALS, GRADES, GROUP_SIZES, LANGUAGES, LENGTHS, SUBJECTS, describeGrades, labelOf } from '@/lib/quiz/taxonomy';
import { TEACHER_STEPS, clearProfile, complete, dismiss, emptyProfile, gradesForSubject, hints, loadProfile, normalizeProfile, saveProfile, setSubjectGrades, summarize, toggleIn, toggleLanguage, type Audience, type Profile } from '@/lib/quiz/onboarding/profile';

const TITLES: Record<(typeof TEACHER_STEPS)[number], string> = { subjects: 'What do you teach?', grades: 'Which exact grades?', map: 'Which subject at which grades?', curricula: 'Which curriculum?', languages: 'Which languages?', context: 'How do you usually play?', workspace: 'Your workspace' };

function Chips({ label, options, value, onToggle, hint }: { label: string; options: readonly { id: string; label: string }[]; value: readonly string[]; onToggle: (id: string) => void; hint?: string }) {
  return (
    <div role="group" aria-label={label} className="stack" style={{ gap: 8 }}>
      {hint && <p className="note" style={{ margin: 0 }}>{hint}</p>}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => <button key={o.id} type="button" className={`btn small ${value.includes(o.id) ? '' : 'ghost'}`} aria-pressed={value.includes(o.id)} onClick={() => onToggle(o.id)}>{value.includes(o.id) ? '✓ ' : ''}{o.label}</button>)}
      </div>
    </div>
  );
}

export default function OnboardingWizard() {
  const [p, setP] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  /* browser storage only exists after hydration */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setP(loadProfile()); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const update = useCallback((fn: (x: Profile) => Profile) => setP((cur) => { const next = fn(cur ?? emptyProfile()); setSaved(saveProfile(next)); return next; }), []);
  const go = (step: number) => { update((x) => ({ ...x, step })); setTimeout(() => heading.current?.focus(), 0); };

  if (!p) return <p role="status" className="note">Loading…</p>;
  const audience: Audience = p.audience;
  const step = p.step; const key = TEACHER_STEPS[step]!;
  const last = step === TEACHER_STEPS.length - 1;
  const finished = !!p.completedAt;
  const subjectOptions = SUBJECTS.filter((s) => s.label.toLowerCase().includes(search.trim().toLowerCase()));
  const gradeGroups = [{ name: 'Early years', ids: ['early_years'] }, { name: 'Grades 1–12 (UK Year 2–13)', ids: GRADES.filter((g) => /^g\d+$/.test(g.id)).map((g) => g.id) }, { name: 'Beyond school', ids: ['higher_ed', 'other'] }];

  return (
    <section className="panel stack" aria-labelledby="ob-h" data-testid="onboarding">
      <div className="row spread" style={{ alignItems: 'center' }}>
        <div role="group" aria-label="Who is this for?" className="row" style={{ gap: 8 }}>
          {(['teacher', 'student'] as const).map((a) => <button key={a} type="button" className={`btn small ${audience === a ? '' : 'ghost'}`} aria-pressed={audience === a} onClick={() => update((x) => ({ ...x, audience: a, step: 0 }))}>I’m a {a}</button>)}
        </div>
        <span className="note" role="status">{saved === false ? 'This browser blocks storage, so your answers will not be kept.' : saved ? 'Saved on this device' : ''}</span>
      </div>

      {audience === 'student' ? (
        <div className="stack">
          <h2 id="ob-h" ref={heading} tabIndex={-1}>A few quick choices</h2>
          <p className="note">All optional. No email is needed, and you can practise as a guest.</p>
          <Chips label="Your grade" options={GRADES} value={p.grades} onToggle={(id) => update((x) => normalizeProfile({ ...x, grades: [id] }))} hint="Pick one." />
          <Chips label="Favourite subjects" options={SUBJECTS} value={p.subjects} onToggle={(id) => update((x) => toggleIn(x, 'subjects', id))} />
          <Chips label="Goals" options={GOALS} value={p.goals} onToggle={(id) => update((x) => toggleIn(x, 'goals', id))} />
          <Chips label="Quiz language" options={LANGUAGES} value={p.languages.content} onToggle={(id) => update((x) => toggleLanguage(x, 'content', id))} />
          <div className="row"><Link className="btn" href="/quiz/library">Browse quizzes</Link><Link className="btn ghost" href="/quiz/join">Join a game</Link></div>
        </div>
      ) : (
        <>
          <ol className="row" aria-label="Progress" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 6, flexWrap: 'wrap' }}>
            {TEACHER_STEPS.map((s, i) => <li key={s}><button type="button" className={`btn small ${i === step ? '' : 'ghost'}`} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>{i + 1}. {TITLES[s].replace('?', '')}</button></li>)}
          </ol>
          <h2 id="ob-h" ref={heading} tabIndex={-1}>{TITLES[key]}</h2>

          {key === 'subjects' && (
            <div className="stack">
              <label>Search subjects<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to filter…" /></label>
              <Chips label="Subjects" options={subjectOptions} value={p.subjects} onToggle={(id) => update((x) => toggleIn(x, 'subjects', id))} hint="Choose every subject you teach." />
              {subjectOptions.length === 0 && <p className="note">No standard subject matches. Add it below.</p>}
              <form className="row" onSubmit={(e) => { e.preventDefault(); const v = custom.trim(); if (v) update((x) => normalizeProfile({ ...x, customSubjects: [...x.customSubjects, v] })); setCustom(''); }}>
                <label style={{ flex: 1 }}>Another subject<input value={custom} maxLength={40} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Robotics" /></label><button className="btn small" type="submit">Add</button>
              </form>
              {p.customSubjects.length > 0 && <ul className="row" style={{ listStyle: 'none', padding: 0, flexWrap: 'wrap', gap: 6 }}>{p.customSubjects.map((c) => <li key={c}><button type="button" className="btn small ghost" aria-label={`Remove ${c}`} onClick={() => update((x) => ({ ...x, customSubjects: x.customSubjects.filter((y) => y !== c) }))}>{c} ✕</button></li>)}</ul>}
            </div>
          )}
          {key === 'grades' && (
            <div className="stack">
              <p className="note">Pick the exact grades, not just “primary” or “secondary”. UK Year numbers are shown for reference.</p>
              {gradeGroups.map((g) => <Chips key={g.name} label={g.name} options={GRADES.filter((o) => g.ids.includes(o.id))} value={p.grades} onToggle={(id) => update((x) => toggleIn(x, 'grades', id))} hint={g.name} />)}
            </div>
          )}
          {key === 'map' && (
            p.subjects.length === 0 || p.grades.length === 0 ? <p className="info">Pick at least one subject and one grade first, then you can say which grades each subject is taught at.</p> : (
              <div className="stack">
                <p className="note">By default every subject uses every grade you picked. Narrow a subject only if it differs.</p>
                {p.subjects.map((s) => (
                  <div key={s} className="stack" style={{ gap: 6 }}>
                    <b>{labelOf('subject', s)} <span className="note">· {describeGrades(gradesForSubject(p, s))}{p.subjectGrades[s] ? '' : ' (all)'}</span></b>
                    <Chips label={`${labelOf('subject', s)} grades`} options={GRADES.filter((g) => p.grades.includes(g.id))} value={gradesForSubject(p, s)} onToggle={(id) => update((x) => { const cur = gradesForSubject(x, s); return setSubjectGrades(x, s, cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]); })} />
                  </div>
                ))}
              </div>
            )
          )}
          {key === 'curricula' && (
            <div className="stack">
              <Chips label="Curricula" options={CURRICULA} value={p.curricula} onToggle={(id) => update((x) => toggleIn(x, 'curricula', id))} hint="Choose any that apply. This only filters the library; it is not a claim that a quiz is formally aligned." />
              <form className="row" onSubmit={(e) => { e.preventDefault(); const v = custom.trim(); if (v) update((x) => normalizeProfile({ ...x, customCurricula: [...x.customCurricula, v] })); setCustom(''); }}>
                <label style={{ flex: 1 }}>Other programme<input value={custom} maxLength={40} onChange={(e) => setCustom(e.target.value)} /></label><button className="btn small" type="submit">Add</button>
              </form>
              {p.customCurricula.length > 0 && <p className="note">Also: {p.customCurricula.join(', ')}</p>}
            </div>
          )}
          {key === 'languages' && (
            <div className="stack">
              <p className="info">Quiz Studio’s interface is English for now. Translations will be offered here when they genuinely exist.</p>
              <Chips label="Teaching language" options={LANGUAGES} value={p.languages.teaching} onToggle={(id) => update((x) => toggleLanguage(x, 'teaching', id))} hint="The language you speak in class." />
              <Chips label="Quiz content language" options={LANGUAGES} value={p.languages.content} onToggle={(id) => update((x) => toggleLanguage(x, 'content', id))} hint="The language you want quiz questions in." />
            </div>
          )}
          {key === 'context' && (
            <div className="stack">
              <Chips label="How you play" options={CONTEXTS} value={p.contexts} onToggle={(id) => update((x) => toggleIn(x, 'contexts', id))} hint="Choose all that apply." />
              <ul className="note">{CONTEXTS.filter((c) => p.contexts.includes(c.id)).map((c) => <li key={c.id}><b>{c.label}:</b> {c.hint}</li>)}</ul>
              <div role="group" aria-label="Typical lesson length" className="stack" style={{ gap: 8 }}><b>Typical session length</b>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{LENGTHS.map((o) => <button key={o.id} type="button" className={`btn small ${p.sessionLength === o.id ? '' : 'ghost'}`} aria-pressed={p.sessionLength === o.id} onClick={() => update((x) => ({ ...x, sessionLength: x.sessionLength === o.id ? null : o.id }))}>{o.label}</button>)}</div></div>
              <div role="group" aria-label="Group size" className="stack" style={{ gap: 8 }}><b>Group size</b>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{GROUP_SIZES.map((o) => <button key={o.id} type="button" className={`btn small ${p.groupSize === o.id ? '' : 'ghost'}`} aria-pressed={p.groupSize === o.id} onClick={() => update((x) => ({ ...x, groupSize: x.groupSize === o.id ? null : o.id }))}>{o.label}</button>)}</div></div>
            </div>
          )}
          {key === 'workspace' && (
            <div className="stack">
              <p>{p.subjects.length || p.customSubjects.length ? <>You teach <b>{summarize(p) || p.customSubjects.join('; ')}</b>.</> : 'No subjects chosen yet.'}</p>
              {hints(p).length > 0 && <ul className="note">{hints(p).map((h) => <li key={h.step}><button type="button" className="textlink" onClick={() => go(TEACHER_STEPS.indexOf(h.step))}>{h.message}</button></li>)}</ul>}
              <p className="note">Your library will highlight matching quizzes first. You can always browse every subject, and clear this profile at any time.</p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <Link className="btn" href="/quiz/library" onClick={() => update((x) => complete(x))}>Open my library</Link>
                <Link className="btn cyan" href="/quiz/modes" onClick={() => update((x) => complete(x))}>Host a class</Link>
                <Link className="btn ghost" href="/quiz/new" onClick={() => update((x) => complete(x))}>Create a quiz</Link>
              </div>
            </div>
          )}

          <div className="row spread" style={{ marginTop: 8 }}>
            <button type="button" className="btn ghost" disabled={step === 0} onClick={() => go(step - 1)}>Back</button>
            <div className="row">
              {!finished && <Link className="textlink" href="/quiz" onClick={() => update((x) => dismiss(x))}>Skip all for now</Link>}
              {!last ? <button type="button" className="btn" onClick={() => go(step + 1)}>{(key === 'subjects' && !p.subjects.length) || (key === 'grades' && !p.grades.length) ? 'Skip this step' : 'Next'}</button>
                : <button type="button" className="btn" onClick={() => update((x) => complete(x))}>{finished ? 'Saved ✓' : 'Finish setup'}</button>}
            </div>
          </div>
        </>
      )}
      {(p.completedAt || p.dismissedAt || p.subjects.length > 0) && (
        <p className="note"><button type="button" className="textlink" onClick={() => { if (window.confirm('Clear your teaching profile from this browser?')) { clearProfile(); setP(emptyProfile()); setSaved(null); } }}>Clear my profile</button></p>
      )}
    </section>
  );
}
