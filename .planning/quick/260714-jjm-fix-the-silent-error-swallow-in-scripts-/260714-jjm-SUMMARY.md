---
phase: quick-260714-jjm
plan: 01
subsystem: eureka
tags: [eureka, entity-extract, silent-swallow, observability, T-218-VD-5, david-session, silent-skip-false-success]
requires:
  - scripts/eureka-command.cjs (maybeExtractFirst / cmdRun)
  - scripts/entity-extract.cjs (cmdRun failed-status.json contract, byte-unchanged)
provides:
  - eureka status.json extraction_error field (additive, absent on success)
  - one-line stderr surfacing of a failed entity-extraction pre-step
  - reproduction test legs 5/6/7 wired into run-all-218.sh
affects:
  - "/mos:eureka run and start (foreground + detached observability)"
tech-stack:
  added: []
  patterns:
    - additive observability keys (mirror of entity-extract.cjs tier-2 keys, 260714-hzx)
    - degrade-never-throw with surfacing (failure visible, ranking never blocked)
    - in-process monkey-patch of a shared module.exports property for testing
key-files:
  created:
    - .planning/quick/260714-jjm-fix-the-silent-error-swallow-in-scripts-/deferred-items.md
    - .planning/quick/260714-jjm-fix-the-silent-error-swallow-in-scripts-/260714-jjm-SUMMARY.md
  modified:
    - scripts/eureka-command.cjs
    - tests/test-218-eureka-auto-extract.cjs
    - tests/run-all-218.sh
    - .planning/debug/interns-round-eureka-david-session-2026-07-14.md
    - "~/MindrianRooms/rethinking-mindrianos/research/2026-07-14-academy-tester-qa-silent-skip-false-success/ (room entry, auto-committed by hook)"
decisions:
  - "Surface via BOTH status.json field and one stderr line - the detached cmdStart path uses stdio ignore, so status.json is the only visible trail there"
  - "Return the failure detail from maybeExtractFirst and thread it through cmdRun - a direct status write inside maybeExtractFirst would be clobbered by the running-state writeStatus"
  - "Read both failure paths: a throw AND a non-zero return code (the likelier David mechanism, where entity-extract catches internally and returns 1)"
  - "Kept the incident file status investigating - the fix proves the mechanism plausible but David's actual room state is still unconfirmed"
metrics:
  duration: ~20m
  completed: 2026-07-14
---

# Phase quick-260714-jjm Plan 01: Fix the Silent Error-Swallow in eureka-command.cjs Summary

Made a silent entity-extraction pre-step failure impossible to miss - it now surfaces as an additive `extraction_error` field in the eureka status.json plus one stderr line, with ranking, fallback, and exit codes unchanged (degrade-never-throw intact) - and proved via a RED-then-GREEN reproduction test that a silent extraction failure reproduces the exact David-session "exit 0 / state done / zero surfaced error" false-success shape.

## What Was Built

**Task 1 (TDD, two commits):** Added reproduction legs 5/6/7 to `tests/test-218-eureka-auto-extract.cjs`, then the surfacing fix in `scripts/eureka-command.cjs`.
- Leg 5 (throw path): a thrown `ENTITY_EXTRACT.main` must surface `extraction_error` plus one stderr line.
- Leg 6 (caught exit-1 path, the likelier David mechanism): a non-zero return where entity-extract writes its own `state: 'failed'` status.json must surface that error field.
- Leg 7 (control): a clean run writes NO `extraction_error` key (absent, not falsy).
- Fix: `maybeExtractFirst` returns a failure-detail string on either path (or null on skip/success), writes exactly one stderr line, and `cmdRun` threads `extraction_error` additively into all four `writeStatus` payloads via conditional spread.

**Task 2 (one commit):** Wired the auto-extract test into `tests/run-all-218.sh` as the `T-218-VD-5` leg (it was previously in NO aggregator - a wiring gap this closed). `run-all-218.sh` now reports PASS=15 FAIL=0.

**Task 3 (one commit):** Appended Addendum 2 to the incident file with the RED-run evidence verbatim, filled the Resolution block (files_changed + commits), kept status `investigating`, and composited instance #4 (FIXED with test coverage) into the `rethinking-mindrianos` room research entry.

