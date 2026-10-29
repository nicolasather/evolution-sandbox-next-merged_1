'use client';
import { useEffect, useRef, useState } from 'react';
import QuestionPlay, { type PlayQuestion } from '../QuestionPlay';
import AnswerView from '../AnswerView';
import { BRANCHES, BOSSES, ENEMIES, ENEMY_INFO, LEVEL_DAMAGE_PCT, LEVEL_RANGE_PCT, ROLES, ROLE_REASON, TICKS_PER_SECOND, TOWERS, TOWER_AGES, TOWER_TIMELINE, isUnlocked, nextUnlock, rolesForSquad, unlockWave } from '@/lib/quiz/td/balance';
import { roleSVG, towerSVG, enemySVG, kindSVG, iconSVG, TOWER_ACCENT } from '@/lib/quiz/td/art';
import { buildCost, moveCost, previewBoard, sellRefund, targetCost, upgradeCost } from '@/lib/quiz/td/engine';
import { laneReach } from '@/lib/quiz/td/maps';
import { TD_BRANCHES, TD_ROLES, type TDErrorCode, TD_TARGETING, TD_TOWERS, type TDBoardAction, type TDRole, type TDEnemyKind, type TDSeat, type TDState, type TDTeam, type TDTower, type TDTowerKind } from '@/lib/quiz/td/domain';
import { kindLabels } from '@/lib/quiz/types';
import type { TDSnap } from './useTD';

export const Art = ({ svg, size, label }: { svg: string; size: number; label?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element -- inline original SVG (no network), sized explicitly
  <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} width={size} height={size} alt={label ?? ''} aria-hidden={label ? undefined : true} />
);
export const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const TEAM_SWATCH = ['#55BD8C', '#FC7462', '#67BCD9', '#FFC94B'];
export const PHASE_LABEL: Record<string, string> = { lobby: 'Lobby', countdown: 'Starting', quiz_open: 'Question', reveal: 'Answer', build: 'Build', wave: 'Wave', wave_result: 'Wave result', finished: 'Match over' };

/** Live clock for the current phase, from the server time (frozen while paused). */
export function useNow(serverNow: () => number, ms = 250) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
  return serverNow();
}

export function Hud({ snap, team, now, compact }: { snap: TDSnap; team: TDTeam | null; now: number; compact?: boolean }) {
  const left = snap.phaseDeadlineMs !== null ? (snap.paused ? snap.phaseDeadlineMs - snap.paused.atMs : snap.phaseDeadlineMs - now) : null;
  return (
    <div className={`td-hud ${compact ? 'compact' : ''}`} role="group" aria-label="Match status">
      <span className="td-stat"><Art svg={iconSVG('wave')} size={24} /><b>WAVE</b> {Math.max(0, Math.min(snap.round, snap.plan.waves))} / {snap.plan.waves}</span>
      {team && <span className="td-stat core"><Art svg={iconSVG('core')} size={24} /><b>CORE</b> {team.coreHP} / {team.maxCoreHP}<span className="td-meter" aria-hidden="true"><i style={{ width: `${(team.coreHP / Math.max(1, team.maxCoreHP)) * 100}%` }} /></span></span>}
      {team && <span className="td-stat points"><Art svg={iconSVG('points')} size={24} /><b>POINTS</b> {team.points}</span>}
      <span className="td-stat phase" aria-live="polite"><b>{PHASE_LABEL[snap.phase]}</b>{left !== null && snap.phase !== 'finished' ? ` ${fmt(left)}` : ''}{snap.paused ? ' · paused' : ''}</span>
    </div>
  );
}

export function ConnBadge({ conn }: { conn: string }) {
  if (conn === 'connected') return null;
  const text = conn === 'connecting' ? 'Connecting…' : conn === 'degraded' ? 'Slow connection — still syncing' : conn === 'reconnecting' ? 'Reconnecting – actions paused' : 'Back online — board refreshed';
  return <p className={`td-conn ${conn}`} role="status">{text}</p>;
}

