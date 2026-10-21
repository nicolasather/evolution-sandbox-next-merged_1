import type { Metadata } from 'next';
import Link from 'next/link';
import { DAILY_AMOUNT, REFERRAL, TEACHING } from '@/lib/quiz/rewards/eligibility';
import { EARN_CAPS, PERSISTENCE_GATE } from '@/lib/quiz/rewards/coins';
import { MISSIONS, WEEKLY_COIN_CAP } from '@/lib/quiz/rewards/missions';
export const metadata: Metadata = { title: 'Coins & rewards' };

export default function Rewards() {
  return (
    <main id="main" className="page">
      <nav aria-label="Breadcrumb" className="note"><Link href="/quiz">Quiz Studio</Link> › Coins &amp; rewards</nav>
      <header className="page-header"><div><p className="eyebrow">How rewards work</p><h1>Points, Coins and cosmetics</h1>
        <p className="muted-text" style={{ maxWidth: '64ch' }}><b>Points</b> exist inside one game and decide that game’s score. <b>Coins</b> are a separate, cosmetic-only currency for avatars, frames, badges and backgrounds. Coins never buy a correct answer, a grade or any game advantage.</p></div>
        <Link className="btn" href="/quiz/collection">Open my collection</Link></header>
      <p className="info" role="status" data-testid="coins-gate"><b>Status:</b> {PERSISTENCE_GATE} The rules below are implemented and tested; turning on stored balances needs a reviewed database migration and your approval.</p>

      <section className="panel stack" aria-labelledby="earn-h"><h2 id="earn-h">What earns Coins</h2>
        <ul>
          <li><b>Daily learning reward</b> — {DAILY_AMOUNT} Coins once per day, after finishing a quiz of at least three questions. Opening the app earns nothing.</li>
          <li><b>Weekly missions</b> — at most {EARN_CAPS.weekly_mission?.perWeek} per week and {WEEKLY_COIN_CAP} Coins in total. Missions are about learning, never about time on screen.</li>
          <li><b>Teacher milestones</b> — for genuine live classes: at least {TEACHING.minQuestions} questions taught and marked, {TEACHING.minActiveSeconds / 60} active minutes (idle time and pauses excluded), up to {TEACHING.maxPerDay} per day. Students never need accounts.</li>
          <li><b>Teacher referrals</b> — only when the new teacher teaches a qualifying class; up to {REFERRAL.maxPerYear} a year; never aimed at children.</li>
        </ul></section>
      <section className="panel stack" aria-labelledby="mis-h"><h2 id="mis-h">This week’s mission types</h2>
        <ul>{MISSIONS.map((m) => <li key={m.id}><b>{m.title}</b> · {m.coins} Coins · for {m.audience === 'both' ? 'everyone' : `${m.audience}s`}</li>)}</ul></section>
      <section className="panel stack" aria-labelledby="fair-h"><h2 id="fair-h">Fair by design</h2>
        <ul><li>Learning streaks forgive a rest day each week, skip school breaks, and fade gently instead of vanishing. You can hide yours.</li>
          <li>Every grant has a unique id, so a repeated request can never pay twice, and every change appears in your history.</li>
          <li>Reward pop-ups wait until a question or session is over.</li></ul></section>
    </main>
  );
}
