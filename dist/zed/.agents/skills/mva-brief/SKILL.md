---
name: mva-brief
description: Run the 30-second MVA pipeline for the user's current venture sentence
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Build a Minimum Viable Argument brief from your room."
body_shape: E
hitl_shape: "F.1"
hitl_why: "The 30-second brief closes with a numbered option or free-text choice, the canonical F.1 Next Move."
argument-hint: (no args -- reads pending state from UserPromptSubmit detection)
serves_jtbd: ["explore"]
teaching: "When you have just typed a venture sentence and want a brief in under a minute, /mos:mva-brief runs the 6-agent fan-out and deploys a shareable deck. The reward-before-investment surface of Phase 118."
allowed-tools: Bash, AskUserQuestion
interactive_first_reward: instant_brief
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: deep_research
  sub_mode: mva-brief
  framework: null
  posture: push_forward
  hierarchy_rank: 10
  filing: none
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

# /mos:mva-brief

Run the 30-second MVA pipeline against the pending venture sentence detected by
the UserPromptSubmit hook (Plan 118-00).

## What this does

1. Reads pending state from `~/.mindrian/mva/<session-id>.json` (written by
   Plan 118-00 detection hook).
2. Fires 6 parallel agents (Brain similar + Brain cross-domain + Brain classic
   traps + Tavily funding + Six-hats red/black + Dashboard graph) under the
   45-second hard budget.
3. Streams agent results as they return -- each one rendered in Larry's
   GUIDED voice (per feedback_larry_pedagogical_guided_first.md).
4. Closes with the 3-option footer:
   - [1] Just tell me what's new (stay in "tell me" mode)
   - [2] Build a room around this (invest)
   - [3] Challenge me -- Devil's Advocate (go deeper cognitively)

## Instructions for the model

Invoke `node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/mva-run.cjs"` via Bash with no arguments. The script reads
the pending state file, runs the orchestrator, and writes the rendered output
to stdout.

Relay the stdout to the user VERBATIM. Do NOT:

- Add commentary or interpretation before the rendered output
- Re-summarize the agent findings ("So basically what this means is...")
- Skip the 3-option footer
- Autonomously pick option 1, 2, or 3 for the user
- Add Larry-voice framing ("Here's what I found for you...") -- the renderer
  already speaks in Larry's voice; double-voicing breaks the GUIDED tone

The 3-option footer IS the user's decision point. Wait for the user to type
1, 2, or 3 (or their own free-text), then route per the option behavior:

- 1: stay in JUST_TALK mode; keep brief in scrollback; user can ask follow-ups
- 2: invoke /mos:new-project (stub for v1.13.0; Phase 119 wires fully)
- 3: invoke /mos:challenge-assumptions against the brief

## Canon parts implemented

- Part 2 (team around navigator -- 6 agents as a parallel team)
- Part 8 (boundary -- agents send only generic handles to Brain / Tavily)
- Part 10 sub-claim 3 (room as receipt -- the brief IS the reward)
