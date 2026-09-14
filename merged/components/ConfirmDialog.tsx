'use client';

import { useEffect, useRef } from 'react';

/**
 * An in-page confirmation. `window.confirm()` is silently blocked in sandboxed
 * frames — embeds, previews, the Artifact host — which left "Start over" dead
 * there; this works everywhere and matches the rest of the interface.
 *
 * While open it owns the keyboard: focus starts on the safe choice, Tab cycles
 * the two buttons, Escape cancels, and focus returns to whatever opened it.
 * Styled by the shared design system (`.confirm*`), same as the single-file build.
 */
export function ConfirmDialog({
  open, title, body, cancelLabel, confirmLabel, onCancel, onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const noRef = useRef<HTMLButtonElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => { cancelRef.current = onCancel; });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    noRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault(); ev.stopPropagation();
        cancelRef.current();
      } else if (ev.key === 'Tab') {
        const btns = [noRef.current, yesRef.current].filter((b): b is HTMLButtonElement => !!b);
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        ev.preventDefault();
        btns[(i + (ev.shiftKey ? -1 : 1) + btns.length) % btns.length]?.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  return (
    <div
      id="confirm"
      className="confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-t"
      aria-describedby="confirm-d"
      hidden={!open}
      onClick={ev => { if (ev.target === ev.currentTarget) onCancel(); }}
    >
      <div className="confirm-box">
        <p className="mono confirm-k" id="confirm-t">{title}</p>
        <p className="confirm-d" id="confirm-d">{body}</p>
        <div className="confirm-row">
          <button ref={noRef} type="button" className="chip" id="confirm-no" onClick={onCancel}>{cancelLabel}</button>
          <button ref={yesRef} type="button" className="chip danger" id="confirm-yes" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
