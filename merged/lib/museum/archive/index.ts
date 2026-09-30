import { alienExhibit } from '../../alienarchaeology/memory';
import { alienArchaeologyStore } from '../../alienarchaeology/store';
import { siteExhibit } from '../../archaeology/memory';
import { archaeologyStore } from '../../archaeology/store';
import { dioramaExhibit } from '../../civilization/memory';
import { civilizationStore } from '../../civilization/store';
import { decipherExhibit } from '../../decipher/memory';
import { decipherStore } from '../../decipher/store';
import { episodeExhibit } from '../../escaperoom/memory';
import { getEpisode } from '../../escaperoom/registry';
import { escapeRoomStore } from '../../escaperoom/store';
import { playDb } from '../../processing';
import { reverseExhibit } from '../../reverseevolution/memory';
import { reverseEvolutionStore } from '../../reverseevolution/store';
import { memoryExhibit } from '../../survival/memory';
import { survivalStore } from '../../survival/store';
import type { MuseumExhibit } from '../types';

/* ============================================================================
   MODE ARCHIVES — records the player's activities in the extra modes
   produced: expedition records, preserved settlements, excavation reports,
   translated tablets, escape-room episode records, alien field reports and
   reverse-evolution dependency maps.

   These are the PLAYER'S records. They are never humanity-history exhibits
   and never share a collection with them: the Museum shows them in their own
   wing (components/museum/ModeArchiveWing.tsx). Each keeps the provenance
   label its mode already gives it (lib/museum/types.ts) — almost always
   'procedural-fictional', tied to a seed.
   ========================================================================== */

/** A record in the Mode Archive. The shared shape predates this split and is kept as-is. */
export type ModeArchiveRecord = MuseumExhibit;

export interface ArchiveSection {
  id: string;
  mode: string;
  /** Wing section label, e.g. "Expedition Records". */
  label: string;
  /** What this kind of record is, one line. */
  blurb: string;
  /** The mode's established accent colour. */
  accent: string;
  records: ModeArchiveRecord[];
}

/** Every section of the Mode Archive, in a fixed order; empty sections included (the UI decides). */
export function archiveSections(): ArchiveSection[] {
  return [
    { id: 'survival', mode: 'survival', label: 'Expedition Records', blurb: 'What your Survival runs endured — and what they left behind.', accent: '#d9a256', records: survivalStore.get().memories.map(memoryExhibit) },
    { id: 'civilization', mode: 'civilization', label: 'Preserved Settlements', blurb: 'Dioramas of the settlements your Civilization runs grew.', accent: '#4f8f6f', records: civilizationStore.get().dioramas.map(dioramaExhibit) },
    { id: 'archaeology', mode: 'archaeology', label: 'Excavation Reports', blurb: 'Filed reports from your Archaeologist digs.', accent: '#b8743a', records: archaeologyStore.get().reports.map(siteExhibit) },
    { id: 'decipher', mode: 'decipher', label: 'Translated Tablets', blurb: 'Tablet sets your Decipher runs read.', accent: '#5a7cc0', records: decipherStore.get().memories.map(decipherExhibit) },
    { id: 'escape-room', mode: 'escape-room', label: 'Episode Records', blurb: 'Historical Escape Room episodes you completed.', accent: '#c0603a', records: escapeRoomStore.get().memories.map(m => episodeExhibit(m, getEpisode(m.episodeId)?.title ?? 'Unknown episode')) },
    { id: 'alien-archaeology', mode: 'alien-archaeology', label: 'Alien Field Reports', blurb: 'Field reports from your Alien Archaeology sites.', accent: '#3fa6a0', records: alienArchaeologyStore.get().reports.map(alienExhibit) },
    { id: 'reverse-evolution', mode: 'reverse-evolution', label: 'Dependency Maps', blurb: 'Discoveries your Reverse Evolution runs traced back to their origins.', accent: '#2f9d7b', records: reverseEvolutionStore.get().runs.map(m => reverseExhibit(m, playDb.nodes.find(n => n.id === m.targetId)?.n ?? m.targetId)) },
  ];
}

/** Subscribe to every mode store the archive reads. */
export const ARCHIVE_STORES = [
  survivalStore, civilizationStore, archaeologyStore, decipherStore,
  escapeRoomStore, alienArchaeologyStore, reverseEvolutionStore,
] as const;
