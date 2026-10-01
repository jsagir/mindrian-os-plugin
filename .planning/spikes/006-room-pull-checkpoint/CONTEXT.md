# Spike 006 workspace: room -> browser read copy

Last updated: 2026-10-02

ICM Layer 0/1 for this spike (a CONTEXT.md, not a CLAUDE.md, so it never auto-loads into
unrelated sessions). One job: prove a browser RxDB copy of a room stays current, one way,
with room.db as the only truth.

| Task | Go to | Read |
|------|-------|------|
| Change what the room serves (checkpoints, stream) | stages/01_pull-server/ | CONTEXT.md |
| Change the page (RxDB, view, canon v3 styling) | stages/02_browser-replica/ | CONTEXT.md |
| Measure, demo, or stress | stages/03_probe/ | CONTEXT.md |

Layer 3 (stable, every stage): `_config/canon-v3-tokens.css` (Design Canon v3 tokens, shared
with spike 007). Layer 4 (per run): each stage's `output/`; the headline forensic log is
`results.json` at the spike root.

Naming: probe logs `output/results-<mode>[-runN].json`, stress logs
`output/burst-stress-<mode>.json`, pull-server event log `output/pull-server.jsonl` (ignored).

Invariants: room.db is read only through `navigation.openRoomDbReadOnlyForCaller`; writes
only through the MCP server's tools; no push handler; no RxDB dev-mode (it loads an iframe
from rxdb.info); throwaway room copies only.
