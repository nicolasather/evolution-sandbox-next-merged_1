import type { Metadata } from 'next';
import Collection from '@/components/quiz/Collection';
export const metadata: Metadata = { title: 'My collection' };
export default function Page() { return <Collection />; }
