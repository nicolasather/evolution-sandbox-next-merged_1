'use client';
import Link from 'next/link';
import Image from 'next/image';
import { allowedFlows, gameModeSupports, modifierAvailability } from '@/lib/quiz/compatibility';
import { GAME_MODES } from '@/lib/quiz/game-modes';
import { modeInfo } from '@/lib/quiz/mode-info';
import { MODIFIERS, flowLabels, modeLabels, modifierDescriptions, modifierLabels, type Flow, type Modifier, type PlayMode } from '@/lib/quiz/types';
import AdvancedToggle from '../AdvancedToggle';
import CreatorChrome from '../CreatorChrome';
import { useCreator } from '../CreatorProvider';

const TIMERS = [null, 10, 15, 20, 30, 45, 60, 90, 120] as const;
const METHOD_HELP: Record<PlayMode, string> = {
  solo: 'Just one player, at their own pace.',
  classroom: 'One teacher computer and a projector. Teams take part without logging in.',
  online: 'Players join from their own devices with a room code.',
};
/** One concrete example per modifier, using sample numbers, so nobody has to guess what a rule does. */
const EXAMPLES: Record<Modifier, string> = {
  limited_slots: 'Example: with 3 slots, the first 3 answers are accepted; a 4th player is told the slots are full and nothing is added or taken.',
  secret_wager: 'Example: a player holding 300 points wagers 100. Correct: 400. Wrong: 200.',
  steal_question: 'Example: Team 1 answers wrongly. The host hands the same question to Team 2 for one try.',
  lose_all: 'Example: the host picks Team 3, who holds 450 points. Team 3 drops to 0.',
  go_to_first: 'Example: the leader holds 900 and Team 2 holds 400. Team 2 jumps to 900.',
  steal_points: 'Example: the host moves up to 100 points from Team 1 to Team 2.',
  give_points: 'Example: the host makes Team 1 hand up to 100 points to Team 2.',
  swap_points: 'Example: Team 1 holds 200 and Team 2 holds 700. They exchange totals.',
  potluck: 'Example: a random server-side event adds or removes up to 200 points, never dropping below zero.',
};

