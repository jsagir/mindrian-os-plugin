---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 03
subsystem: verification-baseline
tags: [baseline, falsification, characterization, wave-0]
requires: []
provides:
  - tests/test-365-falsify-missing-five.cjs (falsification test 3, characterization)
  - tests/test-365-falsify-contradiction.cjs (falsification test 5, writer-level, with positive control)
  - tests/test-365-falsify-destination.cjs (falsification test 2, characterization)
  - tests/fixtures/365-falsification-record.json (recorded outcomes at the phase base)
  - 365-BASELINE.md (human-readable baseline and the manual two-navigators protocol, NOT RUN)
affects: [365-16, 365-17]
requirements: [V365-01]
key-files:
  created:
    - tests/test-365-falsify-missing-five.cjs
    - tests/test-365-falsify-contradiction.cjs
    - tests/test-365-falsify-destination.cjs
    - tests/fixtures/365-falsification-record.json
    - .planning/phases/365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt/365-BASELINE.md
  modified: []
decisions:
  - "Falsification tests are characterization tests (exit 0 on match, RECORD MISMATCH on flip, record written only with RECORD_365_FALSIFICATION=1), so a predicted failure never sits in the red list and never reads as something 365 heals"
  - "Test 5 drives the two lexical CONTRADICTS writers (analyze-room Sections 3 and 3b; graph-backfill CUE_MAP through runDerivation) and refuses to record a zero unless a positive control room proves both writers live"
  - "Test 2 isolates both halves of the destination (governing thought only, active JTBD only) in addition to with and without"
metrics:
  tasks: 2
  files: 5
  commits: 2
---

# Phase 365 Plan 03: Falsification Records and Baseline Summary

The review draft's falsification tests are now measured against today's code (or protocolled, for the one that needs people) before any product code changes: three characterization tests, one record file, and 365-BASELINE.md.

PLAN_BASE = `2ec0e555a7118b32d6751484065741ebdef11951` (short `2ec0e555a`). The record's `base_sha` is PLAN_BASE.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `5bc3b6e6a` | test(365-03): missing-five and contradiction falsification records |
| 2 | `1b28e5c35` | test(365-03): destination characterization and the phase baseline record |

Both commits used `git commit --only` on exact paths; both are ancestors of HEAD. A peer's uncommitted Phase 366 hunks in `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` and `366-VALIDATION.md` were left untouched.

## Observed outcomes (at PLAN_BASE)

| Record key | Predicted | Observed | Detail |
|------------|-----------|----------|--------|
| `missing_five` | FALSIFIED | FALSIFIED | Six confirmed claims (one per written day, the seventh-item member "friday" never written). `findUnsupportedClaims` returned 6, research preflight `evidence_gaps` returned 6, `analyze-room` returned 3 gap lines (all empty-section). No output names the absent day. |
| `contradiction_no_shared_wording` | FALSIFIED | FALSIFIED | Real pair ("The first units ship in March 2027." / "Nothing leaves the factory before 2029."): 0 CONTRADICT lines, 0 EDGE:CONTRADICTS lines, 0 backfill candidates (pair path and room-scan path), 0 CONTRADICTS edges in room.db. Positive control: 1 CONTRADICT line, 1 EDGE:CONTRADICTS line, 1 candidate on each deriver path, 1 CONTRADICTS edge. |
| `remove_destination` | UNKNOWN | `no_confidence_emitted` | `suggest_next` emits no numeric confidence or score field anywhere. The top suggestion does move: with the active JTBD it is a `context_block` reach (signal `jtbd_changed`), without it there is none. Governing thought alone changes nothing; JTBD alone reproduces the full-destination result. |

No prediction failed to hold. Manual test 1 (two navigators) is recorded in 365-BASELINE.md as NOT RUN with a written protocol; test 4 is noted as acceptance test 2.

## Findings for the navigator

1. The governing thought written into every section's MINTO.md does not influence `suggest_next` at the phase base; only the JTBD does, and only as a `jtbd_changed` notice, not a confidence value. Property 2 as worded ("confidence stays unchanged") cannot be answered because no confidence is emitted. This is a characterization, not a defect for this phase.
2. Writers not driven by test 5: the graph-derivation LLM or score producer (the one that could pass; needs a live model or the local encoder, and the spec forbids a model grading these properties) and the writers that only record a contradiction someone already named. Listed in the record under `observed_detail.writers_not_driven`.

## Test results

`bash tests/run-all-365.sh` at HEAD `1b28e5c35dfced8ce65885666aaa35ca9d7cca84`: exit 0, `PASSED=44 FAILED=0 SKIPPED=1 KNOWN=9`. The three falsification tests report PASSED; the four acceptance legs remain KNOWN reds with matching signatures (RED-365-BYTE, RED-365-BYTE-DERIVED, RED-365-ONEWEEK-STATUS, RED-365-ONEWEEK-STANDING, RED-365-FLOOR, RED-365-FLOOR-NOTICE). The regression block is SKIPPED (RUN_365_REGRESSIONS unset), as in earlier plans. Each falsification test run individually exits 0 against the record. Python3 and git were available (no ENV GAP).

## Deviations from Plan

None - plan executed exactly as written, with two small additions inside the plan's own files: the contradiction test also drives the room-scan path of the backfill deriver (not only the pair path), and the destination test adds governing-thought-only and JTBD-only rooms to split the destination into its two halves. The destination test stubs the Brain companion leg of `suggest_next` (`chainRecommender.chainOfferForReach` to null) so the test stays hermetic; it adds only the optional `chain_offer` field, and `installNetGuard` proves zero network attempts.

## Known Stubs

None.

## Threat Flags

None. The tests run on scratch rooms under `os.tmpdir()`, use no network, no model and no Jev. T-365-12 mitigated (record compared on every run, written only with the env flag); T-365-06 mitigated (net guard asserted zero attempts); T-365-11 mitigated (`--only` commits, ancestor checks).

## Hand-offs for later plans

- 365-16 and 365-17: the aggregator discovers the three new tests by glob; they are PASSED legs, not in the red list, and need no entry in `365-baseline-red.json`.
- If a later change makes a recorded outcome flip (for example a contradiction writer starts catching the no-shared-wording pair, or a confidence field appears on `suggest_next`), the test fails with RECORD MISMATCH; re-record with `RECORD_365_FALSIFICATION=1 RECORD_365_BASE_SHA=<sha>` only with the navigator.
- Manual test 1 (two navigators) stays NOT RUN until the navigator and the paper author schedule it; the protocol and the pre-written-rubric rule are in 365-BASELINE.md.

## Self-Check: PASSED

- FOUND: tests/test-365-falsify-missing-five.cjs, tests/test-365-falsify-contradiction.cjs, tests/test-365-falsify-destination.cjs, tests/fixtures/365-falsification-record.json, 365-BASELINE.md
- FOUND commits: 5bc3b6e6a, 1b28e5c35 (both ancestors of HEAD)
- No em-dashes or en-dashes in any created file
