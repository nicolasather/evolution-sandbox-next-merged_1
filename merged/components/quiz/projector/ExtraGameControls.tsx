'use client';
/** Teacher controls for the five newer projector games. Every button states its cost, and a disabled button says WHY in plain words,
 *  so the class (and the teacher) always see the consequence before it is chosen. The reducer re-checks everything; these are previews. */
import { useState } from 'react';
import type { Core, Locale } from '@/lib/quiz/projector/types';
import { COLLECTION_BONUS, EARN as AUCTION_EARN, type AuctionG } from '@/lib/quiz/projector/reducers/auction';
import { EARN as TERR_EARN, legalTargets, previewCell, WALL_MAX, type TerritoryG } from '@/lib/quiz/projector/reducers/territory';
import { EARN as FACT_EARN, INSPECT_COST, MACHINE_KINDS, MAX_LEVEL, OUTPUT, PRICE, REPAIR_COST, breakdownVictim, previewShift, upgradeCost, type FactoryG, type MachineKind } from '@/lib/quiz/projector/reducers/factory';
import { COST as SEA, EARN as SEA_EARN, previewSail, stealAmount, type PirateG } from '@/lib/quiz/projector/reducers/pirate';
import { BASE, COMEBACK_BONUS, SHIELD_CAP, stancePreview, type ShowdownChoice, type ShowdownG } from '@/lib/quiz/projector/reducers/showdown';
import { TeamSwatch } from './parts';
import { MACHINE_NAME } from './scenes/ExtraScenes';

type Send = (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
type Props = { core: Core; g: unknown; locale?: Locale; send: Send; busy: boolean; selected: string | number | null; clearSel: () => void };

/** A button with an always-visible reason when it cannot be used. */
function Act({ children, onClick, off, why, kind = 'ghost', note }: { children: React.ReactNode; onClick: () => void; off?: boolean; why?: string; kind?: string; note?: string }) {
  return (
    <div className="pj-act">
      <button className={`btn small ${kind}`} disabled={off} onClick={onClick} aria-describedby={off && why ? undefined : undefined} title={off ? why : note}>{children}</button>
      {off && why ? <small className="pj-why" role="note">{why}</small> : note ? <small className="pj-note">{note}</small> : null}
    </div>
  );
}
function useTeam(core: Core) {
  const [pick, setPick] = useState('');
  const turn = core.teams[core.actor % core.teams.length]!.id; const all = core.askMode === 'all';
  const team = all ? (core.teams.some((t) => t.id === pick) ? pick : core.teams[0]!.id) : turn;
  return { team, setTeam: setPick, all };
}
function TeamPick({ core, value, onChange }: { core: Core; value: string; onChange: (v: string) => void }) {
  return <div className="pj-teampick" role="radiogroup" aria-label="Team">{core.teams.map((t, i) => <button key={t.id} role="radio" aria-checked={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}><TeamSwatch i={i} size={20} />{t.name}</button>)}</div>;
}
const tierRow = (send: Send, busy: boolean, std: number, hard: number, extra = '') => (
  <div className="pj-tiers">
    <Act kind="primary" off={busy} why="Please wait…" onClick={() => void send('ask', { tier: 'standard' })} note={`Standard question · a correct answer earns ${std}${extra}`}>Ask a standard question</Act>
    <Act kind="ghost" off={busy} why="Please wait…" onClick={() => void send('ask', { tier: 'challenge' })} note={`Challenge question (harder) · a correct answer earns ${hard}${extra}`}>Ask a challenge question</Act>
  </div>
);
const Done = ({ send, busy, label = 'End turn' }: { send: Send; busy: boolean; label?: string }) => <Act kind="primary" off={busy} why="Please wait…" onClick={() => void send('end_turn')}>{label}</Act>;

/* ───────── Auction House ───────── */
export function AuctionControls({ core, g: raw, send, busy, selected, clearSel }: Props) {
  const g = raw as AuctionG; const { team, setTeam, all } = useTeam(core); const t = g.teams[team]!; const [amount, setAmount] = useState(3);
  if (core.phase === 'choose') return <div className="pj-ctl"><p className="muted-text">Earn bidding points first. Round {g.round}: {g.lineup.length} lots will be sold at the gavel.</p>{tierRow(send, busy, AUCTION_EARN.standard, AUCTION_EARN.challenge, ' (+ blueprint income)')}</div>;
  const lot = typeof selected === 'number' ? selected : g.lineup[0]?.id ?? 0; const have = g.bids[team]; const max = t.points; const amt = Math.max(1, Math.min(amount, Math.max(1, max)));
  const lotInfo = g.lineup.find((l) => l.id === lot);
  return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={setTeam} />}
      <p className="muted-text">Bidding points: <b>{t.points}</b>{t.reserved ? ` (+${t.reserved} under the paddle)` : ''} · prizes owned: <b>{t.wins}</b> · income per correct answer: <b>+{t.income}</b></p>
      <p className="muted-text">Pick a lot on the stage{lotInfo ? <> — <b>Lot {lotInfo.id}</b> appraised {lotInfo.low}–{lotInfo.high}</> : ''}. The true value is revealed only at the gavel; bids are sealed until then.</p>
      <div className="row"><Act off={busy || !!have || max < 1} why={have ? 'This team already has a paddle up. Lower it first.' : 'No points to bid.'} onClick={() => void send('bid', { team, lot, amount: amt })}>Raise paddle: {amt} on lot {lot}</Act>
        <div className="pj-step" role="group" aria-label="Bid amount"><button className="btn small ghost" aria-label="Lower the bid" onClick={() => setAmount(Math.max(1, amt - 1))}>−</button><b>{amt}</b><button className="btn small ghost" aria-label="Raise the bid" onClick={() => setAmount(Math.min(Math.max(1, max), amt + 1))}>+</button></div></div>
      <div className="row"><Act off={busy || !have} why="No paddle is up for this team." onClick={() => void send('retract_bid', { team })}>Lower paddle (refund)</Act>
        <Act off={busy || !!have} why="A paddle is up; lower it to pass." onClick={() => void send('pass_bid', { team })}>Pass this round</Act></div>
      <Act kind="primary" off={busy} why="Please wait…" note={`Losing bids are refunded. One of each kind of prize = +${COLLECTION_BONUS}.`} onClick={() => { clearSel(); void send('end_turn'); }}>End turn</Act>
    </div>
  );
}

