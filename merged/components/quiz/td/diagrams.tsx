/** Tiny original diagrams for the two ways to play, drawn in the same ink-and-toy language as the art kit. Decorative: the buttons beside them carry the words. */
const INK = '#19283A';
export function FormatDiagram({ kind }: { kind: 'coop' | 'versus' }) {
  const dot = (x: number, y: number, c: string) => <circle key={`${x}-${y}`} cx={x} cy={y} r={7} fill={c} stroke={INK} strokeWidth={3} />;
  const fort = (x: number, y: number) => <g key={`f${x}-${y}`}><path d={`M${x - 12} ${y + 10} V${y - 4} H${x - 6} V${y - 9} H${x - 1} V${y - 4} H${x + 4} V${y - 9} H${x + 9} V${y - 4} H${x + 12} V${y + 10} Z`} fill="#B9C3CF" stroke={INK} strokeWidth={3} strokeLinejoin="round" /><path d={`M${x - 3} ${y - 12} L${x + 3} ${y - 18} L${x + 9} ${y - 12} L${x + 3} ${y - 6} Z`} fill="#FFC94B" stroke={INK} strokeWidth={2} strokeLinejoin="round" /></g>;
  return (
    <svg className="td-diagram" viewBox="0 0 220 96" role="img" aria-label={kind === 'coop' ? 'Five students on one team defending one fort' : 'Three teams each defending their own fort on identical maps'}>
      {kind === 'coop' ? (
        <>{[['#55BD8C', 22, 22], ['#FC7462', 22, 48], ['#67BCD9', 22, 74], ['#FFC94B', 50, 35], ['#A48EDD', 50, 61]].map(([c, x, y]) => dot(x as number, y as number, c as string))}
          <path d="M70 48 H150" stroke={INK} strokeWidth={4} strokeDasharray="8 7" strokeLinecap="round" fill="none" />{fort(176, 48)}</>
      ) : (
        <>{[['#55BD8C', 26], ['#FC7462', 48], ['#67BCD9', 70]].map(([c, y]) => <g key={y as number}>{dot(20, y as number, c as string)}{dot(38, y as number, c as string)}<path d={`M54 ${y} H140`} stroke={INK} strokeWidth={3} strokeDasharray="6 6" strokeLinecap="round" fill="none" />{fort(160, y as number)}</g>)}
          <path d="M190 30 L196 20 L202 30 L208 20 L214 30 V40 H190 Z" fill="#FFC94B" stroke={INK} strokeWidth={3} strokeLinejoin="round" /></>
      )}
    </svg>
  );
}
