# Mode compatibility and AI content contracts

Code: `lib/modeAdapters/` · tests: `lib/modeAdapters/__tests__/modeAdapters.test.ts`.

A mode never needs editing when an item is added: each mode has an **adapter** declaring `eligibility(item)`,
`validatePacket(raw)`, `simulatePacket(packet)` and `fallbackPacket(seed)`. `resolvePacket()` uses a generated
packet only if it validates **and** simulates as solvable; otherwise the deterministic fallback; otherwise
nothing (the mode keeps its own content). It never throws.

| Mode | Policy | Packet | Solvability proof |
|---|---|---|---|
| Main Evolution | opt-in | `{itemIds[1..24]}` | every id exists and is eligible (non-placeholder, has a canonical route) |
| Reverse Evolution | opt-in | `{targetId}` | `generateRun()` succeeds (target has a recipe to decompose) |
| Minimum Path | opt-in | `{start,target}` | BFS over the prerequisite graph finds a path of 2–12 hops |
| Survival | **excluded** | – | builds camps from its own authored traits, terrain and members; no catalogue-item entry point |
| Archaeologist | **excluded** | – | draws finds from its own authored artifact vocabulary on purpose (never the discovery graph) |
| Civilization (Lifelines) | **excluded** | – | authored districts and its own simulator |
| Decipher | **excluded** | – | invented writing systems on purpose; real items would spoil / mislead |
| Alien Archaeology | **excluded** | – | fictional civilizations must not be seeded with human items |
| Historical Escape Room | **excluded** | – | each room is a hand-verified authored episode |

Failure matrix (tested for all 9 modes): no AI · `undefined` · string · array · wrong `schemaVersion` · unknown ids ·
oversized · hostile extra fields · a validator that throws → a defined, safe outcome (fallback or `none`).
Schema-valid output is still a **draft**: nothing here publishes anything.

**Not done in Phase 1:** no mode calls a model; packets are produced only by the deterministic fallbacks or supplied
by a test. Wiring a live generator is Phase 2 and needs your approval.

## What the real modes actually call (verified)

- `lib/modeAdapters/runtime.ts` → `adapterGate()` and `generatedPackets()`. Called by **Minimum Path** (`lib/minpath/daily.ts`,
  `variantChallenge.ts`) and **Reverse Evolution** (`lib/reverseevolution/catalog.ts`). **Main Evolution** receives pipeline
  items natively through the database. Survival and Archaeologist were first listed as opt-in, but neither has any entry point for
  catalogue items, so they are now recorded as excluded instead of keeping an adapter nothing calls.
- Original items are never filtered: only items carrying `visualArchetype` (published by the pipeline) go through their mode's adapter.
- `data/verified/mode_packets.json` ships empty; with no packets every mode behaves byte-for-byte as before.