/** Why an action is unavailable, as a coloured tag plus the plain sentence: points, phase, a taken pad and a missing branch look different at a glance. */
const REASON: Partial<Record<TDErrorCode, { label: string; cls: string }>> = {
  INSUFFICIENT_POINTS: { label: 'Not enough points', cls: 'points' }, WRONG_PHASE: { label: 'Wrong phase', cls: 'phase' }, PAUSED: { label: 'Paused', cls: 'phase' }, MATCH_FINISHED: { label: 'Match over', cls: 'phase' }, LOCKED: { label: 'Not unlocked yet', cls: 'phase' }, ROLE_SIZE: { label: 'Needs a bigger squad', cls: 'phase' },
  PAD_OCCUPIED: { label: 'Pad taken', cls: 'taken' }, BRANCH_REQUIRED: { label: 'Pick a branch', cls: 'branch' }, MAX_TOWERS: { label: 'Tower limit', cls: 'taken' }, MAX_LEVEL: { label: 'Max level', cls: 'branch' },
};
export function ReasonTag({ code }: { code?: TDErrorCode }) { const r = code ? REASON[code] : undefined; return r ? <span className={`td-tag ${r.cls}`}>{r.label}</span> : null; }

// ── lobby ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function RolePicker({ value, onPick, busy, squadSize = 5 }: { value: TDRole | null; onPick: (r: TDRole | null) => void; busy: boolean; squadSize?: number }) {
  const n = Math.max(1, Math.min(5, squadSize)); const allowed = rolesForSquad(n);
  return (
    <fieldset className="td-roles"><legend>ROLE <small>{n === 1 ? 'one balanced role for a solo squad' : `${allowed.length} roles for a squad of ${n}`}</small></legend>
      <div className="td-rolegrid">
        {TD_ROLES.filter((r) => n === 1 ? allowed.includes(r) : true).map((r) => {
          const ok = allowed.includes(r);
          return (
            <button key={r} type="button" className="td-role" aria-pressed={value === r} disabled={busy || !ok} aria-describedby={`role-why-${r}`} onClick={() => onPick(value === r && n > 1 ? null : r)}>
              <Art svg={roleSVG(r)} size={52} />
              <span><b>{ROLES[r].name}</b><small>{ROLES[r].passive}</small><small className="active">{ROLES[r].active}</small><small id={`role-why-${r}`} className={ok ? 'fit' : 'locked'}>{ok ? ROLE_REASON[r] : `Needs a squad of ${[1, 2, 3, 4, 5].find((k) => rolesForSquad(k).includes(r))} or more — ${ROLE_REASON[r]}`}</small></span>
            </button>
          );
        })}
      </div>
      {n === 1 && <p className="td-note">With one player there is nothing to share, so you get the role that helps a lone builder most. More teammates unlock more roles.</p>}
    </fieldset>
  );
}

/** The technology timeline: six towers in history order, each with its age, the wave it unlocks at, and whether the squad has it yet. */
export function TechTimeline({ round, waves, compact }: { round: number; waves: number; compact?: boolean }) {
  const next = nextUnlock(round, waves);
  return (
    <section className={`td-timeline ${compact ? 'compact' : ''}`} aria-label="Tower unlock timeline">
      <h3>TECH TIMELINE</h3>
      <ol>
        {TOWER_TIMELINE.map((k) => { const on = isUnlocked(k, Math.max(1, round), waves); const isNext = next?.kind === k;
          return (
            <li key={k} className={on ? 'on' : isNext ? 'next' : 'off'} style={{ ['--tw' as string]: TOWER_ACCENT[k] }}>
              <Art svg={towerSVG(k, 1)} size={compact ? 30 : 38} />
              <span><b>{TOWERS[k].name}</b><small>{TOWER_AGES[k].age} · {TOWER_AGES[k].era}</small>{!compact && <small className="story">{TOWER_AGES[k].story}</small>}</span>
              <em>{on ? 'Unlocked' : `Wave ${unlockWave(k, waves)}`}</em>
            </li>);
        })}
      </ol>
      {next && <p className="td-note">Next unlock: <b>{TOWERS[next.kind].name}</b> ({TOWER_AGES[next.kind].age}) at wave {next.wave}.</p>}
    </section>
  );
}

// ── build drawer ────────────────────────────────────────────────────────────────────────────────────────────
const dps = (kind: TDTowerKind, level: number) => { const st = TOWERS[kind]; return st.cooldownTicks ? Math.round((st.damage * LEVEL_DAMAGE_PCT[level - 1]! / 100) * TICKS_PER_SECOND / st.cooldownTicks) : 0; };
const rangeTiles = (kind: TDTowerKind, level: number) => Math.round(TOWERS[kind].range * LEVEL_RANGE_PCT[level - 1]! / 100 / 100) / 10;

