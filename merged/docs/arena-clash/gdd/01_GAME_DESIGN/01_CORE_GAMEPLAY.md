# Arena Clash — full gameplay specification

## Core game loop
**Quiz phase (freeze) → planning window → movement/capture objective play → result → quiz again → upgrades → end-of-match podium.** Objective state stays server owned. Class game is 2–4 teams (1–5 per team) of students on separate phones or laptops. Short objective episodes 75–180 seconds depending question length; quiz breaks for all five question formats. All modes have skill choices but quiz performance remains meaningful.

## Match win condition
Team standings weighted by (a) correct-answer normalized team contribution and (b) objective completion. Default 60% quiz / 40% arena. Teacher may choose Study (75/25), Balanced (60/40), Game (50/50); never less than 50% quiz. Objective scores always normalized to cap snowball. Each match includes explicit legible point totals and labels.

## Formats
- **Control Circuit**: three colored zones, two active each round, rotate on a visible telegraph. Occupancy captures after 4 seconds uncontested. Defenders can interrupt; no fighting; if two opposing teams present, progress stops. Own a zone for 2 seconds to trigger a capped score pulse once per cycle.
- **Banner Relay**: neutral banner spawns at a central place; touching picks it up, movement slows to 0.85x, safe handoffs inside the team; pass through three checkpoints; hand-in scores capped objective points. Dropped on leave/disconnect and auto-resets after 8 sec to avoid blocking.
- **Crystal Dash**: collect glowing tokens on fair deterministic mirrors of the map, carry up to 3, deposit at team vaults; higher-risk crystals appear at middle lane but no direct stun or attacks.

## Match phases
Lobby, tutorial, question_open, reveal, tactical_choice, arena_live, episode_result, finished, paused. Never transition based solely on a client's clock. Teacher control and host offline freeze are server authoritative.

## Presentation
One coherent storybook gameboard with cute toy-like player pieces and clear objective markings, no human/animal faces. At 50% viewport, objectives, current round, team point wallet and next question cue must be legible.
