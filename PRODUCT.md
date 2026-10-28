# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Teachers and students (confirmed). Teachers run classroom sessions, often on a shared projector; students play on those shared screens or on their own devices. Individual-device multiplayer is explicitly out of scope for the Projector Games.

## Product Purpose
Two products in one Next.js app (`merged/`): **Evolution Sandbox**, an explorable discovery graph where players combine raw materials (stone, wood, bone, fibre) into 918 discoveries, each with a definition, an argument for why it mattered, how we know, and sources; and **Quiz Studio**, a classroom quiz platform with 10 "Projector Games" (Empire Race, Boss Battle, Escape Room, Treasure Vault, Risk Ladder, Auction House, Territory War, Lucky Factory, Pirate Voyage, Final Showdown). [Inferred from README.md and merged/README.md, not yet confirmed by the owner: success means learners engage with and retain the content, and teachers can run a session without friction.]

## Capabilities and Constraints
- English only (Vietnamese strings and locale toggle were removed from the Projector Games).
- Projector-safe views must redact hidden information (lot values, sealed bids, uncharted chests).
- `/quiz/lab` runs any game offline with 2-8 teams; the practice lab grants no rewards.
- Evolution Sandbox data is canonical in the sibling single-file project `evolution-sandbox/`; sources carry an honest "source required" flag where unverified.
- Statically rendered pages; Supabase backs real classroom sessions.

## Evidence on Hand
Real content lives in `data/` and `merged/` (README, CHANGELOG, docs). No testimonials, customer names or usage metrics were provided; do not fabricate them.

## Product Principles
- Honesty about knowledge: show sources, and flag what is unverified.
- Readable from the back of a classroom: projector views must work at distance.
- Every control explains itself (one-line reason why an action is enabled or disabled).
- Teachers stay in control of pacing; hidden information stays hidden on the shared screen.

## Open Decisions
- Success metrics and positioning beyond the above are not yet confirmed.
- Accessibility standard not yet specified.