export function BuildMenu({ state, seat, padId, onBuild, onHover, busy }: { state: TDState; seat: TDSeat; padId: string; onBuild: (k: TDTowerKind) => void; onHover: (k: TDTowerKind | null) => void; busy: boolean }) {
  const team = state.teams.find((t) => t.id === seat.teamId)!;
  return (
    <section className="td-drawer" aria-label={`Build on pad ${padId.toUpperCase()}`}>
      <h3>EMPTY PAD {padId.toUpperCase()}</h3>
      <p className="td-note">Point at a card to see on the map how far that tower reaches.</p>
      <div className="td-towergrid">
        {TD_TOWERS.map((k) => {
          const pv = previewBoard(state, seat, { kind: 'build', padId, tower: k }); const cost = buildCost(state, team, seat, k);
          return (
            <button key={k} type="button" className="td-towercard" style={{ ['--tw' as string]: TOWER_ACCENT[k] }} disabled={busy || !pv.ok} onMouseEnter={() => onHover(k)} onFocus={() => onHover(k)} onMouseLeave={() => onHover(null)} onClick={() => onBuild(k)} aria-describedby={`why-${k}`}>
              <Art svg={towerSVG(k, 1)} size={48} />
              <span className="name">{TOWERS[k].name}</span>
              <span className="cost">{cost.cost} POINTS{cost.architect ? ' · Architect −10%' : ''}{cost.kit ? ' · Comeback kit' : ''}</span>
              <span className="age">{TOWER_AGES[k].age} · {TOWER_AGES[k].era}</span>
              <span className="role">{TOWERS[k].role}{dps(k, 1) ? ` · ${dps(k, 1)} dmg/s` : ''} · range {rangeTiles(k, 1)} · reaches {laneReach(state.config.mapId, padId, TOWERS[k].range)}% of the lane</span>
              {pv.ok ? <span id={`why-${k}`} className="ok">BUILD: {TOWERS[k].name.split(' ')[0]!.toUpperCase()} {cost.cost} POINTS</span> : <span id={`why-${k}`} className="why"><ReasonTag code={pv.code} /> {pv.message}</span>}
            </button>
          );
        })}
      </div>
      <p className="td-note">Points: <b>{team.points}</b>. Tap a card, then confirm — nothing is spent until the server accepts.</p>
    </section>
  );
}

export function TowerCard({ state, seat, tower, onAction, onMove, moving, busy }: { state: TDState; seat: TDSeat; tower: TDTower; onAction: (a: TDBoardAction) => void; onMove: () => void; moving: boolean; busy: boolean }) {
  const team = state.teams.find((t) => t.id === seat.teamId)!;
  const up = upgradeCost(tower); const can = (a: TDBoardAction) => previewBoard(state, seat, a);
  const upPv = up !== null && tower.level === 1 ? can({ kind: 'upgrade', towerId: tower.id }) : null;
  const tc = targetCost(team, seat);
  const lastDmg = team.lastWave?.damageByTower?.[tower.id];
  return (
    <section className="td-drawer" aria-label={`${TOWERS[tower.kind].name} details`}>
      <div className="td-towerhead"><Art svg={towerSVG(tower.kind, tower.level)} size={60} /><div><h3>{TOWERS[tower.kind].name} · LEVEL {tower.level}</h3><span className="td-pips" aria-hidden="true">{[1, 2, 3].map((n) => <i key={n} className={n <= tower.level ? 'on' : ''} />)}</span>
        <p className="td-note">{tower.kind === 'beacon' ? `Speeds up towers within ${rangeTiles(tower.kind, tower.level)} tiles` : `${dps(tower.kind, tower.level)} dmg/s · range ${rangeTiles(tower.kind, tower.level)} tiles`}{tower.branch ? ` · ${BRANCHES[tower.branch]!.name}` : ''}{lastDmg !== undefined ? ` · last wave: ${lastDmg} damage` : ''}</p></div></div>
      {tower.level === 1 && up !== null && <button type="button" className="td-btn primary" disabled={busy || !upPv?.ok} onClick={() => onAction({ kind: 'upgrade', towerId: tower.id })}>{upPv?.ok ? `Upgrade to level 2 · ${up} points (+30% damage, +10% range)` : <><ReasonTag code={upPv?.code} /> {upPv?.message}</>}</button>}
      {tower.level === 2 && up !== null && (
        <div className="td-branches" role="group" aria-label="Level 3 upgrade: choose one">
          {TD_BRANCHES[tower.kind].map((b) => { const pv = can({ kind: 'upgrade', towerId: tower.id, branch: b }); return (
            <button key={b} type="button" className="td-branch" disabled={busy || !pv.ok} onClick={() => onAction({ kind: 'upgrade', towerId: tower.id, branch: b })}>
              <b>{BRANCHES[b]!.name}</b><span>{BRANCHES[b]!.effect}</span><small>{BRANCHES[b]!.tradeoff}</small><span className={pv.ok ? 'cost' : 'why'}>{pv.ok ? `SPEND ${up} POINTS` : <><ReasonTag code={pv.code} /> {pv.message}</>}</span>
            </button>); })}
        </div>
      )}
      {tower.level === 3 && <p className="td-note">Tower is level 3.</p>}
      {tower.kind !== 'beacon' && (
        <label className="td-field">Targeting {tc ? `(change costs ${tc})` : '(free change: Tactician)'}
          <select value={tower.targeting} disabled={busy || state.phase !== 'build'} onChange={(e) => onAction({ kind: 'target', towerId: tower.id, policy: e.target.value as TDTower['targeting'] })}>
            {TD_TARGETING.map((t) => <option key={t} value={t}>{{ first: 'First (closest to core)', strongest: 'Strongest', fastest: 'Fastest', lowest_health: 'Lowest health' }[t]}</option>)}
          </select></label>
      )}
      <div className="td-row">
        <button type="button" className="td-btn ghost" disabled={busy || state.phase !== 'build'} aria-pressed={moving} onClick={onMove}>{moving ? 'Pick an empty pad…' : `Move · ${moveCost(tower) || 'free'}`}</button>
        <button type="button" className="td-btn ghost" disabled={busy || state.phase !== 'build'} onClick={() => onAction({ kind: 'sell', towerId: tower.id })}>Sell · +{sellRefund(tower)}</button>
      </div>
      {state.phase !== 'build' && <p className="td-why"><ReasonTag code="WRONG_PHASE" /> Build only between waves.</p>}
    </section>
  );
}

