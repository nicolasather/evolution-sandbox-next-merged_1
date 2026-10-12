'use client';
import { districtView } from '@/lib/civilization/lifelines/selectors';
import type { ContentIndex, LifelinesState } from '@/lib/civilization/lifelines/schema';

/** The accessible, text-first equivalent of the map: every district, its programmes, needs and links. */
export function DistrictList({ index, run, selectedId, onSelect }: { index: ContentIndex; run: LifelinesState; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="ll-dlist" aria-label="Districts">
      {run.layout.districts.map(d => {
        const v = districtView(index, run, d.id, run.report);
        if (!v) return null;
        return (
          <li key={d.id}>
            <button type="button" className={'ll-drow' + (selectedId === d.id ? ' sel' : '')} aria-pressed={selectedId === d.id} onClick={() => onSelect(d.id)}>
              <b>{d.name}{d.storage ? ' · shared reserve' : ''}</b>
              <span>{v.built.length} established · {v.queue.length} in progress{v.needs.length ? ` · needs: ${v.needs.map(n => n.label).join(', ')}` : ''}</span>
              <span className="ll-dim">Links: {v.links.map(l => `${l.label} to ${l.otherName}${l.worn ? ' (worn)' : ''}`).join('; ') || 'none'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
