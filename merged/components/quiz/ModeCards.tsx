import Image from 'next/image';
import Link from 'next/link';
import { ALL_MODES, modeInfo } from '@/lib/quiz/mode-info';

/** The three real ways to play Classic Quiz, each with its own scene. "Select Mode" goes to the library to pick a quiz for that mode. */
export default function ModeCards({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <div className="qz-modes">
      {ALL_MODES.map((m, i) => {
        const info = modeInfo(m);
        return (
          <article key={m} className={`qz-mode${i === 0 ? ' big' : ''}`} style={{ ['--accent' as string]: info.accent }}>
            <div className="art"><Image src={info.art} alt="" width={1200} height={675} unoptimized priority={i === 0} /></div>
            <div className="body">
              <H>{info.title}</H>
              <p style={{ margin: 0 }}>{info.summary}</p>
              <ul className="facts">{info.facts.map((f) => <li key={f}>{f}</li>)}<li>{info.flows.length === 1 ? '1 question flow' : `${info.flows.length} question flows`}</li></ul>
              <Link className="btn" href={`/quiz/library?mode=${m}`} aria-label={`Select Mode: ${info.title}`}>Select Mode</Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
