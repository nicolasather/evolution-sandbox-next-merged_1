'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { dismiss, emptyProfile, loadProfile, saveProfile, shouldShowOnboarding, summarize, type Profile } from '@/lib/quiz/onboarding/profile';

/** First-visit invitation for teachers (once, until completed or dismissed). Returning teachers with a profile see a one-line reminder of what the library is tuned to. */
export default function OnboardingPrompt() {
  const [p, setP] = useState<Profile | null>(null);
  /* browser storage only exists after hydration */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setP(loadProfile()); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  if (!p) return null;
  if (shouldShowOnboarding(p)) {
    return (
      <aside className="panel row spread" role="region" aria-label="Set up Quiz Studio" style={{ margin: '16px auto', maxWidth: 1100 }}>
        <div><b>New here? Tune Quiz Studio to your classes.</b><p className="note" style={{ margin: 0 }}>Choose your subjects, exact grades and curriculum in about two minutes. Optional, no email needed.</p></div>
        <div className="row"><Link className="btn" href="/quiz/welcome">Set up</Link><button className="btn ghost" type="button" onClick={() => { const d = dismiss(p); saveProfile(d); setP(d || emptyProfile()); }}>Not now</button></div>
      </aside>
    );
  }
  if (p.completedAt && p.subjects.length) return <aside className="note" style={{ margin: '12px auto', maxWidth: 1100, padding: '0 16px' }}>Library tuned to {summarize(p)}. <Link className="textlink" href="/quiz/welcome">Edit</Link></aside>;
  return null;
}
