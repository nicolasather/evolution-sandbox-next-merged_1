/** Who may read an uploaded file. Pure and dependency-free so every branch is unit-tested (matrix M01–M06, M13).
 *  The caller supplies lazy lookups; nothing here trusts a storage path just because somebody typed it:
 *    1. the asset must exist and be 'ready' (never 'pending', 'quarantined' or 'deleted');
 *    2. the owner may always read their own file;
 *    3. anybody — signed in or not — may read a file that a PUBLISHED quiz actually references;
 *    4. a room participant (valid player token) or the room's host may read a file that room's immutable question snapshot references.
 *  Everything else is denied. The route turns every denial into the same 404 so private drafts are not revealed. */
export type MediaAssetRow = { owner_id: string; status: string } | null;
export type MediaAccessInput = {
  asset: MediaAssetRow;
  /** Verified user id from Supabase Auth, or null for a visitor with no session. */
  userId: string | null;
  inPublishedQuiz: () => Promise<boolean>;
  /** Present only when the request names a room. `member` = valid player token or the signed-in host of that room. */
  room?: { member: () => Promise<boolean>; inSnapshot: () => Promise<boolean> };
};
export async function canReadMedia(i: MediaAccessInput): Promise<boolean> {
  if (!i.asset || i.asset.status !== 'ready') return false;
  if (i.userId && i.asset.owner_id === i.userId) return true;
  if (await i.inPublishedQuiz()) return true;
  if (i.room && (await i.room.member()) && (await i.room.inSnapshot())) return true;
  return false;
}
