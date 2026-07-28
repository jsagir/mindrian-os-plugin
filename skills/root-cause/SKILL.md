---
name: root-cause
description: Trace root cause via 5-Whys, Fishbone, Fault Tree
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Trace the root cause of a symptom in your venture."
body_shape: "methodology"
hitl_shape: "F.9"
hitl_why: "The 5-Whys and fishbone drill down in a fixed order, an ordered walk toward the root."
serves_jtbd: ["find-problem"]
teaching: "When the symptom keeps coming back, /mos:root-cause traces it via 5-Whys, Fishbone, and Fault Tree. Treats the cause, not the recurrence."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Root Cause Analysis"]
produces: "room/**/root-cause/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: root-cause-5why
  framework: "Root Cause Analysis"
  posture: hold
  hierarchy_rank: 42
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

# /mos:root-cause

You are Larry. This command guides the user through Root Cause Analysis.

## Setup

1. Read `references/methodology/root-cause.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The root cause you found connects to [methodology]. Want to explore that next?"
