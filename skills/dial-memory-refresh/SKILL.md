---
name: dial-memory-refresh
description: Refresh the Dial Memory (auto) section in each room section's memory MD
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
compatibility: Requires Claude Code (or a host implementing disable-model-invocation semantics); Tier-1 hook mechanics referenced in this skill.
help_jtbd: "Refresh the human-readable Dial Memory section rendered from the graph."
body_shape: E
hitl_shape: "F.0"
hitl_why: "It offers a single refresh action to approve or defer."
argument-hint: "[--all | --section <slug>]"
serves_jtbd: ["validate-idea", "audit-room"]
teaching: "When a section's Dial Memory feels stale, /mos:dial-memory-refresh rebuilds the auto-section from the SELECTED_REACH / PIVOTED / DRSCH relationship layer. Human-authored prose stays byte-preserved."
disable-model-invocation: false
allowed-tools: Bash(node *), AskUserQuestion
kind: utility
frameworks: []
produces: "room/*/FEYNMAN.md"
inputs: []
autonomous_safe: true
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: dial-refresh
  framework: "Reverse Salient Analysis"
  posture: hold
  hierarchy_rank: 22
  filing: memory_event_only
  plan_gated: false
  web_scope: null
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:dial-memory-refresh

Force-refresh the `## Dial Memory (auto)` sentinel-bounded section in each section's memory MD. The renderer reads the dial relationship layer (`SELECTED_REACH` / `PIVOTED` / `DRSCH` evidence edges) from `room.db` via the Phase 109 `navigation.cjs` chokepoint; the runner (a thin shim over the Phase 124 timeline-runner) writes back atomically with the human-authored body byte-preserved. This is the manual knob the user reaches for when the automatic session-start cascade is not enough.

## Modes

- `/mos:dial-memory-refresh` -- refresh every section in the active room (default; equivalent to `--all`).
- `/mos:dial-memory-refresh --all` -- refresh every section in the active room.
- `/mos:dial-memory-refresh --section <slug>` -- refresh one section.

## Output

F.0 Action Report (Canon Part 3 UI Ruling System; same shape as `/mos:feynman-timeline-refresh`). Three summary rows + a PER SECTION breakdown + a NEXT action footer:

- Sections refreshed: N
- Sections skipped: S
- Sections failed: F

## The 4 rendered components (MEMDIAL-02)

The Dial Memory section is rendered FROM the graph (MEMDIAL-03; the graph is the source of truth) and carries all four components on every refresh:

1. Available reaches -- the 6 canonical reach ids (the Phase 141 doctrine; Phase 148 D-09 raised 5 -> 6 with the hats reach).
2. Last selected -- the most-recent `SELECTED_REACH` edge.
3. Current recommended -- the frozen 0.70-gate result.
4. Recent research conclusions -- surfaced from the `DRSCH` research-conclusion evidence edges; a clean placeholder when none exist.

## Graceful degradation

- **No active room**: exit 1 with "Set one with /mos:rooms switch <slug>".
- **room.db missing**: single-line message, exit 0 (soft-fail; the dial-memory section is enrichment, not a gate).
- **Runner exception per section**: the failure is logged via `dial_memory_refresh_failed` memory_event; the per-section row names the failure; other sections still process.

## Canon references

- **Canon Part 7 (Reuse Before Build)**: the runner is a THIN SHIM over `lib/core/feynman/timeline-runner.cjs` (Phase 124). No new atomic-write logic at the runner or command layer.
- **Canon Part 8 (Graph Boundary)**: zero net-new Brain surface. The renderer reads ONLY `room.db` via `navigation.cjs`. The runner writes ONLY inside the dial sentinels.
- **Canon Part 9 (Memory Locality)**: this is the Larry-explains face of the dial relationship layer -- the rendered section IS the human-readable view of the SQL graph.

## Invocation

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/dial-memory-refresh-command.cjs $ARGUMENTS
```

## Examples

```
/mos:dial-memory-refresh
/mos:dial-memory-refresh --all
/mos:dial-memory-refresh --section problem-definition
```

## Exit codes

| Exit | Meaning |
| --- | --- |
| 0 | Success (including soft-fail paths: room.db missing) |
| 1 | Invocation error: no active room |

## Cross-surface adaptation

- **CLI**: full power. The slash command runs the dispatcher through the Bash tool. F.0 report renders in the terminal.
- **Desktop**: the same slash command runs when the plugin is connected. Larry may narrate the result conversationally; the dispatcher is identical.
- **Cowork**: same as CLI. Team members see the regenerated `## Dial Memory (auto)` block through the shared `00_Context/` snapshot on their next session-start.

No surface-specific code exists anywhere in the dispatcher.
