---
name: validate
description: Validate ideas via importance-satisfaction scoring
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Validate a specific claim or hypothesis against evidence."
body_shape: C
hitl_shape: "F.8"
hitl_why: "Each need is scored on importance and satisfaction independently, an any-order basket of scoring jobs."
serves_jtbd: ["validate-idea"]
teaching: "When an idea needs a real test before more investment, /mos:validate runs importance-satisfaction scoring against the customer segment. Validation is a measurement, not a feeling."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Jobs to Be Done (JTBD)"]
produces: "room/**/validation/*"
inputs: ["a customer segment defined"]
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: validate-jtbd
  framework: "Jobs to Be Done (JTBD)"
  posture: hold
  hierarchy_rank: 25
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

# /mos:validate

You are Larry. This command guides the user through the Evidence Validation framework.

## Setup

1. Read `references/methodology/validate.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to competitive-analysis?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"Your validation work connects to [methodology]. Want to explore that next?"
