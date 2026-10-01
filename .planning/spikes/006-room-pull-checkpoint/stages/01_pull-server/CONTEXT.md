# Stage 01: pull server

Last updated: 2026-10-02

## Inputs
| Source | File/Location | Scope | Why |
| :--- | :--- | :--- | :--- |
| Room (Layer 4, read only) | `$ROOM_DIR/.mindrian/room.db` via `lib/core/navigation.cjs` | nodes, edges | the only truth |
| Plugin chokepoint (Layer 3) | `lib/core/navigation.cjs` `openRoomDbReadOnlyForCaller` | mode=ro handle | no second door |

## Process
1. Answer `/pull/{nodes,edges}?cp=` with documents changed since the checkpoint (`PULL_MODE`: journal default, ts, settle).
2. Watch `.mindrian/room.db*` (fs.watch) plus a `PRAGMA data_version` poll; on change, push new rows on `/stream` (SSE).
3. Refuse every non-GET with 405.

## Outputs
| Artifact | Location | Format |
| :--- | :--- | :--- |
| HTTP + SSE endpoints | `127.0.0.1:$PULL_PORT` (3871) | JSON, text/event-stream |
| Event log (optional) | `$PULL_LOG` | JSONL |
