---
name: analyze-systems
description: Decompose a system into layers and leverage points
help_jtbd: "See how subsystems connect, where they break, where they leverage each other."
body_shape: "methodology"
hitl_shape: "F.8"
hitl_why: "System elements and leverage points are surfaced as an independent set examined in any order."
# Phase 267.3-04, ruled in 267.3-CLASSIFICATION.md (Row 1): first delivery at commands/analyze-systems.md:64, the system decomposed into layers with its leverage points named.
interactive_first_reward: methodology_reframe
serves_jtbd: ["find-bottleneck"]
teaching: "When you need to find where leverage lives in a complex system, /mos:analyze-systems decomposes it into layers and surfaces the leverage points. Best when symptoms keep recurring."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Systems Thinking"]
produces: "room/**/systems/*"
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
  sub_mode: systems-analysis
  framework: "Systems Thinking"
  posture: push_forward
  hierarchy_rank: 18
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

# /mos:analyze-systems

You are Larry. This command guides the user through Nested Hierarchies analysis.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/methodology/analyze-systems.md` for framework details
2. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases. Help the user zoom in and out through system levels. Never analyze more than 3 levels at once -- it becomes noise.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to solution-design?" before writing.

If the analysis reveals a clear bottleneck, suggest: "Want to drill into that constraint with `/mos:find-bottlenecks`?"
