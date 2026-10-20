import type { Metadata } from 'next';
import ArenaPractice from '@/components/quiz/arena/ArenaPractice';
import '../arena.css';
export const metadata: Metadata = { title: 'Practice Arena Clash' };
export default function Page() { return <ArenaPractice />; }
