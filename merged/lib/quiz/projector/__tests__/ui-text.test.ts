/** Every log line and every error code a projector game can emit must read as a sentence, never a raw key. */
import '../games';
import fs from 'fs';
import path from 'path';
import { GAME_KEYS } from '../types';
import { accuracy, cfgOf, createState, fakeProviders, makePool, makeTeams, nextCommand, run } from '../testkit';
import { errText, logText } from '../../../../components/quiz/projector/i18n';

describe('human-readable text', () => {
  it.each([...GAME_KEYS])('%s: no log entry shows a raw key', async (game) => {
    const pool = makePool(300); let { state } = createState(cfgOf(game, 30), makeTeams(3), pool); const prov = fakeProviders(accuracy(0.6, 'ui'), pool); let n = 0;
    while (state.core.phase !== 'finished' && n++ < 3000) { const r = await run(state, nextCommand(state)!, pool, prov); if (!r.ok) { const f = await run(state, { action: 'skip_turn', payload: { reason: 'stuck' } }, pool, prov); if (!f.ok) break; state = f.state; continue; } state = r.state; }
    const bad = state.core.log.filter((e) => logText('en', e, () => 'Team') === e.k).map((e) => e.k);
    expect([...new Set(bad)]).toEqual([]);
    for (const e of state.core.log) { const tx = logText('en', e, () => 'Team'); if (tx.trim().length <= 3) throw new Error('empty log text for ' + e.k); expect(tx).not.toMatch(/\{\w+\}/); }
  }, 60000);
  it('every error code used by a reducer has a sentence', () => {
    const dir = path.join(__dirname, '..', 'reducers'); const codes = new Set<string>();
    for (const f of fs.readdirSync(dir)) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/err\('([A-Za-z]+)'/g)) codes.add(m[1]!);
    const missing = [...codes].filter((c) => errText('en', `projector:${c}`) === `projector:${c}`);
    expect(missing).toEqual([]);
  });
});
