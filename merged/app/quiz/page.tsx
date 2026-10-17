import Link from 'next/link';

export default function QuizHome() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Quiz Studio</p>
        <h1>Your questions.<br />Everyone’s game.</h1>
        <p className="lead">Write your own quizzes with five kinds of questions, then play solo, run a whole classroom from one projector, or host a live online match with a room code.</p>
        <div className="row">
          <Link className="btn" href="/quiz/new">Create a quiz</Link>
          <Link className="btn ghost" href="/quiz/library">Browse the library</Link>
          <Link className="btn ghost" href="/quiz/join">Join a game</Link>
        </div>
      </section>
      <section className="features">
        <article className="panel"><h3>Five question formats</h3><p className="muted-text">Multiple Choice, Answer Forge, Connection Rush, Truth Hunt and Fill the Table — mix them freely in one quiz.</p></article>
        <article className="panel"><h3>One classroom screen</h3><p className="muted-text">A teacher and a projector. Teams answer together or take turns. No student devices or accounts.</p></article>
        <article className="panel"><h3>Live online play</h3><p className="muted-text">Players join with a six-character code. Everyone gets the same question, or each moves at their own pace.</p></article>
        <article className="panel"><h3>Nine quiz modifiers</h3><p className="muted-text">Wagers, steals, swaps and more — only the ones that fit your chosen way of playing are offered. Points are the only currency.</p></article>
      </section>
    </main>
  );
}