// ── questions ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function QuestionOverlay({ snap, question, now, onSubmit, submitted, personal, onClose }: { snap: TDSnap; question: Record<string, unknown>; now: number; onSubmit: (r: unknown) => Promise<unknown>; submitted: boolean; personal?: boolean; onClose?: () => void }) {
  const r = snap.rounds[snap.rounds.length - 1];
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, [question.id]);
  const left = !personal && snap.phaseDeadlineMs !== null ? (snap.paused ? snap.phaseDeadlineMs - snap.paused.atMs : snap.phaseDeadlineMs - now) : null;
  const myTeam = snap.selfTeamId; const counts = r && myTeam ? `${r.submittedCount[myTeam] ?? 0} of ${r.eligibleCount[myTeam] ?? 0} in your squad have answered` : '';
  return (
    <div className="td-quiz" role="dialog" aria-modal="true" aria-labelledby="td-q-head">
      <div className="td-quizcard">
        <header className="td-quizhead">
          <h2 id="td-q-head" ref={head} tabIndex={-1}>{personal ? 'YOUR QUESTION' : `QUESTION ${r?.question?.index ?? ''} / ${r?.question?.total ?? snap.plan.waves}`}</h2>
          <span><Art svg={kindSVG(String(question.kind))} size={28} /> {kindLabels[question.kind as keyof typeof kindLabels]}{r?.question?.repeat ? ' · review cycle' : ''}</span>
          {!personal && <span className="td-freeze">❄ Battle frozen</span>}
          {left !== null && <span className={`td-timer ${left < 10_000 ? 'low' : ''}`} role="timer" aria-label={`Time left ${fmt(left)}`}>TIME {fmt(left)}</span>}
        </header>
        {submitted ? (
          <div className="td-submitted" role="status"><p className="big">✓ Submitted</p><p>{personal ? 'Your answer is in.' : `Battle is frozen until everyone has answered or the time is up. ${counts}.`}</p></div>
        ) : (
          <QuestionPlay liveRound question={question as unknown as PlayQuestion} onSubmit={onSubmit} submitLabel="Submit answer" readAloud={snap.config.readAloud || true} />
        )}
        <p className="td-note">{personal ? 'Towers keep defending while you answer. Accuracy matters, not speed.' : 'Every teammate gets the same reading time. Speed earns nothing.'}</p>
        {personal && onClose && submitted && <button type="button" className="td-btn" onClick={onClose}>Back to the board</button>}
      </div>
    </div>
  );
}

