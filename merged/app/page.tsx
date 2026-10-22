import type { Metadata } from 'next';
import Link from 'next/link';
import './_chooser.css';

export const metadata: Metadata = {
  title: 'Choose where to go',
  alternates: { canonical: '/' },
};

export default function Chooser() {
  return (
    <main className="choose">
      <div>
        <h1>What would you like to do?</h1>
        <p className="lead">Two separate experiences live on this site. Pick one — you can always come back.</p>
      </div>
      <div className="choose-grid">
        <Link href="/sandbox" className="choose-card">
          <h2>Evolution Sandbox</h2>
          <small>Combine four raw materials into 1,917 discoveries, each with its evidence.</small>
          <span className="cta">Enter Evolution Sandbox →</span>
        </Link>
        <Link href="/quiz" className="choose-card">
          <h2>Quiz Studio</h2>
          <small>Create quizzes and play them solo, on a classroom projector, or online with a room code.</small>
          <span className="cta">Enter the Quiz →</span>
        </Link>
        <Link href="/quiz/rank" className="choose-card" style={{ borderColor: '#eab308', background: 'linear-gradient(135deg,#fffde7,#fff3b0)' }} aria-label="Lihat peringkat pengguna">
          <h2>👑 Rank Board</h2>
          <small>Lihat peringkat pengguna — XP, skor, beruntun, dan nilai komposit.</small>
          <span className="cta" style={{ background: '#eab308', color: '#422006', fontWeight: 700 }}>Lihat Rank →</span>
        </Link>
      </div>
    </main>
  );
}
