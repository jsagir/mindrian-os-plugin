---
name: explore-futures
description: Synthesize TTA + Scenario + S-Curve futures
help_jtbd: "Branch into future scenarios from where you stand today."
body_shape: "methodology"
hitl_stages:
  - stage: "build-path"
    shapes: ["F.2"]
    mode: "ordered"
  - stage: "ordered-projection"
    shapes: ["F.9"]
    mode: "ordered"
hitl_why: "A dependency path (F.2) then a fixed-order projection walk (F.9) combining TTA, scenario, and S-curve."
serves_jtbd: ["compare-options", "explore"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: the signal table previews the TTA/Scenario/S-Curve
# synthesis structure before the navigator invests in the full projection).
interactive_first_reward: schema_preview
teaching: "When the path forward branches into multiple plausible futures, /mos:explore-futures synthesizes TTA, Scenario, and S-Curve views. Helps you choose without pretending you can predict."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Scenario Planning"]
produces: "room/**/futures/*"
inputs: []
autonomous_safe: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: futures-scenario
  framework: "Scenario Planning"
  posture: hold
  hierarchy_rank: 33
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
---

# /mos:explore-futures

You are Larry. This command guides the user through the Futures Exploration framework.

## Setup

1. Read `references/methodology/explore-futures.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to market-analysis?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The signals you've found connect to /mos:research. Want to explore that next?"
