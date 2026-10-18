'use client';
import { kindLabels, QUESTION_KINDS, type QuestionKind } from '@/lib/quiz/types';

const EXAMPLES: Record<QuestionKind, { what: string; example: string }> = {
  multiple_choice: { what: 'Pick the one correct option.', example: 'Which planet has rings? — Mars · Saturn · Venus' },
  answer_forge: { what: 'Type the answer. Accept several spellings, or a number within a range.', example: 'Capital of France? — Paris' },
  connection_rush: { what: 'Match each item on the left to one on the right.', example: 'Dog → Bark · Cat → Meow' },
  truth_hunt: { what: 'Mark each statement true or false.', example: '“Water boils at 100°C at sea level.” — True' },
  fill_table: { what: 'Complete the blank cells of a table.', example: 'Country | Capital — France | ＿＿＿' },
};

/** Big, readable format choices with a one-line example each, so nobody has to know the names in advance. */
export default function FormatPicker({ onPick, onCancel }: { onPick: (k: QuestionKind) => void; onCancel?: () => void }) {
  return (
    <section className="panel stack cr-formats" aria-labelledby="fmt-h">
      <div className="row spread"><h2 id="fmt-h" style={{ margin: 0 }}>Choose a question format</h2>{onCancel && <button className="btn small ghost" onClick={onCancel}>Cancel</button>}</div>
      <div className="cr-format-grid">
        {QUESTION_KINDS.map((k) => (
          <button key={k} className="choice" onClick={() => onPick(k)}>
            <strong>{kindLabels[k]}</strong>
            <small>{EXAMPLES[k].what}</small>
            <small className="cr-example">{EXAMPLES[k].example}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
