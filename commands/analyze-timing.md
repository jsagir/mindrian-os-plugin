---
name: analyze-timing
description: Place a technology on the S-Curve timing clock
help_jtbd: "Find the timing window your venture sits inside."
body_shape: "methodology"
hitl_shape: "F.1"
hitl_why: "S-curve timing resolves to a single next-move read the navigator confirms."
serves_jtbd: ["understand-market"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: naming the technology surfaces the S-Curve position
# structure before the navigator invests in the full timing read).
interactive_first_reward: schema_preview
teaching: "When you need to know if your technology is too early, too late, or right on time, /mos:analyze-timing places it on the S-Curve. Best before you commit to a launch window."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["S-Curve Analysis", "Adoption-Capacity Theory"]
produces: "room/**/timing/*"
inputs: []
# Phase 265-13: lets the navigation engine OFFER /mos:research at an F.1
# selector when room evidence is below tier; it never fetches behind the
# navigator's back. on: matches "Ask: File this to market-analysis?" below;
# tier: Operational because S-Curve positioning is answered by industry
# maturity data (adoption curves, analyst benchmarks) once the navigator
# names the specific performance metric -- single-topic, textbook mid-flow
# offer per the online-research audit.
requires_evidence:
  tier: Operational
  on: [market-analysis]
  dispatch: /mos:research
autonomous_safe: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
# Phase 172-12 (INV-11 reconciliation): analyze-timing is the connector home for
# TWO reaches that land on the same command. The PRIMARY connector block declares
# the S-Curve direct path (SENS-06 -> context_block). The Adoption-Capacity (ACE)
# diffusion path is surfaced by SENS-09 (lib/core/sensors/sensor-diffusion-adoption.cjs),
# which fires the FROZEN brain_consult reach with dispatch 'adoption-capacity';
# the WFL-01 map (data/dispatch-framework-map.json) resolves that to
# "Adoption-Capacity Theory" -> /mos:analyze-timing via commandsForFramework.
# SENS-09 is therefore listed in sensor_triggers so the ACE surfacing is
# first-class in the frontmatter (NO 7th reach minted; brain_consult is frozen).
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06, SENS-09]
  reach_id: context_block
  sub_mode: timing-scurve
  framework: "S-Curve Analysis"
  posture: push_forward
  hierarchy_rank: 27
  filing: fileEvidenceWithReadback
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

# /mos:analyze-timing

You are Larry. This command guides the user through S-Curve Analysis.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/methodology/analyze-timing.md` for framework details
2. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file. Start by identifying the specific technology and its performance metric. Do not accept "AI" or "blockchain" -- demand specificity. Once the metric is named, if market-analysis evidence for its maturity curve is thin, name the gap and offer: "Want to run /mos:research against this context before placing it?"

Timing is not luck. It is reading the S-Curve correctly. The graveyard of innovation is filled with companies right about the tech and wrong about the timing.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to market-analysis?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The timing analysis connects to /mos:research. Want to explore that next?"
