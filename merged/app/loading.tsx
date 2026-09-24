/** The first frame while the game loads: an archaeological line, not a spinner. */
export default function Loading() {
  return (
    <div className="state-screen" role="status" aria-live="polite">
      <i className="state-ring" aria-hidden="true" />
      <p className="state-k mono">Recovering timeline…</p>
    </div>
  );
}
