'use client';
import { useState } from 'react';
import { CAMPAIGNS, hotspotNeeds } from '@/lib/quiz/projector/content/escape-campaigns';
import { SHAPE_LABEL, SHAPES } from '@/lib/quiz/projector/content/vault-doors';
import type { BossAction, BossG } from '@/lib/quiz/projector/reducers/boss';
import { COST, ek, reachable, type EmpireG } from '@/lib/quiz/projector/reducers/empire';
import { activeSpots, type EscapeG } from '@/lib/quiz/projector/reducers/escape';
import { branchTier, previewFor, type LadderG } from '@/lib/quiz/projector/reducers/ladder';
import { payment, SCANNER_COST, type VaultG } from '@/lib/quiz/projector/reducers/vault';
import type { Core, Locale } from '@/lib/quiz/projector/types';
import { L, tr } from './i18n';
import { TeamSwatch } from './parts';

type Send = (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
export type CtlProps = { core: Core; g: unknown; locale: Locale; send: Send; busy: boolean; selected: string | number | null; clearSel: () => void };

/** A button that says WHY it is off. `why` is shown under the button whenever it is disabled (and is the tooltip), so a locked action is never a mystery. */
const Btn = ({ children, onClick, disabled, kind = '', title, why }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; kind?: string; title?: string; why?: string }) => (
  <span className="pj-act"><button className={`btn small ${kind}`} onClick={onClick} disabled={disabled} title={disabled ? why ?? title : title}>{children}</button>{disabled && why ? <small className="pj-why" role="note">{why}</small> : null}</span>);
const first = (...c: [boolean, string][]) => c.find(([f]) => f)?.[1];
function TeamPick({ core, value, onChange, only }: { core: Core; value: string; onChange: (v: string) => void; only?: string[] }) {
  return <div className="pj-teampick" role="radiogroup">{core.teams.filter((t) => !only || only.includes(t.id)).map((t) => { const i = core.teams.findIndex((x) => x.id === t.id); return <button key={t.id} role="radio" aria-checked={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}><TeamSwatch i={i} size={20} />{t.name}</button>; })}</div>;
}
/** The team the buttons act for: the one whose turn it is, or a picker when every team plays at once. */
function useActing(core: Core) {
  const [pick, setPick] = useState('');
  const turn = core.teams[core.actor % core.teams.length]!.id;
  const team = core.askMode === 'all' ? (core.teams.some((t) => t.id === pick) ? pick : core.teams[0]!.id) : turn;
  return { team, pick: setPick, all: core.askMode === 'all' };
}