/* ───────── Territory War ───────── */
export function TerritoryControls({ core, g: raw, send, busy, selected, clearSel }: Props) {
  const g = raw as TerritoryG; const { team, setTeam, all } = useTeam(core); const t = g.teams[team]!; const name = (id: string) => core.teams.find((x) => x.id === id)?.name ?? id;
  if (core.phase === 'choose') return <div className="pj-ctl"><p className="muted-text">Earn war points, then spend them on the map.</p>{tierRow(send, busy, TERR_EARN.standard, TERR_EARN.challenge)}</div>;
  const cell = typeof selected === 'number' ? g.cells[selected] : undefined; const pv = cell ? previewCell(g, team, cell.id, name) : null; const legal = legalTargets(g, team);
  const go = () => { if (cell && pv?.action) void send(pv.action, { team, cell: cell.id }).then((ok) => ok && clearSel()); };
  return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={setTeam} />}
      <p className="muted-text">War points: <b>{t.points}</b> · squares held: <b>{g.cells.filter((c) => c.owner === team).length}</b> · {Object.keys(legal).length} legal moves are outlined on the map</p>
      {!cell ? <p className="note">Click a square on the map to see what it would cost and what you would get.</p> : (
        <div className="pj-preview" role="status"><b>Square {cell.x + 1},{cell.y + 1}</b> · {cell.terrain}{cell.objective ? ' · objective' : ''}{cell.wall ? ` · wall ${cell.wall}/${WALL_MAX}` : ''}<br />
          {pv?.ok ? <>{pv.result} <b>Cost {pv.cost}.</b></> : <span className="pj-why">{pv?.reason}</span>}</div>
      )}
      <Act kind="primary" off={busy || !cell || !pv?.ok} why={!cell ? 'Pick a square first.' : pv?.reason ?? ''} onClick={go}>{pv?.ok ? `${({ capture: 'Capture', breach: 'Breach the wall', seize: 'Seize', fortify: 'Fortify', landing: 'Plant a flag' } as Record<string, string>)[pv.action ?? 'capture']} · ${pv.cost} points` : 'Act on this square'}</Act>
      {cell && cell.owner === team && <Act off={busy || !(previewCell(g, team, cell.id, name).action === 'fortify')} why="Only your own squares can be fortified, up to the wall limit." onClick={() => void send('fortify', { team, cell: cell.id }).then((ok) => ok && clearSel())}>Fortify this square</Act>}
      <Done send={send} busy={busy} label="End turn · keep unspent points" />
    </div>
  );
}

