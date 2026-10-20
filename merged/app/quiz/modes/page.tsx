import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ALL_MODES, modeInfo } from '@/lib/quiz/mode-info';
import { MODE_LIST } from '@/lib/quiz/projector/modes';
import TutorialOverlay from '@/components/quiz/projector/TutorialOverlay';
import Poster from '@/components/quiz/td/Poster';
import '../td/td.css';
export const metadata: Metadata = { title: 'Game Modes' };

export default function ModesPage() {
  return (
    <main className="page" id="main">
      <header className="page-header">
        <div><p className="eyebrow">Quiz Studio</p><h1>Game Modes</h1>
          <p className="muted-text" style={{ maxWidth: '60ch' }}>Start with the ten Projector Games for a whole classroom, or scroll down for the classic modes. Only the modifiers that work with your choice are offered afterwards, and points are the only currency.</p></div>
        <Link className="btn ghost" href="/quiz/library">Quiz Library</Link>
      </header>
      <section className="td-modecard" style={{ marginBottom: 44 }} aria-labelledby="td-h" id="tower-defense">
        <div className="td-modebody">
          <Poster mapId="meadow_circuit" ribbon="Online · own devices" />
          <div className="stack" style={{ gap: 10 }}>
            <h2 id="td-h" className="td-sign" style={{ justifySelf: 'start' }}>Tower Defense</h2>
            <p style={{ maxWidth: '60ch' }}>Each student plays on their own device in a squad of 1 to 5. Correct answers earn points; squads spend them on towers between waves and defend their core. Co-op for one class squad, or 2–4 competitive squads on identical maps (up to 20 students).</p>
            <ul>
              <li>Questions together before each build, or at each student’s own pace while towers defend.</li>
              <li>Six towers with upgrade branches, five roles, eight enemy types and a boss on every map.</li>
              <li>The teacher console pauses, extends and approves; the projector shows every squad’s board.</li>
            </ul>
            <div className="td-row wrap" style={{ marginTop: 6 }}>
              <Link className="td-btn primary" href="/quiz/library?mode=online&game=tower_defense">Pick a quiz</Link>
              <Link className="td-btn" href="/quiz/td/practice">Practice alone</Link>
              <Link className="td-btn ghost" href="/quiz/td">How to play</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="stack" style={{ gap: 18, marginBottom: 44 }} aria-labelledby="pj-h" id="projector-games">
        <header><p className="eyebrow">Classroom projector</p><h2 id="pj-h" style={{ fontStyle: 'italic' }}>Projector Games · {MODE_LIST.length} game worlds</h2>
          <p className="muted-text" style={{ maxWidth: '62ch' }}>Ten full game worlds for one teacher computer and a projector. Teams answer aloud, the teacher marks them, and no student devices or accounts are needed. From 5 to 180 minutes, or no clock at all.</p>
          <p><Link className="textlink" href="/quiz/lab">Try any of them now with sample questions →</Link></p></header>
        <div className="pj-games">
          {MODE_LIST.map((m) => (
            <div key={m.key} className="pj-game" style={{ ['--accent' as string]: m.accent }}>
              <Link className="pj-gamelink" href={`/quiz/library?mode=classroom&game=${m.key}`}>
                <Image src={`/quiz/modes/${m.art}.svg`} alt="" width={1200} height={675} unoptimized />
                <span className="body"><span className="tag">{m.style.en}</span><h3>{m.name.en}</h3><p>{m.tagline.en}</p><p className="muted-text">{m.skillRule.en}</p></span>
              </Link>
              <div className="pj-gamefoot">
                <Link className="btn small primary" href={`/quiz/library?mode=classroom&game=${m.key}`}>Pick a quiz</Link>
                <Link className="btn small ghost" href={`/quiz/lab?game=${m.key}`}>Practice lab</Link>
                <TutorialOverlay game={m.key} name={m.name.en} auto={false} />
              </div>
            </div>
          ))}
        </div>
      </section>
      <header style={{ marginBottom: 14 }}><p className="eyebrow">Classic Quiz</p><h2 style={{ fontStyle: 'italic' }}>Classic modes</h2></header>
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
