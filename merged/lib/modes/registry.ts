import type { ModeDefinition } from './types';

/** The full conceptual roster from the design brief. Only `main-evolution` is
 *  `available` — every other entry is real architecture (a stable id, a
 *  planned save key) with nothing behind it yet. components/ModeHub.tsx
 *  only ever renders a card for an `available` mode; it must never turn
 *  this list into a grid of locked/"coming soon" placeholders. */
export const MODES: ModeDefinition[] = [
  {
    id: 'main-evolution',
    title: 'Main Evolution',
    subtitle: 'The Timeline',
    description: 'Combine raw materials into 918 discoveries, in the order humanity actually reached them.',
    status: 'available',
    saveKey: 'evo.sandbox.v1',
  },
  {
    id: 'survival',
    title: 'Survival',
    subtitle: 'Adapt',
    description: 'Keep a small prehistoric group alive in a procedurally generated landscape.',
    status: 'available',
    saveKey: 'evo.survival.v1',
  },
  {
    id: 'civilization',
    title: 'Civilization',
    subtitle: 'Build',
    description: 'Grow a settlement whose own success creates the next problem it has to solve.',
    status: 'available',
    saveKey: 'evo.civilization.v1',
  },
  {
    id: 'archaeology',
    title: 'Archaeologist',
    subtitle: 'Recover',
    description: 'Excavate a site, document context, and justify an interpretation from incomplete evidence.',
    status: 'available',
    saveKey: 'evo.archaeology.v1',
  },
  {
    id: 'escape-room',
    title: 'Historical Escape Room',
    subtitle: 'Enter the Past',
    description: 'Reason through how a historical mechanism actually worked to open the next space.',
    status: 'available',
    saveKey: 'evo.escaperoom.v1',
  },
  {
    id: 'decipher',
    title: 'Decipher',
    subtitle: 'Read the Lost',
    description: 'Reconstruct meaning in a procedurally generated, never-seen-before writing system from evidence alone.',
    status: 'available',
    saveKey: 'evo.decipher.v1',
  },
  {
    id: 'alien-archaeology',
    title: 'Alien Archaeology',
    subtitle: 'Unknown Worlds',
    description: 'Reconstruct an extinct nonhuman civilization from ruins whose builders, biology and purpose start out unknown.',
    status: 'available',
    saveKey: 'evo.alienarchaeology.v1',
  },
  {
    id: 'reverse-evolution',
    title: 'Reverse Evolution',
    subtitle: 'From Smartphone to Stone',
    description: 'Start from a complex object and descend through its dependencies to the raw materials behind it.',
    status: 'available',
    saveKey: 'evo.reverseevolution.v1',
  },
  {
    id: 'minimum-path',
    title: 'Minimum Path',
    subtitle: 'Shortest Route',
    description: 'Reach a target discovery from a starting one in as few connected steps as possible.',
    status: 'in-development',
    saveKey: 'evo.minimumpath.v1',
  },
];

export function getMode(id: string): ModeDefinition | undefined {
  return MODES.find(m => m.id === id);
}

export function availableModes(): ModeDefinition[] {
  return MODES.filter(m => m.status === 'available');
}
