import { notFound } from 'next/navigation';
import { playDb } from '@/lib/processing';
import { gateOpen } from '@/lib/server/ownerAuth';
import { RecipeReview } from '@/components/admin/RecipeReview';
import { OnboardPanel } from '@/components/admin/OnboardPanel';

/* Owner-only review page. It does not exist (404) unless the developer gate is open,
   and never on production. The API behind it additionally needs the owner token. */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owner review', robots: { index: false, follow: false } };

export default function Page() {
  if (!gateOpen(process.env)) notFound();
  // targets: items published by the verified-content pipeline (they carry visualArchetype)
  const targets = playDb.nodes.filter(n => n.visualArchetype).map(n => ({ id: n.id, name: n.n, recipe: (n.rec ?? [])[0] ?? [] }));
  const names: Record<string, string> = {};
  for (const n of playDb.nodes) names[n.id] = n.n;
  return <><RecipeReview targets={targets} names={names} /><OnboardPanel /></>;
}
