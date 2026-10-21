import type { Metadata } from 'next';
import CRPractice from '@/components/quiz/cr/CRPractice';
import '../cr.css';
export const metadata: Metadata = { title: 'Practice Clue Racing' };
export default function Page() { return <CRPractice />; }
