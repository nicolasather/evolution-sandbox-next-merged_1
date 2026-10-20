'use client';
/** Teacher controls for the two projector modifiers (Secret Wager, Steal the Question). Shown only when the teacher enabled them at setup and the
 *  game allows them; every number on a button is the exact consequence, and the reducer re-checks all of it. */
import { useId, useState } from 'react';
import { moduleFor } from '@/lib/quiz/projector/engine';
import '@/lib/quiz/projector/games';
import type { Core } from '@/lib/quiz/projector/types';
import { TeamSwatch } from './parts';

type Send = (action: string, payload?: Record<string, unknown>) => Promise<boolean>;

export default function ModifierPanel({ core, g, send, busy }: { core: Core; g: unknown; send: Send; busy: boolean }) {
  const wallet = moduleFor(core.game).wallet; const id = useId();
  const [amount, setAmount] = useState(''); const [pickTeam, setPickTeam] = useState(''); const [stealTeam, setStealTeam] = useState('');
  if (!wallet || (!core.mods?.wager && !core.mods?.rebound) || core.phase === 'finished') return null;
  const s = { core, g } as Parameters<typeof wallet.balance>[0];
  const turnTeam = core.teams[core.actor % core.teams.length]!.id;
  const wagerTeam = core.askMode === 'all' ? (core.teams.some((t) => t.id === pickTeam) ? pickTeam : core.teams[0]!.id) : turnTeam;
  const bal = wallet.balance(s, wagerTeam); const cap = Math.min(wallet.wagerCap, bal); const cur = core.wagers?.[wagerTeam] ?? 0;
  const n = Number(amount); const valid = amount !== '' && Number.isInteger(n) && n >= 0 && n <= cap;
  const r = core.rebound; const open = core.mods.rebound && r && !r.used;
  const name = (t: string) => core.teams.find((x) => x.id === t)?.name ?? '';
  return (
    <section className="pj-panel" aria-label="Modifiers">
      {core.mods.wager && core.phase === 'choose' && (
        <div className="stack">
          <h3>Secret Wager</h3>
          {core.askMode === 'all' && <div className="pj-teampick" role="radiogroup" aria-label="Team">{core.teams.map((t, i) => <button key={t.id} role="radio" aria-checked={wagerTeam === t.id} className={wagerTeam === t.id ? 'on' : ''} onClick={() => setPickTeam(t.id)}><TeamSwatch i={i} size={20} />{t.name}</button>)}</div>}
          <p className="muted-text" id={id}>{name(wagerTeam)} holds {bal}. Stake 0–{cap}: correct wins the stake, wrong loses it, partial returns it.{cur ? ` Current stake: ${cur}.` : ''}</p>
          <div className="row">
            <input type="number" inputMode="numeric" min={0} max={cap} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Stake for ${name(wagerTeam)}`} aria-describedby={id} style={{ width: '6rem' }} />
            <button className="btn small" disabled={busy || !valid} onClick={() => void send('wager', { team: wagerTeam, amount: n }).then((ok) => ok && setAmount(''))}>{valid ? `Stake ${n}` : 'Stake'}</button>
            {cur > 0 && <button className="btn small ghost" disabled={busy} onClick={() => void send('wager', { team: wagerTeam, amount: 0 })}>Withdraw stake</button>}
          </div>
          {!valid && amount !== '' && <small className="pj-why" role="note">Enter a whole number from 0 to {cap}.</small>}
        </div>
      )}
      {open && (
        <div className="stack">
          <h3>Steal the Question</h3>
          <p className="muted-text">{name(r!.from)} missed. Another team may answer the same question once; a correct steal earns {wallet.earn(1)}.</p>
          <div className="pj-teampick" role="radiogroup" aria-label="Team that steals">{core.teams.filter((t) => t.id !== r!.from).map((t) => { const i = core.teams.findIndex((x) => x.id === t.id); return <button key={t.id} role="radio" aria-checked={stealTeam === t.id} className={stealTeam === t.id ? 'on' : ''} onClick={() => setStealTeam(t.id)}><TeamSwatch i={i} size={20} />{t.name}</button>; })}</div>
          <div className="row">
            <button className="btn small good" disabled={busy || !stealTeam} onClick={() => void send('rebound', { team: stealTeam, verdict: 'correct' })}>{stealTeam ? `${name(stealTeam)}: correct (+${wallet.earn(1)})` : 'Pick a team'}</button>
            <button className="btn small" disabled={busy || !stealTeam} onClick={() => void send('rebound', { team: stealTeam, verdict: 'wrong' })}>{stealTeam ? `${name(stealTeam)}: not correct` : 'Pick a team'}</button>
            <button className="btn small ghost" disabled={busy} onClick={() => void send('rebound_pass')}>Nobody steals</button>
          </div>
        </div>
      )}
    </section>
  );
}
