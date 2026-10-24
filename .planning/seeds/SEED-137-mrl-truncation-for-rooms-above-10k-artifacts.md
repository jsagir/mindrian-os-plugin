---
id: SEED-137
title: "Matryoshka (MRL) truncation of mdbr-leaf-ir to 128 or 256 dimensions as a first pass for rooms above about 10,000 artifacts"
status: open
priority: low
filed: 2026-10-21
planted_during: "Phase 379.1 plan 06 (graph derive drain and scout runaway CPU)"
origin: "Phase 379.1, decision D-379.1-17"
trigger_when: "a real room has more than about 10,000 artifacts (ASSUMED threshold, by N squared scaling of the probe)"
scope: small
surfaces: [MindrianOS-Plugin]
promotes_to: "a quick that adds a truncated first pass to buildCandidatePairs, then rescores the k best at full width"
---

# SEED-137: MRL truncation as a first pass for very large rooms

## The problem

The candidate pass of the drain is an N x N dot-product pass over 384-dimension vectors. It is cheap at N = 2,163 and grows with N squared. For a room of many thousands of artifacts it becomes the next cost to bound.

## Evidence

- The model card of MongoDB/mdbr-leaf-ir says the model "is robust to vector quantization and MRL truncation" and that embeddings "can be truncated for more efficient storage". The card's own example uses 256 dimensions (379.1-BREAKTHROUGH-RESEARCH.md, Q4, PROVEN). The card does not show 128 (quality at 128 is UNVERIFIED).
- Measured on this machine: a 128-dimension first pass over N squared took 4,011 ms against 10,832 ms at 384 dimensions, a 2.7 times saving of about 7 s per full rebuild at N = 2,163 (PROVEN probe).
- A slice is not a quantization, so decision D-379.1-09 (no quantization) is not touched.

## Open question (Q5 of the research)

Does a 128 or 256-dimension slice need re-normalization before the cosine in Transformers.js? ASSUMED yes: the card's example runs through the sentence-transformers path. Confirm that before any code.

## Proposed next step

Slice the first d components of each cached vector, re-normalize, run the N x N pass at d, keep the best m candidates per row (m larger than k), and rescore those at 384 dimensions. Measure recall against the exact pass on a real room and on the large fixture. Ship only if recall holds at the INFORMS floor.

## Trigger

A room above about 10,000 artifacts in the field, or a drain pass that exceeds its budget on the candidate step.
