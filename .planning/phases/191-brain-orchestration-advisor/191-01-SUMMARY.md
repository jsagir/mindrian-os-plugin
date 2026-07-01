---
phase: 191-brain-orchestration-advisor
plan: 01
subsystem: orchestration-advisor-harness
tags: [harness-as-code, contracts-on-disk, recon, tdd-red]
dependency-graph:
  requires: []
  provides:
    - "191-IFACE.md (shared IFACE + RULES, the inter-wave bus for Waves 2-4)"
    - "RED lift-module test scaffold (tests/orchestration-candidate-lift.test.cjs)"
  affects:
    - "191-02 (Foundation): implements lib/core/orchestration-candidate-lift.cjs against the IFACE"
    - "191-03 (decide() wire): implements section 5 of the IFACE"
    - "191-04 (F.7 render): implements section 6 of the IFACE"
    - "191-05 (Verify): asserts section 7 (router-flip) and section 8 (B2 return-shape) of the IFACE"
tech-stack:
  added: []
  patterns:
    - "harness-as-code (D-05, ref /mos:bono): recon-first, contracts-on-disk, one shared IFACE block"
key-files:
  created:
    - .planning/phases/191-brain-orchestration-advisor/191-IFACE.md
    - tests/orchestration-candidate-lift.test.cjs
  modified: []
decisions:
  - "Honored D-01: the IFACE documents decide() lifting the candidate; the Phase-184 reader (decide-projection-reader.cjs) is explicitly marked NOT modified anywhere in the contract."
  - "Honored D-03a: no live Brain/Aura reference anywhere in the IFACE; every seam anchor is a LOCAL file:line in the current tree."
  - "hitl_shape mapping (posture -> confirm/hold/ask) is Claude's-discretion detail filled in at IFACE-write time per plan section 4, since the plan specified the enum but not the exact posture mapping; documented explicitly so Wave 2 has zero ambiguity."
metrics:
  duration: "~35 minutes"
  completed: "2026-07-01"
---

# Phase 191 Plan 01: RECON -- contracts-on-disk IFACE + RED test scaffold Summary

One-liner: Wrote the single shared IFACE contract (191-IFACE.md, 8 sections, all seams anchored to resolved file:line in the current tree) and a RED node-assert test scaffold for the not-yet-built lift module, per the harness-as-code recon wave. Zero production code changed.

## What Was Built

**Task 1 -- 191-IFACE.md.** The contracts-on-disk bus for Phase 191. Contains:
1. The RULES block (R1-R8), copied verbatim from the plan.
2. The `liftFiringCandidate(input) -> LiftResult` signature (the shared interface Waves 2-4 build against), with resolved anchors for its three default seams (`rankFn` -> `f-selector-ranker.cjs:484`/`:609`, `verbFn` -> `navigation-engine.cjs:416`/`:1322`, `gate` -> `navigation-engine.cjs:86`/`:1314`).
3. The confidence-join contract (match `command` slug between the projection option and a `rankForSelector` scored entry; the matched score IS the confidence; no re-weighting).
4. The `hitl_shape` closed enum (`confirm`/`ask`/`hold`) with an explicit posture-to-enum mapping table.
5. The `decide()` wire contract (Wave 3a): insertion point, both return-path anchors (`:901` tier_0, `:1041` main), and how the lift result composes with the existing `resolveFireSkill` ladder without disturbing its precedence.
6. The F.7 render contract (Wave 3b): how `command_recommendation` becomes a `renderDial` row.
7. The router-flip assertion contract (Wave 4): cites `routeActivation`'s Precedence Rule 1 anchor, explicit "do not re-implement" note (D-06).
8. The B2 return-shape contract (Wave 4): the current `decision` + `trace` key enumeration Wave 4 diffs against.

A verified-anchors table at the bottom cross-references every file:line cited in sections 5-8 for quick re-verification.

**Task 2 -- tests/orchestration-candidate-lift.test.cjs.** A plain node-assert CJS scaffold (matching the `tests/test-reader-184.cjs` house style: `assert.ok` + a `pass` counter + `PASS N assertions` on success). Requires `lib/core/orchestration-candidate-lift.cjs`, which does not exist yet, so the file crashes with `MODULE_NOT_FOUND` and exits non-zero -- the RED state the plan mandates. All five `LiftResult.reason` code paths are pre-written as test bodies for Wave 2 to turn GREEN: `lifted`, `below_gate`, `no_canonical_verb`, `no_offer`, `no_match`, plus a gate-provenance block that proves the gate reads `RECOMMENDED_CONFIDENCE_FLOOR` (never a hardcoded `0.70`) by expressing every fixture score relative to the imported constant.

## Verification

```
$ node tests/orchestration-candidate-lift.test.cjs
Error: Cannot find module '.../lib/core/orchestration-candidate-lift.cjs'
(exit code 1)
```
RED confirmed -- exits non-zero solely because the implementation module is absent.

```
$ grep -c "liftFiringCandidate\|command_recommendation\|RECOMMENDED_CONFIDENCE_FLOOR\|routeActivation\|hitl_shape" 191-IFACE.md
```
All five required strings present; zero em-dash characters in either new file.

## Deviations from Plan

None -- plan executed exactly as written. Both tasks' acceptance criteria and `<verify>` automated checks passed on the first attempt.

## Known Stubs

None. This wave is documentation + a RED test only; no production code, no UI, no data wiring.

## Threat Flags

None. Both new files are scoped exactly to the plan's threat register (T-191-01 IFACE content mitigated by anchor-only documentation; T-191-02 test fixtures accepted as synthetic).

## Self-Check: PASSED

- FOUND: .planning/phases/191-brain-orchestration-advisor/191-IFACE.md
- FOUND: tests/orchestration-candidate-lift.test.cjs
- FOUND commit: b109885d (feat(191-01): write the shared IFACE contract)
- FOUND commit: 012ea537 (test(191-01): lay the RED lift-module test scaffold)
