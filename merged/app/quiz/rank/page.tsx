import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'User Rank Board',
  description: 'Rank among users by XP, score, streak and performance.',
};

export default function RankPage() {
  return (
    <main id="main" style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>🏆 User Rank Board</h1>
      <p>Ranked by composite score (XP + room scores + streak + performance).</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
        <Link href="/quiz" className="btn">← Back to Quiz</Link>
        <Link href="/quiz/rank?metric=composite" className="btn cyan">Rank (Composite)</Link>
        <Link href="/quiz/rank?metric=xp" className="btn">By XP</Link>
        <Link href="/quiz/rank?metric=score" className="btn">By Score</Link>
      </div>
      <section aria-label="How ranking works" style={{ marginTop: 40, padding: 20, background: '#f8fafc', borderRadius: 12 }}>
        <h2>How it works</h2>
        <ul>
          <li><strong>XP (50%)</strong> — Earned across quizzes and activities.</li>
          <li><strong>Room Score (30%)</strong> — Points from game sessions.</li>
          <li><strong>Streak (15%)</strong> — Consecutive active days.</li>
          <li><strong>Performance (5%)</strong> — Accuracy and fast answers.</li>
        </ul>
      </section>
    </main>
  );
}