export function EmpireControls({ core, g: raw, locale, send, busy, selected, clearSel }: CtlProps) {
  const g = raw as EmpireG; const { team, pick, all } = useActing(core); const tile = typeof selected === 'number' ? g.tiles[selected] : undefined; const en = g.energy[team] ?? 0;
  const act = (action: string, extra: Record<string, unknown> = {}) => send(action, { team, tile: tile?.id, ...extra }).then((ok) => ok && clearSel());
  const bridges = g.blocked.map((k) => k.split('-').map(Number) as [number, number]).filter(([a, b]) => !g.bridges.includes(ek(a, b)) && (g.tiles[a]!.owner === team || g.tiles[b]!.owner === team));
  const ok = (cost: number) => !busy && en >= cost;
  if (core.phase === 'choose') return (
    <div className="pj-ctl"><p className="muted-text">{tr(locale, 'chooseZone')}{tile ? `: ${tr(locale, 'tile', { n: tile.id + 1 })}` : ''}</p>
      <div className="row"><Btn kind="primary" disabled={busy} onClick={() => send('ask', tile ? { tile: tile.id } : {})}>{tr(locale, 'askQuestion')}</Btn>{tile && <Btn kind="ghost" disabled={busy} onClick={() => { void send('choose_zone', { tile: tile.id }); }}>{tr(locale, 'tile', { n: tile.id + 1 })} ✓</Btn>}</div></div>
  );
  if (core.phase === 'planning') return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={pick} />}
      <p className="muted-text">{tr(locale, 'energy')}: <b>{en}</b>{tile ? ` · ${tr(locale, 'tile', { n: tile.id + 1 })}` : ''}</p>
      <div className="row">
        <Btn disabled={!tile || !ok(COST.claim) || !!tile.owner || !reachable(g, team, tile.id)} why={first([!tile, 'Pick a zone on the map.'], [en < COST.claim, `Needs ${COST.claim} energy (you have ${en}).`], [!!tile?.owner, 'That zone is already held.'], [!!tile && !reachable(g, team, tile.id), 'It must touch your land.'])} onClick={() => act('claim')}>{tr(locale, 'claim')} · {COST.claim}</Btn>
        <Btn disabled={!tile || !ok(COST.fortify) || tile.owner !== team || tile.fort} why={first([!tile, 'Pick one of your zones.'], [en < COST.fortify, `Needs ${COST.fortify} energy (you have ${en}).`], [tile?.owner !== team, 'Only your own zones.'], [!!tile?.fort, 'Already fortified.'])} onClick={() => act('fortify')}>{tr(locale, 'fortify')} · {COST.fortify}</Btn>
        <Btn disabled={!tile || !ok(COST.research) || !tile.hidden} why={first([!tile, 'Pick a zone first.'], [en < COST.research, `Needs ${COST.research} energy (you have ${en}).`], [!tile?.hidden, 'Nothing is hidden there.'])} onClick={() => act('research')}>{tr(locale, 'research')} · {COST.research}</Btn>
        <Btn disabled={!tile || !ok(COST.challenge) || !tile.owner || tile.owner === team || !reachable(g, team, tile.id)} why={first([!tile, 'Pick a rival zone.'], [en < COST.challenge, `Needs ${COST.challenge} energy (you have ${en}).`], [!tile?.owner || tile.owner === team, 'Pick a zone held by a rival.'], [!!tile && !reachable(g, team, tile.id), 'It must touch your land.'])} onClick={() => act('challenge')}>{tr(locale, 'challenge')} · {COST.challenge}</Btn>
      </div>
      {bridges.length > 0 && <div className="row">{bridges.slice(0, 4).map(([a, b]) => <Btn key={`${a}-${b}`} kind="ghost" disabled={!ok(COST.bridge)} why={`Needs ${COST.bridge} energy (you have ${en}).`} onClick={() => act('bridge', { a, b })}>{tr(locale, 'bridge')} {a + 1}↔{b + 1} · {COST.bridge}</Btn>)}</div>}
      <div className="row">{g.duel ? <Btn kind="primary" disabled={busy} onClick={() => send('ask')}>{tr(locale, 'askQuestion')}</Btn> : <Btn kind="primary" disabled={busy} onClick={() => send('end_turn')}>{tr(locale, 'endTurn')}</Btn>}</div></div>
  );
  return null;
}

