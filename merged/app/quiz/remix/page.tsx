import type { Metadata } from 'next';
import RemixGame from '@/components/quiz/remix/RemixGame';

export const metadata: Metadata = {
  title: 'Sandbox Remix Quiz',
  description: 'Auto-generated quizzes from the Evolution Sandbox discovery database with confidence wagers, streak shields and a redemption round.',
};

export default function RemixPage() {
  return <main id="main"><RemixGame /></main>;
}
