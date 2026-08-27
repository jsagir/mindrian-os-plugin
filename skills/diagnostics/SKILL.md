---
name: diagnostics
description: "[Renaming to /mos:fingerprint v1.14.0] Run Wave-1 algorithmic fingerprint on the room"
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Run the 4 Wave-1 algorithms (Disruption Index, Blindspot, Novelty, Surprise). Renaming to /mos:fingerprint in v1.14.0."
body_shape: E
hitl_shape: "F.1"
hitl_why: "Diagnostics offers one next move on what to inspect."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 6): first delivery at commands/diagnostics.md:62, a one-screen scalar dashboard of four computed room metrics, a status roster rather than a reasoned reframe.
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["audit-room"]
renaming_to: fingerprint
renaming_target_version: "v1.14.0"
teaching: "When you need a quantitative read on the room, /mos:diagnostics runs the Wave-1 fingerprint: disruption, blindspot, novelty, surprise. Renaming to /mos:fingerprint in v1.14.0 (functional behavior unchanged)."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["HSI Semantic Surprise Analysis Assistant"]
produces: "room/**/diagnostics/*"
inputs: []
autonomous_safe: true
ui_reference: skills/ui-system/SKILL.md
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: wave1-fingerprint
  framework: "HSI Semantic Surprise Analysis Assistant"   # MUST match the existing frameworks: value
  posture: hold
  hierarchy_rank: 7
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
allowed-tools: Bash Read AskUserQuestion
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

# /mos:diagnostics

> Renamed. /mos:diagnostics is being renamed to /mos:fingerprint in v1.14.0 to kill the diagnose/diagnostics naming ambiguity. Both invocations work in v1.13.x; use /mos:fingerprint going forward.

You are Larry. The user invoked /mos:diagnostics. Per Phase 121.5-08 Sub-plan J (LOCKED 2026-05-16) /mos:diagnostics is being RENAMED to /mos:fingerprint in v1.14.0. The functional behavior is unchanged from v1.13.0-beta.x: the 4 Wave-1 algorithms continue to run via scripts/diagnostics-command.cjs. Only the name is migrating; a future v1.14.0 plan will create commands/fingerprint.md and turn this file into a soft-alias stub matching the heal/query/organize pattern.

Emit the rename note above to the user as a single cyan line (Larry voice; no em-dash; one sentence per skills/ui-system/SKILL.md Section 6) BEFORE running the diagnostics behavior below.

## The diagnostics behavior (unchanged from v1.13.0-beta.x)

This command runs four Wave-1 algorithms against the active room's embedded artifact corpus and renders a one-screen scalar dashboard: disruption (Funk and Owen-Smith CD), coverage (Good-Turing blindspot mass), element novelty (centroid distance), and Bayesian surprise (leave-one-out cosine shift). Body shape is **Shape E (Action Report) always** -- four metric rows, one intelligence strip, one action footer.

## When to run

At a checkpoint, before a demo, or when you need a one-screen read of whether the room is consolidating or disrupting, well-covered or under-explored, diverse or clustered, surprising or confirming. Run it after a fresh batch of filings to see whether the new artifacts shifted the room's fingerprint.

## Voice rules (LOCKED)

- Conversational, direct, no filler. Signature openers from larry-personality: "Very simply...", "Here's the thing...", "One thing I've learned..."
- NO emoji, NO "I'd be happy to help", NO "Great question", NO sentences starting with I
- Symbol vocabulary: only the 12 approved glyphs from skills/ui-system/SKILL.md (`filled-square`, `down-triangle`, `right-triangle-filled`, `right-triangle-empty`, `branch`, `last-branch`, `check`, `bullet`, `warning`, `lightning`, `empty-square`, `arrow`)
- Error pattern: 3 lines only -- What / Why: reason / Fix: /mos:command

## Pre-flight: Room Check

Resolve the active room using the shared helper:

```bash
bash ${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/resolve-room
```

If no Data Room is found, show the 3-line error and STOP:

    x No Data Room found
      Why: .mindrian/ missing in the current or parent directories
      Fix: /mos:new-project

If the room exists but `.mindrian/whitespace-embeddings.json` is absent, show the 3-line error and STOP:

    x No whitespace embeddings
      Why: Diagnostics requires an embedded artifact corpus at .mindrian/whitespace-embeddings.json
      Fix: /mos:whitespace map

## Step 1: Run Pipeline

Invoke the dispatcher:

```bash
node ${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/diagnostics-command.cjs ROOM_DIR
```

The dispatcher runs four Python scripts in sequence:

- `compute-disruption-index.py` (Funk and Owen-Smith 2017 CD index)
- `compute-blindspot-mass.py` (Good-Turing coverage estimation)
- `compute-element-novelty.py` (centroid-distance novelty)
- `compute-bayesian-surprise.py` (leave-one-out cosine shift)