export default function RulesStep() {
  const c = useCreator();
  const s = c.settings; const r = s.rules; const gm = GAME_MODES[s.gameMode];
  if (!c.ready) return <CreatorChrome step="rules"><p className="muted-text" role="status">Loading your draft…</p></CreatorChrome>;
  if (!c.draftKey) return <CreatorChrome step="rules" canContinue={false} continueHint="Choose a game mode first."><p className="info">Start with <Link href="/quiz/create/mode">choosing a game mode</Link>.</p></CreatorChrome>;

  const patchRules = (p: Partial<typeof r>) => c.patchSettings((x) => ({ ...x, rules: { ...x.rules, ...p } }));
  const flows = allowedFlows(r.playMethod, s.gameMode);
  const ok: Modifier[] = [], no: { m: Modifier; reason: string }[] = [];
  for (const m of MODIFIERS) { const a = modifierAvailability(r.playMethod, r.flow, m, s.gameMode); if (a.ok) ok.push(m); else no.push({ m, reason: a.reason }); }
  const methods = (['solo', 'classroom', 'online'] as PlayMode[]).filter((m) => gameModeSupports(s.gameMode, m));
  const isAction = s.gameMode !== 'classic_quiz';
  const questionCount = c.questions.length;

  return (
    <CreatorChrome step="rules">
      <p className="muted-text">Playing <strong>{gm.title}</strong>. Only the choices that work with it are shown. Defaults are sensible: you can continue without changing anything.</p>

      <section className="panel stack" aria-labelledby="r-method">
        <h2 id="r-method">How it is played</h2>
        <div className="choices" role="radiogroup" aria-label="Play method">
          {methods.map((m) => (
            <button key={m} role="radio" aria-checked={r.playMethod === m} className="choice cr-method" onClick={() => c.patchSettings((x) => ({ ...x, rules: { ...x.rules, playMethod: m } }))}>
              <Image src={modeInfo(m).art} alt="" width={400} height={225} unoptimized />
              <strong>{modeLabels[m]}</strong><small>{METHOD_HELP[m]}</small>
            </button>
          ))}
        </div>
        {flows.length > 1 && (
          <div className="stack">
            <h3 style={{ margin: 0 }}>Question flow</h3>
            <div className="choices" role="radiogroup" aria-label="Question flow">
              {flows.map((f: Flow) => <button key={f} role="radio" aria-checked={r.flow === f} className="choice" onClick={() => c.patchSettings((x) => ({ ...x, rules: { ...x.rules, flow: f } }))}><strong>{flowLabels[f].split(' — ')[0]}</strong><small>{flowLabels[f].split(' — ')[1]}</small></button>)}
            </div>
          </div>
        )}
        {r.playMethod === 'classroom' && (
          <div className="stack">
            <div className="row spread"><h3 style={{ margin: 0 }}>Teams ({r.teamNames.length})</h3>
              <div className="row">
                <button className="btn small ghost" disabled={r.teamNames.length >= 8} onClick={() => patchRules({ teamNames: [...r.teamNames, `Team ${r.teamNames.length + 1}`] })}>Add team</button>
                <button className="btn small ghost" disabled={r.teamNames.length <= 2} onClick={() => patchRules({ teamNames: r.teamNames.slice(0, -1) })}>Remove team</button>
              </div></div>
            <div className="grid2">{r.teamNames.map((n, i) => <label key={i}>Team {i + 1} name<input value={n} maxLength={40} onChange={(e) => patchRules({ teamNames: r.teamNames.map((x, j) => (j === i ? e.target.value : x)) })} /></label>)}</div>
            <p className="note">The teacher controls the screen and records each team’s answer. Students need no devices or accounts.{r.flow === 'round_robin' ? ' In round robin, teams take turns in this order.' : ''}</p>
          </div>
        )}
      </section>

      <section className="panel stack" aria-labelledby="r-basic">
        <h2 id="r-basic">Timer and points</h2>
        <div className="grid2">
          <label>Time per question
            <select value={r.questionSeconds === null ? 'none' : String(r.questionSeconds)} onChange={(e) => patchRules({ questionSeconds: e.target.value === 'none' ? null : Number(e.target.value) })}>
              {TIMERS.map((t) => <option key={String(t)} value={t === null ? 'none' : t}>{t === null ? 'No time limit' : `${t} seconds`}</option>)}
              {r.questionSeconds !== null && !TIMERS.includes(r.questionSeconds as never) && <option value={r.questionSeconds}>{r.questionSeconds} seconds</option>}
            </select>
          </label>
          <label>Points for a correct answer (new questions)
            <input type="number" min={0} max={10000} value={r.basePoints} onChange={(e) => patchRules({ basePoints: Math.max(0, Math.min(10000, Number(e.target.value) || 0)) })} />
          </label>
        </div>
        <div className="row">
          <button className="btn small ghost" disabled={!questionCount} onClick={() => c.setQuestions((qs) => qs.map((q) => ({ ...q, basePoints: r.basePoints })))}>Apply {r.basePoints} points to all {questionCount} question{questionCount === 1 ? '' : 's'}</button>
        </div>
        <p className="note">Points are the only currency in every game mode. Cosmetic rewards, if any, never change a match.</p>
      </section>

      {isAction && (
        <section className="panel stack" aria-labelledby="r-mode">
          <h2 id="r-mode">{gm.title} settings</h2>
          <div className="grid2">
            {s.gameMode !== 'clue_racing' && (
              <label>{s.gameMode === 'tower_defense' ? 'Base health' : 'Hit points'}: {s.gameOptions.lives}
                <input type="range" min={1} max={9} value={s.gameOptions.lives} onChange={(e) => c.patchSettings({ gameOptions: { ...s.gameOptions, lives: Number(e.target.value) } })} /></label>
            )}
            {s.gameMode === 'clue_racing' && (
              <label>Checkpoints on the track: {Math.min(s.gameOptions.trackLength, Math.max(1, questionCount || s.gameOptions.trackLength))}
                <input type="range" min={5} max={30} value={s.gameOptions.trackLength} onChange={(e) => c.patchSettings({ gameOptions: { ...s.gameOptions, trackLength: Number(e.target.value) } })} />
                <span className="note">The track is never longer than the number of questions{questionCount ? ` (${questionCount} now)` : ''}.</span></label>
            )}
            <label>Pace
              <select value={s.gameOptions.pace} onChange={(e) => c.patchSettings({ gameOptions: { ...s.gameOptions, pace: e.target.value as never } })}>
                <option value="relaxed">Relaxed</option><option value="normal">Normal</option><option value="fast">Fast</option>
              </select>
              <span className="note">How quickly waves and hazards get harder.</span></label>
          </div>
          <p className="note">{gm.onWrong} {gm.ends}</p>
        </section>
      )}

      <section className="panel stack" aria-labelledby="r-mods">
        <h2 id="r-mods">Modifiers <span className="pill">{r.modifiers.length} on</span></h2>
        <p className="muted-text">Only modifiers that work with {gm.title}, {modeLabels[r.playMethod].toLowerCase()} and this flow are listed. All are off by default.</p>
        {ok.length === 0 && <p className="note">No modifiers are available for this setup.</p>}
        {ok.map((m) => (
          <label key={m} className="modifier">
            <input type="checkbox" checked={r.modifiers.includes(m)} onChange={(e) => patchRules({ modifiers: e.target.checked ? [...r.modifiers, m] : r.modifiers.filter((x) => x !== m) })} />
            <span><strong>{modifierLabels[m]}</strong><small>{modifierDescriptions[m]}</small><small className="cr-example">{EXAMPLES[m]}</small></span>
          </label>
        ))}
        {r.modifiers.includes('limited_slots') && <label>Answer slots per question<input type="number" min={1} max={100} value={r.slotLimit} onChange={(e) => patchRules({ slotLimit: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} /></label>}
        {no.length > 0 && (
          <details><summary>{no.length} modifier{no.length === 1 ? '' : 's'} not available with these choices</summary>
            <ul className="note">{no.map(({ m, reason }) => <li key={m}><strong>{modifierLabels[m]}</strong> — {reason}</li>)}</ul></details>
        )}
      </section>

      <AdvancedToggle label="Advanced: match length, adaptive timing, random pool, practice" />
      {s.advanced && (
        <section className="panel stack" aria-labelledby="r-adv">
          <h2 id="r-adv">Advanced</h2>
          <label>Match length: {Math.round(r.durationSeconds / 60)} minutes<input type="range" min={1} max={120} value={Math.round(r.durationSeconds / 60)} onChange={(e) => patchRules({ durationSeconds: Number(e.target.value) * 60 })} /></label>
          <label className="inline"><input type="checkbox" checked={r.adaptiveTiming} onChange={(e) => patchRules({ adaptiveTiming: e.target.checked })} /> Adaptive timing — add reading time for long questions, tables and videos</label>
          <label>Random pool: {r.poolSize === 0 ? 'ask every question' : `ask ${r.poolSize} random question${r.poolSize === 1 ? '' : 's'}`}
            <input type="range" min={0} max={Math.max(1, Math.min(200, questionCount))} value={Math.min(r.poolSize, Math.max(1, questionCount))} onChange={(e) => patchRules({ poolSize: Number(e.target.value) })} disabled={questionCount < 2} />
            <span className="note">Each session draws its own set from a seed, so a replay can reproduce it. {questionCount < 2 ? 'Needs at least 2 questions.' : ''}</span></label>
          <label className="inline"><input type="checkbox" checked={r.practice} onChange={(e) => patchRules({ practice: e.target.checked })} /> Practice mode — retry freely with explanations; never counts toward competitive results</label>
        </section>
      )}
    </CreatorChrome>
  );
}
