/** Keyboard + on-screen stick → one normalized movement vector. Pure and testable: attach() wires DOM events, vector() is deterministic. */
export type Vec2 = { x: number; y: number };
export class InputState {
  private keys = new Set<string>(); stick: Vec2 = { x: 0, y: 0 }; enabled = true;
  static readonly MAP: Record<string, 'l' | 'r' | 'u' | 'd'> = { a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r', w: 'u', arrowup: 'u', s: 'd', arrowdown: 'd' };
  key(code: string, down: boolean) { const k = InputState.MAP[code.toLowerCase()]; if (!k) return false; if (down) this.keys.add(k); else this.keys.delete(k); return true; }
  clear() { this.keys.clear(); this.stick = { x: 0, y: 0 }; }
  vector(): Vec2 {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = (this.keys.has('r') ? 1 : 0) - (this.keys.has('l') ? 1 : 0), y = (this.keys.has('d') ? 1 : 0) - (this.keys.has('u') ? 1 : 0);
    if (!x && !y) { x = this.stick.x; y = this.stick.y; }
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } if (m < 0.08) return { x: 0, y: 0 }; return { x, y };
  }
  /** pointer position relative to a stick centre → a clamped vector with a dead zone */
  static stickFrom(dx: number, dy: number, radius: number): Vec2 { const m = Math.hypot(dx, dy); if (m < radius * 0.12) return { x: 0, y: 0 }; const k = Math.min(1, m / radius) / m; return { x: dx * k, y: dy * k }; }
}
export const isTypingTarget = (el: EventTarget | null) => { const e = el as HTMLElement | null; if (!e || !e.tagName) return false; const t = e.tagName; return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.isContentEditable; };
