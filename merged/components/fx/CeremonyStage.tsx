'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plate3D } from '../Plate3D';
import { cn } from '@/lib/utils';
import { sound } from '@/lib/sound';
import { PARTICLE_SCALE, getQuality, prefersReducedMotion } from '@/lib/perf';
import rawDb from '@/data/db.json';
import type { Discovery } from '@/lib/types';

/* ============================================================================
   CEREMONY STAGE — the room goes quiet for a new discovery.

   The world darkens, the piece is lifted to the centre on its own plate, its
   catalogue number counts up ("017 / 322"), its name, era and evidence line
   are written under it, and dust rises slowly behind it. A hidden discovery
   arrives as "?????????" and resolves letter by letter. Everything printed
   comes from the record itself: an entry with no verified source says
   SOURCE NEEDED instead of pretending.
   Skippable: a tap while it is still writing jumps to the finished state;
   a tap after that (or Esc / Enter / Space) closes it.
   ========================================================================== */

type Src = { scope?: string };
const SOURCES = (rawDb as unknown as { sources: Record<string, Src> }).sources;
const ERA_NAME = new Map((rawDb as unknown as { eras: { id: string; name: string }[] }).eras.map(e => [e.id, e.name]));
const TOTAL = (rawDb as unknown as { counts: { total: number } }).counts.total;

/** What the record can honestly say about its evidence. */
export function evidenceLine(n: Pick<Discovery, 'src'>): { text: string; verified: boolean } {
  if (n.src.includes('source_required')) return { text: 'Source needed', verified: false };
  const refs = n.src.map(id => SOURCES[id]).filter(Boolean);
  const topic = refs.filter(s => s.scope !== 'general');
  const c = topic.length || refs.length;
  if (!c) return { text: 'Source needed', verified: false };
  return { text: `Verified evidence · ${c} ${c === 1 ? 'source' : 'sources'}`, verified: true };
}

const pad = (v: number) => String(Math.round(v)).padStart(3, '0');

