/** Obstacle Survival art. Original ink-and-paper flat shapes: a 3 px ink outline, no gradients, no faces. Role silhouettes differ by SHAPE as well as colour
 *  so they stay readable in grayscale; hazards differ by shape and by pattern so a colour-blind student never needs the colour. */
import type { HazardKind, Perk, Role } from '@/lib/quiz/os/domain';

export const C = { ink: '#17253A', paper: '#FFF7E8', coral: '#F56F59', mint: '#6DD7B0', sky: '#6BBFE8', lemon: '#F7D96B', plum: '#745FAD', wheat: '#EAB979', navy: '#192E46', slate: '#5D718A' } as const;
export const TEAM_COLORS = ['#F56F59', '#6BBFE8', '#6DD7B0', '#745FAD'] as const;
export const TEAM_MARK = ['●', '■', '▲', '◆'] as const; // a shape, so squads differ without colour

export const ROLE_INFO: Record<Role, { name: string; ability: string; passive: string; short: string; color: string }> = {
  trailblazer: { name: 'Trailblazer', ability: 'Dash line', passive: 'Quick on the feet', short: 'Dash forward in a burst of speed.', color: C.coral },
  shieldbearer: { name: 'Shieldbearer', ability: 'Guard dome', passive: 'Steady and sturdy', short: 'A short guard dome ignores one hit.', color: C.mint },
  bridgewright: { name: 'Bridgewright', ability: 'Quick bridge', passive: 'Always has a plan', short: 'Lay planks: nearby hazards rest for the whole squad.', color: C.sky },
  pathfinder: { name: 'Pathfinder', ability: 'Survey pulse', passive: 'Fastest to the goal', short: 'Light up the safe route for the squad.', color: C.lemon },
  medic: { name: 'Medic', ability: 'Rescue rope', passive: 'Keeps the squad moving', short: 'Free stunned teammates at once.', color: C.plum },
};
export const KIND_NAME: Record<HazardKind, string> = {
  swipe_bar: 'Swipe bar', falling_block: 'Falling block', rolling_drum: 'Rolling drum', spikes: 'Spikes', conveyor: 'Conveyor', slime: 'Slime', pulse_gate: 'Pulse gate',
  laser_grid: 'Laser grid', crumble_tile: 'Crumble tile', wind_fan: 'Wind fan', bounce_pad: 'Bounce pad', mud_chute: 'Mud chute',
};
export const KIND_NOTE: Record<HazardKind, string> = {
  swipe_bar: 'Sweeps across the lane. Wait for it to pass, then go.', falling_block: 'A shadow shows where it lands. Step out of the shadow.', rolling_drum: 'Rolls through on a rhythm. A hit sends you to your checkpoint.',
  spikes: 'Rise on a beat. The dashed outline means “now”.', conveyor: 'Pushes you along. Harmless; lean against it.', slime: 'Slows you down. Harmless.', pulse_gate: 'Opens and closes. Cross while it is open.',
  laser_grid: 'Beams flick on after a warning. Cross while they are off.', crumble_tile: 'The floor drops away after a warning.', wind_fan: 'Blows you back. Harmless; push through it.', bounce_pad: 'Makes you hop — hopping dodges hazards.', mud_chute: 'Slows you down. Harmless.',
};
export const PERK_ICON: Record<Perk, string> = { safety_rail: '🛡', bridge_socket: '🌉', checkpoint_beacon: '⚑', group_recovery: '✚', route_peek: '👁', team_dash_pad: '➤', help_question: '?', safe_gate: '⛨' };
/** Decorative glyphs are spelled out for assistive tech where they stand alone. */

