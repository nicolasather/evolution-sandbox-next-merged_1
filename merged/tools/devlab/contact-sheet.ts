/* npm run lab:sheet — writes dev-data/visual-lab/contact-sheet.svg with one cell per resource. */
import { writeFileSync } from 'fs';
import path from 'path';
import { contactSheet, type SheetCell } from '../../lib/devlab/preview';
import { labDir } from '../../lib/devlab/store';
import { loadAll, refuseOnVercel } from './common';

refuseOnVercel();
const { dataset, results } = loadAll();
const cells: SheetCell[] = dataset.resources.map(r => {
  const g = results.get(r.id);
  return {
    id: r.id, name: r.name, category: r.category,
    state: !g ? 'missing' : g.status, source: g?.source, markup: g?.markup, note: g?.failure?.kind,
  };
});
const out = path.join(labDir(), 'contact-sheet.svg');
writeFileSync(out, contactSheet(cells));
const c = (s: SheetCell['state']) => cells.filter(x => x.state === s).length;
console.log(`wrote ${out}: ${c('ok')} rendered (${cells.filter(x => x.source === 'fixture').length} of them hand-authored fixtures), ${c('failed')} failed, ${c('missing')} not generated`);
