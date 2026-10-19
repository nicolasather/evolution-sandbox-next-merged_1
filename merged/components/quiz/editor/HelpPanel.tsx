'use client';
import { useEffect, useRef, useState } from 'react';

export const HELP_TOPICS: { id: string; title: string; body: string }[] = [
  { id: 'start', title: 'Making your first quiz', body: 'Give it a title, pick a question format, write the question, mark the right answer. Your work saves itself on this device; sign in to keep it online.' },
  { id: 'formats', title: 'The five question formats', body: 'Multiple Choice: pick the right option. Answer Forge: type the answer. Connection Rush: match pairs. Truth Hunt: decide true or false for each statement. Fill the Table: complete the blanks in a table.' },
  { id: 'scoring', title: 'How points work', body: 'Each question has base points. You can also give partial credit for multi-part questions or add a small speed bonus. The Review step shows the most a player can earn.' },
  { id: 'media', title: 'Pictures, audio and video', body: 'Upload a file or paste a YouTube or Vimeo link. Always add a short description so everyone can follow along.' },
  { id: 'import', title: 'Importing questions', body: 'Use a spreadsheet (.csv or .xlsx), a pasted list, or a Quiz Studio backup. You see a preview first and nothing is added until you confirm.' },
  { id: 'publish', title: 'Saving and publishing', body: 'A draft can be unfinished and stays private. Publishing lists the quiz in the library and needs every question to be complete.' },
  { id: 'keys', title: 'Keyboard shortcuts', body: 'Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z redo, Alt+↑/↓ move the selected question, Ctrl/⌘+S save a draft.' },
];

/** In-context help drawer. Opens from the header, closes with Escape, and returns focus to the button that opened it. */
export default function HelpPanel({ open, onClose, topic }: { open: boolean; onClose: () => void; topic?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="help-h" className="panel stack" style={{ position: 'fixed', right: 12, bottom: 70, width: 'min(380px, calc(100vw - 24px))', maxHeight: '70vh', overflow: 'auto', zIndex: 60 }}>
      <div className="row spread"><h2 id="help-h" style={{ margin: 0, fontSize: '1.6rem' }}>Help</h2><button className="btn small ghost" onClick={onClose}>Close</button></div>
      {HELP_TOPICS.map((t) => (
        <details key={t.id} open={t.id === topic}><summary>{t.title}</summary><p className="note" style={{ marginTop: 8 }}>{t.body}</p></details>
      ))}
      <p className="note"><a href="/quiz/help">Open the full help center</a></p>
    </aside>
  );
}

/** One-time tip that is dismissed forever (per browser) with a single click. */
export function FirstRunTip({ id, children }: { id: string; children: React.ReactNode }) {
  const [hidden, setHidden] = useState(true);
  /* reads browser storage, which only exists after hydration */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { setHidden(localStorage.getItem(`qz:tip:${id}`) === '1'); } catch { setHidden(false); } }, [id]);
  /* eslint-enable react-hooks/set-state-in-effect */
  if (hidden) return null;
  return <div className="info row spread" role="note"><span>{children}</span><button className="btn small ghost" onClick={() => { setHidden(true); try { localStorage.setItem(`qz:tip:${id}`, '1'); } catch { /* ignore */ } }}>Got it</button></div>;
}