const BOSS_ACTIONS: BossAction[] = ['strike', 'defend', 'repair', 'scan', 'combine'];
export function BossControls({ core, g: raw, locale, send, busy }: CtlProps) {
  const g = raw as BossG; const { team, pick, all } = useActing(core); const t = g.teams[team]!; const [aim, setAim] = useState(false); const [partner, setPartner] = useState('');
  if (core.phase !== 'choose') return null;
  const ids = all ? core.teams.map((x) => x.id) : [team]; const allChosen = ids.every((id) => g.teams[id]?.chosen); const other = core.teams.filter((x) => x.id !== team);
  return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={pick} />}
      <p className="muted-text">{t.chosen ? tr(locale, t.chosen) : '—'} · {t.role}</p>
      <div className="row">{BOSS_ACTIONS.map((a) => <Btn key={a} kind={t.chosen === a ? 'primary' : ''} disabled={busy || (a === 'scan' && t.cd.scan > 0) || (a === 'combine' && (g.boss.phase < 2 || t.cd.combine > 0 || !partner))} why={a === 'scan' && t.cd.scan > 0 ? `Recharging (${t.cd.scan} turns).` : a === 'combine' ? first([g.boss.phase < 2, 'Combos unlock in phase 2.'], [t.cd.combine > 0, `Recharging (${t.cd.combine} turns).`], [!partner, 'Pick a partner team first.']) : undefined} onClick={() => send('choose_action', { team, action: a, aim: aim ? 'weak' : 'any', partner })}>{tr(locale, a)}{a === 'scan' && t.cd.scan > 0 ? ` (${t.cd.scan})` : ''}</Btn>)}</div>
      <label className="pj-check"><input type="checkbox" checked={aim} onChange={(e) => setAim(e.target.checked)} /> {tr(locale, 'aimWeak')}</label>
      {g.boss.phase >= 2 && other.length > 0 && <div className="row"><span className="muted-text">{tr(locale, 'partner')}:</span><TeamPick core={core} value={partner} onChange={setPartner} only={other.map((x) => x.id)} /></div>}
      <div className="row">{t.chosen && <Btn kind="ghost" disabled={busy} onClick={() => send('cancel_choice', { team })}>{tr(locale, 'undo')}</Btn>}<Btn kind="primary" disabled={busy || !(all ? allChosen : !!t.chosen)} why="Choose an action first." onClick={() => send('ask')}>{tr(locale, 'askQuestion')}</Btn></div></div>
  );
}

export function EscapeControls({ core, g: raw, locale, send, busy, selected, clearSel }: CtlProps) {
  const g = raw as EscapeG; const { team, pick, all } = useActing(core); const camp = CAMPAIGNS[g.campaign]; const [reason, setReason] = useState(''); const [to, setTo] = useState(''); const [item, setItem] = useState('');
  const h = typeof selected === 'string' ? activeSpots(g).find((x) => x.id === selected) : undefined; const inv = g.inv[g.shared ? 'shared' : team] ?? [];
  const free = core.phase === 'choose' || core.phase === 'planning';
  if (!free) return null;
  const needs = h ? hotspotNeeds(h, g.maxTier) : []; const haveAll = needs.every((i) => inv.includes(i)); const act = (a: string, extra: Record<string, unknown> = {}) => send(a, { team, hotspot: h?.id, ...extra }).then((ok) => ok && clearSel());
  return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={pick} />}
      <p className="muted-text">{h ? `${L(locale, h.label)}${needs.length ? ' · ' + tr(locale, 'needs', { i: needs.map((i) => L(locale, camp.items[i]!.label)).join(', ') }) : ''}` : '—'}</p>
      <div className="row">
        {g.selected ? <Btn kind="primary" disabled={busy} onClick={() => send('ask')}>{tr(locale, 'askQuestion')}</Btn> : <Btn kind="primary" disabled={busy || !h || h.kind !== 'puzzle' || !h.question || g.solved.includes(h.id) || !haveAll} why={first([!h, 'Click a puzzle in the room.'], [!!h && h.kind !== 'puzzle', 'That object is a lock or door: use items.'], [!!h && g.solved.includes(h.id), 'Already solved.'], [!haveAll, 'You still need the items listed above.'])} onClick={() => act('inspect')}>{tr(locale, 'inspect')}</Btn>}
        {g.selected && <Btn kind="ghost" disabled={busy} onClick={() => send('cancel_choice')}>{tr(locale, 'undo')}</Btn>}
        <Btn disabled={busy || !h || h.kind === 'puzzle' || g.opened.includes(h.id) || !haveAll} why={first([!h, 'Click a lock or door.'], [!!h && h.kind === 'puzzle', 'That object is a puzzle: inspect it.'], [!!h && g.opened.includes(h.id), 'Already open.'], [!haveAll, 'You still need the items listed above.'])} onClick={() => act('unlock')}>{tr(locale, 'unlock')}</Btn>
        <Btn kind="ghost" disabled={busy || !h || !h.question || g.solved.includes(h.id) || g.hintTokens <= 0} why={first([!h, 'Click a puzzle first.'], [g.hintTokens <= 0, 'No hint tokens left.'], [true, 'Nothing to hint here.'])} onClick={() => act('hint')}>{tr(locale, 'hint')} · {g.hintTokens}</Btn>
      </div>
      {!g.shared && inv.length > 0 && <div className="row"><select value={item} onChange={(e) => setItem(e.target.value)} aria-label={tr(locale, 'trade')}><option value="">{tr(locale, 'trade')}…</option>{inv.map((i) => <option key={i} value={i}>{L(locale, camp.items[i]!.label)}</option>)}</select><TeamPick core={core} value={to} onChange={setTo} only={core.teams.filter((x) => x.id !== team).map((x) => x.id)} /><Btn disabled={busy || !item || !to} onClick={() => send('trade', { from: team, to, item })}>{tr(locale, 'trade')}</Btn></div>}
      <details className="pj-more"><summary>{tr(locale, 'bypass')}</summary><div className="row"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="…" maxLength={120} aria-label={tr(locale, 'bypass')} /><Btn kind="danger" disabled={busy || reason.trim().length < 3 || !h || !h.question} onClick={() => act('bypass', { reason })}>{tr(locale, 'bypass')}</Btn></div></details>
      <div className="row"><Btn kind="ghost" disabled={busy} onClick={() => send('end_turn')}>{tr(locale, 'endTurn')}</Btn></div></div>
  );
}

