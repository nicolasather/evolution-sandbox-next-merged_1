'use client';
import type { Loose } from '@/lib/quiz/loose';
/** The player's whole screen: status bar, arena, and the panel that matches the current phase. Used for online matches and for Practice (same code, different transport). */
import type { SwarmConnection } from '@/lib/swarm/client/connection';
import { BOSS_DEFS, ROLE_DEFS } from '@/lib/swarm/balance';
import { ROLES, type BossKind } from '@/lib/swarm/domain';
import Arena from './Arena';
import { ConnBadge, Hud, LobbyPanel, PauseOverlay, QuestionPanel, DraftPanel, ReadyBanner, RoleBadge } from './panels';
import { ResultsPanel } from './SwarmResults';
import { cue, type Prefs } from './prefs';

type A = Record<string, Loose>;
export function PrefsBar({ prefs, set }: { prefs: Prefs; set: (p: Partial<Prefs>) => void }) {
  return (
    <details className="sw-prefs"><summary>Display and sound</summary>
      <label><input type="checkbox" checked={prefs.reduced} onChange={(e) => set({ reduced: e.target.checked })} /> Reduce motion (static markers instead of bursts)</label>
      <label><input type="checkbox" checked={prefs.contrast} onChange={(e) => set({ contrast: e.target.checked })} /> High contrast</label>
      <label><input type="checkbox" checked={prefs.names} onChange={(e) => set({ names: e.target.checked })} /> Show names above avatars</label>
      <label><input type="checkbox" checked={prefs.large} onChange={(e) => set({ large: e.target.checked })} /> Larger text</label>
      <label><input type="checkbox" checked={prefs.sound} onChange={(e) => set({ sound: e.target.checked })} /> Sound cues</label>
      <p className="sw-note">Saved on this device only.</p>
    </details>
  );
}

function WavePanel({ conn }: { conn: SwarmConnection }) {
  const m = conn.s.meta as A; const roster = (conn.s.roster as A[]) ?? []; const p = conn.buffer.latest()?.e.p ?? {}; const boss = m.boss as BossKind | null; const me = conn.s.me as A | undefined;
  return (
    <section className="sw-card sw-wave" aria-label="Wave status" data-testid="wavepanel">
      {boss && m.phase === 'boss_wave' && <div className="sw-boss"><h3>Boss: {BOSS_DEFS[boss].label}</h3><p>{BOSS_DEFS[boss].summary}</p></div>}
      <h3>Your team</h3>
      <ul className="sw-roster">{roster.map((r) => { const e = p[r.id]; const down = e ? !!(e[5] & 2) : false; return <li key={r.id}><RoleBadge role={r.role} size={28} /><span>{r.name}{r.id === me?.id ? ' (you)' : ''}</span><em className={down ? 'off' : r.on ? 'on' : 'off'}>{down ? 'down — stay close to revive' : r.on ? (e ? `${e[2]} / ${e[3]} HP` : 'online') : 'offline'}</em></li>; })}</ul>
      <details className="sw-how"><summary>Controls and your role</summary>
        <p className="sw-note">Move: WASD, arrows or the stick. Ability: Space or the button. You shoot on your own. The map is bigger than your screen: follow the gold arrow back to the beacon, and use the minimap (top left).</p>
        {me?.role && <p className="sw-note">You are the <b>{ROLE_DEFS[me.role as (typeof ROLES)[number]].label}</b>: {ROLE_DEFS[me.role as (typeof ROLES)[number]].blurb}</p>}
      </details>
    </section>
  );
}

export default function SwarmGame({ conn, prefs, setPrefs, roomId, token, practice }: { conn: SwarmConnection; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; roomId?: string; token?: string; practice?: { start: () => void; again: () => void } }) {
  const m = conn.s.meta as A | undefined; const phase = m?.phase as string | undefined;
  const panelFirst = phase === 'question' || phase === 'grade' || phase === 'freeze' || phase === 'upgrade' || phase === 'lobby' || phase === 'role_pick' || phase === 'ending' || phase === 'results';
  const onCue = (k: 'good' | 'bad' | 'down' | 'wave') => cue(k, prefs.sound);
  return (
    <main className={`sw ${prefs.contrast ? 'contrast' : ''} ${prefs.large ? 'large' : ''} ${prefs.reduced ? 'calm' : ''}`} id="main" data-phase={phase ?? 'connecting'}>
      <ConnBadge conn={conn} />
      {!m ? <section className="sw-card" role="status"><h2>Connecting…</h2><p>Joining the match.</p></section> : (
        <>
          <Hud conn={conn} />
          <div className={`sw-stage ${panelFirst ? 'panel-first' : ''}`}>
            <div className="sw-arenacol"><div className="sw-arenabox"><Arena conn={conn} interactive prefs={prefs} onCue={onCue} /><PauseOverlay conn={conn} /></div></div>
            <aside className="sw-side" aria-label="Match panel">
              {(phase === 'lobby' || phase === 'role_pick') && <><LobbyPanel conn={conn} prefs={prefs} />{practice && <button type="button" className="sw-btn primary big" onClick={practice.start} data-testid="start-practice">Start practice</button>}</>}
              {(phase === 'countdown' || phase === 'ready') && <ReadyBanner conn={conn} />}
              {(phase === 'wave' || phase === 'boss_wave') && <WavePanel conn={conn} />}
              {(phase === 'freeze' || phase === 'question' || phase === 'grade') && <QuestionPanel conn={conn} readAloud />}
              {phase === 'upgrade' && <DraftPanel conn={conn} />}
              {(phase === 'ending' || phase === 'results') && <ResultsPanel conn={conn} roomId={roomId} token={token} practice={practice ? { again: practice.again } : undefined} />}
            </aside>
          </div>
        </>
      )}
      <PrefsBar prefs={prefs} set={setPrefs} />
    </main>
  );
}