const stroke = { stroke: C.ink, strokeWidth: 3, strokeLinejoin: 'round' as const };
export function RoleIcon({ role, size = 48, title }: { role: Role; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <ellipse cx="32" cy="57" rx="16" ry="4" fill={C.ink} opacity=".18" />
      {role === 'trailblazer' && <><path d="M12 48 L22 38 M52 48 L42 38" stroke={C.mint} strokeWidth="4" strokeLinecap="round" /><path d="M32 8 L55 25 L46 52 L18 52 L9 25 Z" fill={C.coral} {...stroke} /></>}
      {role === 'shieldbearer' && <><path d="M32 6 L54 14 L51 38 Q46 52 32 58 Q18 52 13 38 L10 14 Z" fill={C.mint} {...stroke} /><path d="M32 22 L42 27 L32 39 L22 27 Z" fill={C.paper} {...stroke} strokeWidth={2.5} /></>}
      {role === 'bridgewright' && <><rect x="10" y="10" width="44" height="44" rx="9" fill={C.sky} {...stroke} /><rect x="19" y="25" width="26" height="14" rx="3" fill={C.paper} {...stroke} strokeWidth={2.5} /></>}
      {role === 'pathfinder' && <><path d="M32 4 L60 32 L32 60 L4 32 Z" fill={C.lemon} {...stroke} /><path d="M32 16 V48 M16 32 H48" stroke={C.ink} strokeWidth="4" strokeLinecap="round" /></>}
      {role === 'medic' && <><circle cx="32" cy="32" r="26" fill={C.plum} {...stroke} /><rect x="27" y="14" width="10" height="36" rx="3" fill={C.paper} {...stroke} strokeWidth={2.5} /><rect x="14" y="27" width="36" height="10" rx="3" fill={C.paper} {...stroke} strokeWidth={2.5} /></>}
    </svg>
  );
}
export function HazardIcon({ kind, size = 48, state = 'active' }: { kind: HazardKind; size?: number; state?: 'idle' | 'warn' | 'active' }) {
  const dash = state === 'warn' ? '5 4' : undefined; const op = state === 'idle' ? 0.55 : 1;
  const s = { ...stroke, strokeDasharray: dash };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" opacity={op}>
      {(kind === 'swipe_bar' || kind === 'wind_fan') && <><rect x="6" y="22" width="52" height="20" rx="5" fill={kind === 'swipe_bar' ? C.coral : C.sky} {...s} /><path d="M16 22 L28 42 M32 22 L44 42" stroke={C.ink} strokeWidth="3" /></>}
      {(kind === 'falling_block' || kind === 'pulse_gate') && <><rect x="12" y="8" width="40" height="34" rx="5" fill={C.lemon} {...s} /><path d="M10 46 L32 58 L54 46 Z" fill={C.wheat} {...s} /></>}
      {kind === 'spikes' && <path d="M4 56 L16 10 L28 56 M24 56 L36 10 L48 56 M40 56 L52 10 L62 56 Z" fill={C.coral} {...s} />}
      {(kind === 'rolling_drum' || kind === 'conveyor') && <><circle cx="32" cy="32" r="24" fill={kind === 'rolling_drum' ? C.sky : C.mint} {...s} /><path d="M32 12 V52 M12 32 H52" stroke={C.ink} strokeWidth="4" strokeLinecap="round" /></>}
      {(kind === 'laser_grid' || kind === 'bounce_pad') && <><rect x="6" y="10" width="52" height="44" rx="5" fill={C.plum} {...s} /><path d="M14 46 L50 18" stroke={C.paper} strokeWidth="4" strokeLinecap="round" /></>}
      {(kind === 'slime' || kind === 'mud_chute') && <><path d="M8 20 L44 8 L58 28 L52 50 L20 56 L6 40 Z" fill={kind === 'slime' ? C.mint : C.wheat} {...s} /><circle cx="40" cy="30" r="5" fill={C.paper} {...stroke} strokeWidth={2.5} /></>}
      {kind === 'crumble_tile' && <><rect x="8" y="8" width="48" height="48" rx="4" fill={C.wheat} {...s} /><path d="M8 24 L26 30 L20 46 L40 52 M56 18 L38 28" stroke={C.ink} strokeWidth="3" fill="none" /></>}
    </svg>
  );
}
