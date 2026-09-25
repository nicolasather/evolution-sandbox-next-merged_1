import type { ActionId } from '@/lib/types';

/* Line glyphs for the techniques, on a 24 × 24 grid, drawn with the ink colour. Each one is the thing
   that is DONE (a blow, a groove, a twist), not a tool, so they read at 20 px and do not need words. */
const PATHS: Record<ActionId, string> = {
  smash:    'M12 12 L12 4 M12 12 L18.5 6 M12 12 L20 12 M12 12 L17.5 18.5 M12 12 L6.5 18.5 M12 12 L4 12 M12 12 L5.5 6 M8 20.5 L16 20.5',
  hammer:   'M5 6.5 H15 V11.5 H5 Z M10 11.5 V20.5 M15 9 H19.5',
  split:    'M6 5 H18 V19 H6 Z M12 5 L10.4 9 L13.6 12 L10.6 15.5 L12 19',
  chisel:   'M7 20 L12.6 10.4 L15 12 L9.4 21.6 Z M13 9 L14.6 4.5 M16.6 7.4 L20 6 M15.8 3.6 L18.6 4.4',
  cut:      'M4.5 19.5 L19.5 4.5 M4.5 14 C8.5 14 10 15.5 10 19.5 M14 4.5 L19.5 4.5 L19.5 10',
  carve:    'M4 17 C8 9 13 15 20 7 M4 20.5 H20 M18.4 5.6 L20.6 5.2 L20.2 7.5',
  scrape:   'M4 7 H20 M4 11.5 H15 M4 16 H11 M14 19.5 L20.5 13.5',
  saw:      'M3.5 15 L6 9 L8.5 15 L11 9 L13.5 15 L16 9 L18.5 15 L21 9 M3.5 19.5 H21',
  brush:    'M20 4 L11 13 M11 13 C7.5 12 4.5 14.5 4.5 19.5 C9.5 19.5 12 16.5 11 13 M14 10 L16 12',
  dig:      'M15 4 L9.5 16 M15 4 L18 5.5 M9.5 16 C7.5 15.5 6 17.5 7.5 19.5 C9 20.5 11.5 20 11.5 17.5 M4 21 H8 M13 21 H14 M17 21 H20',
  grind:    'M4.5 16 C4.5 12 8 10 11 10.5 C14 11 15 14 13 16.5 C11 19 6 19.5 4.5 16 Z M15.5 5.5 A5 5 0 0 1 20.5 10.5 M20.5 10.5 L18.5 9.5 M20.5 10.5 L21 8.3',
  mix:      'M4 11 H20 C20 16.5 16.5 20 12 20 C7.5 20 4 16.5 4 11 Z M12 15.5 C10 15.5 9.5 13 12 12.5 C14.5 12 15 15 12 16 M15 4.5 L11 11',
  shape:    'M8 5 C6 5 6 9 8.5 10.5 C11 12 10 13.5 9 15.5 C8 18 9.5 20 12 20 C14.5 20 16 18 15 15.5 C14 13.5 13 12 15.5 10.5 C18 9 18 5 16 5 Z',
  press:    'M12 3.5 V13 M8.5 9.5 L12 13 L15.5 9.5 M4.5 16 H19.5 M6 19.5 H18',
  polish:   'M5 15 C5 11.5 8 9 12 9 C16 9 19 11.5 19 15 C19 17 16 19 12 19 C8 19 5 17 5 15 Z M9.5 13.5 C10.5 12.5 12 12.3 13 12.7 M18.5 3.5 V7.5 M16.5 5.5 H20.5 M5.5 4.5 V7 M4.2 5.7 H6.8',
  separate: 'M12 4 V20 M10 8 L4.5 12 L10 16 M14 8 L19.5 12 L14 16',
  pull:     'M3.5 12 H20.5 M7 8 L3.5 12 L7 16 M17 8 L20.5 12 L17 16 M9 10 L15 14',
  twist:    'M6 4 C18 8 6 13 18 20 M18 4 C6 8 18 13 6 20',
  tie:      'M4 9 C4 5 12 5 12 9.5 C12 14 20 14 20 10 M12 9.5 C12 13 6 13 6 17 C6 20 10 20.5 12 18 M12 9.5 C12 12.5 18 12.5 18 16.5',
  stretch:  'M3 12 H8.5 L12 6.5 L15.5 12 L12 17.5 L8.5 12 M15.5 12 H21 M5.5 9.5 L3 12 L5.5 14.5 M18.5 9.5 L21 12 L18.5 14.5',
  burn:     'M12 3.5 C12 8 16.5 9.5 16.5 14.5 C16.5 17.8 14.5 20.5 12 20.5 C9.5 20.5 7.5 18 7.5 15 C7.5 12.5 9 11.5 9.5 9.5 C11.5 10 12 8 12 3.5 Z M12 20 C10.5 19.5 10 17.5 11 16 C12.5 16.5 13.8 18 12 20',
  heat:     'M6 8 C8 6 8 4.5 6 3 M12 8 C14 6 14 4.5 12 3 M18 8 C20 6 20 4.5 18 3 M4 13 H20 M6.5 17 H17.5 M9 20.5 H15',
  dry:      'M12 5 C12 5 6.5 11 6.5 14.5 C6.5 17.5 9 20 12 20 C15 20 17.5 17.5 17.5 14.5 C17.5 11 12 5 12 5 Z M4 4 L20 20',
  cool:     'M12 3 V21 M4.5 7.5 L19.5 16.5 M19.5 7.5 L4.5 16.5 M9.5 4.5 L12 7 L14.5 4.5 M9.5 19.5 L12 17 L14.5 19.5',
  pour:     'M4 9 L13 5.5 L16.5 12 L9 17.5 Z M16.5 12 C18.5 13 19.5 15 19 17 M19.5 19.5 V20.5 M16 19.5 V20.5 M12.5 20 V21',
};

export function TechniqueIcon({ id, size = 22, className }: { id: ActionId; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[id]} />
    </svg>
  );
}

/** The "not learned yet" chip's mark. */
export function LockedMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 9.2 C9 6.6 15 6.6 15 9.6 C15 12.2 12 12 12 14.8 M12 18.2 V18.6" strokeDasharray="0" />
    </svg>
  );
}
