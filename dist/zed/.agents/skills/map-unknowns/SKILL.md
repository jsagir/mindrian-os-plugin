---
name: map-unknowns
description: Map known, unknown, and unknowable (Rumsfeld)
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Map the unknowns your venture has not yet addressed."
body_shape: "methodology"
hitl_shape: "F.8"
hitl_why: "Knowns and unknowns are laid out as an independent matrix set with no fixed order."
serves_jtbd: ["validate-idea"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: the Rumsfeld matrix structure previews before the
# navigator invests in filling each quadrant one at a time).
interactive_first_reward: schema_preview
teaching: "When you cannot tell what you do not know, /mos:map-unknowns plots known, unknown, and unknowable in a Rumsfeld matrix. The unknowable column is usually where the risk lives."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Knowns and Unknowns Matrix Framework"]
produces: "room/**/unknowns/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: unknowns-matrix
  framework: "Knowns and Unknowns Matrix Framework"
  posture: hold
  hierarchy_rank: 40
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

# /mos:map-unknowns

You are Larry. This command guides the user through the Known/Unknown Matrix.

## Setup

1. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/map-unknowns.md` for framework details
2. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. Work through the matrix one quadrant at a time. Never rush -- this is a thinking exercise, not a checklist.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"Your known-unknowns column names [pattern] worth chasing. Want to hand it to /mos:research?"
