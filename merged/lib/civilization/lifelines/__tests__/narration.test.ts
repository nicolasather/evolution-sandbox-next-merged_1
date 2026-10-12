import { DEFAULT_SETTINGS } from '../campaign';
import {
  BrowserSpeechNarrator, MockNarrator, NarrationController, SilentNarrator, estimateMs, narrationManifest, preferredVoice, voiceHint, cueFor, type Cue,
} from '../narration';
import { ix } from '../__testing__/helpers';

const withAudio = { ...DEFAULT_SETTINGS, narration: 'browser' as const };
const setup = () => {
  const mock = new MockNarrator(); const shown: (Cue | null)[] = [];
  const timers: (() => void)[] = [];
  const ctl = new NarrationController(mock, c => shown.push(c), fn => { timers.push(fn); return 0 as never; });
  return { mock, shown, ctl, timers };
};

describe('narration', () => {
  it('subtitles are shown without any audio, with no gesture required', () => {
    const { ctl, shown, mock } = setup();
    expect(ctl.request(cueFor('c', 'intro', 'Hello.'), DEFAULT_SETTINGS)).toBe('shown');
    expect(shown[0]?.text).toBe('Hello.'); expect(mock.spoken).toEqual([]);
  });
  it('audio waits for a user gesture and the player enabling it', () => {
    const { ctl, mock } = setup();
    expect(ctl.request(cueFor('c', 'intro', 'One.'), withAudio)).toBe('shown');
    expect(mock.spoken).toEqual([]);
    ctl.markGesture();
    expect(ctl.request(cueFor('c', 'success', 'Two.'), withAudio)).toBe('voiced');
    expect(mock.spoken).toEqual(['Two.']);
  });
  it('each pressure category is voiced once per run; a new run resets', () => {
    const { ctl, mock } = setup(); ctl.markGesture();
    ctl.request(cueFor('c', 'warning', 'Water.', 'warning:water'), withAudio); mock.finish();
    expect(ctl.request(cueFor('c', 'warning', 'Water again.', 'warning:water'), withAudio)).toBe('skipped');
    ctl.newRun();
    expect(ctl.request(cueFor('c', 'warning', 'Water.', 'warning:water'), withAudio)).toBe('voiced');
  });
  it('obsolete cues are dropped and leaving cancels everything', () => {
    const { ctl, mock } = setup(); ctl.markGesture();
    ctl.request(cueFor('c', 'intro', 'First.'), withAudio);
    ctl.request(cueFor('c', 'warning', 'Stale.', 'warning:food'), withAudio, () => true);
    mock.finish();
    expect(mock.spoken).toEqual(['First.']);
    ctl.cancel(); expect(mock.cancels).toBeGreaterThan(0);
    ctl.dispose();
    expect(ctl.request(cueFor('c', 'intro', 'After.'), withAudio)).toBe('skipped');
  });
  it('subtitles can be turned off and dismissed', () => {
    const { ctl, shown } = setup();
    expect(ctl.request(cueFor('c', 'intro', 'Quiet.'), { ...DEFAULT_SETTINGS, subtitles: false })).toBe('skipped');
    expect(shown).toEqual([]);
    ctl.request(cueFor('c', 'intro', 'Shown.'), DEFAULT_SETTINGS); ctl.dismissSubtitle();
    expect(shown[shown.length - 1]).toBeNull();
  });
  it('silent narrator is complete and instant; browser narrator degrades when speech is missing', () => {
    const cb = jest.fn(); new SilentNarrator().speak('x', { rate: 1, volume: 1, voiceURI: null }, cb); expect(cb).toHaveBeenCalled();
    const none = new BrowserSpeechNarrator(null, null); expect(none.isAvailable()).toBe(false); expect(none.voices()).toEqual([]);
    const done = jest.fn(); none.speak('x', { rate: 1, volume: 1, voiceURI: null }, done); expect(done).toHaveBeenCalled();
  });
  it('browser narrator speaks through the injected synthesiser', () => {
    const spoken: Record<string, unknown>[] = [];
    const synth = { speak: (u: unknown) => spoken.push(u as Record<string, unknown>), cancel: jest.fn(), getVoices: () => [{ voiceURI: 'v1', name: 'Aria', lang: 'en-US' }] };
    const n = new BrowserSpeechNarrator(synth, t => ({ text: t }));
    n.speak('Hi', { rate: 0.9, volume: 0.5, voiceURI: 'v1' }, () => undefined);
    expect(spoken[0]).toMatchObject({ text: 'Hi', rate: 0.9, volume: 0.5 });
    n.cancel(); expect(synth.cancel).toHaveBeenCalled();
  });
  it('voice labels are honest: a name hint is only a hint; no voice is invented', () => {
    expect(preferredVoice([])).toBeNull();
    const voices = [{ uri: 'a', name: 'Daniel', lang: 'en-GB' }, { uri: 'b', name: 'Microsoft Zira', lang: 'en-US' }];
    expect(preferredVoice(voices)?.uri).toBe('b');
    expect(voiceHint(voices[0])).toBeNull(); expect(voiceHint(voices[1])).toBe('name-suggests-female-style');
    expect(preferredVoice([{ uri: 'z', name: 'Hans', lang: 'de-DE' }])).toBeNull();
  });
  it('asset manifest never claims a recording that does not exist', () => {
    const none = narrationManifest(ix);
    expect(none).toHaveLength(72);
    expect(none.every(e => e.status === 'subtitle-only' && e.file === null)).toBe(true);
    expect(narrationManifest(ix, {}, true).every(e => e.status === 'browser-fallback')).toBe(true);
    const rec = narrationManifest(ix, { 'first-light:intro': 'x.mp3' });
    expect(rec.find(e => e.cueId === 'first-light:intro')).toMatchObject({ status: 'recorded', file: 'x.mp3' });
  });
  it('subtitle time scales with length and speed', () => {
    expect(estimateMs('a b c', 1)).toBe(3500);
    expect(estimateMs(Array(60).fill('w').join(' '), 1)).toBeGreaterThan(estimateMs(Array(20).fill('w').join(' '), 1));
  });
});
