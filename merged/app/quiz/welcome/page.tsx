import type { Metadata } from 'next';
import Link from 'next/link';
import OnboardingWizard from '@/components/quiz/onboarding/OnboardingWizard';
export const metadata: Metadata = { title: 'Teaching profile' };

export default function Welcome() {
  return (
    <main id="main" className="page">
      <nav aria-label="Breadcrumb" className="note"><Link href="/quiz">Quiz Studio</Link> › Teaching profile</nav>
      <header className="page-header"><div><p className="eyebrow">Optional · about two minutes</p><h1>Set up Quiz Studio for your classes</h1>
        <p className="muted-text" style={{ maxWidth: '62ch' }}>Tell us what and who you teach and the library will suggest matching quizzes. Every step can be skipped, nothing needs an email, and your answers stay in this browser until you choose otherwise.</p></div></header>
      <OnboardingWizard />
    </main>
  );
}
