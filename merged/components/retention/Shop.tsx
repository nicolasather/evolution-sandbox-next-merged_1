'use client';
import { useState } from 'react';
import { CATEGORIES, retention, type CosmeticCategory } from '@/lib/retention/store';
import { SHOP_BY_ID, shopOf, type CosmeticDef } from '@/lib/retention/catalog';
import { kindOfCosmetic } from '@/lib/retention/art/loader';
import { retentionBus } from '@/lib/retention/bus';
import { hubUi } from '@/lib/retention/ui';
import { notices } from '@/lib/retention/notices';
import { THEME_PALETTES } from '@/lib/retention/themes';
import { RArt } from './RArt';
import { EffectPreview } from './EffectPreview';
import { useHubUi, useRetention } from './hooks';

const LABEL: Record<CosmeticCategory, string> = { icon: 'Icons', effect: 'Effects', skin: 'Skins', decoration: 'Decorations', theme: 'Themes' };
const BLURB: Record<CosmeticCategory, string> = {
  icon: 'Your mark on the coin pill and the cards you share.',
  effect: 'A small flourish added to the finish of every NEW discovery.',
  skin: 'An engraved plate that sits behind each piece on the bench.',
  decoration: 'An ornament that rests in the corner of your bench.',
  theme: 'A complete palette for the whole game.',
};

function Art({ c, size, still }: { c: CosmeticDef; size: number; still?: boolean }) {
  if (c.category === 'effect') return <EffectPreview id={c.id} w={size} h={Math.round(size * 0.62)} still={still ?? true} scale={1.7} />;
  return <RArt kind={kindOfCosmetic(c.category)} id={c.id} size={size} title={c.name} />;
}

export function Shop() {
  const r = useRetention();
  const ui = useHubUi();
  const [cat, setCat] = useState<CosmeticCategory>('icon');
  const [sel, setSel] = useState<string>(() => shopOf('icon')[0].id);
  const list = shopOf(cat);
  const c = SHOP_BY_ID[sel] && SHOP_BY_ID[sel].category === cat ? SHOP_BY_ID[sel] : list[0];
  const owned = retention.isOwned(c.id, c.defaultUnlocked);
  const equipped = r.equipped[cat] === c.id;
  const afford = r.coins >= c.cost;
  const pal = cat === 'theme' ? THEME_PALETTES[c.id] : null;

  const pick = (id: string) => {
    setSel(id);
    const d = SHOP_BY_ID[id];
    if (d?.category === 'theme') { hubUi.previewTheme(id); retentionBus.emit({ t: 'signal', name: 'hub-preview', id }); }
    else if (ui.previewTheme) hubUi.previewTheme(null);
  };
  const buy = () => {
    if (retention.buy(c.id, c.cost, c.defaultUnlocked)) notices.push({ kind: 'info', title: `${c.name} is yours`, sub: LABEL[cat].slice(0, -1) + ' added to your collection' });
  };
  const equip = () => {
    retention.equip(cat, c.id);
    if (cat === 'theme') hubUi.previewTheme(null);
    retentionBus.emit({ t: 'signal', name: 'hub-changed' });
  };
  const unequip = () => {
    retention.equip(cat, null);
    if (cat === 'theme') { hubUi.previewTheme(null); retentionBus.emit({ t: 'signal', name: 'theme-default' }); }
    retentionBus.emit({ t: 'signal', name: 'hub-changed' });
  };

  return (
    <div className="rshop">
      <div className="rsub" role="tablist" aria-label="Shop categories">
        {CATEGORIES.map(k => (
          <button key={k} role="tab" aria-selected={cat === k} className="chip"
            onClick={() => { setCat(k); setSel(shopOf(k)[0].id); if (ui.previewTheme) hubUi.previewTheme(null); }}>
            {LABEL[k]} <span className="mono rdim">{shopOf(k).filter(x => retention.isOwned(x.id, x.defaultUnlocked)).length}/30</span>
          </button>
        ))}
      </div>
      <p className="rnote mono">{BLURB[cat]} Everything here is cosmetic and kept only in this browser; coins are personal and never needed for progress.</p>
      <div className="rshop-body">
        <ul className="rgrid" aria-label={LABEL[cat]}>
          {list.map(x => {
            const own = retention.isOwned(x.id, x.defaultUnlocked);
            return (
              <li key={x.id}>
                <button className="rcard" aria-pressed={x.id === c.id} data-owned={own ? '1' : '0'} data-eq={r.equipped[cat] === x.id ? '1' : '0'} onClick={() => pick(x.id)}>
                  <span className="rcard-art"><Art c={x} size={cat === 'effect' ? 84 : 52} /></span>
                  <span className="rcard-name">{x.name}</span>
                  <span className="rcard-st mono">{r.equipped[cat] === x.id ? 'Equipped' : own ? 'Owned' : `${x.cost} ◈`}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <aside className="rdetail" aria-live="polite">
          <div className="rdetail-art">
            {cat === 'effect' ? <EffectPreview id={c.id} w={240} h={150} still={false} /> : <RArt kind={kindOfCosmetic(cat)} id={c.id} size={150} title={c.name} />}
          </div>
          <h3>{c.name}</h3>
          <p className="mono rdim">{c.rarity} · {LABEL[cat].slice(0, -1).toLowerCase()} · motif “{c.motif}”</p>
          {pal && <div className="rswatch" aria-label="Palette">{pal.map((col, i) => <i key={i} style={{ background: col }} />)}</div>}
          {cat === 'theme' && <p className="mono rdim">Previewing on this page now. Equip to keep it; close the drawer to undo.</p>}
          <div className="rbtns">
            {!owned && <button className="chip rbuy" onClick={buy} disabled={!afford}>{afford ? `Get for ${c.cost} ◈` : `${c.cost} ◈ — ${c.cost - r.coins} more`}</button>}
            {owned && !equipped && <button className="chip rbuy" onClick={equip}>Equip</button>}
            {owned && equipped && <button className="chip" onClick={unequip}>{cat === 'theme' ? 'Back to default theme' : 'Unequip'}</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}
