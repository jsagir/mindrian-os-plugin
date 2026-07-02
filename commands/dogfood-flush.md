---
visibility: admin
description: Drain the dog-food queue into the mindrian room and regenerate ## Live (auto)
help_jtbd: "Manually flush captured plugin edits into the mindrian dataroom."
body_shape: E
hitl_shape: "F.0"
hitl_why: "It offers one dogfood-flush action to approve or defer."
argument-hint: ""
serves_jtbd: ["audit-room"]
teaching: "When you want the plugin's own venture room to reflect your latest edits immediately, /mos:dogfood-flush drains the PostToolUse queue and regenerates the Live (auto) section in STATE.md. The automatic SessionStart drain handles the steady-state case."
disable-model-invocation: false
allowed-tools: Bash(node *)
kind: utility
frameworks: []
produces: "~/MindrianRooms/mindrian/STATE.md"
inputs: []
autonomous_safe: true
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Lifecycle command. A dog-fooding maintenance flush the maintainer runs deliberately; an internal upkeep action with no navigator problem-state trigger."
---

# /mos:dogfood-flush

Force-drain the dog-food queue (`~/.mindrian/dogfood-queue.jsonl`) into
`~/MindrianRooms/mindrian/room.db` via the Phase 109 navigation chokepoint,
then regenerate the `## Live (auto)` sentinel-bounded section in
`~/MindrianRooms/mindrian/STATE.md` atomically with the human-authored body
byte-preserved.

This is the manual knob the user reaches for when the automatic SessionStart
drain has not run recently -- explicit redraw, drain everything pending right now.

## Behavior

Two-step pipeline:

1. `scripts/dogfood-emit.cjs` -- drain the queue file, batch-emit `file_changed`
   memory_event rows via `lib/core/navigation.cjs::logMemoryEvent`. Truncate
   the queue on success (atomic .tmp + rename).
2. `scripts/dogfood-derive.cjs` -- read the last 10 file_changed events,
   regenerate the `<!-- LIVE_AUTO_START -->` / `<!-- LIVE_AUTO_END -->` block
   in STATE.md. Log a `feynman_timeline_refreshed` memory_event on success.

## Output

F.0 Action Report:

- **emitted:** N events flushed from the queue.
- **derived:** STATE.md `## Live (auto)` regenerated at `<iso-timestamp>`.
- **skipped:** if the target room is missing, both phases soft-warn and exit 0
  without crashing the parent.

## Invariants

- **Canon Part 8 (Graph Boundary):** zero Brain egress. The grep sweep in
  `tests/test-dogfood-emit-derive.cjs` is the structural enforcement.
- **Canon Part 9 (Memory Locality):** every memory_event write goes through
  `navigation.cjs`. The Phase 109-06 pre-commit hook is the structural
  enforcement (any direct `require('lib/core/room-db.cjs')` from
  `dogfood-emit.cjs` / `dogfood-derive.cjs` would fail the hook).
- **Byte-preservation (Phase 124-02 invariant, reused):** everything in
  STATE.md outside the sentinel pair has its SHA256 preserved across
  regeneration (Case A). The integration test
  (`tests/test-dogfood-emit-derive.cjs`) asserts this.

## Implementation

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/dogfood-emit.cjs
node ${CLAUDE_PLUGIN_ROOT}/scripts/dogfood-derive.cjs
```

## Examples

```
/mos:dogfood-flush
```

## Exit codes

| Exit | Meaning |
| --- | --- |
| 0 | Success (including soft-fail paths: room.db missing, empty queue, no STATE.md) |

## Cross-surface adaptation

- **CLI:** full power. Slash command resolves via Claude Code's plugin hook
  substrate and runs the two scripts through the Bash tool. F.0 report
  renders in the terminal.
- **Desktop:** the same slash command runs when the plugin is connected.
  Larry may narrate the result conversationally; the underlying scripts
  are identical.
- **Cowork:** same as CLI. Team members see the regenerated STATE.md
  `## Live (auto)` block through the shared `~/MindrianRooms/mindrian/`
  snapshot on their next session-start.

No surface-specific code exists anywhere in either script.
