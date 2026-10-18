import { Suspense, type ReactNode } from 'react';
import './creator.css';
import CreatorProvider from '@/components/quiz/creator/CreatorProvider';
import { quizConfigured } from '@/lib/quiz/config';

/** One provider for all seven routed steps: the draft is identified by `?draft=` in the URL, so each step survives a refresh. */
export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<main className="page"><p className="muted-text" role="status">Opening the creator…</p></main>}>
      <CreatorProvider cloudConfigured={quizConfigured()}>{children}</CreatorProvider>
    </Suspense>
  );
}
