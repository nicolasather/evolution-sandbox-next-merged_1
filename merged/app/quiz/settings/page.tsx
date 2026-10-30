import type { Metadata } from 'next';
import Link from 'next/link';
import MotionSettings from '@/components/quiz/MotionSettings';

export const metadata: Metadata = { title: 'Settings' };

export default function QuizSettings() {
  return (
    <main className="qz-main" id="main">
      <nav className="qz-crumbs" aria-label="Breadcrumb"><Link href="/quiz">Quiz Studio</Link> / <span>Settings</span></nav>
      <h1>Settings</h1>
      <MotionSettings />
    </main>
  );
}
