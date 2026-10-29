'use client';
import Image from 'next/image';
import Link from 'next/link';
import type { PointerEvent } from 'react';
import { ALL_MODES, modeInfo } from '@/lib/quiz/mode-info';
import { useQuizMotion } from './useQuizMotion';

/** The three real ways to play Classic Quiz, each with its own scene. Cursor tilt and a specular highlight follow the pointer unless motion is reduced. */
export default function ModeCards({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  const { reduced } = useQuizMotion();

  function tilt(e: PointerEvent<HTMLElement>) {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const el = e.currentTarget;
    el.style.setProperty('--rx', `${(0.5 - py) * 12}deg`); // at most ±6deg
    el.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  }
  function untilt(e: PointerEvent<HTMLElement>) {
    e.currentTarget.style.setProperty('--rx', '0deg');
    e.currentTarget.style.setProperty('--ry', '0deg');
  }

  return (
    <div className="qz-modes">
      {ALL_MODES.map((m, i) => {
        const info = modeInfo(m);
        return (
          <article
            key={m}
            className={`qz-mode qz-mode-enter${i === 0 ? ' big' : ''}`}
            style={{ ['--accent' as string]: info.accent, animationDelay: `${i * 60}ms` }}
            onPointerMove={tilt}
            onPointerLeave={untilt}
          >
            <div className="art"><Image src={info.art} alt="" width={1200} height={675} unoptimized priority={i === 0} /></div>
            <div className="body">
              <H>{info.title}</H>
              <p style={{ margin: 0 }}>{info.summary}</p>
              <ul className="qz-pills" aria-label="What this mode includes">
                {info.facts.map((f) => <li key={f}>{f}</li>)}
                <li>{info.flows.length === 1 ? '1 question flow' : `${info.flows.length} question flows`}</li>
              </ul>
              <Link className="btn" href={`/quiz/library?mode=${m}`} aria-label={`Select Mode: ${info.title}`}>Select Mode</Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
