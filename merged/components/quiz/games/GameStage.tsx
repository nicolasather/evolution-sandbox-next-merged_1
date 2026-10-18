import type { ClueState, GameState, ObstacleState, TowerDefenseState } from '@/lib/quiz/games/engine';
import { outcomeLabel, summary } from '@/lib/quiz/games/engine';

const INK = '#0A1220', CREAM = '#FFF6E2', YELLOW = '#FFD52F', CYAN = '#16C9EF', CORAL = '#FF386A', LIME = '#B5ED44', PURPLE = '#8D5BFF';
const W = 800, H = 340;

/** A path made of straight pieces so towers/markers can be placed by arc position without a path-measuring API. */
const PATH_PTS: [number, number][] = [[10, 250], [150, 250], [230, 150], [380, 150], [470, 250], [610, 250], [690, 170]];
function along(t: number): [number, number] {
  const segs = PATH_PTS.slice(1).map((p, i) => { const a = PATH_PTS[i]!; return { a, p, len: Math.hypot(p[0] - a[0], p[1] - a[1]) }; });
  const total = segs.reduce((s, x) => s + x.len, 0);
  let d = Math.max(0, Math.min(1, t)) * total;
  for (const s of segs) { if (d <= s.len) return [s.a[0] + (s.p[0] - s.a[0]) * (d / s.len), s.a[1] + (s.p[1] - s.a[1]) * (d / s.len)]; d -= s.len; }
  return PATH_PTS[PATH_PTS.length - 1]!;
}
const pathD = 'M' + PATH_PTS.map((p) => p.join(',')).join(' L');

function Pips({ n, max, x, y, color }: { n: number; max: number; x: number; y: number; color: string }) {
  return <g>{Array.from({ length: max }, (_, i) => <rect key={i} x={x + i * 26} y={y} width={20} height={20} rx={4} fill={i < n ? color : '#0b121b'} stroke={INK} strokeWidth={3} />)}</g>;
}

