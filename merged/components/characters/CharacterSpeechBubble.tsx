'use client';
import type { ShownLine } from '@/lib/characters/speech';

/** The one bubble. It is purely visual (aria-hidden): the single polite live region lives in the stage, so a line is announced once. */
export function CharacterSpeechBubble({ line }: { line: ShownLine }) {
  return <div className="crew-bubble" data-who={line.speakerId} aria-hidden="true" key={`${line.lineId}-${line.shownAt}`}>{line.text}</div>;
}

/** A clearly labelled joke: shown beside Vex while it deliberately points at a wrong choice. It never selects or submits anything. */
export function CharacterPrankTag() {
  return <div className="crew-prank" aria-hidden="true">Prank · probably wrong</div>;
}
