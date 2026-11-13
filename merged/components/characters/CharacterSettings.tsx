'use client';
import { useEffect, useId, useRef } from 'react';
import { CharacterSilhouette } from './CharacterRig';
import { CHARACTERS, CREW } from '@/lib/characters/registry';
import { crewStore } from '@/lib/characters/store';
import type { CrewSave, CrewSettings } from '@/lib/characters/types';

const UNLOCK_TEXT: Record<string, string> = { vex: 'Arrives after 20 discoveries.', orra: 'Arrives when you reach the Civilization era.' };

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="crew-row" data-off={disabled ? '1' : undefined}>
      <label htmlFor={id}>{label}{hint && <small>{hint}</small>}</label>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    </div>
  );
}

/** Every behaviour of the crew, switchable on its own, available from every mode and persisted immediately. */
export function CharacterSettings({ save, onClose }: { save: CrewSave; onClose: () => void }) {
  const s = save.settings;
  const first = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<CrewSettings>) => crewStore.setSettings(patch);
  useEffect(() => {
    first.current?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const off = !s.enabled;
  return (
    <div className="crew-panel" role="dialog" aria-label="Crew settings" ref={first}>
      <h2>The crew</h2>
      <Toggle label="Show the crew" checked={s.enabled} onChange={v => set({ enabled: v })} />
      <h3>Who</h3>
      {CREW.map(c => save.unlocked[c.id] !== undefined
        ? <Toggle key={c.id} label={c.name} hint={c.role} checked={s.perCharacter[c.id]} disabled={off} onChange={v => crewStore.setCharacterEnabled(c.id, v)} />
        : <div key={c.id} className="crew-lock"><CharacterSilhouette id={c.id} size={26} /><span>{CHARACTERS[c.id].name}: {UNLOCK_TEXT[c.id]}</span></div>)}
      <h3>What they do</h3>
      <Toggle label="Autonomous bench turns" hint="Now and then a creature may try a real combination for you. It uses only items you own, follows the normal rules and puts failed pieces back." checked={s.autonomousTurns && save.disclosureSeen} disabled={off} onChange={v => crewStore.acceptDisclosure(v)} />
      <Toggle label="Object pranks" hint="Vex may send a loose bench piece home. You can pick it up again at once." checked={s.objectPranks} disabled={off} onChange={v => set({ objectPranks: v })} />
      <Toggle label="Wrong-answer pranks" hint="Vex may point at a clearly marked joke choice. It never selects or submits anything." checked={s.answerPranks} disabled={off} onChange={v => set({ answerPranks: v })} />
      <Toggle label="Play and skits" hint="They wander, joke around and put on little scenes between themselves." checked={s.ambientSkits} disabled={off} onChange={v => set({ ambientSkits: v })} />
      <Toggle label="Speech bubbles" hint="A few words, one at a time." checked={s.dialogue} disabled={off} onChange={v => set({ dialogue: v })} />
      <Toggle label="Reduce their motion" hint="Always follows your system setting; this only reduces it further." checked={s.reducedMotion} onChange={v => set({ reducedMotion: v })} />
      <button type="button" className="crew-link" onClick={() => crewStore.resetRelationships()}>Reset their history together</button>
    </div>
  );
}

/** A tiny first-run note, asked in-world at a quiet moment, before anything is ever done on the bench. */
export function CharacterDisclosure({ onAnswer }: { onAnswer: (accept: boolean) => void }) {
  return (
    <div className="crew-ask" role="group" aria-label="Crew bench turns">
      <p>Kip may now and then try a real combination on the bench for you, using only things you own. Failed pieces go back to the backpack. You can switch this off any time in the crew settings.</p>
      <div className="crew-btns">
        <button type="button" onClick={() => onAnswer(true)}>Fine by me</button>
        <button type="button" onClick={() => onAnswer(false)}>No thanks</button>
      </div>
    </div>
  );
}
