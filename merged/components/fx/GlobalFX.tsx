'use client';

import { Cursor } from './Cursor';

/** Mounted once at the root layout — the one piece of the reactive-fx system
 *  that belongs on every page, game and static alike. */
export function GlobalFX() {
  return <Cursor />;
}
