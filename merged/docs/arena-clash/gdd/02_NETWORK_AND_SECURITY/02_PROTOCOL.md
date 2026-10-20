# Protocol v1 proposed contract

Client packets: `hello` {token, protocol}, `move` {seq,x,y}, `ability` {actionId}, `vote` {actionId, upgradeId}, `answer` {submissionId, windowId, response}, `ready`, `host` {actionId, kind, args}, `ping`.

Server packets: `welcome` {roomId, role, team, serverMs, protocol}, `snap` {seq, serverMs, phase, publicView, entities}, `ack` {actionId, ok, errorCode}, `answerResult` (only to originating player), `reveal`, `pause`, `resync`, `bye`.

Strict max packet size 8KB for control, maybe 16KB for permitted answer form. Every packet validated with Zod including no unknown keys. Replay protection by action ID, input sequence strictly increasing per player. No direct client `position`, `capturePercent`, `correct`, `points`, `roleCooldown` writes.

Reconnect obtains full authoritative snapshot, not a pile of old deltas. Graceful worker shutdown checkpoints, sends bye and moves lease safely. All avatar/team data per viewer. Do not put teacher-only rubric, identities of private students or answer keys in public snapshots.
