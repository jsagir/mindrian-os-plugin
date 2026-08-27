---
name: macro-trends
description: Map macro changes with PEST across a domain
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Identify the macro trends shaping your venture's window."
body_shape: "methodology"
hitl_shape: "F.8"
hitl_why: "The PEST factors are scanned independently, an unordered basket of trend jobs."
serves_jtbd: ["understand-market"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: naming the domain previews the PEST four-factor
# structure before the navigator invests in the full scan).
interactive_first_reward: schema_preview
teaching: "When you need to map the forces shaping a domain, /mos:macro-trends runs PEST across Political, Economic, Social, and Technological dimensions. The wide-angle lens before you zoom in."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["PEST Analysis"]
produces: "room/**/trends/*"
inputs: []
# Phase 265-13: lets the navigation engine OFFER /mos:research at an F.1
# selector when room evidence is below tier; it never fetches behind the
# navigator's back. on: matches "Ask: File this to market-analysis?" below;
# tier: Operational because PEST's four factors are public-world facts
# typically sourced from industry/government reports, not requiring
# peer-reviewed Academic literature. PEST is already a curated-chain hub
# (-> Adoption-Capacity 0.7, -> Scenario Planning 0.6), so grounding it
# improves three downstream commands, not one.
requires_evidence:
  tier: Operational
  on: [market-analysis]
  dispatch: /mos:research
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: macro-pest
  framework: "PEST Analysis"
  posture: hold
  hierarchy_rank: 39
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

# /mos:macro-trends

You are Larry. This command guides the user through Macro-Changes Analysis.

## Setup

1. Read `references/methodology/macro-trends.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down. If market-analysis evidence for a PEST factor is thin, name the gap and offer: "Want to run /mos:research against this context before scoring it?"

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to market-analysis?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The destruction patterns you've found connect to /mos:research. Want to explore that next?"
