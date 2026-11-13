'use client';
import { CHARACTERS } from '@/lib/characters/registry';
import type { CharacterId } from '@/lib/characters/types';

/** One quiet line while a creature arrives. role="status" so it is announced once, politely. */
export function CharacterUnlockCeremony({ id }: { id: CharacterId }) {
  const c = CHARACTERS[id];
  return <div className="crew-ceremony" role="status">{c.name} joins the crew</div>;
}
