---
id: SEED-136
title: "SimHash (random-hyperplane LSH) as the escalation above MINDRIAN_DERIVE_MAX_PAIRS_PER_ENTRY"
status: open
priority: low
filed: 2026-10-21
planted_during: "Phase 379.1 plan 06 (graph derive drain and scout runaway CPU)"
origin: "Phase 379.1, decision D-379.1-12"
trigger_when: "a real room has more than about 2,500 artifacts, so the top-k pruner (N x k pairs) passes the 50,000-pair entry ceiling and the drain starts to skip entries with a disclosed pair_cap_exceeded"
scope: medium
surfaces: [MindrianOS-Plugin]
promotes_to: "a GSD phase or quick that adds an LSH candidate generator beside buildCandidatePairs in lib/core/graph-derive-classifier.cjs"
---

# SEED-136: SimHash escalation above the pair ceiling

## The problem

Phase 379.1 replaced the all-pairs drain with a top-k cosine pruner (k = 20) and a cursor. The pruner is exact, and it is brute force: one dot product per pair of artifacts. For a room above about 2,500 artifacts the candidate list (N x k) passes MINDRIAN_DERIVE_MAX_PAIRS_PER_ENTRY (50,000). Such an entry clears with a disclosed `derivation_skipped` event (reason `pair_cap_exceeded`). The room is then not derived at all. That is honest, and it is also a dead end.

## Evidence

- Brute-force cosine pass over N = 2,163 artifacts at 384 dimensions took 10,832 ms in plain JS on this machine (379.1-BREAKTHROUGH-RESEARCH.md, Q1, PROVEN probe). The cost grows with N squared.
- At the incident size the bound is min(2,163 x 20, 2,338,203) = 43,260 pairs, below the ceiling, so the incident room runs through the cursor over 9 drains (379.1-04-SUMMARY.md).
- The research table ranks SimHash as "not needed at N = 2163 (brute force is 11 s); file as the escalation path above the hard ceiling".

## Proposed next step

Random-hyperplane LSH: b random hyperplanes give a b-bit code per vector, with Pr[h(u) = h(v)] = 1 - theta / pi. Bucket by code, score only inside buckets (and across near buckets), and feed those candidates to the same cursor. Keep the exact pruner for rooms below the ceiling. Plain JS, no dependency. Measure recall against the exact top-k on the 2,105-artifact large fixture and on a real room, as `tests/fixtures/379.1/probe-k.json` did for k.

## Trigger

A room whose entry is skipped with `pair_cap_exceeded` in the field, or a decision to raise the scout artifact cap (SEED-141) so far that the drain must follow.
