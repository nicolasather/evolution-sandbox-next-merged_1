/** WCAG 2.x contrast ratio, used by the Appearance step's accessibility check. */
function lin(c: number) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const v = parseInt(n, 16);
  return 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
}
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
export type ContrastCheck = { label: string; fg: string; bg: string; ratio: number; need: number; pass: boolean };
export function checkTheme(v: Record<string, string>): ContrastCheck[] {
  const rows: [string, string, string, number][] = [
    ['Text on background', v['--th-text']!, v['--th-bg']!, 4.5],
    ['Text on panels', v['--th-text']!, v['--th-panel']!, 4.5],
    ['Button text on accent', v['--th-ink']!, v['--th-accent']!, 4.5],
    ['Button text on second accent', v['--th-ink']!, v['--th-accent2']!, 4.5],
    ['Accent against background (outlines, focus)', v['--th-accent']!, v['--th-bg']!, 3],
  ];
  return rows.map(([label, fg, bg, need]) => { const ratio = contrastRatio(fg, bg); return { label, fg, bg, ratio, need, pass: ratio >= need }; });
}
