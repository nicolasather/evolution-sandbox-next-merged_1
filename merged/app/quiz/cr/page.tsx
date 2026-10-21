import type { Metadata } from 'next';
import Link from 'next/link';
import { DIFFICULTY_COPY, FORMAT_COPY, PERK_COPY, ROLE_INFO as BAL_ROLES } from '@/lib/quiz/cr/balance';
import { FORMATS, MAP_IDS, PERKS, ROLES } from '@/lib/quiz/cr/domain';
import { MAP_INFO } from '@/lib/quiz/cr/maps';
import { FormatIcon, PerkIcon, RoleIcon } from '@/components/quiz/cr/icons';
import './cr.css';
export const metadata: Metadata = { title: 'Clue Racing' };

const SHOT: Record<string, string> = { sunleaf_passage: '02_sunleaf_gameplay', tideglass_harbor: '03_tideglass_gameplay', copperwind_borough: '04_copperwind_gameplay', starpetal_heights: '05_starpetal_gameplay' };
/** How Clue Racing works, with the three ways in: host with a quiz, join with a code, or practice alone. */
export default function CRHub() {
  return (
    <main className="cr" id="main">
      <div className="cr-hub">
        <section className="cr-hero2">
          <div>
            <h1>Clue Racing</h1>
            <p>Every student races on their own device across one illustrated course. The class answers a question at every checkpoint — the whole race freezes while they do — and the answers unfold the clue that tells each team where to go next.</p>
            <p>Teams of one to five walk the same course at the same speed. Nobody can attack, block or slow anyone: speed never earns points, and the quiz carries most of the score.</p>
            <div className="cr-row wrap">
              <Link className="cr-btn primary" href="/quiz/library?mode=online&game=clue_racing">Host with a quiz</Link>
              <Link className="cr-btn" href="/quiz/cr/join">Join with a code</Link>
              <Link className="cr-btn" href="/quiz/cr/practice">Practice alone</Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static original art */}
          <img src="/quiz/cr/art/svg/01_mode_hub.svg" alt="Clue Racing: an illustrated course with a clue board and a route fork" width={640} height={360} />
        </section>
        <ol className="cr-loop" aria-label="One leg">
          <li><b>Race</b>Walk the course to the next checkpoint.</li><li><b>Question</b>The world freezes. Everyone answers the same question.</li>
          <li><b>Clue</b>The class’s answers unfold the next clue.</li><li><b>Route</b>Vote on a road and spend points on a small perk.</li>
        </ol>
        <section className="cr-hubgrid cr-hubcards">
          <div className="cr-card"><h2>Three formats</h2><ul className="cr-roster">{FORMATS.map((f) => <li key={f}><FormatIcon format={f} size={30} /><span><b>{FORMAT_COPY[f].name}</b> — {FORMAT_COPY[f].blurb}</span></li>)}</ul></div>
          <div className="cr-card"><h2>Six roles</h2><ul className="cr-roster">{ROLES.map((r) => <li key={r}><RoleIcon role={r} size={32} /><span><b>{BAL_ROLES[r].name}</b> — {BAL_ROLES[r].how}</span></li>)}</ul><p className="cr-note">A team of one plays the Solo Pathfinder; teams of two to five use each of the five team roles at most once.</p></div>
          <div className="cr-card"><h2>Four perks</h2><ul className="cr-roster">{PERKS.map((p) => <li key={p}><PerkIcon perk={p} size={28} /><span><b>{PERK_COPY[p].name}</b> — {PERK_COPY[p].blurb}</span></li>)}</ul><p className="cr-note">Points are the only currency and come only from correct answers.</p></div>
        </section>
        <section className="cr-card"><h2>Four handcrafted maps</h2>
          <ul className="cr-maps2">{MAP_IDS.map((m) => <li key={m}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static original art */}
            <img src={`/quiz/cr/art/svg/${SHOT[m]}.svg`} alt={`${MAP_INFO[m].title}: a play composition`} width={320} height={180} loading="lazy" />
            <b>{MAP_INFO[m].title}</b><span>{MAP_INFO[m].blurb}</span></li>)}</ul>
          <p className="cr-note">{DIFFICULTY_COPY.normal} Reduced motion, colour-blind team shapes, keyboard and touch controls, and a gentle-timing option are always available.</p>
        </section>
      </div>
    </main>
  );
}
