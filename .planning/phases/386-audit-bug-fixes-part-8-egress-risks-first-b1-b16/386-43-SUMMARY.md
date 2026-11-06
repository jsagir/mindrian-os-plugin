---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "43"
subsystem: part8-egress
tags: [part8, sprouts, guidance, persona]
requires: [386-42]
provides:
  - sprout guidance in the Brain query patterns, the brain-query agent, the Brain connector skill, a persona pointer and a new Brain reference
affects: [386-27, 386-33]
key-files:
  created:
    - references/brain/sprout-split-route.md
    - tests/test-386-sprout-guidance.cjs
  modified:
    - skills/larry-personality/SKILL.md
    - skills/brain-connector/SKILL.md
    - references/brain/query-patterns.md
    - agents/brain-query.md
    - data/harness-manifest.json
decisions:
  - "The persona skill carries a one line pointer; the full guidance lives in references/brain/sprout-split-route.md (coordinator decision)"
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 43: Sprout guidance Summary

The models that compose Brain calls are now taught the sprout rule and the handling of a `sprouts_required` refusal: a Brain call carries sprouts and never a body; on a refusal, split the text into typed claims, keep the room claims local with `claim_write`, call again with the sprouts only (route `sprout_call`, read from the plan 42 RCA), never copy a run of four words from a claim into a sprout, and assemble the answer locally.

## Deviations from Plan

**1. [Scope and design change, coordinator decision] Persona guidance is a pointer plus a new reference file**
- **Found during:** Task 2 baseline comparison.
- **Issue:** The full "Composing a Brain call" section in skills/larry-personality/SKILL.md broke 4 persona guard tests: test-3696-skill-budget S2 (machinery share 18 percent, limit 15, headroom about 109 bytes), test-3696-persona-drift R1 and test-3696-operation-doctrine D6 (any snake_case word in the persona text is read as a tool reference; sprouts_required, sprout_call, anomaly_cue and mental_model are not registered), and D7h (one new imperative line).
- **Fix:** No persona governance test was changed. The persona skill now holds a heading "Composing a Brain call" and one line (a path, no snake_case token, 59 bytes): `Sprouts, not bodies: references/brain/sprout-split-route.md`. The full guidance is in the new file references/brain/sprout-split-route.md (outside the references/personality/ glob that the persona tests read, so its tokens are not read as persona tool references). The SG1 arm now checks the pointer (path, at most 110 bytes, no snake_case) and the reference (sprouts_required, claim_write, the route name read from the RCA, the 6 claim types, 12 words, the rule, the four word run rule).
- **Files added beyond the plan:** references/brain/sprout-split-route.md, data/harness-manifest.json (persona digest regenerated with node scripts/build-harness-manifest.cjs because the pre-commit hook requires it).
- **Commits:** 58df961b1 (RED), 1597fefae (3 files), 0ed2f6d41 (pointer, reference, SG1, manifest).

## Verification

- The 4 persona guard tests (test-3696-skill-budget, test-3696-persona-drift, test-3696-operation-doctrine, test-36925-naming): results equal baseline (all pass). Machinery share 14.8 percent (limit 15).
- Every baseline test that names an edited file: result equal baseline. Known reds unchanged: test-298-contract-parity (dirty tree), test-346-catalogue-schema, test-359-prose-budget, test-l8g-theo-bare, test-mux-card-before-answer.
- node tests/test-386-sprout-guidance.cjs: SG1 to SG4 pass. SG5 passed at commit time. Later it failed once because a peer changed commands/eureka.md (mirror eureka diverges); that is not part of this plan.
- lib/mcp/runtime-instructions.cjs and commands/ untouched by this plan; node scripts/check-help-coverage.cjs exit 0.

## Self-Check: PASSED

Files exist: references/brain/sprout-split-route.md, tests/test-386-sprout-guidance.cjs. Commits 58df961b1, 1597fefae, 0ed2f6d41 exist.
