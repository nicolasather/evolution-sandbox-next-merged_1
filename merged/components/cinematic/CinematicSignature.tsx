import type { CSSProperties, ReactNode } from 'react';
import type { SceneId } from '@/lib/cinematic/scenes';

/* ============================================================================
   SIGNATURE — one looping animation that belongs to one scene only, laid over
   the shared 2.5D stage: two lights that merge (Merging), a network drawing
   itself (Graph), drawers sliding in (Archive), snow and a low fire
   (Survival), a skyline rising (Civilization), a door opening (Escape Room),
   rings collapsing inward (Reverse)…  Pure CSS/SVG; every colour is a --k*.
   The styling lives in app/_cinematic.css, section 9.
   ========================================================================== */

const N = (n: number) => Array.from({ length: n }, (_, i) => i);
const v = (o: Record<string, string | number>) => o as CSSProperties;

const NET_NODES: [number, number][] = [[10, 38], [24, 18], [30, 44], [46, 26], [52, 50], [64, 16], [72, 40], [86, 24], [90, 48]];
const NET_EDGES: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [3, 6], [4, 6], [5, 7], [6, 7], [6, 8], [7, 8]];
const GLYPHS = [
  'M4 4h16M12 4v16M6 20h12', 'M4 20 12 4l8 16M8 14h8', 'M6 4v16M6 12h12M18 4v16',
  'M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0M12 4v16', 'M4 4l16 16M20 4 4 20M12 4v16', 'M4 8h16M4 16h16M8 4v16M16 4v16',
];

function body(id: SceneId): ReactNode {
  switch (id) {
    case 'work':
      return <><b className="a" /><b className="b" /><i className="ring" /><i className="ring r2" /></>;
    case 'graph':
      return (
        <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice">
          {NET_EDGES.map(([a, b], i) => (
            <line key={i} style={v({ '--i': i })} x1={NET_NODES[a][0]} y1={NET_NODES[a][1]} x2={NET_NODES[b][0]} y2={NET_NODES[b][1]} />
          ))}
          {NET_NODES.map(([x, y], i) => <circle key={i} style={v({ '--i': i })} cx={x} cy={y} r="1.6" />)}
        </svg>
      );
    case 'arch':
      return <>{N(6).map(i => <b key={i} style={v({ '--i': i })} />)}</>;
    case 'time':
      return <><i className="line" />{N(7).map(i => <b key={i} style={v({ '--i': i })} />)}</>;
    case 'hub':
      return <div className="orbit">{N(8).map(i => <b key={i} style={v({ '--i': i })} />)}</div>;
    case 'museum':
      return <><i className="cone l" /><i className="cone r" /></>;
    case 'minpath':
      return (
        <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice">
          <path id="sgp" d="M6 50C22 50 14 30 32 30S46 12 62 14 80 28 94 8" />
          <circle cx="6" cy="50" r="2.2" /><circle cx="94" cy="8" r="2.6" className="end" />
          <circle r="1.7" className="dot"><animateMotion dur="6s" repeatCount="indefinite" path="M6 50C22 50 14 30 32 30S46 12 62 14 80 28 94 8" /></circle>
        </svg>
      );
    case 'journal':
      return <>{N(7).map(i => <b key={i} style={v({ '--i': i })} />)}</>;
    case 'world':
      return <div className="globe">{N(5).map(i => <i key={i} style={v({ '--i': i })} />)}<u /></div>;
    case 'trade':
      return <>{N(4).map(i => <b key={i} style={v({ '--i': i })} />)}</>;
    case 'lab':
      return <>{N(16).map(i => <b key={i} style={v({ '--i': i })} />)}</>;
    case 'survival':
      return <><i className="fire" />{N(44).map(i => <b key={i} style={v({ '--i': i })} />)}</>;
    case 'civilization':
      return <>{N(14).map(i => <b key={i} style={v({ '--i': i })} />)}</>;
    case 'archaeology':
      return <>{N(6).map(i => <b key={i} style={v({ '--i': i })} />)}<i className="brush" /></>;
    case 'escape-room':
      return <><i className="light" /><b className="door l" /><b className="door r" /><i className="hole" /></>;
    case 'decipher':
      return (
        <>{N(14).map(i => (
          <svg key={i} viewBox="0 0 24 24" style={v({ '--i': i })}><path d={GLYPHS[i % GLYPHS.length]} /></svg>
        ))}</>
      );
    case 'alien-archaeology':
      return <>{N(4).map(i => <i key={i} style={v({ '--i': i })} />)}<b className="scan" /></>;
    case 'reverse-evolution':
      return <>{N(5).map(i => <i key={i} style={v({ '--i': i })} />)}{N(10).map(i => <b key={i} style={v({ '--i': i })} />)}</>;
    default:
      return null;
  }
}

export function Signature({ id }: { id: SceneId }) {
  return <div className={`sg sg-${id}`} aria-hidden="true">{body(id)}</div>;
}
