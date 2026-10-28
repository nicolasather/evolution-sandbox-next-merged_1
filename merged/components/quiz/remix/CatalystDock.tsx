'use client';
/**
 * Floating Sandbox add-on: spend Quiz XP on a Catalyst Hint, and show the "Inspect Discovery" card when the page is
 * opened from a quiz Evidence Micro-Card (?inspect=<id>). Kept outside the protected Sandbox tree: it only reads the save.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useHasMounted } from '@/lib/useHasMounted';
import { CATALYST_COST_XP, availableXp, readShared, readUnlockedIds, spendXpOnHint } from '@/lib/sandboxQuizBridge';

type Inspect = { name: string; era: string; evidence: string; summary: string; recipe: string[][] };
const box: React.CSSProperties = { position: 'fixed', right: 12, bottom: 12, zIndex: 60, maxWidth: 320, font: '14px system-ui, sans-serif', color: '#e6f1ff' };
const card: React.CSSProperties = { background: 'rgba(15,23,42,.95)', border: '2px solid #38bdf8', borderRadius: 12, padding: 10, boxShadow: '4px 4px 0 #0284c7', marginTop: 8 };
const btn: React.CSSProperties = { background: '#0ea5e9', color: '#00131f', border: 0, borderRadius: 8, padding: '6px 10px', fontWeight: 800, cursor: 'pointer' };

export default function CatalystDock() {
  const mounted = useHasMounted();
  const [open, setOpen] = useState(false);
  const [xp, setXp] = useState(0);
  const [hints, setHints] = useState<{ a: string; b: string; aName?: string; bName?: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [inspect, setInspect] = useState<Inspect | null>(null);

  useEffect(() => {
    if (!mounted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage is read after mount
    const s = readShared(); setXp(availableXp(s)); setHints(s.hints);
    const id = new URLSearchParams(window.location.search).get('inspect');
    if (id) fetch(`/api/quiz/catalyst?inspect=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.success) setInspect(d); }).catch(() => undefined);
  }, [mounted]);
  if (!mounted) return null;

  const buy = async () => {
    setMsg('');
    const s = readShared();
    if (availableXp(s) < CATALYST_COST_XP) { setMsg(`You need ${CATALYST_COST_XP} XP. Earn XP in the Sandbox Remix quiz.`); return; }
    try {
      const r = await fetch('/api/quiz/catalyst', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unlocked: readUnlockedIds(), revealed: s.hints }) });
      const d = await r.json() as { success: boolean; a: string; b: string; aName: string; bName: string; error?: string };
      if (!d.success) { setMsg(d.error ?? 'No hint available.'); return; }
      const next = spendXpOnHint({ a: d.a, b: d.b });
      if (!next) { setMsg('Not enough XP.'); return; }
      setXp(availableXp(next)); setHints(next.hints.map((h) => (h.a === d.a && h.b === d.b ? { ...h, aName: d.aName, bName: d.bName } : h)));
      setMsg(`Catalyst: try combining ${d.aName} + ${d.bName}.`);
    } catch { setMsg('Network error. No XP was spent.'); }
  };

  return (
    <div style={box}>
      {inspect && (
        <div style={card} role="region" aria-label="Inspect discovery">
          <strong>🔬 {inspect.name}</strong> <small>({inspect.era})</small>
          <p style={{ margin: '6px 0' }}>{inspect.summary}</p>
          <p style={{ margin: '6px 0' }}><b>Evidence:</b> {inspect.evidence}</p>
          {inspect.recipe[0] && <p style={{ margin: '6px 0' }}><b>Recipe:</b> {inspect.recipe.map((p) => p.join(' + ')).join(' · ')}</p>}
          <button type="button" style={btn} onClick={() => setInspect(null)}>Close</button>
        </div>
      )}
      <button type="button" style={{ ...btn, float: 'right' }} aria-expanded={open} onClick={() => setOpen(!open)}>🧪 Catalyst Hint ({xp} XP)</button>
      {open && (
        <div style={{ ...card, clear: 'both' }}>
          <p style={{ margin: '0 0 6px' }}>Spend {CATALYST_COST_XP} XP from the quiz to reveal one recipe pair you can already combine.</p>
          <button type="button" style={btn} onClick={() => void buy()}>Reveal a pair (−{CATALYST_COST_XP} XP)</button>
          {msg && <p role="status" style={{ margin: '8px 0 0' }}>{msg}</p>}
          {hints.length > 0 && <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>{hints.slice(-5).map((h) => <li key={h.a + h.b}>{h.aName ?? h.a} + {h.bName ?? h.b}</li>)}</ul>}
          <p style={{ margin: '8px 0 0' }}><Link href="/quiz/remix" style={{ color: '#67e8f9' }}>Earn XP in the quiz →</Link></p>
        </div>
      )}
    </div>
  );
}
