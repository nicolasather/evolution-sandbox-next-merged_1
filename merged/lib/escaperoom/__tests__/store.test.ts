import { escapeRoomStore } from '@/lib/escaperoom/store';
import { BRONZE_WORKSHOP } from '@/lib/escaperoom/episodes/bronzeWorkshop';
import { applyAction, blankState } from '@/lib/escaperoom/simulate';
import { summarizeEpisode } from '@/lib/escaperoom/memory';

describe('escape room store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    escapeRoomStore.reset();
  });

  it('starts with no active episode and no memories', () => {
    expect(escapeRoomStore.get().activeState).toBeNull();
    expect(escapeRoomStore.get().memories).toEqual([]);
  });

  it('setActive persists the current episode state for resume', () => {
    const s = blankState(BRONZE_WORKSHOP);
    escapeRoomStore.setActive(s);
    expect(escapeRoomStore.get().activeState?.episodeId).toBe(BRONZE_WORKSHOP.id);
  });

  it('archiveActive clears the active episode and adds a memory', () => {
    let s = blankState(BRONZE_WORKSHOP);
    s = applyAction(BRONZE_WORKSHOP, s, { kind: 'submitRatio', puzzleId: 'ratio', value: 10 }).state;
    escapeRoomStore.setActive(s);
    escapeRoomStore.archiveActive(summarizeEpisode(BRONZE_WORKSHOP, s));
    expect(escapeRoomStore.get().activeState).toBeNull();
    expect(escapeRoomStore.get().memories).toHaveLength(1);
  });

  it('reloads across a simulated reload', () => {
    const s = blankState(BRONZE_WORKSHOP);
    escapeRoomStore.setActive(s);
    escapeRoomStore.load();
    expect(escapeRoomStore.get().activeState?.episodeId).toBe(BRONZE_WORKSHOP.id);
  });
});
