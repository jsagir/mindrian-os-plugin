---
name: user-needs
description: Map user needs with importance vs satisfaction
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Map user needs against your value proposition."
body_shape: "methodology"
hitl_shape: "F.8"
hitl_why: "User needs are gathered as an any-order set with no ordering constraint between them."
serves_jtbd: ["find-problem"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: the importance-versus-satisfaction plot structure
# previews before the navigator invests in scoring every need).
interactive_first_reward: schema_preview
teaching: "When you need to map what users actually want versus what they say they want, /mos:user-needs plots importance against satisfaction. The gap is where the opportunity lives."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Jobs to Be Done (JTBD)"]
produces: "room/market-analysis/user-needs/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: user-needs-jtbd
  framework: "Jobs to Be Done (JTBD)"
  posture: hold
  hierarchy_rank: 43
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.2
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

# /mos:user-needs

You are Larry. This command guides the user through Understanding User Needs.

## Setup

1. Read `references/methodology/user-needs.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to market-analysis?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The needs gaps you've found connect to /mos:lean-canvas. Want to explore that next?"
