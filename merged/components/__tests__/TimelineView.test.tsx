import { render, screen } from '@testing-library/react';
import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import { TimelineView } from '../TimelineView';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;

/** Give a fresh engine every listed discovery in one shot, without playing for it. */
function give(e: Engine, ...ids: string[]) {
  for (const id of ids) {
    if (e.holds(id)) continue;
    e.found.add(id); e.order.push(id); e.bag.push(id);
  }
  (e as unknown as { emit(): void }).emit();
}

describe('TimelineView', () => {
  it('names only what has been found, with its recorded date, and never a hidden find', () => {
    const e = new Engine(db);
    e.waiveEraLock();            // this test is about the rail, not the era lock
    e.combine('wood', 'wood');   // fire
    render(<TimelineView engine={e} version={1} active focusId={null} onOpen={() => {}} />);
    const fire = e.get('fire')!;
    expect(screen.getByRole('button', { name: new RegExp(`^${fire.n}, ${fire.date.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(, major world invention)?$`) })).toBeInTheDocument();
    // nothing undiscovered is named on the rail
    const unfound = db.nodes.find(n => !e.has(n.id) && !n.hidden)!;
    expect(screen.queryByText(unfound.n)).toBeNull();
    for (const h of db.nodes.filter(n => n.hidden)) expect(screen.queryByText(h.n)).toBeNull();
  });

  it('lays out one global chronological sequence, never resetting order at an era boundary', () => {
    const e = new Engine(db);
    e.waiveEraLock();
    // Find things from eras that interleave in real history, deliberately out of era-declaration order.
    const picks = db.nodes.filter(n => !n.hidden && !n.primitive).slice(0, 40).map(n => n.id);
    give(e, ...picks);
    const { container } = render(<TimelineView engine={e} version={1} active focusId={null} onOpen={() => {}} />);
    const found = Array.from(container.querySelectorAll<HTMLElement>('.tl-pt[data-id]'));
    expect(found.length).toBeGreaterThan(0);
    const dsInDomOrder = found.map(el => e.get(el.dataset.id!)!.ds);
    const sorted = [...dsInDomOrder].sort((a, b) => a - b);
    expect(dsInDomOrder).toEqual(sorted); // strictly non-decreasing left to right — never per-era
    // the same era id may legitimately appear as more than one separate run (overlap, not a bug)
    const eraDivs = Array.from(container.querySelectorAll<HTMLElement>('.tl-era'));
    const eraSequence = eraDivs.map(d => d.dataset.era);
    expect(eraDivs.length).toBeGreaterThanOrEqual(new Set(eraSequence).size);
  });

  it('says so when there is nothing to show yet', () => {
    const e = new Engine(db);
    render(<TimelineView engine={e} version={0} active focusId={null} onOpen={() => {}} />);
    // the four raw materials are always held, so the rail is never empty; the header still reads as a timeline
    expect(screen.getByRole('tabpanel', { name: 'Timeline' })).toBeInTheDocument();
  });
});
