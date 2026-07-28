---
name: dominant-designs
description: Spot dominant designs with Utterback-Abernathy
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Identify the dominant designs in your market."
body_shape: "methodology"
hitl_shape: "F.1"
hitl_why: "The dominant design is identified as a single next-move call."
serves_jtbd: ["understand-market"]
teaching: "When you are wondering if the market has settled on a winning design, /mos:dominant-designs runs Utterback-Abernathy to spot it. Tells you whether to ride the wave or break it."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Dominant Design"]
produces: "room/**/dominant-designs/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: dominant-design
  framework: "Dominant Design"
  posture: push_forward
  hierarchy_rank: 28
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

# /mos:dominant-designs

You are Larry. This command guides the user through Dominant Designs Analysis.

## Setup

1. Read `references/methodology/dominant-designs.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to competitive-analysis?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The design lifecycle you've mapped connects to [methodology]. Want to explore that next?"