export function RevealPanel({ snap, question }: { snap: TDSnap; question: Record<string, unknown> | null }) {
  const r = snap.rounds[snap.rounds.length - 1]; const team = snap.teams.find((t) => t.id === snap.selfTeamId) as TDTeam | undefined;
  if (!r) return null;
  const mine = r.mine; const award = snap.selfTeamId ? r.award[snap.selfTeamId] ?? 0 : null;
  const verdict = mine === null || mine === undefined ? 'You did not answer this one — that is fine, look at the explanation.' : mine >= 1000 ? 'Correct.' : mine > 0 ? `Partly correct (${Math.round(mine / 10)}%).` : 'Not this time — here is why.';
  const key = (question?.answerKey ?? null) as Record<string, unknown> | null;
  return (
    <section className="td-reveal" aria-live="polite">
      <h2>REVIEW ANSWER</h2>
      {team && <p className="td-award">{award ? `+${award} points for your squad` : 'No points this round'} · {r.submittedCount[team.id] ?? 0} of {r.eligibleCount[team.id] ?? 0} answered</p>}
      <p className={`td-verdict ${mine && mine >= 1000 ? 'good' : 'review'}`}>{verdict}</p>
      {question && key && <AnswerView kind={String(question.kind)} payload={question.payload as never} answerKey={key as never} />}
    </section>
  );
}

export function WaveResultPanel({ team }: { team: TDTeam }) {
  const w = team.lastWave; if (!w) return null;
  return (
    <section className="td-waveres" aria-live="polite">
      <h2>{w.outcome === 'fallen' ? 'The core has fallen' : w.outcome === 'held' ? `Wave ${w.wave} held` : `Wave ${w.wave} cleared`}</h2>
      <ul><li><b>{w.kills}</b> defeated</li><li><b>{w.leaks}</b> reached the core{w.blocked ? ` (${w.blocked} blocked)` : ''}</li><li>Core <b>{team.coreHP} / {team.maxCoreHP}</b></li>{w.bossDefeated !== null && <li>Boss <b>{w.bossDefeated ? 'defeated' : 'escaped'}</b></li>}</ul>
    </section>
  );
}

export function Opponents({ snap }: { snap: TDSnap }) {
  const others = snap.teams.filter((t) => t.id !== snap.selfTeamId);
  if (snap.config.format !== 'versus' || !others.length) return null;
  return (
    <section className="td-opponents" aria-label="Other squads">
      <h3>OTHER SQUADS</h3>
      <ul>{others.map((t) => <li key={t.id}><i style={{ background: TEAM_SWATCH[t.colorIndex] }} aria-hidden="true" /><b>{t.name}</b><span>wave {t.wavesCleared} · core {t.coreHP}/{t.maxCoreHP}{'accuracyPct' in t && t.accuracyPct !== null ? ` · ${t.accuracyPct}%` : ''}{t.fallen ? ' · core fallen' : ''}</span></li>)}</ul>
    </section>
  );
}

/** How the match is scored, in words anyone can check: shown in competitive matches so squad size and speed never feel like hidden advantages. */
export function RankingRules({ squads }: { squads: boolean }) {
  return (
    <details className="td-rules">
      <summary>How is this scored?</summary>
      <ol>
        {squads && <li><b>Ranking:</b> waves cleared first, then core health left, then answer accuracy. Every squad plays the same map and the same waves.</li>}
        <li><b>Points:</b> a correct squad answer earns 60% of the round’s award, plus up to 40% more as more of the squad gets it right. A squad of 5 does not earn five times a squad of 1: only the <i>share</i> correct counts.</li>
        <li><b>Speed:</b> answering faster earns nothing.</li>
        <li><b>Spending:</b> points buy towers and upgrades only; the server checks every purchase.</li>
      </ol>
    </details>
  );
}

