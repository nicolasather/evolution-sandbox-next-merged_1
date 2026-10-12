# Civilization: Lifelines

Extra Mode `civilization` (stable id unchanged). Build root: `merged/`.

## Where things are
- Content database: `data/civilization/lifelines.v1.json` (contentVersion 1.0.0). Authoring source: `tools/build_lifelines_content.py` (`npm run data:lifelines`, output byte-identical).
- Loader: `lib/civilization/lifelines/content.ts` lazily `import()`s the JSON, validates and freezes it; the chunk is not fetched until the mode opens.
- Engine (pure, deterministic, fixed-point milli-units): `engine.ts`, `network.ts` (max-flow per service), `layout.ts`, `rules.ts`, `selectors.ts`.
- Persistence: `save.ts`, `store.ts` (Web Lock single writer, conflict handling, memory-only fallback), `campaign.ts`, `rewards.ts`, `hubSummary.ts`, `archiveRecords.ts`.
- Narration/questions: `narration.ts`, `questions.ts`, `public/audio/civilization/` (no recordings ship).
- UI: `components/civilization/CivilizationMode.tsx` (controller), `lifelines/*`, legacy mode kept in `LegacyCivilization.tsx`. Styles: `app/_lifelines.css` (scoped to `#lifelines-mode`).

## Saves
- Run `evo.civilization.lifelines.v2`, campaign `evo.civilization.lifelines.campaign.v2`. Legacy `evo.civilization.v1` is never written by Lifelines.
- Unreadable / future / other-content-version saves are kept (backup key) and never overwritten silently.
- Completion key `chapterId@lifelines-rules-1`, recorded once. No museum card is made: `VERIFIED_CHAPTER_EXHIBITS` is intentionally empty.

## Known limits (honest)
- No recorded narration; optional browser voice only. Voice "female-style" is only a name hint.
- Balance beyond the three scripted policy bots is untested with real players.
- Verified in headless Chromium (desktop, 390px, reduced motion), not on real devices or screen readers.
- Production build was verified with Google Fonts mocked (sandbox has no access to fonts.googleapis.com).
