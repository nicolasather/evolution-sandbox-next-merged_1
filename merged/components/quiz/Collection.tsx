'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/quiz/client';
import { THEMES, REACTIONS, MAX_WHEEL, iconSvg, describeCriterion } from '@/lib/quiz/cosmetics/catalog';
import { lockerSearch, type Ledger } from '@/lib/quiz/cosmetics/ledger';

type Data = { unlocked: Record<string, string>; equipped: { icon?: string; wheel?: string[] }; optedOut: boolean };

/** Player locker: album by theme, equip owned icons, favourites, reaction wheel, opt-out. Items are only ever earned by learning, never bought. */
export default function Collection() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [theme, setTheme] = useState('');
  const [fav, setFav] = useState<string[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [recent, setRecent] = useState(false);
  const [wheel, setWheel] = useState<string[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads per-device preferences from localStorage after hydration (not available during SSR)
    try { setFav(JSON.parse(localStorage.getItem('qz:fav-icons') ?? '[]')); setWheel(JSON.parse(localStorage.getItem('qz:wheel') ?? '[]')); } catch { /* ignore */ }
    api<Data>('/api/quiz/cosmetics').then(setD).catch((e) => setErr(e.message ?? 'Could not load your collection.'));
  }, []);
  const ledger: Ledger = useMemo(() => ({ v: 1, events: {}, flagged: [], unlocked: d?.unlocked ?? {} }), [d]);
  const items = useMemo(() => lockerSearch({ query: q, theme: theme || undefined, favoritesOnly: favOnly, favorites: fav, recentOnly: recent }, ledger), [q, theme, favOnly, fav, recent, ledger]);

  function toggleFav(id: string) { const n = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id]; setFav(n); try { localStorage.setItem('qz:fav-icons', JSON.stringify(n)); } catch { /* ignore */ } }
  function toggleWheel(id: string) {
    const n = wheel.includes(id) ? wheel.filter((x) => x !== id) : wheel.length >= MAX_WHEEL ? wheel : [...wheel, id];
    setWheel(n); try { localStorage.setItem('qz:wheel', JSON.stringify(n)); } catch { /* ignore */ }
  }
  async function equipIcon(id: string) { setMsg(''); try { const r = await api<{ equipped: Data['equipped'] }>('/api/quiz/cosmetics', { method: 'POST', json: { action: 'equip', itemId: id } }); setD((x) => x && { ...x, equipped: r.equipped }); setMsg('Equipped.'); } catch (e) { setMsg((e as Error).message); } }
  async function optOut(v: boolean) { try { await api('/api/quiz/cosmetics', { method: 'POST', json: { action: 'opt_out', value: v } }); setD((x) => x && { ...x, optedOut: v }); } catch (e) { setMsg((e as Error).message); } }

  if (err) return <main className="qz-main"><p className="error" role="alert">{err}</p><p><Link href="/quiz/login">Sign in</Link> or play a game to start collecting.</p></main>;
  if (!d) return <main className="qz-main"><p role="status">Loading your collection…</p></main>;
  const owned = items.filter((i) => i.owned).length;
  return (
    <main className="qz-main" id="main">
      <nav className="qz-crumbs" aria-label="Breadcrumb"><Link href="/quiz">Quiz Studio</Link> / <span>My collection</span></nav>
      <h1>My collection</h1>
      <p className="note">Items are earned by learning — they can’t be bought, traded or drawn at random. {owned} of {items.length} shown are unlocked.</p>
      <div className="panel">
        <label><input type="checkbox" checked={d.optedOut} onChange={(e) => optOut(e.target.checked)} /> Don’t award or show collectibles for me</label>
      </div>
      <div className="panel" role="search">
        <label>Search <input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>{' '}
        <label>Theme <select value={theme} onChange={(e) => setTheme(e.target.value)}><option value="">All</option>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>{' '}
        <label><input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} /> Favourites</label>{' '}
        <label><input type="checkbox" checked={recent} onChange={(e) => setRecent(e.target.checked)} /> Recently unlocked</label>
        <p role="status" aria-live="polite">{msg}</p>
      </div>
      <ul className="qz-grid" style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
        {items.map((i) => (
          <li key={i.id} className="panel" style={{ opacity: i.owned ? 1 : .75 }}>
            <div aria-hidden dangerouslySetInnerHTML={{ __html: iconSvg(i.id, { size: 64, locked: !i.owned }) }} />
            <strong>{i.name}</strong>
            <div className="note">{i.rarity} · {THEMES.find((t) => t.id === i.theme)?.name}</div>
            <div className="note">{i.owned ? 'Unlocked' : `Locked — ${describeCriterion(i.criterion)}`}</div>
            <button className="btn small ghost" aria-pressed={fav.includes(i.id)} onClick={() => toggleFav(i.id)}>{fav.includes(i.id) ? 'Unfavourite' : 'Favourite'}</button>{' '}
            {i.owned && <button className="btn small" aria-pressed={d.equipped.icon === i.id} onClick={() => equipIcon(i.id)}>{d.equipped.icon === i.id ? 'Equipped' : 'Equip'}</button>}
          </li>
        ))}
        {items.length === 0 && <li>No items match.</li>}
      </ul>
      <section className="panel" aria-labelledby="wheel-h">
        <h2 id="wheel-h">Reaction wheel ({wheel.length}/{MAX_WHEEL})</h2>
        <p className="note">Choose up to {MAX_WHEEL} friendly reactions. Each has a text label, and there is a short pause between reactions in a game.</p>
        <div>{REACTIONS.map((r) => <button key={r.id} className="btn small ghost" aria-pressed={wheel.includes(r.id)} onClick={() => toggleWheel(r.id)}><span aria-hidden>{r.glyph}</span> {r.label}</button>)}</div>
      </section>
    </main>
  );
}
