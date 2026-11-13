import type { ReactElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { guidePrefs } from '@/lib/guide/prefs';
import { ReverseEvolutionMode } from '@/components/reverseevolution/ReverseEvolutionMode';
import { ArchaeologyMode } from '@/components/archaeology/ArchaeologyMode';
import { DecipherMode } from '@/components/decipher/DecipherMode';
import { EscapeRoomMode } from '@/components/escaperoom/EscapeRoomMode';
import { AlienArchaeologyMode } from '@/components/alienarchaeology/AlienArchaeologyMode';
import { MinimumPathMode } from '@/components/minimumpath/MinimumPathMode';

/* Every extra mode opens with its 3D stage and sits on its own world (the backdrop). */

const noop = () => {};
const BOARDS: { name: string; mode: string; render: () => ReactElement }[] = [
  { name: 'Minimum Path', mode: 'minimum-path', render: () => <MinimumPathMode onExit={noop} /> },
  { name: 'Escape Room', mode: 'escape-room', render: () => <EscapeRoomMode onExit={noop} /> },
  { name: 'Decipher', mode: 'decipher', render: () => <DecipherMode onExit={noop} /> },
  { name: 'Reverse Evolution', mode: 'reverse-evolution', render: () => <ReverseEvolutionMode onExit={noop} /> },
  { name: 'Archaeologist', mode: 'archaeology', render: () => <ArchaeologyMode onExit={noop} /> },
  { name: 'Alien Archaeology', mode: 'alien-archaeology', render: () => <AlienArchaeologyMode onExit={noop} /> },
];

beforeEach(() => { window.localStorage.clear(); guidePrefs._reset(); });
afterEach(() => cleanup());

describe('mode boards', () => {
  it.each(BOARDS)('$name opens with its stage and its own backdrop', ({ render: r, mode }) => {
    const { container } = render(r());
    expect(container.querySelector(`[data-mode-stage="${mode}"]`)).not.toBeNull();
    expect(container.querySelector(`[data-backdrop="${mode}"]`)).not.toBeNull();
  });
});