/* ───────── Lucky Factory ───────── */
export function FactoryControls({ core, g: raw, send, busy, selected, clearSel }: Props) {
  const g = raw as FactoryG; const { team, setTeam, all } = useTeam(core); const t = g.teams[team]!; const ti = core.teams.findIndex((x) => x.id === team);
  if (core.phase === 'choose') return <div className="pj-ctl"><p className="muted-text">Earn parts, then build the line. Shift {g.shift}: {g.events[0]}.</p>{tierRow(send, busy, FACT_EARN.standard, FACT_EARN.challenge)}</div>;
  const i = typeof selected === 'number' ? selected : -1; const m = t.machines[i]; const pv = previewShift(g, t, ti); const victim = g.events[0] === 'breakdown' ? breakdownVictim(t, ti, g.shift) : null;
  const full = t.machines.length >= g.slots;
  return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={setTeam} />}
      <p className="muted-text">Parts: <b>{t.points}</b> · shipped: <b>{t.shipped}</b> · if the turn ended now: <b>{pv.output}</b> goods{victim !== null && !pv.saved ? ` (machine ${victim + 1} will fail)` : ''}</p>
      <div className="pj-build" role="group" aria-label="Build a machine">{MACHINE_KINDS.map((k: MachineKind) => (
        <Act key={k} off={busy || full || t.points < PRICE[k]} why={full ? `All ${g.slots} slots are in use.` : `Needs ${PRICE[k]} parts; you have ${t.points}.`} note={`Makes ${OUTPUT[k]} per shift`} onClick={() => void send('build', { team, kind: k })}>Build {MACHINE_NAME[k]} · {PRICE[k]}</Act>))}</div>
      {!m ? <p className="note">Click a machine on the line to upgrade or repair it.</p> : (
        <div className="row"><Act off={busy || m.broken || m.level >= MAX_LEVEL || t.points < upgradeCost(m.level)} why={m.broken ? 'Repair it first.' : m.level >= MAX_LEVEL ? 'Already at the top level.' : `Needs ${upgradeCost(m.level)} parts.`} note={`Level ${m.level} → ${m.level + 1}`} onClick={() => void send('upgrade', { team, index: i }).then((ok) => ok && clearSel())}>Upgrade machine {i + 1} · {upgradeCost(m.level)}</Act>
          <Act off={busy || !m.broken || t.points < REPAIR_COST} why={!m.broken ? 'This machine is working.' : `Needs ${REPAIR_COST} parts.`} onClick={() => void send('repair', { team, index: i }).then((ok) => ok && clearSel())}>Repair machine {i + 1} · {REPAIR_COST}</Act></div>)}
      <Act off={busy || g.events[0] !== 'breakdown' || t.inspected || victim === null || t.points < INSPECT_COST} why={g.events[0] !== 'breakdown' ? 'No breakdown is due this shift.' : t.inspected ? 'Already checked this shift.' : victim === null ? 'No working machine to protect.' : `Needs ${INSPECT_COST} parts.`} note="Saves the machine that would fail this shift" onClick={() => void send('inspect', { team })}>Safety check · {INSPECT_COST}</Act>
      <Done send={send} busy={busy} label={`End turn and ship ${pv.output}`} />
    </div>
  );
}

