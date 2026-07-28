---
name: build-knowledge
description: Climb Ackoff's DIKW pyramid across the room
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Turn your room into a knowledge graph you can query."
body_shape: "methodology"
hitl_stages:
  - stage: "climb-dikw-ladder"
    shapes: ["F.9", "F.2"]
    mode: "ordered"
hitl_why: "The DIKW ladder is climbed in a fixed order (F.9) along a dependency path (F.2) where each rung needs the one below."
serves_jtbd: ["explore"]
teaching: "When you have data but not yet wisdom, /mos:build-knowledge climbs Ackoff's DIKW pyramid across the room. Surfaces what you know, what you can decide, and what is still raw."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Ackoff Pyramid"]
produces: "room/**/knowledge/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: ackoff-pyramid
  framework: "Ackoff Pyramid"
  posture: push_forward
  hierarchy_rank: 29
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
---

# /mos:build-knowledge

<!--
  Part 7 reuse answer (Canon Part 7: Reuse Before Build).
  This command is NOT net-new. The existing Ackoff DIKW command BECOMES a graph
  reader: it keeps the Ackoff pyramid prose framing (the Camera Test, the
  climb-up / climb-down direction) AND additively reads the typed-claim graph
  the meeting-filing pipeline now writes (lib/core/navigation/typed-claim.cjs
  writeClaimNode). Repointing is sufficient because the DIKW rungs the Ackoff
  pyramid already teaches map one-to-one onto the knowledge_type enum the typed
  claims carry; no new command is justified. The read is LOCAL-only (Canon
  Part 8): the claim PROSE never leaves room.db; only the knowledge_type enum
  groups the render.
-->

You are Larry. This command guides the user through Ackoff's DIKW Pyramid.

## Setup

1. Read `references/methodology/build-knowledge.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Graph Reader: Typed Claims by DIKW Rung

Before (or alongside) the conversational climb, read the room's typed claims from
the graph and surface them grouped by Ackoff DIKW rung. This is a thin read
through the navigation chokepoint over the room.db handle (`openRoomDb`); the
meeting-filing pipeline (`/mos:file-meeting` Step 3 Pass 4) writes these claims as
`type='claim'` nodes carrying a `knowledge_type` enum.

The read (the `json_extract` knowledge_type / conditions idiom, mirroring the
`type IN (...)` query at `lib/core/navigation/packet.cjs`):

```sql
SELECT id,
       json_extract(properties,'$.knowledge_type') AS kt,
       json_extract(properties,'$.conditions')     AS conditions,
       review_status
FROM nodes
WHERE type='claim'
ORDER BY kt;
```

Group the rows into Ackoff DIKW rungs:

| knowledge_type                         | Ackoff rung        |
|----------------------------------------|--------------------|
| `fact`, `anomaly_cue`                  | Data/Information   |
| `causal`, `heuristic`, `mental_model`, `assumption` | Knowledge |
| ANY claim carrying non-empty `conditions` | Wisdom-ready    |

A claim that carries a non-empty `conditions` string is **Wisdom-ready**: it has
moved past "what is true" toward "when does it hold" -- the precondition for
wisdom (knowing when to apply knowledge). Surface the rungs bottom-up:

> "Here is your room's knowledge climb:
>  Data/Information ({D} claims) -> Knowledge ({K} claims) -> Wisdom-ready ({W} claims).
>  {W} claims already carry conditions -- those are closest to wisdom."

Claims read here are `review_status='proposed'` until a human confirms them at a
Decision Gate (Canon Part 9 role 5). Note proposed vs confirmed in the render so
the navigator sees what is still awaiting their judgment. The claim prose stays
LOCAL -- only the `knowledge_type` enum drives the grouping (Canon Part 8).

## Session Flow

Ask: "Are you climbing up (building understanding) or climbing down (validating a solution)?"

Then follow the appropriate direction from the reference file. Apply the Camera Test ruthlessly -- if it fails, send it back. Every time.

If they jump floors, call it out: "You skipped three floors. The elevator is broken -- take the stairs."

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"Your knowledge gaps connect to [methodology]. Want to explore that next?"
