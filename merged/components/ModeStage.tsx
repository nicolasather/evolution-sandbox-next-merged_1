'use client';

import { Plate3D } from './Plate3D';
import { STAGE_ART, type StageMode } from '@/lib/modestage/art';
import { ModeBackdrop } from './ModeBackdrop';

/* ============================================================================
   MODE STAGE — the floating 3D object that opens every extra mode, the same
   wireframe language as the merge plates, set in front of a two-plane backdrop
   of the mode's own world (far plane faint, near plane brighter). Decorative:
   the controls and the guide stay where they were.
   ========================================================================== */

export function ModeStage({ mode, title, caption }: { mode: StageMode; title: string; caption: string }) {
  return (
    <figure className="mode-stage" data-mode-stage={mode}>
      <ModeBackdrop mode={mode} />
      <div className="mode-stage-model">
        <Plate3D node={{ id: `mode-stage:${mode}`, vis: '', cat: '' }} svg={STAGE_ART[mode]} variant="card" label={title} />
      </div>
      <figcaption className="mode-stage-caption">
        <strong>{title}</strong>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
