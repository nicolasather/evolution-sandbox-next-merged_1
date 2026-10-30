'use client';

import { useEffect, useRef, useState } from 'react';
import { EMOTES, SandboxIcon, type SandboxIconId } from './SandboxIcons';
import { cn } from '@/lib/utils';

/* A compact row of five expressions. It opens from one small button, speaks one short line
   when chosen, and folds away again: it never sits on the workspace. */
const BUBBLE_MS = 1800;

export function EmoteTray() {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<{ key: number; line: string; icon: SandboxIconId } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pick = (e: (typeof EMOTES)[number]) => {
    setOpen(false);
    setSaid({ key: Date.now(), line: e.line, icon: e.id });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaid(null), BUBBLE_MS);
  };

  return (
    <div className="sx-emote" data-open={open ? 'true' : 'false'}>
      {said && (
        <p key={said.key} className="sx-emote-said" role="status">
          <SandboxIcon id={said.icon} size={16} /> {said.line}
        </p>
      )}
      {open && (
        <div className="sx-emote-pop" role="group" aria-label="Expressions">
          {EMOTES.map(e => (
            <button key={e.id} type="button" className={cn('sx-emote-btn')} onClick={() => pick(e)}
              aria-label={e.label} title={e.label}>
              <SandboxIcon id={e.id} size={20} />
              <span className="sx-emote-name mono">{e.label}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className="sx-emote-toggle chip" aria-expanded={open}
        onClick={() => setOpen(o => !o)} title="Show how you feel">
        <SandboxIcon id="curious" size={16} /> <span className="sr">Expressions</span>
      </button>
    </div>
  );
}