export function Ticker({ team, seats }: { team: TDTeam; seats: { id: string; name: string }[] }) {
  const name = (id?: string) => seats.find((s) => s.id === id)?.name ?? 'Squad';
  const text = (k: string, p: Record<string, string | number> = {}, seat?: string) => ({
    built: `${name(seat)} built ${TOWERS[p.tower as TDTowerKind]?.name ?? p.tower} (−${p.cost})`, upgraded: `${name(seat)} upgraded ${TOWERS[p.tower as TDTowerKind]?.name ?? ''} to level ${p.level} (−${p.cost})`,
    sold: `${name(seat)} sold ${TOWERS[p.tower as TDTowerKind]?.name ?? ''} (+${p.refund})`, moved: `${name(seat)} moved a tower${p.cost ? ` (−${p.cost})` : ''}`, targeting: `${name(seat)} set targeting to ${String(p.policy).replace('_', ' ')}`,
    earned: `+${p.n} points (${p.correct} of ${p.of} correct)`, noAward: 'No points this round', earnedPersonal: `${name(seat)} earned +${p.n}`, ability: `${name(seat)} armed ${p.ability}`, role: `${name(seat)} is ${p.role}`,
    waveCleared: `Wave ${p.wave} cleared`, waveHeld: `Wave ${p.wave} held`, coreFallen: 'The core has fallen', coreRelief: 'Core Relief restored 1 core', padCracked: 'A pad was cracked: that tower moves free', comebackKit: 'Comeback kit: the next Bolt costs half',
    awaitingApproval: `${name(seat)} asked the teacher to approve a ${p.cost}-point purchase`, declined: 'The teacher declined a purchase', joined: `${name(seat)} joined`, removed: 'A player was removed', wagerSet: 'A stake is set', wagerWon: `Stake won (+${p.n})`, wagerLost: `Stake lost (−${p.n})`,
  } as Record<string, string>)[k] ?? k;
  return <ol className="td-ticker" aria-label="Squad activity">{[...team.log].reverse().slice(0, 5).map((l) => <li key={l.n}>{text(l.k, l.p, l.seat)}</li>)}</ol>;
}

export function EnemyLegend({ kinds, onPick }: { kinds: string[]; onPick?: (k: TDEnemyKind) => void }) {
  return (
    <ul className="td-legend" aria-label="Enemy types in this wave">
      {kinds.map((k) => { const label = k === 'colossus' ? 'Boss' : ENEMIES[k as keyof typeof ENEMIES]?.name ?? k;
        return <li key={k}>{onPick ? <button type="button" className="td-enemychip" onClick={() => onPick(k as TDEnemyKind)} aria-label={`About the ${label}`}><Art svg={enemySVG(k as never)} size={28} />{label}<i aria-hidden="true">i</i></button> : <><Art svg={enemySVG(k as never)} size={28} />{label}</>}</li>; })}
    </ul>
  );
}
/** Field-guide card for one enemy kind: what it is, what it does, what to do about it. Read from the same stats the simulation uses. */
export function EnemyCard({ kind, onClose }: { kind: TDEnemyKind; onClose: () => void }) {
  const st = ENEMIES[kind]; const info = ENEMY_INFO[kind]; const ref = useRef<HTMLButtonElement>(null); useEffect(() => { ref.current?.focus(); }, [kind]);
  const sps = Math.round((st.speed * TICKS_PER_SECOND) / 10) / 100;
  return (
    <div className="td-enemycard" role="dialog" aria-modal="false" aria-labelledby="td-enemy-h" data-testid="td-enemycard" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <header><Art svg={enemySVG(kind)} size={64} /><div><h3 id="td-enemy-h">{kind === 'colossus' ? 'Boss — the Colossus family' : st.name}</h3><p className="td-note">{info.type} · threat {'●'.repeat(info.threat)}{'○'.repeat(5 - info.threat)}</p></div>
        <button type="button" ref={ref} className="td-btn small ghost" onClick={onClose} aria-label="Close enemy card">Close</button></header>
      <p>{info.story}</p>
      <dl>
        <div><dt>Health</dt><dd>{st.hp}{st.shield ? ` + ${st.shield} shield` : ''}</dd></div>
        <div><dt>Speed</dt><dd>{sps} tiles/s{st.sprint ? ` (sprints +${st.sprint.pct}%)` : ''}</dd></div>
        <div><dt>Armour</dt><dd>{st.armorPct}%{st.armorPct ? ' of each hit is blocked' : ' — none'}</dd></div>
        <div><dt>Core damage</dt><dd>{st.leak} if it arrives</dd></div>
        <div><dt>Moves</dt><dd>{st.flying ? 'Flying' : 'On the ground'}</dd></div>
        <div><dt>Special</dt><dd>{info.behaviour}</dd></div>
      </dl>
      <p className="td-counter"><b>What to do:</b> {info.counter}</p>
    </div>
  );
}
export { BOSSES };
