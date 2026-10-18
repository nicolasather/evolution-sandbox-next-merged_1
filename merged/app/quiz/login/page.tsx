import type { Metadata } from 'next';
import AuthForm from '@/components/quiz/AuthForm';
export const metadata: Metadata = { title: 'Sign In' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith('/quiz') && !sp.next.startsWith('//') ? sp.next : '/quiz/my';
  return <main className="narrow" id="main"><AuthForm next={next} confirmError={sp.error === 'confirm'} /></main>;
}
