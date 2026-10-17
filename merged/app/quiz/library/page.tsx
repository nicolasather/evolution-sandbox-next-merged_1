import type { Metadata } from 'next';
import QuizList from '@/components/quiz/QuizList';
export const metadata: Metadata = { title: 'Library' };
export default function Library() { return <QuizList mine={false} />; }