export function CeremonyStage({ node, onDone }: { node: Discovery; onDone: () => void }) {
  const mounted = typeof document !== 'undefined';
  const [step, setStep] = useState(0);            // 0 dark · 1 plate · 2 tag · 3 number · 4 name · 5 meta · 6 ready
  const [name, setName] = useState(node.hidden ? '?????????' : node.n);
  const numRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);
  const stepRef = useRef(0);
  const timers = useRef<number[]>([]);
  const major = !!node.hidden || node.rar === 'rare';
  const ev = useMemo(() => evidenceLine(node), [node]);
  const era = ERA_NAME.get(node.era) ?? node.era;

  const finish = useRef(() => {});

  /* the sequence */
  useEffect(() => {
    if (!mounted) return;
    const reduced = prefersReducedMotion();
    let seen = false;
    try { seen = window.localStorage.getItem('evo.ceremony.seen') === '1'; } catch { /* storage blocked */ }
    const k = reduced ? 0.01 : (seen ? 0.72 : 1) * (major ? 1.25 : 1);
    const at = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms * k)); };
    const go = (s: number) => { stepRef.current = s; setStep(s); };

    at(60, () => go(1));
    at(120, () => sound.sfx(node.hidden ? 'hidden' : major ? 'major' : 'discovery'));
    at(700, () => go(2));
    at(950, () => { go(3); countUp(); });
    at(1650, () => { go(4); if (node.hidden) resolveName(); });
    at(node.hidden ? 2900 : 2100, () => go(5));
    at(node.hidden ? 3500 : 2700, () => go(6));
    at(node.hidden ? 7200 : major ? 6400 : 4900, () => finish.current());

    function countUp() {
      const el = numRef.current;
      if (!el) return;
      const t0 = performance.now(), dur = 620 * k + 1;
      const tick = (now: number) => {
        const u = Math.min(1, (now - t0) / dur);
        el.textContent = pad(node.no * (1 - Math.pow(1 - u, 3)));
        if (u < 1 && !doneRef.current) requestAnimationFrame(tick); else el.textContent = pad(node.no);
      };
      requestAnimationFrame(tick);
    }
    function resolveName() {
      const real = node.n, len = real.length;
      let i = 0;
      const id = window.setInterval(() => {
        i++;
        setName(real.slice(0, i) + real.slice(i).replace(/\S/g, '?'));
        if (i >= len) { window.clearInterval(id); setName(real); }
      }, Math.max(24, 900 * k / Math.max(1, len)));
      timers.current.push(id as unknown as number);
    }
    finish.current = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      timers.current.forEach(t => window.clearTimeout(t));
      try { window.localStorage.setItem('evo.ceremony.seen', '1'); } catch { /* storage blocked */ }
      setStep(7);
      window.setTimeout(onDone, reduced ? 0 : 420);
    };

    return () => { timers.current.forEach(t => { window.clearTimeout(t); window.clearInterval(t); }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mounted ceremony
  }, [mounted]);

  /** Tap: fast-forward to the finished page first, close on the second tap. */
  const advance = useRef(() => {});
  useEffect(() => { advance.current = () => {
    if (doneRef.current) return;
    if (stepRef.current < 6) {
      timers.current.forEach(t => { window.clearTimeout(t); window.clearInterval(t); });
      timers.current = [];
      if (numRef.current) numRef.current.textContent = pad(node.no);
      setName(node.n);
      stepRef.current = 6; setStep(6);
      // a finished page stays until the player has read it
      timers.current.push(window.setTimeout(() => finish.current(), major ? 7000 : 5200));
    } else finish.current();
  }; });

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation(); advance.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [mounted]);

  /* rising dust */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!mounted || !cv || prefersReducedMotion() || /jsdom/i.test(navigator.userAgent)) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const count = Math.round((major ? 130 : 90) * PARTICLE_SCALE[getQuality()]);
    const tone = node.hidden ? '216,98,63' : '212,160,90';
    const P = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: H * (0.55 + Math.random() * 0.6), s: 0.6 + Math.random() * 1.8,
      v: 10 + Math.random() * 34, sw: Math.random() * Math.PI * 2, a: 0.15 + Math.random() * 0.5,
    }));
    let raf = 0, last = performance.now(), t = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const fadeIn = Math.min(1, t / 1.2);
      for (const p of P) {
        p.y -= p.v * dt; p.x += Math.sin(t * 0.7 + p.sw) * 6 * dt;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        const edge = Math.min(1, Math.max(0, (p.y / H) * 2.2)); // fades toward the top
        g.fillStyle = `rgba(${tone},${(p.a * edge * fadeIn).toFixed(3)})`;
        g.beginPath(); g.arc(p.x, p.y, p.s, 0, Math.PI * 2); g.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => { W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [mounted, major, node.hidden]);

  if (!mounted) return null;
  return createPortal(
    <div
      className={cn('cer', node.hidden && 'is-hidden', major && 'is-major')}
      data-step={step}
      role="dialog"
      aria-modal="true"
      aria-label={node.hidden ? 'New hidden discovery' : `New discovery: ${node.n}`}
      onClick={() => advance.current()}
    >
      <canvas ref={canvasRef} className="cer-dust" aria-hidden="true" />
      <div className="cer-vig" aria-hidden="true" />
      <div className="cer-body">
        <div className="cer-plate"><Plate3D node={node} variant="card" label={node.n} /></div>
        <p className="cer-tag mono">{node.hidden ? 'New hidden discovery' : node.rar === 'rare' ? 'Rare discovery' : 'New discovery'}</p>
        <p className="cer-no mono"><span ref={numRef}>000</span><i> / {TOTAL}</i></p>
        <h2 className="cer-name" aria-label={node.hidden && step < 4 ? undefined : node.n}>{name}</h2>
        <p className="cer-meta mono">{era} · {node.hidden && step < 5 ? '—' : node.date}</p>
        <p className={cn('cer-ev mono', !ev.verified && 'need')}>{ev.text}</p>
        <p className="cer-go mono">Tap to continue</p>
      </div>
    </div>,
    document.body,
  );
}
