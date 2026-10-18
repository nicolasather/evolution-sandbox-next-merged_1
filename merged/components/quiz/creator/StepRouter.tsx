'use client';
import type { CreatorStep } from '@/lib/quiz/creator-steps';
import ModeStep from './steps/ModeStep';
import DetailsStep from './steps/DetailsStep';
import QuestionsStep from './steps/QuestionsStep';
import RulesStep from './steps/RulesStep';
import AppearanceStep from './steps/AppearanceStep';
import PreviewStep from './steps/PreviewStep';
import PublishStep from './steps/PublishStep';

export default function StepRouter({ step }: { step: CreatorStep }) {
  switch (step) {
    case 'mode': return <ModeStep />;
    case 'details': return <DetailsStep />;
    case 'questions': return <QuestionsStep />;
    case 'rules': return <RulesStep />;
    case 'appearance': return <AppearanceStep />;
    case 'preview': return <PreviewStep />;
    case 'publish': return <PublishStep />;
  }
}
