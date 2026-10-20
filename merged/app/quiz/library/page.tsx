import type { Metadata } from 'next';
import '../td/td.css';
import QuizList from '@/components/quiz/QuizList';
import { isGameKey } from '@/lib/quiz/projector/modes';
import type { PlayMode } from '@/lib/quiz/types';
export const metadata: Metadata = { title: 'Quiz Library' };

export default async function Library({ searchParams }: { searchParams: Promise<{ mode?: string; game?: string }> }) {
  const { mode, game } = await searchParams;
  const m = mode === 'solo' || mode === 'classroom' || mode === 'online' ? (mode as PlayMode) : null;
  const g = m === 'classroom' && isGameKey(game) ? game : null; // a projector game was chosen on /quiz/modes
  const td = m === 'online' && game === 'tower_defense'; // Tower Defense was chosen on /quiz/modes
  return <QuizList mine={false} mode={m} game={g} towerDefense={td} />;
}
