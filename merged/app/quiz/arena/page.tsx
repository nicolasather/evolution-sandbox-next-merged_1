import type { Metadata } from 'next';
import Link from 'next/link';
import { FORMAT_COPY, HELPER_COPY } from '@/lib/quiz/arena/balance';
import { FORMATS, HELPERS, MAP_IDS, ROLES } from '@/lib/quiz/arena/domain';
import { MAP_INFO } from '@/lib/quiz/arena/maps';
import { ROLE_INFO } from '@/components/quiz/arena/art';
import { FormatIcon, HelperIcon, RoleIcon } from '@/components/quiz/arena/icons';
import './arena.css';
export const metadata: Metadata = { title: 'Arena Clash' };

/** How Arena Clash works, with the three ways in: host with a quiz, join with a code, or practice alone. */
export default function ArenaHub() {
  return (
    <main className="ar" id="main">
      <div className="ar-hub">
        <section className="ar-hero2">
          <div>
            <h1>Arena Clash</h1>
            <p>2–4 teams of 1–5 students share one friendly arena on their own devices. Teams race to the same goals — nobody can attack, block or slow anyone. Between rounds the arena freezes for one class question; correct answers earn the points a team spends on a small helper.</p>
            <p>The quiz always counts at least half of the final score. Scores are scaled so a team of three is never at a disadvantage against a team of five.</p>
            <div className="ar-row wrap">
              <Link className="ar-btn primary" href="/quiz/library?mode=online&game=arena_clash">Host with a quiz</Link>
              <Link className="ar-btn" href="/quiz/arena/join">Join with a code</Link>
              <Link className="ar-btn" href="/quiz/arena/practice">Practice with bots</Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static original art */}
          <img src="/quiz/arena/art/14_landing_hub.svg" alt="Arena Clash landing: three formats and a join code" width={640} height={360} />
        </section>
        <ol className="ar-loop" aria-label="One round">
          <li><b>Question</b>The arena freezes. Everyone answers the same question.</li><li><b>Review</b>See the answer and why. Speed earns nothing.</li>
          <li><b>Plan</b>Spend the team’s points on one helper for the next round.</li><li><b>Play</b>Steer your token toward the goal. Abilities help the team.</li>
        </ol>
        <section className="ar-hubgrid">
          <div className="ar-card"><h2>Three formats</h2><ul className="ar-roster">{FORMATS.map((f) => <li key={f}><FormatIcon format={f} size={30} /><span><b>{FORMAT_COPY[f].name}</b> — {FORMAT_COPY[f].blurb}</span></li>)}</ul></div>
          <div className="ar-card"><h2>Five roles</h2><ul className="ar-roster">{ROLES.map((r) => <li key={r}><RoleIcon role={r} size={32} /><span><b>{ROLE_INFO[r].name}</b> — {ROLE_INFO[r].how}</span></li>)}</ul><p className="ar-note">A team of one plays the Runner; bigger teams unlock all five.</p></div>
          <div className="ar-card"><h2>Four helpers</h2><ul className="ar-roster">{HELPERS.map((h) => <li key={h}><HelperIcon helper={h} size={28} /><span><b>{HELPER_COPY[h].name}</b> — {HELPER_COPY[h].blurb}</span></li>)}</ul><p className="ar-note">Points are the only currency and come only from correct answers.</p></div>
        </section>
        <section className="ar-card"><h2>Three maps</h2>
          <ul className="ar-roster">{MAP_IDS.map((m) => <li key={m}><b>{MAP_INFO[m].title}</b>&nbsp;— {MAP_INFO[m].blurb}</li>)}</ul>
          <p className="ar-note">Each map is one sector rotated around the middle, so every team has the same distance to everything. Reduced motion, colour-blind shapes, keyboard and touch controls are always available.</p>
        </section>
      </div>
    </main>
  );
}