export function VaultControls({ core, g: raw, locale, send, busy, selected, clearSel }: CtlProps) {
  const g = raw as VaultG; const { team, pick, all } = useActing(core); const t = g.teams[team]!; const v = typeof selected === 'string' ? g.vaults.find((x) => x.id === selected) : g.vaults.find((x) => x.id === g.selected);
  const [share, setShare] = useState(''); const [to, setTo] = useState('');
  const free = core.phase === 'choose' || core.phase === 'planning'; if (!free) return null;
  const can = !!v && !v.opened && !!payment(t.frags, v.req, v.band); const opened = g.vaults.filter((x) => x.opened).length;
  return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={pick} />}
      <p className="muted-text">{tr(locale, 'held')}: <b>{t.held}</b> · {tr(locale, 'banked')}: <b>{t.banked}</b>{v ? ` · ${v.id.toUpperCase()} ${v.opened ? '✓' : ''}` : ''}</p>
      <div className="row">
        <Btn kind="primary" disabled={busy || !v || v.opened} why={first([!v, 'Click a door on the wall.'], [true, 'That door is already open.'])} onClick={() => send('choose_vault', { vault: v!.id })}>{tr(locale, 'chooseVault')}</Btn>
        <Btn disabled={busy || !g.selected || core.phase !== 'choose'} why={core.phase !== 'choose' ? 'The question was already asked this turn.' : 'Choose a door first.'} onClick={() => send('ask')}>{tr(locale, 'askQuestion')}</Btn>
        <Btn kind={can ? 'good' : ''} disabled={busy || !can} why={first([!v, 'Click a door on the wall.'], [!!v?.opened, 'That door is open.'], [true, 'You do not hold the right key shapes for this lock.'])} onClick={() => send('open', { team, vault: v!.id }).then((ok) => ok && clearSel())}>{tr(locale, 'openVault')}</Btn>
        <Btn disabled={busy || opened < g.grand.need || g.grand.opened} why={g.grand.opened ? 'Already open.' : `Open ${g.grand.need - opened} more door${g.grand.need - opened === 1 ? '' : 's'} first.`} onClick={() => send('open_grand', { team })}>{tr(locale, 'grand')}</Btn>
      </div>
      <div className="row"><Btn kind="ghost" disabled={busy || t.held <= 0} why="Nothing in hand to bank." onClick={() => send('bank', { team })}>{tr(locale, 'bank')}</Btn>
        <Btn kind="ghost" disabled={busy || t.held < SCANNER_COST} why={`Needs ${SCANNER_COST} held treasure (you hold ${t.held}).`} onClick={() => send('bank', { team, mode: 'scanner' })}>{tr(locale, 'scan')} · {SCANNER_COST}</Btn>
        <Btn kind="ghost" disabled={busy} onClick={() => send('end_turn')}>{tr(locale, 'endTurn')}</Btn></div>
      {g.checkpoint && <details className="pj-more"><summary>{tr(locale, 'share')}</summary><div className="row"><select value={share} onChange={(e) => setShare(e.target.value)} aria-label={tr(locale, 'share')}><option value="">…</option>{SHAPES.filter((s) => (t.frags[s] ?? 0) > 0).map((s) => <option key={s} value={s}>{L(locale, SHAPE_LABEL[s])}</option>)}</select><TeamPick core={core} value={to} onChange={setTo} only={core.teams.filter((x) => x.id !== team).map((x) => x.id)} /><Btn disabled={busy || !share || !to} onClick={() => send('share', { team, to, shape: share })}>{tr(locale, 'share')}</Btn></div></details>}
    </div>
  );
}

