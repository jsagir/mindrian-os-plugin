---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 11
subsystem: phase-gate
tags: [phase-gate, acceptance, live-smoke, requirements, canon-phase-map, follow-ons]
requires: ["364-01..10", "364-14"]
provides:
  - "364-ACCEPTANCE.md: the measured phase gate and the live smoke result"
  - "364-FOLLOW-ONS.md: A1-A17 carry-forwards with owner and trigger"
  - "SRM364-01..19 closed [x] with Measured lines"
  - "six Phase 364 rows in docs/CANON-PHASE-MAP.md (Parts 3, 7, 8, 9, 11, 12)"
affects: ["364-12"]
key-files:
  created:
    - .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-ACCEPTANCE.md
    - .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md
  modified:
    - .planning/REQUIREMENTS.md
    - docs/CANON-PHASE-MAP.md
    - tests/fixtures/355-rooms/hit-rate-record.json
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-VERIFICATION.md
decisions:
  - "A red regression found by the gate (364-02's snapshot refresh broke the 355 hit-rate record) was attributed by baseline checkout, then fixed on the navigator's ruling before any requirement row was closed"
  - "Live smoke ran once with the navigator's approval; Theo's real answer today is the honest refusal"
metrics:
  completed: 2026-10-03
  tasks: 3
  files: 6
---

# Phase 364 Plan 11: Phase gate, live smoke, requirement close Summary

The Phase 364 gate is measured (`run-all-364` PASSED=61 FAILED=0 SKIPPED=1 KNOWN=3), the one live Theo smoke ran with approval and shows Theo still refuses honestly, SRM364-01..19 are closed on recorded proof, and the canon map and follow-ons are written.

## Commits

| Commit | What |
|--------|------|
| 02a230d48 | docs(364-11): phase gate measured, follow-ons recorded (364-ACCEPTANCE.md, 364-FOLLOW-ONS.md) |
| f53f346eb | fix(364-11): re-record 355 hit-rate snapshot hash after 364-02 canon refresh |
| 11353f59c | docs(364-11): close SRM364-01..19 on measured proof, record live smoke, resolve A10 |
| 81bcc920f | docs(364-11): Phase 364 canon-map rows (Parts 3, 7, 8, 9, 11, 12) |

All made with `git commit --only`; all are ancestors of HEAD. STATE.md and ROADMAP.md were not touched.

## Measured gate (sandboxed HOME and MINDRIAN_ROOMS_HOME)

- `bash tests/run-all-364.sh`: exit 0, PASSED=61 FAILED=0 SKIPPED=1 (the opt-in smoke) KNOWN=3 (framework and section ledgers on `plugin_version drift`, connector part8 `"layer"`).
- `test-276-tool-honesty-findings-closed` 148/0 (no re-freeze needed), `test-198-local-only` green.
- Every generator `--check` exit 0; `check-cirs-declaration` OK over 14 plans; `check-shape-declaration` has 0 lines naming scientific-roadmap.
- `doctor --acceptance` 16/22; all six failing points are ENV (sandboxed HOME, peer dirt), none names a 364 file.
- `run-all-366`: PASSED=69 FAILED=0 KNOWN=1. `run-all-363`: FAILED=4, none left attributable to 364 after the A10 fix (221 improved; 361 gained `test-fileval-readback` from peer commit 1c3070dc9; dependency leg from peer 369 package.json; 3551 gained the 355 hit-rate red, fixed below).

## Live smoke (navigator reply: "run live smoke")

`MOS_364_LIVE=1 node tests/test-364-live-smoke.cjs`, real HOME, scratch rooms home, exit 0, PASS 4 FAIL 0. Sent only `framework_step {framework: "Scientific Roadmapping"}` and `recommend_chain` for `WellDefined` through the guarded client.

```
LIVE_METRICS {"step_latency_ms":3224,"coverage_latency_ms":1731,"step_ok":false,"step_reason":"step_unauthored","step_count":0,"framework_status":null,"coverage_status":"uncovered","coverage_reason":null}
```

Theo's steps are still unauthored, so the command refuses with "Theo has not authored this step yet"; WellDefined coverage reads `uncovered`.

## Deviations from Plan

**1. [Rule 1 - Bug, found by the gate] 364-02's canon snapshot refresh broke `tests/test-355-hit-rate-record.cjs`**
- **Found during:** Task 1 (run-all-363 regression comparison).
- **Root cause:** `scripts/measure-355-hit-rate.cjs` hashes `data/framework-names.json` into the stored record (`inputs.name_snapshot_source_sha256`, D-51); 364-02 refreshed the snapshot. Proved by baseline checkout (passes at cce8abbbe; fails with only HEAD's snapshot copied in).
- **Fix (navigator ruling):** `node scripts/measure-355-hit-rate.cjs record`. The record diff moved only `name_snapshot_date` and `name_snapshot_source_sha256`. The command also rewrote one line of the 355-VERIFICATION.md hit-rate section, which the test requires to be the record's rendering; committed in the same `--only` commit. Test now 93/0 and `--check` exit 0.
- **Files:** tests/fixtures/355-rooms/hit-rate-record.json, .planning/phases/355-.../355-VERIFICATION.md. **Commit:** f53f346eb. This plan was meant to change no code; this fixture re-record was ordered by the navigator.

**2. [Scope note]** 364-FOLLOW-ONS.md was committed together with REQUIREMENTS.md and ACCEPTANCE.md (11353f59c) because A10 was marked resolved in the same step.

## Deferred / routed

Everything else is in 364-FOLLOW-ONS.md (A1-A17), including A1 (`KNOWN_METHODOLOGIES`), A4 (Desktop and Cowork filing gap), A11 (stale recorded signatures in run-all-363.sh, peer 369 reds).
Not fixed here: `tests/test-canon-crossref-completeness.cjs` fails on Part 9 heading and MINDRIAN-CANON checks unrelated to the new rows (pre-existing).

## Known Stubs

None.

## Threat Flags

None. The only egress was the approved smoke (two generic read-only handles). T-364-48 mitigated (each `[x]` has a Measured line); T-364-50 mitigated (REQUIREMENTS diff confined to the Phase 364 section, `--only` commits); T-364-51 mitigated (no test edited to hide a red; the one red was fixed by regenerating its fixture on a ruling).

## Self-Check: PASSED

Created files exist (364-ACCEPTANCE.md, 364-FOLLOW-ONS.md, this SUMMARY). Commits 02a230d48, f53f346eb, 11353f59c, 81bcc920f are ancestors of HEAD. SRM364-20 and SRM364-21 remain `[ ]` for 364-12. No U+2014 or U+2013 in any added line.
