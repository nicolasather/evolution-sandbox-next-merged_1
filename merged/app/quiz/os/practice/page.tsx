import type { Metadata } from 'next';
import OSPractice from '@/components/quiz/os/OSPractice';
import '../os.css';
export const metadata: Metadata = { title: 'Practice Obstacle Survival' };
export default function Page() { return <OSPractice />; }
