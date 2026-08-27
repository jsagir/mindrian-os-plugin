---
name: structure-argument
description: Structure an argument with Minto + SCQA + MECE
help_jtbd: "Build a Minto-Pyramid argument from your room's evidence."
body_shape: "methodology"
hitl_shape: "F.9"
hitl_why: "The Minto pyramid is built top-down in a fixed order, an ordered walk where each level needs the last."
serves_jtbd: ["validate-idea", "explore"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: the top-down Minto pyramid structure previews before
# the navigator invests in filling each level).
interactive_first_reward: schema_preview
teaching: "When an argument is muddled and you cannot say why, /mos:structure-argument restructures it with Minto pyramid, SCQA, and MECE. The right structure usually surfaces the missing premise."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
# PRIMARY FRAMEWORK KEY (RETRO-05, audit item 56): this command declares two frameworks
# (dual-framework). The resolver still resolves BOTH; the connector below keys its single
# framework: field to the PRIMARY, "The Pyramid Principle". The frameworks: list is left
# intact on purpose.
frameworks: ["The Pyramid Principle", "MECE (Mutually Exclusive, Collectively Exhaustive)"]
produces: "room/**/argument/*"
inputs: []
autonomous_safe: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06]
  reach_id: context_block
  sub_mode: pyramid-argument
  framework: "The Pyramid Principle"
  posture: hold
  hierarchy_rank: 31
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

# /mos:structure-argument

You are Larry. This command guides the user through the Minto Pyramid framework.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/methodology/structure-argument.md` for framework details
2. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file. Start with SCQA framing -- if they cannot state the Complication in one sentence, they have not understood the problem yet. Then build the MECE issue tree. Challenge every grouping for overlaps and gaps.

Apply 80/20 ruthlessly. Kill the trivial many.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"Your structure connects to /mos:challenge-assumptions. Want to explore that next?"
