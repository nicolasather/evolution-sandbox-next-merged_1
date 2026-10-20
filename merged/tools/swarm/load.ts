/** Concurrency / load run: `npx tsx tools/swarm/load.ts [--rooms 3] [--seconds 60] [--md docs/swarm-survival/LOAD_REPORT.md]`.
 *  Starts the real worker in-process (memory store) and connects real WebSocket clients: ROOMS × (4 teams × 5 players) = 20 students per room, all moving at 20 Hz
 *  and answering every question. Records tick time, snapshot size, bytes per client per second, event-loop lag, CPU and memory. */
import { writeFileSync } from 'node:fs';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { startSwarmServer } from '../../lib/swarm/server/server';
import { MemoryStore } from '../../lib/swarm/server/store';
import { FixtureSource } from '../../lib/swarm/server/quiz-source';
import { devRoom, joinRoom, WsClient } from '../../lib/swarm/server/testclient';
import { correctResponse } from '../../lib/swarm/server/fixtures';
import { fixtureQuestions } from '../../lib/swarm/server/fixtures';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1]! : d; };
const ROOMS = Number(arg('rooms', '3')); const SECONDS = Number(arg('seconds', '60')); const PER_ROOM = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const store = new MemoryStore(); const srv = await startSwarmServer({ port: 0, host: '127.0.0.1', secret: 'load-secret-load-secret-1234', store, dev: true, allowedOrigins: ['*'], sourceFor: () => new FixtureSource(60), maxRooms: 20, joinPerMinPerIp: 100000, joinPerMinPerRoom: 100000 });
  const lag = monitorEventLoopDelay({ resolution: 5 }); lag.enable();
  const clients: WsClient[] = []; const hosts: WsClient[] = []; const qs = new Map(fixtureQuestions(60).map((q) => [q.id, q]));
  for (let r = 0; r < ROOMS; r++) {
    const room = await devRoom(srv.url, { mode: 'versus', teamCount: 4, teamSizeCap: 5, minutes: 15, difficulty: 'normal' }, 60, 50 + r);
    const h = new WsClient(srv.wsUrl, room.hostToken); await h.connect(); hosts.push(h);
    for (let i = 0; i < PER_ROOM; i++) { const j = await joinRoom(srv.url, room.code, `S${r}-${i}`); if (j.status !== 200) throw new Error(JSON.stringify(j.json)); const c = new WsClient(srv.wsUrl, j.json.token as string); await c.connect(); clients.push(c); }
    h.send({ t: 'host', id: `s${r}`, cmd: { cmd: 'start' } }); await sleep(100); h.send({ t: 'host', id: `b${r}`, cmd: { cmd: 'begin' } });
  }
  await sleep(500); const cpu0 = process.cpuUsage(); const t0 = Date.now(); let seq = 0; const answered = new Set<string>(); let moves = 0, answers = 0;
  const bots = setInterval(() => {
    seq++;
    for (const [i, c] of clients.entries()) {
      const ph = c.phase; if (ph === 'wave' || ph === 'boss_wave') { const a = (seq * 0.13 + i) % (Math.PI * 2); c.send({ t: 'move', seq, x: Math.cos(a), y: Math.sin(a) }); moves++; if (seq % 40 === i % 40) c.send({ t: 'ability', id: `a${seq}-${i}` }); }
      const q = c.quiz; if (ph === 'question' && q && q.question && !c.me?.answered) { const key = `${i}:${q.w}`; if (!answered.has(key)) { answered.add(key); const row = qs.get(q.question.id); if (row) { c.send({ t: 'answer', w: q.w, id: `r${seq}-${i}`, r: correctResponse(row) }); answers++; } } }
    }
  }, 50);
  // teachers ask a question every ~12 s so the freeze/question/draft path is part of the load
  const asker = setInterval(() => { for (const [i, h] of hosts.entries()) h.send({ t: 'host', id: `q${Date.now()}-${i}`, cmd: { cmd: 'ask_now' } }); }, 12_000);
  await sleep(SECONDS * 1000); clearInterval(bots); clearInterval(asker); lag.disable();
  const cpu = process.cpuUsage(cpu0); const wall = (Date.now() - t0) / 1000; const m = srv.metrics; const tick = m.stats('tick_ms'); const snap = m.stats('snapshot_bytes');
  const bytesIn = clients.reduce((a, c) => a + c.bytes, 0); const phases: Record<string, number> = {}; for (const c of clients) phases[c.phase] = (phases[c.phase] ?? 0) + 1;
  const rows = { rooms: ROOMS, clients: clients.length, seconds: Math.round(wall), 'tick ms p50 / p95 / p99 / max': [tick.p50, tick.p95, tick.p99, tick.max].map((x) => x.toFixed(2)).join(' / '), 'snapshot bytes avg / p95 / max': [snap.avg, snap.p95, snap.max].map((x) => Math.round(x)).join(' / '), 'download per client (KB/s)': (bytesIn / clients.length / wall / 1024).toFixed(1), 'event-loop lag p99 / max (ms)': `${(lag.percentile(99) / 1e6).toFixed(1)} / ${(lag.max / 1e6).toFixed(1)}`, 'cpu (one core, %)': ((100 * (cpu.user + cpu.system)) / 1e6 / wall).toFixed(1), 'heap used (MB)': Math.round(process.memoryUsage().heapUsed / 1048576), 'full / delta snapshots': `${m.get('snapshots_full')} / ${m.get('snapshots_delta')}`, 'snapshots skipped (backpressure)': m.get('snapshots_skipped_backpressure'), 'tick catch-up drops': m.get('tick_catchup_dropped'), 'answers graded': m.get('answers_graded'), 'moves sent / answers sent': `${moves} / ${answers}`, 'rate-limited packets': m.get('rate_limited'), 'client phases at end': JSON.stringify(phases) };
  const md = `# Load report\n\nGenerated by \`tools/swarm/load.ts\`. ${ROOMS} room(s) × ${PER_ROOM} real WebSocket students (4 teams of 5), bots move at 20 Hz and answer every question; the teacher forces a question every 12 s. One Node process, memory store, loopback network (no network latency, so bandwidth is measured but latency is not).\n\n| metric | value |\n|---|---|\n${Object.entries(rows).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\nBudget: tick p99 < 25 ms (the tick is 50 ms), snapshot p95 < 6 KB.\n`;
  const i = process.argv.indexOf('--md'); if (i > 0) writeFileSync(process.argv[i + 1]!, md); else console.log(md);
  clients.forEach((c) => c.close()); hosts.forEach((h) => h.close()); await srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
