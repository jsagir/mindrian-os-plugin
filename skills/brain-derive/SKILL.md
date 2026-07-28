---
name: brain-derive
description: Derive BRAIN.md for section(s) now
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
compatibility: Requires Claude Code (or a host implementing disable-model-invocation semantics); Tier-1 hook mechanics referenced in this skill.
help_jtbd: "Pull the Brain's framework recommendations for your current section."
body_shape: E
hitl_shape: "F.0"
hitl_why: "It surfaces one derived Brain packet for a single APPROVE, REJECT, or DEFER."
argument-hint: "[section] [--all] [--cross-room] [--dry-run] [--review-anchors] [--orphan-census] [--cross-label-dups]"
serves_jtbd: ["audit-room"]
teaching: "When a room section drifts from its BRAIN.md derivation, /mos:brain-derive rebuilds the per-section Brain context now. Run after large filings or before a decision gate."
disable-model-invocation: false
allowed-tools: Bash(node *), AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Lifecycle / maintenance command. Regenerates the BRAIN.md per-folder derivation; a maintenance refresh run deliberately or by the staleness scan. INV-06 promotion candidate (a future mindrian-operation counterpart could make derivation contextually triggered), excluded for now."
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

# /mos:brain-derive

Force-refresh BRAIN.md per section via the Brain derivation pipeline. This is the manual knob users reach for when the automatic triggers (hash-change queue drain, session-start staleness scan) are not enough because they want to inspect explicitly, or the room has no recent regeneration activity.

## Modes

- `/mos:brain-derive <section>` -- derive one section
- `/mos:brain-derive --all` -- derive every active section in the current room
- `/mos:brain-derive <section> --cross-room` -- add structural cross-room contradiction scan for that one section
- `/mos:brain-derive --all --cross-room` -- most expensive; cross-room scan on every section
- Append `--dry-run` to any mode above to preview targets + cost without firing any Brain calls or writing BRAIN.md

## Curation surfaces (Phase 130.7-03)

Three standalone reporting modes that pair with the dual-graph health gate so curation debt becomes visible within days, not months. Each runs a read-only methodology-node aggregate (the 2026-05-17 brain-curation audit queries) and prints a digest. They are REPORTING surfaces that feed Phase 132 dedup -- they never themselves dedup or fail a build, and they are mutually exclusive with each other and with the derive path (each is standalone, like `--all`).

- `/mos:brain-derive --review-anchors` -- the REVIEW_REQUIRED queue digest (audit Q1): the count of frameworks stuck in curation review plus a sample list.
- `/mos:brain-derive --orphan-census` -- the all-label orphan census (audit section 7): a per-label table of zero-edge node counts plus the total orphan mass.
- `/mos:brain-derive --cross-label-dups` -- same-name-different-label collisions (audit section 13): groups of one canonical name carrying more than one distinct primary label, each listing its variant labels (keyed by correlation_id collisions across primary_label, feeding the Phase 132 dedup pass).

When the Brain is offline, each curation mode degrades to a single-line "Brain offline" message and exits 0 (soft-fail), exactly like the derive path.

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
node ${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/brain-derive-command.cjs $ARGUMENTS
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
