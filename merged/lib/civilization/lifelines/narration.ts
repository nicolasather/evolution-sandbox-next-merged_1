import type { Settings } from './campaign';
import type { ContentIndex } from './schema';

/* ============================================================================
   NARRATION — subtitles are the complete experience; audio is optional.
   • No recorded narration ships with this build. Every cue's asset status is
     'subtitle-only' (or 'browser-fallback' when the player enables the
     browser's installed speech voice). We never label a cue "recorded" unless a
     licensed file exists in public/audio/civilization/manifest.json.
   • Audio starts only after a user gesture and the player enabling it.
   • A cue of a given pressure category is voiced once per run; obsolete cues
     are dropped; leaving the mode cancels everything.
   ========================================================================== */

export type CueKind = 'intro' | 'success' | 'warning' | 'event' | 'hint' | 'tutorial';
export interface Cue {
  id: string;
  kind: CueKind;
  text: string;
  /** Pressure category (e.g. 'warning:water'). Voiced at most once per run. */
  category?: string;
}

export interface VoiceInfo { uri: string; name: string; lang: string }
export interface NarratorAdapter {
  readonly id: 'silent' | 'browser' | 'mock';
  /** True when this adapter can produce sound. */
  readonly audible: boolean;
  isAvailable(): boolean;
  voices(): VoiceInfo[];
  speak(text: string, opts: { rate: number; volume: number; voiceURI: string | null }, onEnd: () => void): void;
  cancel(): void;
}

export class SilentNarrator implements NarratorAdapter {
  readonly id = 'silent' as const;
  readonly audible = false;
  isAvailable(): boolean { return true; }
  voices(): VoiceInfo[] { return []; }
  speak(_t: string, _o: { rate: number; volume: number; voiceURI: string | null }, onEnd: () => void): void { onEnd(); }
  cancel(): void { /* nothing to stop */ }
}

interface SynthLike {
  speak(u: unknown): void; cancel(): void; getVoices(): { voiceURI: string; name: string; lang: string }[];
}
function defaultSynth(): SynthLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { speechSynthesis?: SynthLike };
  return w.speechSynthesis ?? null;
}
function defaultUtterance(): ((text: string) => Record<string, unknown>) | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as unknown as { SpeechSynthesisUtterance?: new (t: string) => Record<string, unknown> }).SpeechSynthesisUtterance;
  return Ctor ? (t: string) => new Ctor(t) : null;
}

export class BrowserSpeechNarrator implements NarratorAdapter {
  readonly id = 'browser' as const;
  readonly audible = true;
  private readonly synth: SynthLike | null;
  private readonly makeUtterance: ((text: string) => Record<string, unknown>) | null;
  /** Both arguments are injectable for tests; by default the browser's own speech API is used when it exists. */
  constructor(synth?: SynthLike | null, makeUtterance?: ((text: string) => Record<string, unknown>) | null) {
    this.synth = synth !== undefined ? synth : defaultSynth();
    this.makeUtterance = makeUtterance !== undefined ? makeUtterance : defaultUtterance();
  }
  isAvailable(): boolean { return !!this.synth && !!this.makeUtterance; }
  voices(): VoiceInfo[] {
    try { return (this.synth?.getVoices() ?? []).map(v => ({ uri: v.voiceURI, name: v.name, lang: v.lang })); } catch { return []; }
  }
  speak(text: string, opts: { rate: number; volume: number; voiceURI: string | null }, onEnd: () => void): void {
    if (!this.synth || !this.makeUtterance) { onEnd(); return; }
    try {
      const u = this.makeUtterance(text);
      u.rate = opts.rate; u.volume = opts.volume;
      if (opts.voiceURI) {
        const raw = (this.synth.getVoices() as unknown as Record<string, unknown>[]).find(v => v.voiceURI === opts.voiceURI);
        if (raw) u.voice = raw;
      }
      u.onend = onEnd; u.onerror = onEnd;
      this.synth.speak(u);
    } catch { onEnd(); }
  }
  cancel(): void { try { this.synth?.cancel(); } catch { /* ignore */ } }
}

/** Test double: records calls, completes on demand. */
export class MockNarrator implements NarratorAdapter {
  readonly id = 'mock' as const;
  readonly audible = true;
  spoken: string[] = [];
  cancels = 0;
  private pending: (() => void) | null = null;
  isAvailable(): boolean { return true; }
  voices(): VoiceInfo[] { return [{ uri: 'mock-1', name: 'Mock voice', lang: 'en-US' }]; }
  speak(text: string, _o: { rate: number; volume: number; voiceURI: string | null }, onEnd: () => void): void { this.spoken.push(text); this.pending = onEnd; }
  finish(): void { const p = this.pending; this.pending = null; p?.(); }
  cancel(): void { this.cancels++; this.pending = null; }
}

