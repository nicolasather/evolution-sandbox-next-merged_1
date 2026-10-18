import Image from 'next/image';
import Link from 'next/link';
import ModeCards from '@/components/quiz/ModeCards';

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
            <Link className="textlink" href="/quiz/library">Quiz Library</Link>
          </div>
        </div>
      </section>

      <section className="qz-section" aria-labelledby="modes-h">
        <header>
          <h2 id="modes-h">Game Modes</h2>
          <p className="muted-text" style={{ margin: 0 }}>Every play method runs the Classic Quiz game mode.</p>
        </header>
        <ModeCards />
      </section>

      <section className="qz-section" aria-label="Quick links" style={{ paddingBottom: 56 }}>
        <div className="qz-howto">
          <Link href="/quiz/new"><strong>Create a Quiz</strong><p className="muted-text">Open the editor now. No email or sign-in needed.</p></Link>
          <Link href="/quiz/my"><strong>My Quizzes</strong><p className="muted-text">Drafts and published quizzes, including those saved on this device.</p></Link>
          <Link href="/quiz/library"><strong>Quiz Library</strong><p className="muted-text">Search quizzes other people have published.</p></Link>
        </div>
      </section>
    </main>
  );
}
