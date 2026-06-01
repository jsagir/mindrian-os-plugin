---
id: SEED-019
status: dormant
planted: 2026-06-01
planted_during: /mos:radar + Plurai-onboarding research session (post-130.7, alongside Phase 138 scoping)
scope: medium
bundle: part8-runtime-enforcement
trigger_when: "Part 8 PR-gate work opens (check-brain-boundary.cjs stub), OR a tester/audit surfaces a near-miss Brain payload leak, OR Phase 110 brain-context-packet-contract reaches wire-enforcement and wants a runtime classifier companion"
canon_parts:
  - Part 8 (Graph Boundary -- this IS the runtime enforcement layer the canon calls 'pending')
  - Part 9 (Brain wire schema -- the classifier sits on the same egress chokepoint)
related_phases: [90, 110, 138]
related_seeds: [SEED-003]
companion_artifacts:
  - evals/plurai/01-part8-boundary-guardrail.csv (the training set, synthetic samples)
  - evals/plurai/README.md (canon-contract mapping)
needs_author_touch: dormant -- promote when the Part 8 PR-gate (check-brain-boundary.cjs) is scheduled, or when Phase 110 wire enforcement lands
---

# SEED-019: Canon Part 8 Boundary as a Runtime SLM Guardrail

## Why this matters

Canon Part 8 (the Graph Boundary) is today enforced by three things: (1) PR review by a Canon Custodian, (2) the Phase 90 5-tripwire static scans, and (3) the Phase 110 typed-packet wire schema. CANON-PHASE-MAP lists the actual runtime gate, `check-brain-boundary.cjs`, as **pending / not yet scaffolded**.

Plurai's vibe-training (the BARRED method) trains a sub-100ms small language model from a policy description plus a CSV of synthetic samples. `evals/plurai/01-part8-boundary-guardrail.csv` is exactly that policy turned into labeled boundary cases (compliant vs violation). A model trained on it could become the missing runtime gate: a classifier that inspects every outbound Brain query payload and BLOCKS it before egress if it carries user-specific content.

This turns the Part 8 constitution from "enforced by review + static scan" into "enforced by a runtime classifier on the egress chokepoint" -- structural, not procedural. Moat-deepening per the MWP mandate: it sits on the LOCAL-to-BRAIN boundary, the most defensible line in the system.

## Sketch

- Train the guardrail SLM from `evals/plurai/01-part8-boundary-guardrail.csv` (expand the synthetic set first; never use real room content -- Part 8 applies to the training data too).
- Wire it as a pre-egress hook on the Brain MCP call path (the Phase 109 navigation chokepoint / Phase 110 packet builder is the natural insertion point).
- On `violation`: block the call, log a LOCAL-only telemetry event (scalar + slug, no payload), surface to the user as a Decision Gate ("this query would leak X; reformulate or cancel").
- Tri-polar: must work on CLI (hook), Desktop (MCP wrapper), Cowork (shared). The classifier is local; no payload leaves the machine to reach the classifier.

## Open questions

- On-prem / local inference for the SLM (Plurai supports on-prem) vs a bundled distilled model -- the classifier itself must not become a new egress path.
- Relationship to Phase 110 wire enforcement: is the SLM a belt-and-suspenders companion to the typed packet, or does the typed packet make it redundant? Likely complementary: the packet constrains structure, the SLM catches semantic leaks inside otherwise-valid fields.
- Latency budget on the hook path (sub-100ms claim from Plurai; validate against the 2000ms hook ceiling).

## Provenance

Surfaced 2026-06-01 while researching Plurai (https://www.plurai.ai) for MindrianOS self-assessment CSVs. Companion to Phase 138 (capability-radar absorption). The eval CSVs live at `evals/plurai/`.
