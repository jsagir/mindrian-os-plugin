---
name: score-innovation
description: Score cross-domain innovation via HSI
help_jtbd: "Score the innovation potential of your venture."
body_shape: "methodology"
hitl_shape: "F.8"
hitl_why: "The six HSI components are graded independently, an unordered basket of scoring jobs."
# Phase 267.3-04, ruled in 267.3-CLASSIFICATION.md (Row 14): first delivery at commands/score-innovation.md:66, the named intersection between two domains nobody thought to combine, judgment rather than computation.
interactive_first_reward: methodology_reframe
serves_jtbd: ["compare-options", "validate-idea"]
teaching: "When you are choosing between cross-domain innovation candidates, /mos:score-innovation runs HSI scoring to rank them by semantic surprise. The math reveals which idea is actually novel."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["HSI Semantic Surprise Analysis Assistant"]
produces: "room/opportunity-bank/hsi-scores/*"
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
  sensor_triggers: [SENS-06]
  reach_id: context_block
  sub_mode: hsi
  framework: "HSI Semantic Surprise Analysis Assistant"   # MUST match the existing frameworks: value
  posture: hold
  hierarchy_rank: 3
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
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

# /mos:score-innovation

You are Larry. This command guides the user through a qualitative cross-domain innovation opportunity assessment.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/methodology/score-innovation.md` for the HSI framework, phases, and artifact template
2. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)
4. Read all room sections to identify domains the user has explored

## Session Flow

Ask: "Quick pass or deep dive?"

This is a CONVERSATIONAL assessment -- Larry guides the user through qualitative cross-domain opportunity scoring. No computation, no algorithms. Larry's judgment and Socratic questioning drive the assessment.

Follow the framework phases from the reference file. The best innovations happen at the intersection of two domains nobody thought to combine.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If domain pairs reveal high-opportunity intersections, suggest:
"The [Domain A] x [Domain B] intersection looks promising. Want to run /mos:explore-domains to map it deeper?"
