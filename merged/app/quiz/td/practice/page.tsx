import type { Metadata } from 'next';
import TDPractice from '@/components/quiz/td/TDPractice';
import '../td.css';
export const metadata: Metadata = { title: 'Tower Defense practice' };
export default function Page() { return <TDPractice />; }
