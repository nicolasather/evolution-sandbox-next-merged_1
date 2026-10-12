'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Settings } from '@/lib/civilization/lifelines/campaign';
import {
  BrowserSpeechNarrator, NarrationController, SilentNarrator, narrationManifest, cueFor, type Cue, type VoiceInfo,
} from '@/lib/civilization/lifelines/narration';
import type { Snapshot } from '@/lib/civilization/lifelines/store';

/** Wires domain events to subtitle/voice cues. Subtitles are always the complete experience. */
export function useNarration(snap: Snapshot, settings: Settings) {
  const [subtitle, setSubtitle] = useState<Cue | null>(null);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const browser = useMemo(() => new BrowserSpeechNarrator(), []);
  const ctl = useRef<NarrationController | null>(null);
  const settingsRef = useRef(settings);
  const snapRef = useRef(snap);
  useEffect(() => { settingsRef.current = settings; snapRef.current = snap; });

  useEffect(() => {
    const c = new NarrationController(settings.narration === 'browser' && browser.isAvailable() ? browser : new SilentNarrator(), setSubtitle);
    ctl.current = c;
    const refresh = () => setVoices(browser.voices());
    refresh();
    try { window.speechSynthesis?.addEventListener?.('voiceschanged', refresh); } catch { /* no speech */ }
    return () => { c.dispose(); ctl.current = null; try { window.speechSynthesis?.removeEventListener?.('voiceschanged', refresh); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browser]);

  useEffect(() => { ctl.current?.setAdapter(settings.narration === 'browser' && browser.isAvailable() ? browser : new SilentNarrator()); }, [settings.narration, browser]);

  const say = useCallback((cue: Cue, stillRelevant: () => boolean = () => true) => { ctl.current?.request(cue, settingsRef.current, stillRelevant); }, []);

  // Cues from the latest domain events.
  const { run, index, lastEvents } = snap;
  const lastKey = useRef('');
  useEffect(() => {
    if (!run || !index) return;
    const chapter = index.chapters.get(run.chapterId);
    if (!chapter) return;
    const key = `${run.runId}:${run.revision}`;
    if (lastKey.current === key) return;
    const firstOfRun = !lastKey.current.startsWith(run.runId);
    lastKey.current = key;
    if (firstOfRun) { ctl.current?.newRun(); say(cueFor(chapter.id, 'intro', chapter.narration.intro, `intro:${run.runId}`)); }
    for (const e of lastEvents) {
      if (e.type === 'chapter-completed') say(cueFor(chapter.id, 'success', chapter.narration.success, `success:${run.runId}`));
      if (e.type === 'pressure-new') {
        const rid = e.resource;
        const text = chapter.focus === rid ? chapter.narration.warning : `${rid.charAt(0).toUpperCase()}${rid.slice(1)} needs attention. Open the forecast to see why.`;
        say(cueFor(chapter.id, 'warning', text, `warning:${rid}`), () => !!snapRef.current.run?.report?.warnings.some(w => w.resource === rid));
      }
    }
  }, [run, index, lastEvents, say]);

  const manifest = useMemo(() => (index ? narrationManifest(index, {}, browser.isAvailable()) : []), [index, browser]);
  return {
    subtitle,
    dismiss: () => ctl.current?.dismissSubtitle(),
    gesture: () => ctl.current?.markGesture(),
    cancel: () => ctl.current?.cancel(),
    voices,
    audioReady: browser.isAvailable() && voices.length > 0,
    assetSummary: manifest.length
      ? `No recorded narration is included. ${manifest.length} authored lines are shown as subtitles${browser.isAvailable() ? '; a voice on this device can read them aloud.' : '.'}`
      : '',
  };
}