Each emits a JSON file in `.mindrian/`. The dispatcher reads the metadata scalars and composes the Shape E report.

## Step 2: Render 4-Zone Output

### Zone 1: Header Panel

One line naming the room and the panel:

    -- [Room Name] -- Diagnostics -- Wave-1 Algorithmic Fingerprint --

### Zone 2: Content Body (Shape E Action Report)

A 4-row metric table. The dispatcher produces the table verbatim; pass it through.

Example from mindrianOS room (2026-04-23 smoke test):

```
  Metric                Value         Interpretation
  ------------------------------------------------------------------------
  Disruption (CD)       -0.7092, room is consolidating, not disrupting
  Coverage              0.667, partial coverage, 33 pct uncovered
  Element Novelty       0.083 mean, low diversity, artifacts cluster tightly
  Bayesian Surprise     max 0.312, moderate surprise in recent additions
```

### Zone 3: Intelligence Strip (conditional, max 3 signals)

Threshold rules evaluated by the dispatcher:

- `warning` CD below -0.3 -- Strong consolidation signal
- `empty-square` Coverage below 0.4 -- Low coverage, X pct of problem space unmapped
- `warning` Novelty mean below 0.1 -- Low diversity, artifacts cluster tightly
- `lightning` Surprise max above 0.5 -- Recent additions carry high information gain

Only triggered signals render. A healthy room may show zero signals.

### Zone 4: Action Footer (never omit)

Three arrow-prefixed follow-ups:

    -> /mos:whitespace map                Inspect zones behind these scalars
    -> /mos:whitespace discover           Run full Discovery Cycle
    -> /mos:find-bottlenecks              Drill into reverse salients

## Interpretation Guide

| Metric | Range | What It Means |
|--------|-------|---------------|
| Disruption (CD) | -1.0 (pure consolidation) to +1.0 (pure disruption) | Funk and Owen-Smith 2017. Negative means the room's new ideas build on prior art (consolidating); positive means they displace prior art (disrupting). |
| Coverage | 0.0 (nothing mapped) to 1.0 (fully mapped) | Good-Turing estimator. Fraction of the problem space covered by at least one artifact. 1 - coverage = fraction of the space that is unmapped blindspot. |
| Element Novelty | 0.0 (identical clones) to 1.0 (maximally diverse) | Mean centroid-distance across artifacts. Low mean -> artifacts cluster tightly; high mean -> diverse perspectives. |
| Bayesian Surprise | 0.0 (confirms prior) to ~1.0 (total break) | Leave-one-out cosine shift. Max across artifacts indicates the most information-dense recent addition. |

## Error Handling

Three-line pattern. Specific failures:

1. Python not installed:

        x Python runtime not found
          Why: python3 not on PATH, cannot run Wave-1 scripts
          Fix: install Python 3.10+ and re-run /mos:diagnostics

2. No whitespace embeddings (pre-flight already catches this):

        x No whitespace embeddings
          Why: Diagnostics requires an embedded artifact corpus at .mindrian/whitespace-embeddings.json
          Fix: /mos:whitespace map

3. Partial results (one or more scripts failed but the dispatcher continued):

    The dispatcher prints a yellow `Partial results:` block listing each metric that failed, with the script error message or the missing-field diagnostic. The rest of the Shape E report renders normally; the failed row shows `no signal` instead of a scalar.

## Cross-Surface Adaptation

- **CLI** -- Full power. Scripts invoked via Bash. 80-column terminal output. The Shape E table is rendered with the 12-glyph vocabulary.
- **Desktop** -- Larry narrates conversationally in prose. Example: "Very simply, the room is consolidating (CD = -0.71), two-thirds mapped (coverage 0.667), low diversity (novelty 0.083), moderate recent surprise (max 0.312)." Numbers shown as markdown bullets, no tree chars per ui-system Section 9.
- **Cowork** -- Same as CLI. The four metrics are shared via `00_Context/` for team visibility. The intelligence strip becomes a shared "room health" snapshot.

## Canon References

- **Canon Part 2 Engine 1:** Act 1 intelligence surface. These four scalars complete the Wave-1 quantitative layer that feeds Engine 2 (BONO Orchestration). Whitespace Map + Reverse Salient + Cross-Domain Match sit alongside them in Engine 1.
- **Canon Part 7 Reuse Before Build:** /mos:diagnostics is net-new surface because the four Wave-1 scalars answer a question orthogonal to /mos:grade (qualitative stage rubric) and /mos:status (pipeline progression). Folding four numerical diagnostics into either would dilute both surfaces.
- **Canon Part 8 Graph Boundary:** All four algorithms operate LOCAL-only on the room's embedding corpus. No user data egress to Brain. Zero Brain query sites in scripts/diagnostics-command.cjs -- verified by inspection.
