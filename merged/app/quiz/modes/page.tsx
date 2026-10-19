import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ALL_MODES, modeInfo } from '@/lib/quiz/mode-info';
export const metadata: Metadata = { title: 'Game Modes' };

export default function ModesPage() {
  return (
    <main className="page" id="main">
      <header className="page-header">
        <div><p className="eyebrow">Classic Quiz</p><h1>Game Modes</h1>
          <p className="muted-text" style={{ maxWidth: '60ch' }}>Classic Quiz is the game mode. Choose how it is played, then pick a quiz. Only the modifiers that work with your choice are offered afterwards, and points are the only currency.</p></div>
        <Link className="btn ghost" href="/quiz/library">Quiz Library</Link>
      </header>
      <div className="stack" style={{ gap: 30 }}>
        {ALL_MODES.map((m, i) => {
          const info = modeInfo(m);
          return (
            <article key={m} className={`qz-mode wide${i % 2 ? ' flip' : ''}`} style={{ ['--accent' as string]: info.accent }}>
              <div className="art"><Image src={info.art} alt="" width={1200} height={675} unoptimized /></div>
              <div className="body">
                <h2 style={{ fontStyle: 'italic', margin: 0 }}>{info.title}</h2>
                <p>{info.summary}</p>
                <ul className="facts">{info.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                {info.flows.map((f) => (
                  <details key={f.flow}>
                    <summary><strong>{f.label.split(' — ')[0]}</strong> — {f.modifiers.length} modifier{f.modifiers.length === 1 ? '' : 's'} available</summary>
                    <p className="note" style={{ marginTop: 6 }}>{f.label.split(' — ')[1]}. Modifiers: {f.modifiers.join(', ') || 'none'}.</p>
                  </details>
                ))}
                <Link className="btn" href={`/quiz/library?mode=${m}`}>Select Mode</Link>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
