import { render, screen } from '@testing-library/react';
import rawDb from '@/data/db.json';
import { CeremonyStage } from '../fx/CeremonyStage';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;

describe('CeremonyStage', () => {
  it('prints the catalogue number over the total and the era of a normal find', () => {
    const n = db.nodes.find(x => x.id === 'fire')!;
    render(<CeremonyStage node={n} onDone={() => {}} />);
    expect(screen.getByRole('dialog', { name: /New discovery: Fire/ })).toBeInTheDocument();
    expect(screen.getByText(`/ ${db.counts.total}`)).toBeInTheDocument();
    expect(screen.getByText('New discovery')).toBeInTheDocument();
  });

  it('keeps a hidden find masked until it resolves, and says nothing of its name in the label text', () => {
    const h = db.nodes.find(x => x.hidden)!;
    render(<CeremonyStage node={h} onDone={() => {}} />);
    expect(screen.getByText('New hidden discovery')).toBeInTheDocument();
    expect(screen.getByText('?????????')).toBeInTheDocument();
  });
});
