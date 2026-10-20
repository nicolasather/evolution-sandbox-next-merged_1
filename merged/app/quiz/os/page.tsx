import type { Metadata } from 'next';
import Link from 'next/link';
import { PERK_COPY, PERKS } from '@/lib/quiz/os/balance';
import { HAZARD_KINDS, PERK_IDS, ROLES } from '@/lib/quiz/os/domain';
import { BASE_COURSES, MAP_INFO } from '@/lib/quiz/os/course';
import { HazardIcon, KIND_NAME, KIND_NOTE, ROLE_INFO, RoleIcon } from '@/components/quiz/os/art';
import './os.css';
export const metadata: Metadata = { title: 'Obstacle Survival' };

/** How the online Obstacle Survival works, with the three ways in: host with a quiz, join with a code, or practice alone. */
export default function OSHub() {
  return (
    <main className="os" id="main">
      <div className="os-hub">
        <section className="os-hero2">
          <div>
            <h1>Obstacle Survival</h1>
            <p>Every student runs a 2D course on their own device, in a squad of 1 to 5. The course freezes at each gate for one class question; correct answers earn points the squad spends at the checkpoint shop.</p>
            <p>Cooperative escape puts the class on one course. The relay race puts 2–4 squads on identical courses, scored 45% progress, 40% mastery and 15% teamwork.</p>
            <div className="os-row wrap">
              <Link className="os-btn primary" href="/quiz/library?mode=online&game=obstacle_survival">Host with a quiz</Link>
              <Link className="os-btn" href="/quiz/os/join">Join with a code</Link>
              <Link className="os-btn" href="/quiz/os/practice">Practice alone</Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static original art */}
          <img src="/quiz/os/art/01_desktop_traverse.svg" alt="A course run: a winding paper lane with hazards, a squad panel and a chapter banner" width={640} height={360} />
        </section>
        <ol className="os-loop" aria-label="One chapter">
          <li><b>Run</b>Cross the next stretch. Hazards warn before they hurt.</li><li><b>Freeze</b>At the gate the world stops. Nobody can be hurt while answering.</li>
          <li><b>Review</b>See the answer and why. Speed earns nothing.</li><li><b>Shop</b>Spend points on safety rails, shortcuts and more, then run again.</li>
        </ol>
        <section className="os-hubgrid">
          <div className="os-card"><h2>Five roles</h2><ul className="os-roster">{ROLES.map((r) => <li key={r}><RoleIcon role={r} size={34} /><span><b>{ROLE_INFO[r].name}</b> — {ROLE_INFO[r].short}</span></li>)}</ul><p className="os-note">Every role can finish the course alone.</p></div>
          <div className="os-card"><h2>Twelve hazards</h2><ul className="os-roster">{HAZARD_KINDS.map((k) => <li key={k}><HazardIcon kind={k} size={30} /><span><b>{KIND_NAME[k]}</b> — {KIND_NOTE[k]}</span></li>)}</ul></div>
          <div className="os-card"><h2>Eight upgrades</h2><ul className="os-roster">{PERK_IDS.map((p) => <li key={p}><span className="os-perkicon" aria-hidden="true">•</span><span><b>{PERK_COPY[p].name}</b> ({PERKS[p]} pts) — {PERK_COPY[p].blurb}</span></li>)}</ul><p className="os-note">Points are the only currency.</p></div>
        </section>
        <section className="os-card"><h2>Four maps</h2>
          <ul className="os-roster">{MAP_INFO.map((m) => <li key={m.id}><b>{m.name}</b>&nbsp;— {BASE_COURSES[m.id].hazards.length} hazards, {BASE_COURSES[m.id].checkpoints.length} checkpoints. Every run adds a seeded rhythm variation that is checked to be solvable.</li>)}</ul>
          <p className="os-note">Gentle timing lengthens every warning. Reduced motion, colour-blind patterns, keyboard and touch controls are always available.</p>
        </section>
      </div>
    </main>
  );
}
