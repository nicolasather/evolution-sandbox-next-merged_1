'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import QRCode from 'qrcode';
import { LEGAL_FRAMEWORKS } from '@/lib/legalCompliance';
import { isMuted, setMuted } from '@/lib/soundEffects';

/* ── projector high-contrast mode (shared by the Quiz Studio pages through <html data-projector>) ─────────────────────── */
const PKEY = 'evo.quiz.projector';
const listeners = new Set<() => void>();
function readProjector(): boolean { try { return window.localStorage.getItem(PKEY) === '1'; } catch { return false; } }
export function applyProjector(on: boolean) {
  try { window.localStorage.setItem(PKEY, on ? '1' : '0'); } catch { /* storage blocked */ }
  if (on) document.documentElement.setAttribute('data-projector', '1'); else document.documentElement.removeAttribute('data-projector');
  listeners.forEach((l) => l());
}
export function useProjectorMode(): boolean {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, readProjector, () => false);
}
/** Persistent top-nav switch. Re-applies the saved choice after hydration so the attribute is never set during SSR. */
export function ProjectorToggle() {
  const on = useProjectorMode();
  useEffect(() => { if (readProjector()) document.documentElement.setAttribute('data-projector', '1'); }, []);
  useEffect(() => () => { document.documentElement.removeAttribute('data-projector'); }, []);
  return (
    <button type="button" className="rx-proj-btn" aria-pressed={on} onClick={() => applyProjector(!on)} title="WCAG AAA high-contrast layout with larger text for classroom projectors">
      🖥️ Projector High-Contrast Mode{on ? ': ON' : ''}
    </button>
  );
}

/* ── mute ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
export function MuteButton() {
  const [m, setM] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the saved mute flag after mount to keep SSR markup identical
  useEffect(() => { setM(isMuted()); }, []);
  return <button type="button" className="rx-mute" aria-pressed={m} aria-label={m ? 'Unmute sound effects' : 'Mute sound effects'} onClick={() => { setMuted(!m); setM(!m); }}>{m ? '🔇' : '🔊'}</button>;
}

/* ── kinetic slot-machine odometer ────────────────────────────────────────────────────────────────────────────────── */
export function Odometer({ value }: { value: number }) {
  const digits = String(Math.max(0, Math.round(value))).padStart(5, '0').split('');
  return (
    <span className="rx-odo" role="text" aria-label={`Score ${value}`}>
      {digits.map((d, i) => (
        <span className="rx-odo-col" key={i} aria-hidden="true">
          <span className="rx-odo-strip" style={{ transform: `translateY(-${Number(d)}em)` }}>{'0123456789'.split('').map((n) => <span key={n}>{n}</span>)}</span>
        </span>
      ))}
    </span>
  );
}

/* ── full-screen SVG QR modal ─────────────────────────────────────────────────────────────────────────────────────── */
export function QrModal({ url, code, onClose }: { url: string; code: string; onClose: () => void }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }).then((s) => { if (live) setSvg(s); }).catch(() => { if (live) setSvg(''); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { live = false; window.removeEventListener('keydown', onKey); };
  }, [url, onClose]);
  return (
    <div className="rx-qr-modal" role="dialog" aria-modal="true" aria-label="Join QR code" onClick={onClose}>
      <div className="rx-qr-card" onClick={(e) => e.stopPropagation()}>
        <div className="rx-qr-code" dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} aria-label={`QR code that opens ${url}`} />
        <p className="rx-qr-room">ROOM: {code}</p>
        <p className="rx-qr-url">{url}</p>
        <button type="button" className="rx-btn" onClick={onClose} autoFocus>Close (Esc)</button>
      </div>
    </div>
  );
}

/* ── legal & privacy ──────────────────────────────────────────────────────────────────────────────────────────────── */
export function LegalPanel() {
  return (
    <details className="rx-legal">
      <summary>⚖️ Legal &amp; Privacy Compliance</summary>
      <p className="rx-legal-note">Players are given generated science nicknames by default. No email, phone number or real name is collected. A real name appears on the public board only if the player ticks the consent box. Engineering controls below; this is not legal advice.</p>
      <ul>
        {LEGAL_FRAMEWORKS.map((f) => (
          <li key={f.id}>
            <strong>{f.law}</strong> <span className="rx-legal-cite">({f.cite}; {f.articles})</span>
            <div>{f.duty}</div>
            <div className="rx-legal-ctl">Control: {f.control}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}
