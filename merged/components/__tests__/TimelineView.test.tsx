import { render, screen } from '@testing-library/react';
import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import { TimelineView } from '../TimelineView';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;

describe('TimelineView', () => {
  it('names only what has been found, with its recorded date, and never a hidden find', () => {
    const e = new Engine(db);
    e.combine('wood', 'wood');   // fire
    render(<TimelineView engine={e} version={1} active focusId={null} onOpen={() => {}} />);
    const fire = e.get('fire')!;
    expect(screen.getByRole('button', { name: `${fire.n}, ${fire.date}` })).toBeInTheDocument();
    // nothing undiscovered is named on the rail
    const unfound = db.nodes.find(n => !e.has(n.id) && !n.hidden)!;
    expect(screen.queryByText(unfound.n)).toBeNull();
    for (const h of db.nodes.filter(n => n.hidden)) expect(screen.queryByText(h.n)).toBeNull();
  });

  it('says so when there is nothing to show yet', () => {
    const e = new Engine(db);
    render(<TimelineView engine={e} version={0} active focusId={null} onOpen={() => {}} />);
    // the four raw materials are always held, so the rail is never empty; the header still reads as a timeline
    expect(screen.getByRole('tabpanel', { name: 'Timeline' })).toBeInTheDocument();
  });
});
