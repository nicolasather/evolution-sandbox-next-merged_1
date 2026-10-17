import type { Metadata } from 'next';
import Link from 'next/link';
import UpgradeForm from '@/components/quiz/UpgradeForm';
import { requireUserOrRedirect } from '@/lib/quiz/guard';
import { isGuest } from '@/lib/quiz/supabase';
export const metadata: Metadata = { title: 'Keep my quizzes' };

export default async function KeepPage() {
  const user = await requireUserOrRedirect('/quiz/keep');
  if (!isGuest(user)) {
    return <main className="narrow"><div className="panel stack"><h1 style={{ fontSize: '2rem' }}>You already have an account</h1><Link className="btn" href="/quiz/my">Go to My Quizzes</Link></div></main>;
  }
  return <main className="narrow"><UpgradeForm /></main>;
}
