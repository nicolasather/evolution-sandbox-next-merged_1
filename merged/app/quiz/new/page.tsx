import { redirect } from 'next/navigation';

/** The old single-page editor is replaced by seven routed steps. Starting here still needs no account. */
export default function NewQuiz() { redirect('/quiz/create/mode'); }
