---
kind: seed
status: open
created: 2026-07-14
canon_parts: [3, 8, 9]
severity: HIGH
related: [SEED-034 (Graph Derivation Harness -- this seed assumes 034's harness exists and covers what happens when it has not run yet, or cannot), Phase 211-216 (Eureka tri-modal + Grounding Guard critic + AHP portfolio scoring)]
proving_case: intern QA session 2026-07-14 ("David", david-innovation-studio room) -- 30-entry room, embedding model never cached, `/mos:eureka` returned `pairs_scored: 0`, `statements: []`, rendered as "not enough entries" when the actual cause was `encoder_unavailable` intersecting an empty graph (see SEED-034 proving_case_2). Full incident: `.planning/debug/interns-round-eureka-david-session-2026-07-14.md`.
source: interns homework tracker QA program, Eureka-assignment round, 2026-07-14
---

# SEED: Eureka Reasoning-Mode Fallback -- no encoder, no graph, no hard stop

## The blunt diagnosis (one substrate, one method, one failure mode)

`scripts/eureka-portfolio-report.cjs` opens `room.db` directly (`openRoomDb`, line ~643) and hard-gates
on `idx.embedded === true` for its tri-modal index (line ~19: "HARD GATE on `idx.embedded === true`").
There is exactly one substrate (room.db typed edges) and exactly one scoring method (a cached local
embedding model, `MongoDB/mdbr-leaf-ir`). When either is missing, the honest thing happens: the scan
reports `encoder_unavailable` and/or `pairs_scored: 0`, and the render says "not enough entries." That
message is true of the *symptom*. It is not true of the *cause*, and a navigator reading it draws the
wrong conclusion (add more content) when the real blocker is infrastructural (model never fetched,
graph never populated -- see SEED-034).

This is not a request to make Eureka lie about confidence. It is a request to give Eureka a second,
lower-confidence path so "no encoder" and "no graph yet" stop being dead ends.

## Why this is a genuinely different problem than SEED-034

SEED-034 fixes the *supply side*: make the graph a mechanical twin of the filesystem so room.db is
never empty by default. Once that harness ships, most rooms will have real nodes and edges to score.
But two situations SEED-034 does not (and should not try to) solve:

1. **Cold-machine gap.** The embedding model is fetched once, on first use, over the network (Canon
   Part 8 makes this a deliberate one-time opt-in, not silent). Between install and that first fetch,
   `idx.embedded` is `false` no matter how populated the graph is. SEED-034 does not touch this.
2. **New-room gap.** Even with the write-path fixed, a room that is 10 minutes old has a thin graph by
   definition. There is a real floor below which pairwise scoring is statistically meaningless -- but
   "meaningless to score" and "nothing useful to say" are not the same claim, and Eureka currently
   conflates them.

Both are Tier-0-adjacent situations: the system is working correctly, the infrastructure or the data
just is not there yet. Canon Decision #8 ("Tier 0 fully functional -- no dependencies; graceful
degradation everywhere") already commits to exactly this posture elsewhere in the product (`doctor.cjs`
exits 0 under class-flag scans specifically so a scoped diagnostic run never reads as a failure). Eureka
does not yet honor that same commitment.

## The fallback to build

A **reasoning-mode** path in `eureka-portfolio-report.cjs`, entered when `idx.embedded !== true` OR the
room-native substrate is below the scoring floor (per SEED-034's eventual floor, or the current 30-entry
gate if 034 has not shipped):

1. Read the room's raw markdown content directly (the filesystem, not room.db) -- the same content a
   human would read if they opened the room themselves.
2. Run an LLM-reasoning pass (Claude itself; no embedding model required) that identifies plausible
   cross-domain pairs and drafts Opportunity Statements the same shape Eureka's embedding path produces,
   but explicitly labeled `mode: reasoning` (never silently merged with `mode: embedded` results).
3. Render this as a REAL result -- a ranked list, however short, with the confidence caveat stated once,
   up front -- not as a repackaged "not enough entries" message.
4. When the embedding model becomes available (or SEED-034's harness populates the graph), the SAME
   room re-run should upgrade transparently to `mode: embedded`, and the report should say so ("this
   room was previously scored in reasoning-mode; here is the embedded-mode result").

## Why "silent" in the name, precisely

Not silent as in undisclosed -- the mode label is mandatory and visible. Silent as in: the navigator
never has to notice or manage the degrade themselves. No manual "try the fallback command," no separate
mental model for "the broken version of Eureka." One command, one mental model, a labeled confidence
tier that shifts as the infrastructure catches up. This mirrors the Canon Part 8 spirit already used for
the embedding-model opt-in itself (deliberate, disclosed, but never a wall the navigator has to climb
over manually).

## Canon alignment

Part 8: reasoning-mode reads LOCAL room content only; zero new Brain surface, zero new network call
beyond what Eureka already makes; the embedding-model fetch stays the same explicit opt-in it is today.
Part 9: reasoning-mode output lands as `proposed` opportunity statements, same as embedded-mode -- no
new confirm-tier is invented.
Part 3: this is not itself a Decision Gate change; the existing gate around accepting/filing an
Opportunity Statement is unaffected.

## Required capability (exploration acceptance -- this is a seed, not a plan)

1. A `mode` field (`embedded` | `reasoning`) on every Eureka result, surfaced in the render, never
   silently defaulted or hidden.
2. Reasoning-mode entry condition: `idx.embedded !== true` OR scored-pairs floor unmet after a real
   attempt (not entered speculatively before trying the real path).
3. Reasoning-mode reads raw room markdown directly, not room.db (it must work even when SEED-034 has
   not shipped or has not yet run on this room).
4. Confidence caveat rendered once, prominently, in the 4-zone Shape E render -- not buried in a footer.
5. Re-run upgrade path: a room previously scored `reasoning` and later scored `embedded` should surface
   the delta, not just silently replace the old result with no comparison.
6. `/mos:eureka html` exports carry the same `mode` label so a shared report is honest about which path
   produced it.
7. No change to the embedded-mode scoring logic itself -- this is purely an additive fallback branch.

## Open questions for the phase that picks this up

- Cost/latency budget for the reasoning-mode LLM pass on a large room (needs a cap, similar to
  fable-mode's posture-scoping in Phase 167).
- Whether reasoning-mode Opportunity Statements need a distinct AHP-weighting treatment, since they are
  not backed by embedding-similarity scores the way embedded-mode pairs are.
- Sequencing against SEED-034: reasoning-mode should ship in a way that still works standalone if
  SEED-034's harness is delayed, since it addresses the cold-machine gap independently of the
  supply-side graph-population gap.
