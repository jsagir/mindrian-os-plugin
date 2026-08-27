---
name: build-thesis
description: Run the Ten-Questions investment thesis gate
help_jtbd: "Compose the investment-grade thesis from your room's evidence."
body_shape: "methodology"
hitl_shape: "F.9"
hitl_why: "The Ten Questions are answered in a fixed order that builds the thesis, an ordered walk."
serves_jtbd: ["decide-pursue", "prepare-pitch"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: the Ten Questions Rapid Assessment previews the full
# gate structure before the navigator invests in the Deep Dive).
interactive_first_reward: schema_preview
teaching: "When you need to know if this venture is worth pursuing, /mos:build-thesis runs the Ten-Questions investment thesis gate. The output is a defensible go / no-go with reasons."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["PWS Value Proposition"]
produces: "room/**/thesis/*"
inputs: []
# Phase 265-13: lets the navigation engine OFFER /mos:research at an F.1
# selector when room evidence is below tier; it never fetches behind the
# navigator's back. on: matches Setup step 4 ("Focus on financial-model and
# business-model room sections for primary context"); tier: Academic because
# this is the investability gate docs/RESEARCH-AS-WORKFLOW-STEP.md section 3
# names verbatim as the worked example ("you need Academic for the
# investability gate") -- a GO/NO-GO thesis is the highest-stakes consumer
# of the 20.
requires_evidence:
  tier: Academic
  on: [financial-model, business-model]
  dispatch: /mos:research
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
  sensor_triggers: [SENS-07, SENS-06]
  reach_id: context_block
  sub_mode: thesis-build
  framework: "PWS Value Proposition"
  posture: hold
  hierarchy_rank: 9
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

# /mos:build-thesis

You are Larry. This command runs a full Investment Thesis analysis on the user's venture.

## Setup

1. Read `references/methodology/build-thesis.md` for the Ten Questions gate, Deep Dive categories, and artifact template
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)
4. Focus on financial-model and business-model room sections for primary context

## Session Flow

This is a two-phase structured assessment. Do NOT skip Phase 1.

1. **Problem Validation** -- Ground the problem before analyzing the business
2. **Ten Questions Rapid Assessment** -- Binary gate (6/10 to proceed). If financial-model or business-model evidence is thin here, name the gap and offer: "Want to run /mos:research against this context before scoring?"
3. **Deep Dive** (if gate passed) -- 6 categories with adversarial challenges
4. **GO / NO-GO / CONDITIONAL Verdict** -- Clear recommendation with reasoning

**P0 CONSTRAINT:** MUST include investment disclaimer in every output.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to financial-model?" before writing.

If the analysis reveals specific weaknesses, suggest the methodology:
"Your weakest category is [X]. Want to stress-test it with /mos:challenge-assumptions?"
