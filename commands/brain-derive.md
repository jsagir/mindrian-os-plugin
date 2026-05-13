---
description: Derive BRAIN.md for section(s) now
argument-hint: "[section] [--all] [--cross-room] [--dry-run]"
serves_jtbd: ["audit-room"]
teaching: "When a room section drifts from its BRAIN.md derivation, /mos:brain-derive rebuilds the per-section Brain context now. Run after large filings or before a decision gate."
disable-model-invocation: false
allowed-tools: Bash(node *)
---

# /mos:brain-derive

Force-refresh BRAIN.md per section via the Brain derivation pipeline. This is the manual knob users reach for when the automatic triggers (hash-change queue drain, session-start staleness scan) are not enough because they want to inspect explicitly, or the room has no recent regeneration activity.

## Modes

- `/mos:brain-derive <section>` -- derive one section
- `/mos:brain-derive --all` -- derive every active section in the current room
- `/mos:brain-derive <section> --cross-room` -- add structural cross-room contradiction scan for that one section
- `/mos:brain-derive --all --cross-room` -- most expensive; cross-room scan on every section
- Append `--dry-run` to any mode above to preview targets + cost without firing any Brain calls or writing BRAIN.md

## Output

Shape E Action Report (Canon Part 3 UI Ruling System; same structure as `/mos:diagnostics` from Phase 88.6 Plan 02). Five summary rows plus a PER SECTION breakdown plus a NEXT action footer:

- Sections derived: N / M
- Schema gates: passed X / failed Y
- Cross-room: Z contradictions surfaced / scanned rooms
- Brain offline: A sections skipped (rate-limited flag if applicable)
- Cost tokens: ~T

When there are more than 3 target sections, per-section progress streams to stderr as each completes: `[1/7] market-analysis: derived`. The final Shape E report renders to stdout at the end.

## Graceful degradation

- **Brain offline from start**: single-line "Brain offline, no derivation possible" message, zero derivations, exit 0 (soft-fail). The user has not done anything wrong; BRAIN.md is enrichment, not a gate.
- **Rate-limited mid-batch**: the first rate_limited result stops further Brain calls. Every remaining section is recorded as skipped with reason rate_limited. The rendered report carries the flag and the NEXT footer suggests retrying in a few minutes.
- **Schema gate rejection on one section**: other sections still derive. The failed section appears in the PER SECTION block with the schema violation summary. The command does NOT attempt to force-write a schema-invalid BRAIN.md.
- **Invalid section name**: exit 1 with a pointer to the active room and a hint to list sections.
- **No active room**: exit 1 with "Set one with /mos:rooms switch <slug>".

## Canon references

- **Canon Part 3 (Tri-Context Decision Gate)**: output uses the Shape E Action Report body shape so the user sees a LOCAL + BRAIN snapshot of what was derived this run.
- **Canon Part 7 (Reuse Before Build)**: the command wraps the existing `deriveSection` entry point (Plan 90-01) and the cross-room aggregator (Plan 90-06). No new derivation logic is introduced at the command layer.
- **Canon Part 8 (Graph Boundary)**: the command adds zero net new Brain surface. Every Brain call still routes through `deriveSection` which has its chokepoint (`buildBrainQueryContext`), the prompt-builder allow-list schema, the invariants body scan, and the cross-room sanitize + JSON.stringify audit. The dispatcher only sequences those calls and renders results.

## Invocation

Run the dispatcher via Bash:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/brain-derive-command.cjs $ARGUMENTS
```

## Examples

```
/mos:brain-derive market-analysis
/mos:brain-derive --all
/mos:brain-derive --all --cross-room
/mos:brain-derive market-analysis --dry-run
/mos:brain-derive --all --cross-room --dry-run
```

## Exit codes

| Exit | Meaning |
| --- | --- |
| 0 | Success (including Brain-offline soft-fail and all partial-completion paths) |
| 1 | Invocation error: no active room, invalid section name, or missing arguments |

## Cross-surface adaptation

- **CLI**: full power. Slash command resolves via Claude Code's plugin hook substrate and runs the dispatcher through the Bash tool. Shape E report renders in the terminal.
- **Desktop**: the same slash command runs when the plugin is connected. Larry may narrate the result conversationally; the underlying dispatcher is identical.
- **Cowork**: same as CLI. Team members see the regenerated BRAIN.md through the shared `00_Context/` snapshot on their next session-start.

No surface-specific code exists anywhere in the dispatcher.
