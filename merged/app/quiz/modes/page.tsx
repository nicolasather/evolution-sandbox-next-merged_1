import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ALL_GAME_MODES, gameModeDetail } from '@/lib/quiz/game-modes';
import { modeLabels } from '@/lib/quiz/types';
export const metadata: Metadata = { title: 'Game Modes' };

export default function ModesPage() {
  return (
    <main className="page" id="main">
      <header className="page-header">
        <div><p className="eyebrow">Four ways to play</p><h1>Game Modes</h1>
          <p className="muted-text" style={{ maxWidth: '62ch' }}>A game mode changes what answers do. Solo, Classroom and Online are only ways to play: you choose one of them after you choose the mode.</p></div>
        <Link className="btn ghost" href="/quiz/library">Quiz Library</Link>
      </header>
      <div className="stack" style={{ gap: 30 }}>
        {ALL_GAME_MODES.map((id, i) => {
          const d = gameModeDetail(id);
          return (
            <article key={id} className={`qz-mode wide${i % 2 ? ' flip' : ''}`} style={{ ['--accent' as string]: d.accent }}>
              <div className="art"><Image src={d.art} alt="" width={1200} height={675} unoptimized priority={i === 0} /></div>
              <div className="body">
                <h2 style={{ fontStyle: 'italic', margin: 0 }}>{d.title}</h2>
                <p>{d.summary}</p>
                <ol className="cr-loop">{d.loop.map((l) => <li key={l}>{l}</li>)}</ol>
                <p className="note"><strong>Wrong answer:</strong> {d.onWrong} <strong>Ends:</strong> {d.ends}</p>
                <ul className="facts">{d.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                {d.methods.map((m) => (
                  <details key={m.method}>
                    <summary><strong>{modeLabels[m.method]}</strong></summary>
                    <ul className="note">{m.flows.map((f) => <li key={f.flow}>{f.label.split(' — ')[0]}: {f.modifiers.length} modifier{f.modifiers.length === 1 ? '' : 's'} available</li>)}</ul>
                  </details>
                ))}
                <div className="row">
                  <Link className="btn" href={`/quiz/library?game=${id}`}>Browse quizzes</Link>
                  <Link className="btn ghost" href="/quiz/create/mode">Create a quiz</Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
