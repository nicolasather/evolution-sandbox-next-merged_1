import type { Engine } from '@/lib/engine';
import type { ModeId } from '@/lib/modes/types';

/* ============================================================================
   DEV BRIDGE — how the developer console reaches things that live elsewhere in
   the tree. The Main Evolution engine is created inside <Sandbox> (and goes away
   when another mode is open); the mode switch lives in <AppRoot>. Instead of
   threading props through both, each registers itself here and the console asks.

   Everything here is plain registration. Every ACTION that changes state checks
   the override store (or goes through an Engine/Store method that does), so a
   registered handler can never be used to bypass the production gates.
   ========================================================================== */

export interface LaunchRequest {
  mode: ModeId;
  /** Civilization only: begin this campaign chapter as soon as the mode is ready. */
  civChapterId?: string;
}

type EngineWaiter = (engine: Engine) => void;

class DevBridge {
  private engine: Engine | null = null;
  private waiters: EngineWaiter[] = [];
  private launchHandler: ((req: LaunchRequest) => void) | null = null;
  private civChapter: string | null = null;
  private civVersion = 0;
  private civListeners = new Set<() => void>();

  registerEngine(engine: Engine): void {
    this.engine = engine;
    const w = this.waiters; this.waiters = [];
    w.forEach(fn => fn(engine));
  }
  unregisterEngine(engine: Engine): void {
    if (this.engine === engine) this.engine = null;
  }
  getEngine(): Engine | null { return this.engine; }

  /** Run `fn` with the Main Evolution engine: now if it is mounted, else as soon as it is. */
  whenEngine(fn: EngineWaiter): void {
    if (this.engine) fn(this.engine); else this.waiters.push(fn);
  }

  setLaunchHandler(h: ((req: LaunchRequest) => void) | null): void { this.launchHandler = h; }
  launch(req: LaunchRequest): boolean {
    if (!this.launchHandler) return false;
    if (req.civChapterId) { this.civChapter = req.civChapterId; this.civVersion++; this.civListeners.forEach(l => l()); }
    this.launchHandler(req);
    return true;
  }

  /** CivilizationMode watches this so a chapter request made while it is already open is not missed. */
  subscribeCiv = (l: () => void): (() => void) => { this.civListeners.add(l); return () => { this.civListeners.delete(l); }; };
  getCivVersion = (): number => this.civVersion;

  /** CivilizationMode asks once when it is ready; the request is consumed. */
  takeCivChapter(): string | null {
    const c = this.civChapter; this.civChapter = null; return c;
  }

  _reset(): void { this.engine = null; this.waiters = []; this.launchHandler = null; this.civChapter = null; this.civVersion = 0; this.civListeners.clear(); }
}

export const devBridge = new DevBridge();
