import Image from 'next/image';
import Link from 'next/link';
import ModeCards from '@/components/quiz/ModeCards';
import { MODE_LIST } from '@/lib/quiz/projector/modes';
import OnboardingPrompt from '@/components/quiz/onboarding/OnboardingPrompt';

export default function QuizHome() {
  return (
    <main id="main">
      <section className="qz-hero" aria-labelledby="home-h">
        <div className="qz-hero-art"><Image src="/quiz/art/hero-arena.svg" alt="" width={1600} height={900} unoptimized priority /></div>
        <div className="qz-hero-inner">
          <h1 id="home-h">Quiz Studio</h1>
          <p className="lead">Write quizzes in five question formats. Play them solo, on a classroom projector, or online with a room code.</p>
          <div className="row">
            <Link className="btn" href="/quiz/new">Create a Quiz</Link>
            <Link className="btn cyan" href="/quiz/join">Join a Game</Link>
            <Link className="btn yellow" href="/quiz/rank">Rank Board</Link>
            <Link className="textlink" href="/quiz/library">Quiz Library</Link>
          </div>
        </div>
      </section>

      <OnboardingPrompt />

      <section className="qz-section" aria-labelledby="pjhome-h" id="projector-games">
        <header>
          <h2 id="pjhome-h">Projector Games</h2>
          <p className="muted-text" style={{ margin: 0 }}>Ten classroom game worlds for one teacher computer and a projector. No student devices needed. <Link className="textlink" href="/quiz/modes">See all ten</Link> · <Link className="textlink" href="/quiz/lab">Practice lab</Link></p>
        </header>
        <div className="pj-games">
          {MODE_LIST.map((m) => (
            <Link key={m.key} className="pj-game" style={{ ['--accent' as string]: m.accent }} href={`/quiz/lab?game=${m.key}`}>
              <Image src={`/quiz/modes/${m.art}.svg`} alt="" width={1200} height={675} unoptimized />
              <span className="body"><span className="tag">{m.style.en}</span><h3>{m.name.en}</h3><p>{m.objective.en}</p></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="qz-section" aria-labelledby="modes-h">
        <header>
          <h2 id="modes-h">Game Modes</h2>
          <p className="muted-text" style={{ margin: 0 }}>Every play method runs the Classic Quiz game mode. For the classroom projector, see the ten Projector Games above or <Link className="textlink" href="/quiz/modes">browse every mode</Link>.</p>
        </header>
        <ModeCards />
      </section>

      <section className="qz-section" aria-label="Quick links" style={{ paddingBottom: 56 }}>
        <div className="qz-howto">
          <Link href="/quiz/new"><strong>Create a Quiz</strong><p className="muted-text">Open the editor now. No email or sign-in needed.</p></Link>
          <Link href="/quiz/my"><strong>My Quizzes</strong><p className="muted-text">Drafts and published quizzes, including those saved on this device.</p></Link>
          <Link href="/quiz/welcome"><strong>Teaching Profile</strong><p className="muted-text">Choose subjects, exact grades and curriculum so the library suggests the right quizzes.</p></Link>
          <Link href="/quiz/rewards"><strong>Coins &amp; Rewards</strong><p className="muted-text">How Points, Coins and cosmetics work, and what is fair.</p></Link>
          <Link href="/quiz/library"><strong>Quiz Library</strong><p className="muted-text">Search quizzes other people have published.</p></Link>
        </div>
      </section>
    </main>
  );
}
