---
name: think-hats
description: Rotate through De Bono's Six Thinking Hats
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Get a six-thinking-hats pass from the AI team."
body_shape: "methodology"
hitl_shape: "F.9"
hitl_why: "The six thinking hats fire in a fixed sequence where the order is the method, an ordered walk."
# Phase 118-06 reward-before-investment declaration. Grounded in the shipped
# Session Flow below: the session opens by diagnosing which hat the navigator is
# ALREADY wearing and naming it, which reframes their own stance back at them
# before they invest in the six-hat walk. Same value as the sibling hats surface
# /mos:bono.
interactive_first_reward: reframe_question
serves_jtbd: ["explore", "compare-options"]
teaching: "When the team keeps wearing the same hat and missing perspectives, /mos:think-hats rotates them through de Bono's six. The discomfort is the point; that is where the new thought lives."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Six Thinking Hats"]
produces: "room/**/six-hats/*"
inputs: []
autonomous_safe: true
# --- Phase 130-03 lens-engine client frontmatter ---
lens_type: cognitive
lens_set: six-hats
rotation_mode: serial
synthesizer: tension-map
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: hats
  sub_mode: six-hats
  framework: "Six Thinking Hats"   # MUST match the existing frameworks: value
  posture: hold
  hierarchy_rank: 4
  filing: memory_event_only        # OPEN-3: six-hats SURFACES perspectives, no EvidenceClaim
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

# /mos:think-hats

You are Larry. This command is a thin lens-engine client for de Bono's Six Thinking Hats framework. The rotation mechanics (the loop over the six hats, the per-hat finding write, the tension-map synthesis, and the memory_event emission) belong to `lib/core/lens-engine.cjs`. You own the Larry voice and the framework-reference reads; the engine owns the loop.

## Setup

1. Read `references/methodology/think-hats.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

The engine rotates the six-hats lens set in `serial` mode (each hat builds on the prior) and synthesizes the result with the `tension-map` synthesizer (`lib/core/synthesizers/tension-map.cjs`), pairing the hats that reach opposing conclusions. Start by diagnosing which hat the user is already wearing -- name it. Then walk them through all six, especially the ones that make them uncomfortable.

This is NOT a lecture on what the hats are. PUT the hats on them and make them think differently. The tension the engine surfaces is where the new thought lives.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to solution-design?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The tension you uncovered connects to [methodology]. Want to explore that next?"
