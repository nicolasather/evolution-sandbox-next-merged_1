import type { Metadata } from 'next';
import SwarmLab from '@/components/quiz/swarm/SwarmLab';
import '../swarm.css';
export const metadata: Metadata = { title: 'Practice Swarm Survival' };
export default function Page() { return <SwarmLab />; }
