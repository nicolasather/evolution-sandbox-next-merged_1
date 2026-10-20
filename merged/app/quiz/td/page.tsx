import type { Metadata } from 'next';
import Link from 'next/link';
import { MAPS } from '@/lib/quiz/td/maps';
import { BOSSES, ENEMIES, ROLES, TOWERS } from '@/lib/quiz/td/balance';
import { TD_ENEMIES, TD_MAPS, TD_ROLES, TD_TOWERS } from '@/lib/quiz/td/domain';
import './td.css';
export const metadata: Metadata = { title: 'Tower Defense' };

/** How the online Tower Defense works, with the three ways in: host with a quiz, join with a code, or practice alone. */
export default function TDHub() {
  return (
    <main className="td" id="main">
      <div className="td-hub">
        <section className="td-hubhero">
          <div>
            <h1>Tower Defense</h1>
            <p>Every student plays on their own device, in a squad of 1 to 5. Correct answers earn points; the squad spends them on towers between waves and keeps enemies away from its core.</p>
            <p>Co-op puts the class on one board. Competitive puts 2–4 squads on identical maps with identical waves, ranked by waves cleared, then core health, then accuracy.</p>
            <div className="td-row wrap" style={{ marginTop: 12 }}>
              <Link className="td-btn primary" href="/quiz/library?mode=online&game=tower_defense">Host with a quiz</Link>
              <Link className="td-btn" href="/quiz/td/join">Join with a code</Link>
              <Link className="td-btn" href="/quiz/td/practice">Practice alone</Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static original SVG */}
          <img src="/quiz/td/map_meadow_circuit_board.svg" alt="The Meadow Circuit map: a lane winds from the gate on the left to the core on the right, with square tower pads beside it" width={1280} height={768} />
        </section>
        <ol className="td-loop" aria-label="One round">
          <li><b>Answer</b>Everyone gets the same question and the same reading time. Speed earns nothing.</li>
          <li><b>Review</b>See the answer and the explanation. Your squad earns points by how many got it right.</li>
          <li><b>Build</b>Spend points on towers, upgrades and abilities. Nothing costs anything until the server accepts it.</li>
          <li><b>Defend</b>The wave runs on its own. Towers fire; leaks cost core health.</li>
        </ol>
        <section className="td-hubgrid">
          <div className="td-panel"><h2>Six towers</h2><div className="td-artrow">{TD_TOWERS.map((k) => <figure key={k} style={{ margin: 0, textAlign: 'center' }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/quiz/td/tower_${k}_l1.svg`} alt="" width={56} height={56} /><figcaption className="td-note">{TOWERS[k].name}</figcaption></figure>)}</div><p className="td-note">Three levels each; at level 3 choose one of two branches.</p></div>
          <div className="td-panel"><h2>Eight enemies</h2><div className="td-artrow">{TD_ENEMIES.map((k) => <figure key={k} style={{ margin: 0, textAlign: 'center' }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/quiz/td/enemy_${k}_idle.svg`} alt="" width={56} height={56} /><figcaption className="td-note">{ENEMIES[k].name}</figcaption></figure>)}</div><p className="td-note">Armored, shielded, flying and splitting enemies each need a different answer.</p></div>
          <div className="td-panel"><h2>Five roles</h2><ul className="td-roster">{TD_ROLES.map((r) => <li key={r}><img src={`/quiz/td/role_${r}.svg`} alt="" width={28} height={28} /><span><b>{ROLES[r].name}</b> — {ROLES[r].passive}</span></li>)}</ul><p className="td-note">Optional. Everyone answers and builds.</p></div>
        </section>
        <section className="td-panel">
          <h2>Three maps, three bosses</h2>
          <ul className="td-roster">{TD_MAPS.map((m) => <li key={m}><b>{MAPS[m].title}</b>&nbsp;— {MAPS[m].materials.replace(/ · /g, ', ')}. Boss: {BOSSES[MAPS[m].boss].name}. {BOSSES[MAPS[m].boss].summary}</li>)}</ul>
          <p className="td-note">Every boss effect is announced a second before it happens. Low pressure mode keeps the core from falling.</p>
        </section>
      </div>
    </main>
  );
}
