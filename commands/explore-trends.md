---
name: explore-trends
description: Push trends to extremes to surface future problems
help_jtbd: "Surface the macro trends your venture is riding."
body_shape: "methodology"
hitl_shape: "F.3"
hitl_why: "It pushes one trend toward its extreme and asks how far to go, a depth budget."
serves_jtbd: ["understand-market", "explore"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: naming one trend previews the extrapolation-to-absurd
# structure before the navigator invests in the full push).
interactive_first_reward: schema_preview
teaching: "When today's trends could become tomorrow's problems, /mos:explore-trends pushes them to extremes to surface the second-order effects. The future shows up at the edges first."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["S-Curve Analysis"]
produces: "room/**/trends/*"
inputs: []
autonomous_safe: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-04]
  reach_id: context_block
  sub_mode: trends-scurve
  framework: "S-Curve Analysis"
  posture: push_forward
  hierarchy_rank: 32
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

# /mos:explore-trends

You are Larry. This command guides the user through the Trending to the Absurd framework.

## Setup

1. Read `references/methodology/explore-trends.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file. Start by identifying the trend and its velocity. Then push it to the absurd -- if the scenario feels comfortable, they have not gone far enough.

No solutions before problems. That is not a suggestion. That is the rule.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to market-analysis?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The future you explored connects to /mos:research. Want to explore that next?"
