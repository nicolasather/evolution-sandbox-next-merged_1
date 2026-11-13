import { BACKDROP_ART, type StageMode } from '@/lib/modestage/art';

/* ============================================================================
   MODE BACKDROP — a mode's own world as two depth planes (far: faint, near:
   heavier). Used as the surface of the stage and behind each play board. It is
   a pure decoration: aria-hidden, never receives pointer events, and sits under
   the content (see app/_modestage.css). Trusted constants only.
   ========================================================================== */

export function ModeBackdrop({ mode, className = '' }: { mode: StageMode; className?: string }) {
  const planes = BACKDROP_ART[mode];
  return (
    <svg className={`mode-backdrop ${className}`.trim()} data-backdrop={mode} viewBox="0 0 400 140" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <g className="mode-backdrop-far" dangerouslySetInnerHTML={{ __html: planes.far }} />
      <g className="mode-backdrop-near" dangerouslySetInnerHTML={{ __html: planes.near }} />
    </svg>
  );
}
