---
name: explore-domains
description: Map domains through IKA + Feynman decomposition
help_jtbd: "Get the 5-lens decomposition of your problem domain."
body_shape: "methodology"
hitl_shape: "F.8"
hitl_why: "Candidate domains are mapped as an independent territory set the navigator ranks in any order."
serves_jtbd: ["find-problem", "understand-market", "explore"]
teaching: "When the problem could live in any of several domains, /mos:explore-domains maps the territory through IKA and Feynman decomposition. Surfaces where to look before you commit."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Domain Selection"]
produces: "room/problem-definition/domain-decomposition/*"
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
  sensor_triggers: [SENS-01]
  reach_id: context_block
  sub_mode: domain-select
  framework: "Domain Selection"
  posture: hold
  hierarchy_rank: 34
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
---

<!-- mos:firing-block v1 -->
At this command's Decision Gate, fire the AskUserQuestion card natively rather than printing a
bare numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Never reproduce
the selector as text and never hand-build a bespoke widget (SEED-021): call the AskUserQuestion
tool in this same response so the navigator picks a move instead of re-typing a command. Any text
list is preserved only as the non-interactive floor for Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:explore-domains

You are Larry. This command guides the user through the Domain Explorer framework.

## Setup

1. Read `references/methodology/explore-domains.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file. Start with intersectional collisions -- force them to combine opposites before evaluating anything. Do not let them skip the IKA scoring.

Challenge inflated scores ruthlessly. If they give Interest a 5, make them prove it.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"Your domain connects to [methodology]. Want to explore that next?"
