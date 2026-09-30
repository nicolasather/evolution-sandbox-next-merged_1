# The Museum — three separate kinds of knowledge

The Museum is one building with three wings. Each wing has its own data layer,
its own state, and its own look. They never share a collection.

| Wing | Answers | Data | State | UI |
|---|---|---|---|---|
| **Humanity Museum** | *What had humanity achieved by this point in history?* | `data/museum/*.json` (curated, reviewable) | `evo.museum.v1` — `lib/museum/history/store.ts` | `components/museum/HumanityHall.tsx`, `ExhibitFocus.tsx`, `WorldHistory.tsx` |
| **Your Own History** (Personal Discoveries) | *What have I personally discovered and built?* | derived from the Main Evolution save (`lib/museum/personal/`) | none of its own | `components/museum/PersonalWing.tsx` |
| **Records** (Mode Archives) | *What did my runs of the other modes produce?* | each mode's own store (`lib/museum/archive/`) | each mode's own store | `components/museum/ModeArchiveWing.tsx` |

## The one rule

**Humanity Museum availability is derived from the canonical timeline, never from
inventory.** `lib/museum/history/timeline.ts` turns the game's era progression into a
year (continuous, log-scale inside each era, mapped by `data/museum/calendar.json`).
An exhibit is *eligible* when `unlockAt ?? when.from <= year`. Crafting something
out of order moves that year only as much as any other discovery of the current era.

A player's own discovery may *annotate* a canonical exhibit ("your path reached this
earlier / around / later"), via `discoveryIds`, but it never replaces the exhibit and
never unlocks it.

## Per-exhibit state (four distinct flags)

`eligibleAt` (timeline passed it) · `revealedAt` (shown in the hall or a reveal) ·
`visitedAt` (the player focused it) · `detailOpenedAt` (the full account was read).
An exhibit can be eligible and unseen. First sync of a save is a silent baseline;
after that, newly opened galleries and newly available **defining** achievements are
queued for a one-time cinematic reveal on entering the Museum, and one restrained
in-game signal is emitted per sync.

## Adding or correcting history

1. Edit or add an entry in `data/museum/exhibits/NN-<gallery>.json` (a new file must be
   added to `EXHIBIT_FILES` in `lib/museum/history/data.ts`).
2. Required: `id`, `title`, `when` (`from`, optional `to`/`anchor`, `display`, `precision`,
   `basis`), `regions` (each with a `role`; use `independent` for independent inventions),
   `categories`, `importance`, `change`, `context`, `significance`, `relations`,
   `sources`, `display.motif`.
3. `sources.status` stays `source_required` until an id from `data/sources.json` really
   underwrites the entry. Never put a URL in exhibit content.
4. Record disagreement in `uncertainty` (`settled` / `approximate` / `debated` / `contested`).
5. Run `npx jest lib/museum` — `catalog.test.ts` checks every reference, date, region,
   source, motif and the story route.

No rendering code needs to change to add exhibits, regions, galleries or story chapters.