/** Honest voice choice: names are shown as the system reports them; a hint is only a hint. */
const FEMALE_STYLE_HINTS = /\b(female|woman|samantha|zira|aria|jenny|libby|sonia|susan|victoria|karen|moira|tessa|serena|fiona|hazel)\b/i;
export function voiceHint(v: VoiceInfo): 'name-suggests-female-style' | null {
  return FEMALE_STYLE_HINTS.test(v.name) ? 'name-suggests-female-style' : null;
}
export function preferredVoice(voices: VoiceInfo[], lang = 'en'): VoiceInfo | null {
  const english = voices.filter(v => v.lang.toLowerCase().startsWith(lang));
  return english.find(v => voiceHint(v)) ?? english[0] ?? null;
}

/* ------------------------------ controller ------------------------------- */

export interface SubtitleState { cue: Cue | null }

export class NarrationController {
  private spokenCategories = new Set<string>();
  private pending: { cue: Cue; settings: Settings; isObsolete: () => boolean } | null = null;
  private speaking = false;
  private gesture = false;
  private current: Cue | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    private adapter: NarratorAdapter,
    private readonly onSubtitle: (cue: Cue | null) => void,
    private readonly setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = (fn, ms) => setTimeout(fn, ms),
  ) {}

  setAdapter(a: NarratorAdapter): void { this.cancel(); this.adapter = a; }
  /** Audio is permitted only after a real user gesture. */
  markGesture(): void { this.gesture = true; }
  newRun(): void { this.spokenCategories.clear(); this.cancel(); }

  /** `isObsolete` is checked again at speak time; an obsolete cue is dropped silently. */
  request(cue: Cue, settings: Settings, isObsolete: () => boolean = () => false): 'shown' | 'voiced' | 'skipped' {
    if (this.disposed) return 'skipped';
    if (cue.category && this.spokenCategories.has(cue.category)) return 'skipped';
    if (cue.category) this.spokenCategories.add(cue.category);
    const wantAudio = settings.narration === 'browser' && this.gesture && this.adapter.audible && this.adapter.isAvailable();
    if (settings.subtitles) this.show(cue, estimateMs(cue.text, settings.narrationSpeed));
    if (!wantAudio) return settings.subtitles ? 'shown' : 'skipped';
    this.pending = { cue, settings, isObsolete };
    this.pump();
    return 'voiced';
  }

  /** Speak the pending cue if nothing is speaking. The cue's own obsolescence check runs at speak time. */
  private pump(): void {
    if (this.speaking || !this.pending) return;
    const { cue, settings, isObsolete } = this.pending;
    this.pending = null;
    if (isObsolete()) return;
    this.speaking = true;
    this.adapter.speak(cue.text, { rate: settings.narrationSpeed, volume: settings.volume, voiceURI: settings.voiceURI }, () => {
      this.speaking = false;
      this.pump();
    });
  }

  private show(cue: Cue, ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.current = cue;
    this.onSubtitle(cue);
    this.timer = this.setTimer(() => { this.current = null; this.onSubtitle(null); this.timer = null; }, ms);
  }

  dismissSubtitle(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null; this.current = null; this.onSubtitle(null);
  }
  currentCue(): Cue | null { return this.current; }

  cancel(): void {
    this.pending = null;
    this.speaking = false;
    this.adapter.cancel();
    this.dismissSubtitle();
  }
  dispose(): void { this.cancel(); this.disposed = true; }
}

export function estimateMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).length;
  return Math.min(14000, Math.max(3500, Math.round((words / 2.4) * 1000 / Math.max(0.5, rate))));
}

/* --------------------------- asset manifest ------------------------------ */

export type AssetStatus = 'recorded' | 'browser-fallback' | 'subtitle-only';
export interface AssetEntry { cueId: string; chapterId: string; kind: 'intro' | 'success' | 'warning'; text: string; file: string | null; status: AssetStatus }

/** Every authored narration line and the honest status of its audio. `recordings` maps cueId -> file for licensed audio. */
export function narrationManifest(index: ContentIndex, recordings: Readonly<Record<string, string>> = {}, browserAvailable = false): AssetEntry[] {
  const out: AssetEntry[] = [];
  for (const ch of index.chaptersByOrder) {
    for (const kind of ['intro', 'success', 'warning'] as const) {
      const cueId = `${ch.id}:${kind}`;
      const file = recordings[cueId] ?? null;
      out.push({ cueId, chapterId: ch.id, kind, text: ch.narration[kind], file, status: file ? 'recorded' : browserAvailable ? 'browser-fallback' : 'subtitle-only' });
    }
  }
  return out;
}

export function cueFor(chapterId: string, kind: 'intro' | 'success' | 'warning', text: string, category?: string): Cue {
  return { id: `${chapterId}:${kind}`, kind, text, category };
}
