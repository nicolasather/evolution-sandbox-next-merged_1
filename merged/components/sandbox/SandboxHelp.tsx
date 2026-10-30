'use client';

import { useEffect, useRef } from 'react';
import { SandboxIcon } from './SandboxIcons';
import { TechniqueIcon } from '../TechniqueIcon';

/* The Help panel: the basics, written once, opened whenever the player asks.
   It names the controls and the parts of the Sandbox; it never lists recipes. */
export function SandboxHelp({ open, onClose, onReplayGuide }: {
  open: boolean;
  onClose: () => void;
  onReplayGuide: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  if (!open) return null;

  return (
    <div className="sx-help-scrim" onClick={onClose}>
      <section className="sx-help" role="dialog" aria-modal="true" aria-labelledby="sx-help-title"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
        <header className="sx-help-head">
          <h2 id="sx-help-title" className="mono">Help</h2>
          <button ref={closeRef} type="button" className="chip" onClick={onClose}>Close</button>
        </header>

        <div className="sx-help-body">
          <h3 className="mono">Controls</h3>
          <ul>
            <li>Tap an item in the inventory to pick it up. Tap a second one to combine the pair.</li>
            <li>Drag an item onto the bench to put it down where you drop it.</li>
            <li>Press <kbd>i</kbd> on an item, or the <b>i</b> button beside it, to read about it.</li>
          </ul>

          <h3 className="mono">Techniques</h3>
          <p>Pick a technique on the right, then use it on one thing on the bench. Each technique changes a material in its own way.</p>
          <ul className="sx-help-tools">
            <li><TechniqueIcon id="brush" size={16} /> <b>Brush</b>: clean a thing to see what is under it.</li>
            <li><TechniqueIcon id="smash" size={16} /> <b>Smash</b>: break a hard thing into what it is made of.</li>
            <li><TechniqueIcon id="cut" size={16} /> <b>Cut</b>: shape a thing with an edge.</li>
            <li><TechniqueIcon id="separate" size={16} /> <b>Separate</b>: take one thing out of a mixture.</li>
            <li><TechniqueIcon id="dig" size={16} /> <b>Dig</b>: uncover what is buried.</li>
          </ul>

          <h3 className="mono">Combining</h3>
          <p>Two items on the bench can make something new. Most pairs make nothing: that is normal. A hint appears if you are stuck.</p>

          <h3 className="mono">Places</h3>
          <ul className="sx-help-places">
            <li><SandboxIcon id="workspace" size={16} /> <b>Workspace</b>: where you experiment.</li>
            <li><SandboxIcon id="graph" size={16} /> <b>Graph</b>: how your discoveries connect.</li>
            <li><SandboxIcon id="archive" size={16} /> <b>Archive</b>: every discovery you have made, searchable.</li>
            <li><SandboxIcon id="timeline" size={16} /> <b>Timeline</b>: your discoveries in the order of history.</li>
          </ul>

          <div className="sx-help-foot">
            <button type="button" className="chip" onClick={() => { onClose(); onReplayGuide(); }}>
              <SandboxIcon id="replay" size={14} /> Replay the introduction
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
