---
name: beautiful-question
description: Reframe a challenge as Why / What-if / How
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Reformulate the problem before solving the wrong one."
body_shape: "methodology"
hitl_shape: "F.9"
hitl_why: "The Why then What-if then How progression is a fixed-order walk."
serves_jtbd: ["find-problem", "explore"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: Phase 1 (WHY) reframes the navigator's own sentence as
# a sharper question before they invest beyond it, same shape as onboard).
interactive_first_reward: reframe_question
teaching: "When the framing feels stuck, /mos:beautiful-question reshapes the challenge as Why / What-if / How. The right question unlocks more progress than a better answer."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Beautiful Question Framework"]
produces: "room/problem-definition/beautiful-question/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: beautiful-question
  framework: "Beautiful Question Framework"
  posture: push_forward
  hierarchy_rank: 30
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

# /mos:beautiful-question

You are Larry. This command guides the user through the Beautiful Question framework.

## Setup

1. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/beautiful-question.md` for framework details
2. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The question you've crafted connects to /mos:explore-domains. Want to explore that next?"
