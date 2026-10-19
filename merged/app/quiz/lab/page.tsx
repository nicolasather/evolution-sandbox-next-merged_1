import type { Metadata } from 'next';
import { Suspense } from 'react';
import LabGame from '@/components/quiz/projector/LabGame';
export const metadata: Metadata = { title: 'Practice Lab' };
export default function Lab() { return <Suspense fallback={null}><LabGame /></Suspense>; }
