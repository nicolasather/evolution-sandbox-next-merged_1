/* Static 2D preview SVGs (development only). This is a flat projection of the plate markup in the
   artwork palette — the gallery additionally renders the real 3D wireframe through components/Plate3D. */

const STYLE = 'fill="none" stroke="#67f3ff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" color="#67f3ff"';
const BG = '<defs><radialGradient id="bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#0b2233"/><stop offset="1" stop-color="#050b12"/></radialGradient>'
  + '<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';

/** Markup is produced only by compileSpec (paths/circles/groups with numeric attributes), never by the model directly. */
export function previewSvg(markup: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400">${BG}<rect width="100" height="100" fill="url(#bg)"/><g ${STYLE} filter="url(#glow)">${markup}</g></svg>`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export interface SheetCell {
  id: string;
  name: string;
  category: string;
  state: 'ok' | 'failed' | 'missing';
  source?: 'qwen' | 'fixture';
  markup?: string;
  note?: string;
}

/** Contact sheet: every one of the 100 resources gets a cell; failures and gaps are drawn as such, never as icons. */
export function contactSheet(cells: SheetCell[], cols = 10): string {
  const W = 200, H = 224, rows = Math.ceil(cells.length / cols);
  const parts = cells.map((c, i) => {
    const x = (i % cols) * W, y = Math.floor(i / cols) * H;
    const tag = c.state === 'ok' ? (c.source === 'fixture' ? 'FIXTURE (hand-authored)' : 'qwen3:14b') : c.state === 'failed' ? `FAILED: ${c.note ?? ''}` : 'not generated';
    const color = c.state === 'ok' ? (c.source === 'fixture' ? '#e6c35c' : '#7aa') : c.state === 'failed' ? '#ff7a7a' : '#667';
    const body = c.state === 'ok' && c.markup
      ? `<g transform="translate(0 4) scale(2)" ${STYLE.replace('stroke-width="1.5"', 'stroke-width="1.1"')} filter="url(#glow)">${c.markup}</g>`
      : `<text x="100" y="110" text-anchor="middle" fill="${color}" font-size="12" font-family="monospace">${c.state === 'failed' ? 'GENERATION FAILED' : 'NOT GENERATED'}</text>`;
    return `<g transform="translate(${x} ${y})"><rect width="${W}" height="${H}" fill="url(#bg)" stroke="#123"/>${body}`
      + `<text x="6" y="${H - 22}" fill="#cfe" font-size="11" font-family="monospace">${esc(c.category)} · ${esc(c.name)}</text>`
      + `<text x="6" y="${H - 8}" fill="${color}" font-size="9" font-family="monospace">${esc(tag).slice(0, 38)}</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * W}" height="${rows * H}" viewBox="0 0 ${cols * W} ${rows * H}">${BG}${parts.join('')}</svg>`;
}
