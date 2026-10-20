import type { Metadata } from 'next';
import Link from 'next/link';
import { ROLES } from '@/lib/swarm/domain';
import { ROLE_DEFS, BOSS_DEFS, UPGRADE_DEFS, ENEMY_DEFS } from '@/lib/swarm/balance';
import { BOSS_KINDS, UPGRADES, ENEMY_KINDS } from '@/lib/swarm/domain';
import './swarm.css';
export const metadata: Metadata = { title: 'Swarm Survival' };

/** How Swarm Survival works, with the three ways in. Everything shown is read from the same balance tables the game uses. */
export default function SwarmHub() {
  return (
    <main className="sw hub" id="main">
      <section className="sw-hero">
        <div>
          <h1>Swarm Survival</h1>
          <p>Every student controls their own avatar on their own device. Together you defend a beacon from waves of swarming creatures. Between waves the whole team answers a question; correct answers earn points to spend on upgrades.</p>
          <p>Co-op puts the class on one beacon. Versus puts 2–4 teams on identical arenas with identical waves, ranked by waves cleared, then beacon health, then damage and accuracy. Teams of 1 to 5.</p>
          <div className="sw-row">
            <Link className="sw-btn primary" href="/quiz/library?mode=online&game=swarm_survival">Host with a quiz</Link>
            <Link className="sw-btn" href="/quiz/swarm/join">Join with a code</Link>
            <Link className="sw-btn" href="/quiz/swarm/practice">Practice alone</Link>
          </div>
        </div>
      </section>
      <ol className="sw-loop" aria-label="One round">
        <li><b>Fight</b>Move with WASD or the stick. You shoot on your own; your ability is one button.</li>
        <li><b>Freeze</b>When a question appears the whole arena stops for everyone. Nothing happens while you read.</li>
        <li><b>Answer</b>Same question, same time. Speed earns nothing. Points come from how many on the team were right.</li>
        <li><b>Upgrade</b>Vote on one upgrade. Then a 3-2-1 count before the next wave.</li>
      </ol>
      <section className="sw-grid">
        <div className="sw-card"><h2>Five roles</h2><ul className="sw-list">{ROLES.map((r) => <li key={r} style={{ ['--rc' as string]: ROLE_DEFS[r].color }}><b>{ROLE_DEFS[r].label}</b> — {ROLE_DEFS[r].blurb} Ability: {ROLE_DEFS[r].ability}.</li>)}</ul><p className="sw-note">A play style, not a rank. Everyone answers and earns points.</p></div>
        <div className="sw-card"><h2>Eight creatures</h2><ul className="sw-list">{ENEMY_KINDS.map((k) => <li key={k}><b>{ENEMY_DEFS[k].label}</b> — {ENEMY_DEFS[k].note}.</li>)}</ul></div>
        <div className="sw-card"><h2>Three bosses</h2><ul className="sw-list">{BOSS_KINDS.map((k) => <li key={k}><b>{BOSS_DEFS[k].label}</b> — {BOSS_DEFS[k].summary}</li>)}</ul><p className="sw-note">Every boss attack is shown before it lands. Low pressure mode lengthens the warnings.</p></div>
        <div className="sw-card"><h2>Eight upgrades</h2><ul className="sw-list">{UPGRADES.map((k) => <li key={k}><b>{UPGRADE_DEFS[k].label}</b> — {UPGRADE_DEFS[k].effect}.</li>)}</ul></div>
      </section>
      <section className="sw-card"><h2>Fair by design</h2><ul className="sw-list"><li>Your device never decides a score. The game server does all grading and all combat.</li><li>The answer is never sent to a device before the reveal.</li><li>Small teams are balanced: the beacon, enemy count and boss scale with how many are playing.</li><li>No chat, no purchases, no gambling, no user-made content.</li></ul></section>
    </main>
  );
}
