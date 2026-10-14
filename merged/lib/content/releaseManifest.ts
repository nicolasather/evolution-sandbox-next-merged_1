import { altRoutesFile } from '@/lib/processing';

/* Ticket 082/083 — client-safe view of the content release this build ships. The hash is written by the
   release compiler (`npm run release:compile`) and re-computed independently by the server and by a test;
   a mismatch makes every Phase 2 request answer "release_mismatch" (the safe direction). */

export const EMPTY_RELEASE_SHA = '0'.repeat(64);   // placeholder only; a compiled build always replaces it

export const releaseHash: string = typeof altRoutesFile.manifestSha256 === 'string' && /^[a-f0-9]{64}$/.test(altRoutesFile.manifestSha256)
  ? altRoutesFile.manifestSha256 : EMPTY_RELEASE_SHA;
export const approvedRouteCount: number = altRoutesFile.routes?.length ?? 0;
