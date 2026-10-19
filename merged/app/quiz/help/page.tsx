import type { Metadata } from 'next';
import Link from 'next/link';
import PrivacyPanel from '@/components/quiz/PrivacyPanel';
export const metadata: Metadata = { title: 'Help center' };
const FAQ: [string, string][] = [
  ['How do I make a quiz?', 'Open Create a Quiz and follow the six steps: Basics, Questions, Media, Review, Preview and Publish. Your work autosaves.'],
  ['Which question types are there?', 'Multiple choice, True/False, Short answer, Number and Ordering. Multiple choice can allow several correct answers.'],
  ['How do players join?', 'Players open Join a Game and enter the room code. Hosts can require approval or lock the room.'],
  ['Are answers hidden before reveal?', 'Yes. Correct answers, hints and explanations stay on the server until the host reveals them.'],
  ['What is Quiet Classroom?', 'A calm preset: untimed, no ranking pressure, reduced motion and no reactions.'],
  ['How do I report a wrong question?', 'Use Report on the quiz page or during a game. Reports go to the quiz owner and a review queue.'],
  ['What are collectibles?', 'Cosmetic icons earned through learning milestones. They cannot be bought, traded or drawn at random, and hosts or players can switch them off.'],
  ['How do I keep a guest quiz?', 'Use Save to an account on the guest banner before clearing browser data.'],
];
export default function Help() {
  return (
    <main className="qz-main" id="main">
      <nav className="qz-crumbs" aria-label="Breadcrumb"><Link href="/quiz">Quiz Studio</Link> / <span>Help center</span></nav>
      <h1>Help center</h1>
      <div>{FAQ.map(([q, a]) => <details key={q} className="panel"><summary>{q}</summary><p>{a}</p></details>)}</div>
      <section className="panel"><h2>Contact</h2><p>Questions or safety concerns: use the Report button on any quiz, or contact your school administrator or the site owner via the repository’s issue tracker.</p></section>
      <PrivacyPanel />
    </main>
  );
}
