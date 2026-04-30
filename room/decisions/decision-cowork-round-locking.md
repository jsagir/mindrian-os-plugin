---
decision_id: cowork-round-locking
filed: 2026-04-29
session: 2026-04-29 post-v1.11.2 ship, mid-survey
verdict: NO_LOCKING_OPTIMISTIC_CONCURRENCY
canon_parts:
  - "Part 3 -- Tri-Context Decision Gate"
  - "Part 4 -- Every Choice Is Graph Data"
  - "Decision 13 (CLAUDE.md) -- Rejection is data"
  - "Decision 4 (CLAUDE.md) -- Three surfaces"
status: confirmed
applies_to:
  - Phase 88.2 (uiux-selector-block) -- F.1-F.5 implementation
  - Phase 96 (browser capture pack) -- multi-user dashboard interactions
  - Phase 97 (cascade decision gate) -- restored room-proactive surface
  - Phase 99 (BRAIN.md decision card view)
  - Any future F-shape selector that ships into a Cowork-shared room
---

# Decision -- Cowork Round-Locking Semantics

## Question

When two users in the same Cowork-shared room hit an F.0 / F.6 / any F-shape triage round simultaneously, what happens to the room? Locks? Last-write-wins? Both responses captured?

## Verdict

**No locking. Optimistic concurrency. Both responses captured as parallel typed edges.**

The F-shape selector primitive does NOT acquire a room-level lock when it presents. Each actor's response writes its own edge with an `actor_id` property. A divergence-detection edge fires automatically when N greater-than-1 actors answer the same `round_id x position`. The next gate -- F.5 Branch Resolution -- handles the divergence as a normal capture surface.

## Four-voice consultation

```
voice              what it said
---------------    --------------------------------------------------------------
ROOM (mindrianos-  Blue Hat persona warns: "schedule has no slack" before IRIS
venture)           launches May 20. Argues for the smallest design that ships
                   clean. Locking would require lock acquisition, lease renewal,
                   timeout handling, deadlock recovery -- all critical-path risk
                   for a Cowork rollout that is not yet load-bearing.

USER FOLDER        feedback_three_surfaces.md: hard rule -- every feature
                   evaluated through CLI/Desktop/Cowork before design freezes.
                   Cowork must work day 1, not as a retrofit. The answer must
                   be designed in, not bolted on.

BRAIN (teaching    Adjacent classroom pattern: collaborative classroom exercises
graph)             do not lock the chalkboard. Multiple students answer the
                   same question; divergence becomes the lesson. Locking
                   collaborative exercises destroys the pedagogical signal.

LARRY (synthesis)  Decision 13 dressed differently -- rejection is data; so is
                   divergence. Two simultaneous answers to the same auq are
                   not a conflict. They are two decision edges with different
                   actor_ids. The next gate surfaces the divergence as the
                   next round.
```

## Implementation contract

For any F-shape selector that ships into a Cowork-shared room:

1. **Edge schema:** every selector response carries `{round_id, position, actor_id, response, latency_ms, timestamp}`. The `actor_id` is the surface's identity primitive (per Cowork user-id, falls back to `local-cli` on CLI single-user).

2. **Divergence detection:** automatic. After T (default 30 sec) of round-open time, if N greater-than-1 distinct `actor_id` values appear under the same `round_id x position`, a `DIVERGENCE` typed edge is written with both responses as evidence.

3. **Resolution surface:** F.5 (Branch Resolution) is the canonical resolution surface. It already supports {Continue / Merge / Compare / Park / Drop}. Divergence routes there automatically.

4. **No timeouts, no leases, no locks.** Eventually-consistent capture. Last writer does NOT win -- both writers' edges persist in the graph forever.

5. **Privacy boundary (Canon Part 8):** divergence edges and actor_ids are graph-local. They never reach the Brain. Cross-user comprehension patterns can be derived from anonymized aggregates only, and only with explicit opt-in.

## Cool-UI/UX expression

The divergence resolution surface should FEEL like a feature, not an error condition.

```
                     ┌─ ROUND 14 -- DIVERGENCE DETECTED ─────────────────┐
                     │                                                   │
                     │  Q: Does the financial model assume 18% margin?   │
                     │                                                   │
                     │  ▶  YOU answered:    REJECT  ("seems high")       │
                     │  ▷  Lawrence answered: CONFIRM                    │
                     │                                                   │
                     │  ── Resolve ──                                    │
                     │    1) Continue with both edges (divergence kept)  │
                     │    2) Merge -- discuss synchronously              │
                     │    3) Compare -- side-by-side reasoning view      │
                     │    4) Park -- defer to next milestone audit       │
                     │    5) Drop -- mark as no-impact                   │
                     │                                                   │
                     └───────────────────────────────────────────────────┘
```

This is not an error dialog. It is the moat -- divergence captured as edges is teaching data the Brain can never receive but the room can teach you to see.

## Out of scope (explicitly NOT decided here)

- Real-time presence indicators ("Lawrence is also in this round") -- Cowork-level concern, not selector-level.
- Optimistic UI rendering on browser surfaces (showing other actors' answers in flight) -- Phase 96 dashboard concern.
- CRDT semantics for free-text selector responses -- if free-text divergence ever exceeds the F.5 surface's capacity, Phase 100+ revisits.

## Provenance

This decision was filed by Larry on 2026-04-29 in response to user instruction "ask the data room of the plugin not me. ask the users folder. then also ask the brain & larry!" -- the explicit Tri-Context Decision Gate dogfood applied to a product question about MindrianOS itself. The four voices' transcript above IS the evidence trail.

The decisions/ section of the dogfood room (`/home/jsagi/MindrianOS-Plugin/room/`) was empty before this commit (STATE.md flagged it as a GAP); this artifact closes the gap and demonstrates Canon Part 6 dog-fooding.
