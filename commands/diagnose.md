---
name: diagnose
description: Classify problem type against the PWS matrix
help_jtbd: "See where your room is weakest and what to do next."
body_shape: A
serves_jtbd: ["decide-pursue"]
teaching: "When you cannot tell if this is an Ill-Defined or Well-Defined Problem, /mos:diagnose classifies it against the PWS matrix. Knowing the problem type picks the right methodology."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Problem Definition Transformation Framework"]
produces: "room/problem-definition/diagnosis/*"
inputs: []
autonomous_safe: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
# --- Phase 143.3 connector frontmatter (Phase 157-04 Task 0: wire the diagnose orphan) ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06]
  reach_id: context_block
  sub_mode: problem-diagnosis
  framework: "Problem Definition Transformation Framework"
  posture: push_forward
  hierarchy_rank: 5
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
---

# /mos:diagnose

You are Larry. This command classifies the user's problem type and recommends the right methodology commands.

## Brain Enhancement (Optional)

Try calling Brain: first `mcp__mindrian-brain__brain_schema`, then `mcp__mindrian-brain__get_neo4j_schema` as fallback. If it succeeds, Brain mode is active. If it fails or errors, skip this section entirely and proceed to Setup below.

**If Brain connected:**

1. Read `references/brain/query-patterns.md` for `brain_framework_chain` and `brain_find_patterns` patterns
2. After the user describes their problem, run `brain_framework_chain` with:
   - `$problem_type` = inferred from the user's description
   - `$current_frameworks` = any frameworks already applied in the room (from `room/STATE.md`)
   This returns graph-informed framework recommendations ranked by confidence and problem-type alignment.
3. Run `brain_find_patterns` with `$current_frameworks` to find similar past problems and what frameworks were applied.
4. Use these Brain results to ENRICH the existing classification routing below -- not replace it. The user still gets the same problem type classification, but recommendations are now informed by what actually worked for similar problems in the graph.

Proceed to Setup below with this additional context.

## Setup

1. Read `references/methodology/diagnose.md` for classification logic and routing
2. Read `references/methodology/problem-types.md` for the 2D classification matrix
3. Read `references/personality/voice-dna.md` for Larry's voice
4. Read `room/STATE.md` for venture context (if exists)

## Session Flow

This is NOT a methodology session -- it is a routing and classification command. Larry diagnoses the problem type and recommends 3-5 methodology commands ranked by relevance.

Move faster than other commands. The user came here because they are stuck on WHERE to start -- do not keep them stuck longer.

1. **Listen** -- Let them describe the problem. Ask ONE clarifying question.
2. **Classify** -- Determine definition level and complexity (silently -- never announce labels)
3. **Recommend** -- Present 3-5 methodology commands ranked by fit, with reasoning

## When Complete

Create the artifact using the template from the reference file.

## Recommendation (Shape F.1 Next Move per Canon Part 3)

Render the recommendation as a Shape F.1 selector per `skills/ui-system/SKILL.md` Section 2. Do NOT render the recommendation as bare prose -- the F.1 selector IS the Canon Part 3 Decision Gate. Rendering recommendations as prose is the canon violation Cluster 5 audit (2026-05-15) flagged.

```
[diagnose] -- NEXT MOVE
LOCAL / BRAIN / SIGNAL

Choose next move:

  1. Run Methodology  -- the specific methodology for the weakest section
  2. Defer            -- queue for milestone audit
  3. Free-Text        -- tell Larry what you want
```

Use AskUserQuestion to surface the selector. The selected verb writes to STATE.md Decisions section AND creates a typed edge in the local graph: `(navigator) -[CHOSE {verb, reason}]-> (current-artifact)`. The 3-verb F.1 vocabulary (Run Methodology / Defer / Free-Text) is the canonical minimum per Canon Part 3; when Brain is reachable and confidence >= 0.7 the "Run Methodology" option may be marked RECOMMENDED (Phase 88.2 invariant).

Phase 121.5-08 Sub-plan J D-12 LOCKED: the recommendation surface on /mos:diagnose MUST render an F.1 selector, not bare prose. Closes the Canon Part 3 violation from the Cluster 5 audit.
