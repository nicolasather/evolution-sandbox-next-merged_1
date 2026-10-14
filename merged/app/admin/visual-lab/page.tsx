import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Gallery } from '@/components/devlab/Gallery';
import { gateFor } from '@/lib/devlab/server';

/* DEVELOPMENT ONLY — Resource Visual Lab gallery. 404 unless the lab gate is open
   (VISUAL_LAB + ENABLE_DEV_TOOLS, not Vercel/production, loopback host). Adds nothing to the game. */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Visual Lab (dev)', robots: { index: false, follow: false } };

export default async function Page() {
  if (!gateFor(await headers()).open) notFound();
  return <Gallery />;
}
