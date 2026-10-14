import { notFound } from 'next/navigation';
import { gateOpen } from '@/lib/server/ownerAuth';
import { ARCHETYPES } from '@/lib/visual3d/types';
import { Reconstruction3D } from '@/components/Reconstruction3D';

/* Owner/dev-only preview of every procedural archetype through the real component.
   404 unless the developer gate is open (never on production). Adds no content to the game. */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Visual3D preview', robots: { index: false, follow: false } };

const FAMILY: Record<string, string> = {
  blade: 'stone', hafted_tool: 'wood', axe: 'stone', stone_fragment: 'stone', polished_stone: 'stone', wood_rod: 'wood',
  woven_fibre: 'fibre', vessel: 'earth', brick: 'earth', metal_ingot: 'metal', wheel: 'wood', bone_tool: 'bone',
  bead: 'glass', circuit: 'abstract', plant: 'organic', abstract_diagram: 'abstract',
};

export default function Page() {
  if (!gateOpen(process.env)) notFound();
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>Procedural 3D — all archetypes (dev preview)</h1>
      <p style={{ opacity: 0.7 }}>Each cell is the real Reconstruction3D component. Nothing here is game content.</p>
      <div id="v3d-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        {ARCHETYPES.map(a => (
          <div key={a} data-archetype={a}>
            <div className="mono" style={{ fontSize: 12 }}>{a}</div>
            <Reconstruction3D itemId={`preview_${a}`} archetype={a} family={FAMILY[a] ?? 'stone'} name={a} />
          </div>
        ))}
      </div>
    </main>
  );
}