function Tower({ s }: { s: TowerDefenseState }) {
  const slots = Array.from({ length: 8 }, (_, i) => along(0.1 + i * 0.11));
  const enemy = along(0.02 + Math.min(0.9, 0.02));
  return (
    <>
      <path d={pathD} fill="none" stroke={INK} strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathD} fill="none" stroke={CREAM} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
      {slots.map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y - 36})`} className={i < s.towers ? 'qg-pop' : undefined} opacity={i < s.towers ? 1 : 0.18}>
          <rect x={-14} y={0} width={28} height={36} rx={4} fill={CYAN} stroke={INK} strokeWidth={4} />
          <rect x={-18} y={-8} width={36} height={12} rx={3} fill={YELLOW} stroke={INK} strokeWidth={4} />
          {i === 0 && s.upgrades > 0 && Array.from({ length: Math.min(s.upgrades, 5) }, (_, k) => <circle key={k} cx={-10 + k * 8} cy={-18} r={3.5} fill={LIME} stroke={INK} strokeWidth={2} />)}
        </g>
      ))}
      <g transform="translate(690,70)"><rect x={0} y={0} width={90} height={150} rx={6} fill={PURPLE} stroke={INK} strokeWidth={5} />{[0, 1, 2].map((i) => <rect key={i} x={6 + i * 28} y={-14} width={20} height={20} fill={YELLOW} stroke={INK} strokeWidth={4} />)}<rect x={30} y={90} width={30} height={60} rx={14} fill={INK} /></g>
      <g transform={`translate(${enemy[0]},${enemy[1]})`} key={`e${s.wave}`} className="qg-march">
        {s.nextEnemy === 'brute' ? <rect x={-20} y={-20} width={40} height={40} rx={6} fill={CORAL} stroke={INK} strokeWidth={5} /> : s.nextEnemy === 'swarm' ? <><circle cx={-12} cy={0} r={10} fill={CORAL} stroke={INK} strokeWidth={4} /><circle cx={10} cy={-8} r={10} fill={CORAL} stroke={INK} strokeWidth={4} /><circle cx={10} cy={12} r={10} fill={CORAL} stroke={INK} strokeWidth={4} /></> : <polygon points="0,-20 18,14 -18,14" fill={CORAL} stroke={INK} strokeWidth={5} />}
        <text y={6} textAnchor="middle" fontSize={16} fontWeight={900} fill={INK} fontFamily="inherit">{s.nextStrength}</text>
      </g>
      <text x={20} y={34} fontSize={20} fontWeight={800} fill={CREAM} fontFamily="inherit">Base health</text>
      <Pips n={s.lives} max={s.maxLives} x={20} y={44} color={CORAL} />
      <text x={20} y={100} fontSize={16} fill={CREAM} fontFamily="inherit">Tower power {s.towers + s.upgrades} · wave {s.wave + 1}</text>
      {s.last?.kind === 'leak' && <rect key={`f${s.wave}`} className="qg-flash" x={0} y={0} width={W} height={H} fill={CORAL} />}
    </>
  );
}

function Obstacle({ s, total }: { s: ObstacleState; total: number }) {
  const laneY = 250; const runnerX = 70 + Math.min(1, s.distance / Math.max(1, total)) * 560;
  const hz = (k: ObstacleState['nextHazard'], x: number) => k === 'hurdle'
    ? <g transform={`translate(${x},${laneY - 56})`}><rect x={-6} y={0} width={12} height={56} fill={YELLOW} stroke={INK} strokeWidth={4} /><rect x={-26} y={-6} width={52} height={14} rx={4} fill={CREAM} stroke={INK} strokeWidth={4} /></g>
    : k === 'spikes' ? <polygon transform={`translate(${x},${laneY})`} points="-30,0 -20,-40 -10,0 0,-40 10,0 20,-40 30,0" fill={LIME} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    : <g transform={`translate(${x},${laneY - 40})`} className="qg-spin"><circle r={36} fill={PURPLE} stroke={INK} strokeWidth={5} /><circle r={11} fill={CREAM} stroke={INK} strokeWidth={4} />{[0, 1, 2, 3, 4, 5].map((i) => <polygon key={i} points="0,-36 8,-52 16,-34" fill={CREAM} stroke={INK} strokeWidth={3} transform={`rotate(${i * 60})`} />)}</g>;
  return (
    <>
      <rect x={0} y={laneY} width={W} height={H - laneY} fill={INK} /><line x1={0} y1={laneY} x2={W} y2={laneY} stroke={CREAM} strokeWidth={6} />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={i * 100 + 20} y={laneY + 44} width={56} height={8} rx={4} fill={CREAM} opacity={0.7} />)}
      <rect x={720} y={laneY - 120} width={12} height={120} fill={INK} /><rect x={732} y={laneY - 120} width={48} height={40} fill={CREAM} stroke={INK} strokeWidth={3} />{[0, 1, 2].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={732 + c * 24} y={laneY - 120 + r * 13} width={24} height={13} fill={(r + c) % 2 ? CREAM : INK} />))}
      {hz(s.nextHazard, Math.min(runnerX + 150, 690))}
      <g key={`r${s.step}`} className={s.last?.kind === 'hit' ? 'qg-shake' : 'qg-slide'} style={{ transform: `translate(${runnerX}px,${laneY - 48}px)` }}>
        <rect x={-22} y={0} width={44} height={48} rx={20} fill={CYAN} stroke={INK} strokeWidth={5} />
        {s.last?.kind === 'cleared' && <path d="M-34 -8 q34 -40 68 0" fill="none" stroke={YELLOW} strokeWidth={5} strokeLinecap="round" />}
      </g>
      <text x={20} y={34} fontSize={20} fontWeight={800} fill={CREAM} fontFamily="inherit">Hit points</text>
      <Pips n={s.hp} max={s.maxHp} x={20} y={44} color={CORAL} />
      <text x={20} y={100} fontSize={16} fill={CREAM} fontFamily="inherit">Streak {s.streak} · speed ×{s.speed.toFixed(1)}</text>
    </>
  );
}

const TILES = 10;
function Clue({ s }: { s: ClueState }) {
  const pts = Array.from({ length: s.trackLength + 1 }, (_, i) => along(i / s.trackLength));
  const me = pts[Math.min(s.position, s.trackLength)]!;
  return (
    <>
      <path d={pathD} fill="none" stroke={INK} strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathD} fill="none" stroke={CREAM} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === s.trackLength ? 0 : 9} fill={i <= s.position ? LIME : '#c9c2ad'} stroke={INK} strokeWidth={3} />)}
      <g transform={`translate(${pts[s.trackLength]![0]},${pts[s.trackLength]![1]})`}><rect x={-3} y={-100} width={6} height={100} fill={INK} />{[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={3 + c * 18} y={-100 + r * 16} width={18} height={16} fill={(r + c) % 2 ? CREAM : INK} stroke={INK} strokeWidth={2} />))}</g>
      <g key={`m${s.step}`} transform={`translate(${me[0]},${me[1] - 4})`} className="qg-pop"><polygon points="0,-30 22,10 -22,10" fill={s.last?.kind === 'stalled' ? CORAL : YELLOW} stroke={INK} strokeWidth={5} strokeLinejoin="round" /></g>
      <text x={20} y={34} fontSize={20} fontWeight={800} fill={CREAM} fontFamily="inherit">Clue picture</text>
      {Array.from({ length: TILES }, (_, i) => {
        const shown = s.revealed.some((r) => Math.floor((r / s.trackLength) * TILES) === i || r === i);
        return <rect key={i} x={20 + (i % 5) * 34} y={44 + Math.floor(i / 5) * 34} width={30} height={30} rx={4} fill={shown ? [CYAN, LIME, YELLOW, PURPLE, CORAL][i % 5] : '#0b121b'} stroke={INK} strokeWidth={3} />;
      })}
      <text x={20} y={132} fontSize={16} fill={CREAM} fontFamily="inherit">Checkpoint {s.position}/{s.trackLength} · streak {s.streak}</text>
    </>
  );
}

/** The scene for one runner/team in a game mode. Purely a picture of the state; it never grades or scores. */
export default function GameStage({ state, totalQuestions, title }: { state: GameState; totalQuestions: number; title?: string }) {
  const label = `${title ? `${title}: ` : ''}${summary(state)}. ${outcomeLabel(state.outcome, state.mode)}.`;
  const bg = state.mode === 'tower_defense' ? '#1c5a2c' : state.mode === 'obstacle_survival' ? '#7a1634' : '#2f1a66';
  return (
    <figure className="qg-stage" data-outcome={state.outcome}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <rect width={W} height={H} fill={bg} />
        <rect width={W} height={H} fill="url(#qg-dots)" />
        <defs><pattern id="qg-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill="#fff" opacity=".07" /></pattern></defs>
        {state.mode === 'tower_defense' && <Tower s={state} />}
        {state.mode === 'obstacle_survival' && <Obstacle s={state} total={totalQuestions} />}
        {state.mode === 'clue_racing' && <Clue s={state} />}
      </svg>
      <figcaption><strong>{outcomeLabel(state.outcome, state.mode)}</strong> · {summary(state)}</figcaption>
    </figure>
  );
}
