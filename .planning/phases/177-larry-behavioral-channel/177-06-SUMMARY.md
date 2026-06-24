---
phase: 177-larry-behavioral-channel
plan: 06
subsystem: behavioral-channel
tags: [observation-schema, zod, emit-boundary, bright-line, two-pass, shadow-only]
requires:
  - lib/core/navigation/calibration-log.cjs (177-05, the log writer; not touched here)
  - zod (existing project dependency)
provides:
  - lib/core/behavioral/observation-schema.cjs (validateObservation + ObservationSchema + FORBIDDEN_COMPOSED_KEYS)
  - two-pass same-turn ordering doctrine in lib/mcp/larry-server-instructions.md
affects:
  - tests/run-all-177.sh (bch-01 now GREEN)
tech-stack:
  added: []
  patterns: [strict-zod-object, emit-boundary-validator, explicit-forbidden-key-guard]
key-files:
  created:
    - lib/core/behavioral/observation-schema.cjs
  modified:
    - lib/mcp/larry-server-instructions.md
    - tests/test-bch-01-ownership.cjs
decisions:
  - "The observation schema is a STRICT Zod object so unknown keys (incl. all composed keys) are rejected by construction."
  - "An explicit FORBIDDEN_COMPOSED_KEYS guard runs before the Zod parse so the rejection reason names the offending key unambiguously."
  - "The dial position in the prompt is a DERIVED display injected in Pass 2, never model-computed (honors D-177-Q5)."
metrics:
  duration: ~12m
  completed: 2026-06-24
---

# Phase 177 Plan 06: The Observation-Emit Schema Summary

Froze the model OBSERVATION block schema and the `validateObservation` emit-boundary validator with Zod, so the engine -- not the model -- owns the composed decision. The schema STRUCTURALLY forbids the model from emitting dial / investment_level / reach / fire (the bright line), documented the two-pass same-turn ordering reconciled with the BCH-13 latency fallback, and turned test-bch-01 GREEN. SHADOW-ONLY: nothing fires, routing_source stays legacy.

## What shipped

- **lib/core/behavioral/observation-schema.cjs** (new): a STRICT `z.object({...}).strict()` ObservationSchema whose ALLOWED fields are pure-observation handles + scalars (reframe_cue, confidence [0,1], escape_hatch, problem_type, pushback, saturation) and NONE of dial / investment_level / reach / fire. `validateObservation(obj)` runs an explicit `FORBIDDEN_COMPOSED_KEYS` own-property guard (naming the offending key) before the Zod safeParse, returning `{ ok:true, value }` or `{ ok:false, errors }`. Pure module, no I/O (Canon Part 8: enum handles + scalars only). Matches the in-repo `const { z } = require('zod')` idiom (app-views.cjs:24, tool-router.cjs:31).
- **lib/mcp/larry-server-instructions.md** (modified): added a "Two-pass turn ordering" subsection after the Ask-Tell dial doctrine. Pass 1 emits the observation block only -> the engine composes -> Pass 2 writes prose with the dial injected as a derived display. Documents the BCH-13 latency relaxation (same-turn relaxes to same-or-prior-turn during a latency incident, reconciled not contradictory). NO threshold literal (no 0.50 / 0.85) added -- the BCH-05 fence is preserved.
- **tests/test-bch-01-ownership.cjs** (modified): the RED scaffold stub replaced with real pure-node asserts (test-bch-14 ok()/failed-counter idiom). Asserts the allowed shape passes, each forbidden composed key is rejected with the key named, confidence is bounded [0,1], and the prompt documents the two-pass anchor.

## Requirements satisfied

- **BCH-01** -- the model observation schema structurally cannot carry dial / investment_level / reach / fire; validation rejects them. Engine owns the composed decision.
- **BCH-02** -- the observation block is frozen and Zod-validated at the emit boundary.
- **BCH-03** -- two-pass same-turn ordering documented (observation -> compose -> prose).
- **BCH-13** -- latency fallback documented and reconciled with BCH-03 (same-or-prior-turn relaxation).

## Verification

- `node tests/test-bch-01-ownership.cjs` exits 0 (was a RED scaffold stub).
- `node -e require('./lib/core/behavioral/observation-schema.cjs')` loads clean (zod resolves).
- grep confirms larry-server-instructions.md contains `two-pass` and `same-or-prior-turn`; no behavioral-channel threshold literal (0.50/0.85) introduced.
- `bash tests/run-all-177.sh` delta: **10 pass / 6 fail -> 11 pass / 5 fail.** bch-01 flipped FAIL -> PASS. No previously-green suite regressed.

### run-all-177 suite state after this plan

| Suite | State |
|-------|-------|
| bch-10, bch-16, bch-17, bch-18 (W1) | PASS |
| bch-01 ownership (W2) | PASS (this plan) |
| bch-04 shadow-log (W2) | PASS |
| bch-12 color-register (W2) | FAIL (177-07, not owned here) |
| bch-15 calibration-fail (W3) | FAIL (Wave 3, not owned here) |
| bch-07, bch-08 (W4) | FAIL (Wave 4, not owned here) |
| bch-09 forced-material (W5) | FAIL (Wave 5, not owned here) |
| bch-14 part8-egress (cross) | PASS (frozen fence held) |
| bch-s5, bch-s4a (W2) | PASS |
| reach-ids-drift (frozen 6), posture-ids-drift (frozen 3) | PASS (frozen fences held) |

## Part 8 confirmation

observation-schema.cjs is a pure module: no I/O, no network, no db, no Brain wire. The validated observation carries only enum handles + scalars and never the composed decision. The bch-14 Part 8 zero-egress tripwire stayed GREEN -- the calibration log remains LOCAL room.db only, unread by buildBrainPacket. No threshold literal was added to the prompt (BCH-05 fence). Frozen sets untouched: 6 reaches, 3 postures, MAX_K, the 0.70/0.15 gate.

## Deviations from Plan

None - plan executed exactly as written. The three tasks (schema module, two-pass doctrine, test asserts) each verified and committed atomically. No 177-05 files (memory-ops / calibration-log) and no 177-07 files (render-v2 badge) were touched.

## Self-Check: PASSED

- lib/core/behavioral/observation-schema.cjs: FOUND
- lib/mcp/larry-server-instructions.md (two-pass subsection): FOUND
- tests/test-bch-01-ownership.cjs (validateObservation asserts): FOUND
- Commits 7af0bac0, 999e340b, 8c15f220: present in git log