## Reproduction Evidence (RED, pre-fix HEAD)

Leg 5 against pre-fix HEAD produced exactly the David-session shape:

```
exit code 0
eureka status.json: {"state":"done","started_at":"...","finished_at":"...","pid":...,
  "out":".../portfolio-report.md","json":".../portfolio-report.json"}
```

Exit 0, state `done`, zero `extraction_error` - total silence. Post-fix all 8 legs are green.

## Verification

- `node tests/test-218-eureka-auto-extract.cjs` -> `8/8 legs PASSED`.
- `bash tests/run-all-218.sh` -> `Phase 218: PASS=15 FAIL=0 SKIP=0` (includes the new T-218-VD-5 leg).
- `git diff --exit-code` on the four extraction-logic files (`scripts/entity-extract.cjs`, `lib/core/eureka/entity-extractor.cjs`, `entity-classifier.cjs`, `portfolio-dimensions.cjs`) -> clean (byte-unchanged, scope rule held).
- `grep -c extraction_error scripts/eureka-command.cjs` -> 8 (>= 4 required).
- `node tests/test-216-eureka-command.cjs` -> 44 assertions passed (dispatcher run path unregressed).
- No em-dashes in any touched file.

## Deviations from Plan

### Out-of-scope discovery (not fixed, logged)

**1. [SCOPE BOUNDARY] run-all-216.sh reports FAIL=1 due to a pre-existing shape-declaration strict-gate failure**
- **Found during:** Task 2 regression sweep.
- **Issue:** `bash tests/run-all-216.sh` ends `FAIL=1`. The failing leg is `216-03 gate: shape declaration (strict)`, NOT the eureka dispatcher e2e leg. It fails because 24 `skills/*/SKILL.md` files each declare both a `hitl_shape` fork AND `connector.excluded:true` simultaneously, which Canon Part 11 forbids. This is an ADVISORY signal in normal use (WARN); only `--strict`, which the aggregator runs, hard-fails.
- **Why out of scope:** this task touched zero `skills/` files - only `scripts/eureka-command.cjs`, the test, and `run-all-218.sh`. The failure is pre-existing drift unrelated to the silent-swallow fix. Per the SCOPE BOUNDARY rule, pre-existing failures in unrelated files are not auto-fixed.
- **Regression proof for the change under test:** the dispatcher e2e leg (`tests/test-216-eureka-command.cjs`, the one the plan named as exercising the edited run path) passes with 44 assertions - the dispatcher change is unregressed.
- **Action taken:** logged to `deferred-items.md` with the full affected-skill list and the recommended fix (`node scripts/backfill-hitl-shape.cjs` or hand-author per `docs/HITL-SHAPE-DECLARATION-CONTRACT.md`) in a dedicated session. NOT fixed here.

The plan's Task 2 verify predicate (`run-all-216 ends FAIL=0`) is therefore not literally met, but the plan's stated INTENT for that check ("its leg 2 e2e test-216-eureka-command.cjs exercises the edited dispatcher run path end to end, proving no regression") IS met: that leg is green.

## Room Compositing Note

The `rethinking-mindrianos` room research entry at `~/MindrianRooms/rethinking-mindrianos/research/2026-07-14-academy-tester-qa-silent-skip-false-success/` was updated with an "Instance #4 addendum" recording the eureka `maybeExtractFirst` swallow as FIXED-with-test-coverage (the first instance in that cluster closed at the code level). The room has its own `data-room-autocommit` hook, which auto-committed the edit. No mirror exists under `~/MindrianOS/research/` for this specific entry (only the sibling `2026-07-14-eureka-ranking-bug-and-what-why-classifier/` entry has one), so no mirror update was applicable.

## Commits

- `4f0cab3c` test(quick-260714-jjm): add RED reproduction legs for the silent extraction-failure swallow
- `2a80ad29` fix(quick-260714-jjm): surface entity-extraction pre-step failures into eureka status.json and stderr
- `98e3fff9` test(quick-260714-jjm): wire eureka auto-extract test into the 218 aggregator
- `c15da7fc` docs(quick-260714-jjm): close the David-session addendum loop - silent-failure mechanism confirmed plausible, fix live

## Self-Check: PASSED