export function LadderControls({ core, g: raw, locale, send, busy }: CtlProps) {
  const g = raw as LadderG; const { team, pick, all } = useActing(core); const t = g.teams[team]!; const [route, setRoute] = useState<'normal' | 'steady' | 'steep'>('normal');
  if (core.phase !== 'choose') return null;
  const ids = all ? core.teams.map((x) => x.id) : [team]; const pv = previewFor(g, t); const branch = branchTier(g, t.tier); const anyChosen = ids.some((id) => g.teams[id]!.chosen);
  return (
    <div className="pj-ctl">{all && <TeamPick core={core} value={team} onChange={pick} />}
      <ul className="pj-preview" aria-label="preview"><li>{tr(locale, 'gain', { n: pv.gain })}</li><li>{tr(locale, 'atRisk', { n: pv.atRisk })}</li><li>{tr(locale, 'fallsTo', { n: pv.fallsTo })}</li><li>{tr(locale, 'difficulty')}: {tr(locale, (['easy', 'medium', 'hard'] as const)[pv.difficulty - 1]!)}</li></ul>
      {branch && <div className="row">{(['normal', 'steady', 'steep'] as const).map((r) => <Btn key={r} kind={route === r ? 'primary' : 'ghost'} onClick={() => setRoute(r)}>{tr(locale, r === 'normal' ? 'normalRoute' : r)}</Btn>)}</div>}
      <div className="row">
        <Btn kind={t.chosen === 'climb' ? 'primary' : ''} disabled={busy || pv.atSummit} why="Already at the summit." onClick={() => send('choose_action', { team, action: 'climb', route: branch ? route : 'normal' })}>{tr(locale, 'climb')}</Btn>
        <Btn kind={t.chosen === 'bank' ? 'primary' : ''} disabled={busy || !pv.canBank} why="No unbanked points to bank." onClick={() => send('choose_action', { team, action: 'bank' })}>{tr(locale, 'bankPts')}</Btn>
        <Btn kind={t.chosen === 'review' ? 'primary' : ''} disabled={busy || !pv.canReview || all} why={all ? 'Review is for one team at a time.' : 'No review left, or nothing to review.'} onClick={() => send('choose_action', { team, action: 'review' })}>{tr(locale, 'reviewBtn')}</Btn>
      </div>
      <div className="row">{t.chosen && <Btn kind="ghost" disabled={busy} onClick={() => send('cancel_choice', { team })}>{tr(locale, 'undo')}</Btn>}<Btn kind="primary" disabled={busy || !anyChosen} why="Choose Climb, Bank or Review first." onClick={() => send('ask')}>{tr(locale, 'askQuestion')}</Btn><Btn kind="ghost" disabled={busy} onClick={() => send('end_turn')}>{tr(locale, 'endTurn')}</Btn></div></div>
  );
}
