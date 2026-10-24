---
id: SEED-139
title: "Rank fusion (RRF) for the lexical and semantic legs of rs-differential-scorer.cjs"
status: open
priority: low
filed: 2026-10-21
planted_during: "Phase 379.1 plan 06 (graph derive drain and scout runaway CPU)"
origin: "Phase 379.1, the rank-fusion note in 379.1-CONTEXT.md"
trigger_when: "the derive floors (CONVERGES 0.55, INFORMS 0.45) are recalibrated, or an edge-quality complaint names a pair that one leg ranked high and the other low"
scope: medium
surfaces: [MindrianOS-Plugin]
promotes_to: "a phase that changes Convention A of the differential scorer and re-baselines the 272 parity tests"
---

# SEED-139: Rank fusion for the differential scorer

## The problem

`lib/core/rs-differential-scorer.cjs` combines a lexical signal and a semantic signal by raw score. A raw score depends on the scale of each leg. Reciprocal Rank Fusion (RRF) combines the two legs by rank, so one leg cannot dominate by its scale.

## Evidence

- The note in 379.1-CONTEXT.md says the skill combines lexical and semantic signals by rank (RRF), and that the scorer combines raw scores today. The planner left it out of Phase 379.1 on purpose.
- The change touches Convention A (the authoritative structural signal) and the 272 parity tests (tests/272-*), which pin the current numbers. It is not a small edit.

## Proposed next step

Measure first: on the committed fixtures and one real room, compare the pairs that rank high by raw fusion with the pairs that rank high by RRF, and count the disagreements that a person judges to be an error. Only if RRF is better, change the scorer, bump the engine version (the cache key carries it), and re-baseline the 272 and 211 tests in one commit. State in the commit which floors change.

## Trigger

A floor recalibration, or an edge-quality finding from a real room.
