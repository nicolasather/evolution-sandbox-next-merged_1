'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useMemo } from 'react';
import { checkTheme } from '@/lib/quiz/contrast';
import { THEMES, themeInfo } from '@/lib/quiz/settings';
import { questionSchema } from '@/lib/quiz/validation';
import { prepare } from '@/lib/quiz/editor-model';
import { publicPayload } from '@/lib/quiz/public';
import type { Question } from '@/lib/quiz/types';
import ThemeScope from '@/components/quiz/ThemeScope';
import QuestionPlay, { type PlayQuestion } from '@/components/quiz/QuestionPlay';
import CreatorChrome from '../CreatorChrome';
import { useCreator } from '../CreatorProvider';

const SAMPLE: PlayQuestion = {
  id: 'sample', kind: 'multiple_choice', prompt: 'Sample question: which option is the right one?', base_points: 100,
  payload: { options: [{ id: 'a', text: 'First option' }, { id: 'b', text: 'Second option' }, { id: 'c', text: 'Third option' }, { id: 'd', text: 'Fourth option' }] },
};

export default function AppearanceStep() {
  const c = useCreator();
  const t = c.settings.theme; const info = themeInfo[t.id];
  const checks = useMemo(() => checkTheme(info.vars), [info]);
  const sample = useMemo<PlayQuestion>(() => {
    const first = c.questions.map((q) => questionSchema.safeParse(prepare(q))).find((r) => r.success);
    if (!first || !first.success) return SAMPLE;
    const v = first.data as Question;
    return { id: 'theme-sample', kind: v.kind, prompt: v.prompt, base_points: v.basePoints, payload: publicPayload(v.kind, v.payload, 'theme-sample') };
  }, [c.questions]);

  if (!c.ready) return <CreatorChrome step="appearance"><p className="muted-text" role="status">Loading your draft…</p></CreatorChrome>;
  if (!c.draftKey) return <CreatorChrome step="appearance" canContinue={false} continueHint="Choose a game mode first."><p className="info">Start with <Link href="/quiz/create/mode">choosing a game mode</Link>.</p></CreatorChrome>;

  return (
    <CreatorChrome step="appearance">
      <div className="cr-two">
        <section className="panel stack" aria-labelledby="ap-h">
          <h2 id="ap-h">Colour theme</h2>
          <div className="cr-themes" role="radiogroup" aria-label="Colour theme">
            {THEMES.map((id) => (
              <button key={id} role="radio" aria-checked={t.id === id} className="cr-theme" onClick={() => c.patchSettings({ theme: { ...t, id } })}>
                <Image src={themeInfo[id].art} alt="" width={500} height={300} unoptimized />
                <strong>{themeInfo[id].label}</strong><small>{themeInfo[id].blurb}</small>
              </button>
            ))}
          </div>
          <label className="inline"><input type="checkbox" checked={t.reducedMotion} onChange={(e) => c.patchSettings({ theme: { ...t, reducedMotion: e.target.checked } })} /> Reduced motion — no movement on play screens (also automatic when a device asks for it)</label>
          <label className="inline"><input type="checkbox" checked={t.muted} onChange={(e) => c.patchSettings({ theme: { ...t, muted: e.target.checked } })} /> Mute sound effects</label>
          <div>
            <h3>Accessibility check</h3>
            <ul className="cr-contrast">{checks.map((k) => (
              <li key={k.label} data-pass={k.pass}><span>{k.label}</span><strong>{k.ratio}:1</strong><span className={k.pass ? 'pill published' : 'pill'}>{k.pass ? 'Pass' : `Needs ${k.need}:1`}</span></li>
            ))}</ul>
            <p className="note">Checked against WCAG AA. {checks.every((k) => k.pass) ? 'This theme is readable on a projector and on a phone.' : 'Consider the High Contrast theme.'}</p>
          </div>
        </section>

        <aside aria-label="Live preview" className="cr-live">
          <p className="eyebrow">Live preview</p>
          <ThemeScope theme={t} className="cr-live-screen">
            <div className="qz-stage-panel">
              <QuestionPlay question={sample} onSubmit={async () => undefined} submitLabel="Submit answer" />
            </div>
          </ThemeScope>
          <p className="note">Shows {sample.id === 'sample' ? 'a sample question' : 'your first valid question'}. Nothing is scored here.</p>
        </aside>
      </div>
    </CreatorChrome>
  );
}
