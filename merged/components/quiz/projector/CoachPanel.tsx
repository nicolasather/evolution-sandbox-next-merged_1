import type { Core } from '@/lib/quiz/projector/types';
import { coaching } from '@/lib/quiz/projector/coach';
export default function CoachPanel({ core, g }: { core: Core; g?: unknown }) {
  const note = coaching(core, g);
  return <section className="pj-panel pj-coach" aria-label="Gameplay guidance" aria-live="polite"><p className="eyebrow">{note.heading}</p><p>{note.message}</p><strong>{note.action}</strong></section>;
}
