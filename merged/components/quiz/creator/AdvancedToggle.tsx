'use client';
import { useCreator } from './CreatorProvider';

/** Basic shows only what is required. The choice is remembered with the quiz (and the creator's device) and never hides safety settings. */
export default function AdvancedToggle({ label = 'Show advanced options' }: { label?: string }) {
  const c = useCreator();
  return (
    <label className="inline cr-adv">
      <input type="checkbox" checked={c.settings.advanced} onChange={(e) => c.patchSettings({ advanced: e.target.checked })} /> {label}
    </label>
  );
}
