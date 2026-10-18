import Image from 'next/image';
import Link from 'next/link';
import { ALL_GAME_MODES, GAME_MODES } from '@/lib/quiz/game-modes';

/** The four game modes. Solo / Classroom / Online are ways to play any of them and are chosen later. */
export default function ModeCards({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <div className="qz-modes qz-modes4">
      {ALL_GAME_MODES.map((id, i) => {
        const info = GAME_MODES[id];
        return (
          <article key={id} className="qz-mode" style={{ ['--accent' as string]: info.accent }}>
            <div className="art"><Image src={info.art} alt="" width={1200} height={675} unoptimized priority={i === 0} /></div>
            <div className="body">
              <H>{info.title}</H>
              <p style={{ margin: 0 }}>{info.summary}</p>
              <ul className="facts">{info.facts.map((f) => <li key={f}>{f}</li>)}</ul>
              <div className="row">
                <Link className="btn" href={`/quiz/library?game=${id}`} aria-label={`Browse ${info.title} quizzes`}>Browse quizzes</Link>
                <Link className="btn ghost" href="/quiz/create/mode" aria-label={`Create a ${info.title} quiz`}>Create one</Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