/* ───────── Pirate Voyage ───────── */
export function PirateControls({ core, g: raw, send, busy, selected, clearSel }: Props) {
  const g = raw as PirateG; const { team, setTeam, all } = useTeam(core); const t = g.teams[team]!;
  if (core.phase === 'choose') return <div className="pj-ctl"><p className="muted-text">Earn sailing points to move, chart and raid.</p>{tierRow(send, busy, SEA_EARN.standard, SEA_EARN.challenge)}</div>;
  const to = typeof selected === 'number' ? selected : -1; const isl = g.islands[to]; const sail = isl ? previewSail(g, team, to) : null;
  const rivals = core.teams.filter((x) => x.id !== team && g.teams[x.id]!.position === t.position && g.teams[x.id]!.cargo > 0 && t.position !== 0);
  return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={setTeam} />}
      <p className="muted-text">Points: <b>{t.points}</b> · cargo on deck: <b>{t.cargo}</b> · banked: <b>{t.banked}</b> · at <b>{g.islands[t.position]!.name}</b>{t.guard ? ' · guard posted' : ''}</p>
      {!isl ? <p className="note">Click an island on the chart to preview the voyage.</p> : (
        <div className="pj-preview" role="status"><b>{isl.name}</b>{isl.charted && isl.id !== 0 ? ` · chest of ${isl.treasure}` : isl.id !== 0 ? ' · chest unknown' : ''}<br />
          {sail?.ok ? <>Sailing costs <b>{sail.cost}</b>{sail.storm ? ' (storm now)' : sail.stormNext ? ' (a storm is forecast next round)' : ''}.{sail.docks ? ' Docking banks all cargo safely.' : sail.chest ? ` You would load ${sail.chest}.` : ' You would load whatever chest is there.'}</> : <span className="pj-why">{sail?.reason}</span>}</div>
      )}
      <Act kind="primary" off={busy || !isl || !sail?.ok} why={!isl ? 'Pick an island first.' : sail?.reason ?? ''} onClick={() => void send('sail', { team, to }).then((ok) => ok && clearSel())}>{sail?.ok ? `Sail to ${isl!.name} · ${sail.cost}` : 'Sail'}</Act>
      <div className="row"><Act off={busy || !isl || isl.id === 0 || isl.charted || t.points < SEA.chart} why={!isl ? 'Pick an island first.' : isl.id === 0 ? 'The harbour needs no chart.' : isl.charted ? 'Already charted.' : `Needs ${SEA.chart} points.`} note="Reveals the chest before you sail" onClick={() => void send('chart', { team, island: to })}>Chart island · {SEA.chart}</Act>
        <Act off={busy || t.guard >= 1 || t.points < SEA.guard} why={t.guard >= 1 ? 'A guard is already posted.' : `Needs ${SEA.guard} points.`} note="Blocks the next raid on your cargo" onClick={() => void send('guard', { team })}>Post a guard · {SEA.guard}</Act></div>
      <div className="row">{rivals.length === 0
        ? <Act off why={t.position === 0 ? 'No raiding inside the home harbour.' : 'No rival with cargo is anchored here.'} onClick={() => undefined}>Raid a ship · {SEA.raid}</Act>
        : rivals.map((r) => <Act key={r.id} off={busy || t.points < SEA.raid} why={`Needs ${SEA.raid} points.`} note={`Takes up to ${stealAmount(g.teams[r.id]!)} cargo unless guarded`} onClick={() => void send('raid', { team, rival: r.id })}>Raid {r.name} · {SEA.raid}</Act>)}</div>
      <Done send={send} busy={busy} label="End turn" />
    </div>
  );
}

/* ───────── Final Showdown ───────── */
const CH: { k: ShowdownChoice; label: string }[] = [{ k: 'steady', label: 'Steady' }, { k: 'double', label: 'Double down' }, { k: 'shield', label: 'Buy a shield' }];
export function ShowdownControls({ core, g: raw, send, busy }: Props) {
  const g = raw as ShowdownG; const { team, setTeam, all } = useTeam(core); const t = g.teams[team]!;
  if (core.phase === 'choose') return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={setTeam} />}
      <p className="muted-text">Stage: <b>{g.stage}</b> · base {BASE[g.stage]} per correct answer · points: <b>{t.points}</b> · shields: <b>{t.shields}/{SHIELD_CAP}</b></p>
      {t.choice ? <div className="pj-preview" role="status">Chosen: <b>{t.choice}</b>. <button className="btn small ghost" disabled={busy} onClick={() => void send('cancel_choice', { team })}>Undo choice (refund)</button></div> : (
        <div className="pj-stances">{CH.map(({ k, label }) => { const p = stancePreview(g, team, k); const full = k === 'shield' && t.shields >= SHIELD_CAP; return (
          <Act key={k} off={busy || !p.affordable || full} why={full ? `Shield limit ${SHIELD_CAP} reached.` : `Needs ${p.price} points.`} onClick={() => void send('choose_action', { team, choice: k })}
            note={`${p.price ? `Costs ${p.price}. ` : 'Free. '}Win +${p.win}${p.armed ? ` (incl. +${COMEBACK_BONUS} comeback)` : ''}${p.setback ? `, a miss costs ${p.setback}` : ', a miss costs nothing'}${p.shielded && p.setback === 0 && k !== 'steady' ? ' (shielded)' : ''}`}>{label}{p.price ? ` · ${p.price}` : ''}</Act>); })}</div>)}
      <Act kind="primary" off={busy || (all ? core.teams.some((x) => !g.teams[x.id]!.choice) : !t.choice)} why={all ? 'Every team must choose a stance first.' : 'Choose a stance first.'} onClick={() => void send('ask')}>Ask the question</Act>
    </div>
  );
  return <div className="pj-ctl"><p className="muted-text">Check the scoreboard, then press Continue.</p></div>;
}
