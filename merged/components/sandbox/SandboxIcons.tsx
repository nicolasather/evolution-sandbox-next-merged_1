import type { ReactNode } from 'react';

/* ============================================================================
   SANDBOX ICONS — one drawing language for every piece of Sandbox chrome:
   24 × 24 grid, 1.5 stroke, round caps, ink colour only. Nothing here is
   coloured or animated on its own; state comes from the parent (hover,
   pressed, disabled). Every icon is decorative (aria-hidden) and is always
   paired with a visible or accessible label by its caller.
   ========================================================================== */

export type SandboxIconId =
  | 'workspace' | 'graph' | 'archive' | 'timeline'
  | 'help' | 'replay' | 'success' | 'fail' | 'hint' | 'locked'
  | 'curious' | 'eureka' | 'confused' | 'excited' | 'surprised';

const PATHS: Record<SandboxIconId, string> = {
  /* navigation */
  workspace: 'M3.5 7 H10.5 V17 H3.5 Z M13.5 7 H20.5 V17 H13.5 Z',
  graph:     'M5 7 A2 2 0 1 0 5.01 7 Z M19 5 A2 2 0 1 0 19.01 5 Z M19 17 A2 2 0 1 0 19.01 17 Z M6.6 6.1 L17.3 4.9 M6.6 8.1 L17.3 16 M19 7 V15',
  archive:   'M4 5 H20 V9 H4 Z M5.5 9 V19 H18.5 V9 M10 13 H14',
  timeline:  'M3 12 H21 M6 12 A1.5 1.5 0 1 0 6.01 12 Z M12 12 A1.5 1.5 0 1 0 12.01 12 Z M18 12 A1.5 1.5 0 1 0 18.01 12 Z M6 9 V7 M12 15 V17 M18 9 V7',
  /* help and states */
  help:      'M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 Z M9.5 9.5 C9.5 7.5 14.5 7.5 14.5 9.8 C14.5 11.8 12 11.6 12 14 M12 17 V17.4',
  replay:    'M4.5 12 A7.5 7.5 0 1 0 7 6.4 M4.5 4.5 V8.5 H8.5',
  success:   'M4.5 12.5 L9.5 17.5 L19.5 6.5',
  fail:      'M6 6 L18 18 M18 6 L6 18',
  hint:      'M9 17.5 H15 M10 20.5 H14 M12 3.5 A5.5 5.5 0 0 0 8.8 13.5 C9.5 14.2 9.5 15 9.5 15.5 H14.5 C14.5 15 14.5 14.2 15.2 13.5 A5.5 5.5 0 0 0 12 3.5 Z',
  locked:    'M6.5 11 H17.5 V20 H6.5 Z M9 11 V8 A3 3 0 0 1 15 8 V11',
  /* emotes: a face in the same drawing language, five expressions */
  curious:   'M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 Z M9 10 V10.4 M15 10 V10.4 M9 15 C10.5 16 13.5 16 15 14.5 M14.5 4.5 L15.5 3',
  eureka:    'M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 Z M8 10 L10 11.5 L8 13 M16 10 L14 11.5 L16 13 M8.5 15 C10 17.5 14 17.5 15.5 15 M3.5 4 L5 5.5 M20.5 4 L19 5.5 M12 1.5 V2.5',
  confused:  'M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 Z M8.5 10 V10.4 M15.5 10 V10.4 M9 16 C10.5 14.8 13.5 17.2 15 16 M14 4 C15.5 2.5 15.5 5 14 6',
  excited:   'M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 Z M8 9.5 L9.5 11 L8 12.5 M16 9.5 L14.5 11 L16 12.5 M8 14.5 C9.5 18 14.5 18 16 14.5 M4 3 L5 4.5 M20 3 L19 4.5',
  surprised: 'M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 Z M8.8 9.5 V9.9 M15.2 9.5 V9.9 M12 14 A2 2.2 0 1 0 12.01 14 Z',
};

export function SandboxIcon({ id, size = 22, className }: { id: SandboxIconId; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[id]} />
    </svg>
  );
}

/** The five player emotes, in the order the tray shows them. */
export const EMOTES: { id: 'curious' | 'eureka' | 'confused' | 'excited' | 'surprised'; label: string; line: string }[] = [
  { id: 'curious', label: 'Curious', line: 'Hm. What happens if…' },
  { id: 'eureka', label: 'Eureka', line: 'That works!' },
  { id: 'confused', label: 'Confused', line: 'Nothing makes sense.' },
  { id: 'excited', label: 'Excited', line: 'Let’s try more!' },
  { id: 'surprised', label: 'Surprised', line: 'Oh! Didn’t expect that.' },
];

/** A labelled icon for the places that need words beside the picture. */
export function IconLabel({ id, children }: { id: SandboxIconId; children: ReactNode }) {
  return (
    <span className="sx-iconlabel">
      <SandboxIcon id={id} size={16} />
      <span>{children}</span>
    </span>
  );
}
