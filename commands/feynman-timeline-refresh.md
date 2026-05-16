---
description: Refresh FEYNMAN.md ## Timeline (auto) section for one or all room sections
help_jtbd: "Refresh the human-readable Timeline section in FEYNMAN.md."
body_shape: E
argument-hint: "[--all | --section <slug>]"
serves_jtbd: ["validate-idea", "audit-room"]
teaching: "When a section's FEYNMAN.md timeline feels stale, /mos:feynman-timeline-refresh rebuilds the auto-section from the memory event log. Human-authored prose stays byte-preserved."
disable-model-invocation: false
allowed-tools: Bash(node *)
kind: utility
frameworks: []
produces: "room/*/FEYNMAN.md"
inputs: []
autonomous_safe: true
---

# /mos:feynman-timeline-refresh

Force-refresh the `## Timeline (auto)` sentinel-bounded section in each section's `FEYNMAN.md`. The renderer reads from `room.db` via the Phase 109 `navigation.cjs` chokepoint; the runner writes back atomically with the human-authored body byte-preserved. This is the manual knob the user reaches for when the automatic session-start cascade is not enough -- explicit redraw, ignore the watermark.

## Modes

- `/mos:feynman-timeline-refresh` -- refresh every section in the active room (default; equivalent to `--all`).
- `/mos:feynman-timeline-refresh --all` -- refresh every section in the active room.
- `/mos:feynman-timeline-refresh --section <slug>` -- refresh one section.

## Output

F.0 Action Report (Canon Part 3 UI Ruling System; same shape as `/mos:brain-derive`'s Shape E). Three summary rows + a PER SECTION breakdown + a NEXT action footer:

- Sections refreshed: N
- Sections skipped (watermark fresh): S
- Sections failed: F

When more than 3 target sections, per-section progress streams to stderr as each completes: `[1/7] market-analysis: refreshed`. The final report renders to stdout at the end.

## Graceful degradation

- **No active room**: exit 1 with "Set one with /mos:rooms switch <slug>".
- **Invalid section slug**: exit 1 with a pointer to the active room and a hint to list sections.
- **room.db missing**: single-line "room.db not found for active room; the runner needs the Phase 109 SQL spine" message, exit 0 (soft-fail; the timeline section is enrichment, not a gate).
- **Runner exception per section**: the failure is logged via `feynman_timeline_refresh_failed` memory_event; the per-section row in the report names the failure; other sections still process.

## Canon references

- **Canon Part 3 (Tri-Context Decision Gate)**: output uses the F.0 / Shape E Action Report so the user sees a LOCAL snapshot of what was refreshed.
- **Canon Part 7 (Reuse Before Build)**: the command wraps `lib/core/feynman/timeline-runner.cjs` (Plan 124-02). No new render logic at the command layer.
- **Canon Part 8 (Graph Boundary)**: zero net new Brain surface. The renderer reads ONLY `room.db` via `navigation.cjs`. The runner writes ONLY FEYNMAN.md inside the sentinels.
- **Canon Part 9 (Memory Locality)**: this is the Larry-explains face of `memory_event` -- the rendered timeline section IS the human-readable view of the SQL log.

## Invocation

Run the dispatcher via Bash:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/feynman-timeline-refresh-command.cjs $ARGUMENTS
```

## Examples

```
/mos:feynman-timeline-refresh
/mos:feynman-timeline-refresh --all
/mos:feynman-timeline-refresh --section market-analysis
```

## Exit codes

| Exit | Meaning |
| --- | --- |
| 0 | Success (including soft-fail paths: room.db missing, every section watermark-skipped) |
| 1 | Invocation error: no active room, invalid section slug, malformed args |

## Cross-surface adaptation

- **CLI**: full power. Slash command resolves via Claude Code's plugin hook substrate and runs the dispatcher through the Bash tool. F.0 report renders in the terminal.
- **Desktop**: the same slash command runs when the plugin is connected. Larry may narrate the result conversationally; the underlying dispatcher is identical.
- **Cowork**: same as CLI. Team members see the regenerated FEYNMAN.md `## Timeline (auto)` block through the shared `00_Context/` snapshot on their next session-start.

No surface-specific code exists anywhere in the dispatcher.
