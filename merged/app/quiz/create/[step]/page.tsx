import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StepRouter from '@/components/quiz/creator/StepRouter';
import { CREATOR_STEPS, isCreatorStep } from '@/lib/quiz/creator-steps';

export async function generateMetadata({ params }: { params: Promise<{ step: string }> }): Promise<Metadata> {
  const { step } = await params;
  const info = CREATOR_STEPS.find((s) => s.slug === step);
  return { title: info ? `Create Quiz · ${info.title}` : 'Create Quiz' };
}
export function generateStaticParams() { return CREATOR_STEPS.map((s) => ({ step: s.slug })); }

export default async function CreateStep({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!isCreatorStep(step)) notFound();
  return <StepRouter step={step} />;
}
