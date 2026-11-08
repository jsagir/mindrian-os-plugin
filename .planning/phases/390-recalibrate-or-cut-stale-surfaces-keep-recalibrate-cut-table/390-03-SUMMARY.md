---
phase: 390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table
plan: 03
subsystem: testing
tags: [removal-proof, test-helper, aggregator, template, wave-0]
requires: []
provides:
  - tests/helpers/390-removal-check.cjs (checkRemoval)
  - tests/test-390-removal-helper.cjs (15 arms)
  - tests/run-all-390.sh (phase aggregator)
  - 390-removal-test.template.cjs (copy-and-fill template for later waves)
affects: [every later Phase 390 removal wave]
tech-stack:
  added: []
  patterns: [failing-test-first, glob discovery with found-equals-0 guard, needle by concatenation]
key-files:
  created:
    - tests/helpers/390-removal-check.cjs
    - tests/test-390-removal-helper.cjs
    - tests/run-all-390.sh
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-removal-test.template.cjs
  modified: []
key-decisions:
  - "Helper read() returns a Buffer so the NUL-byte and 5 MB skips apply to injected data and to real files in the same way."
  - "Default read() refuses any path that resolves outside the repo root."
  - "Template computes its own repo path with path.relative and passes it as self, so a copy in tests/ or in the phase folder is never swept."
requirements-completed: [R390-CUT-n]
duration: about 20 min
completed: 2026-11-08
---

# Phase 390 Plan 03: Removal-test template, shared helper and phase aggregator Summary

One shared helper (checkRemoval), a copy-and-fill template, and a glob-based aggregator, each shown by a test to be able to fail. No product file changed.

## RED output

Task 1 RED (helper absent), `node tests/test-390-removal-helper.cjs`, exit 1:

```
FAIL H1 a clean synthetic tree gives no failure: Cannot find module './helpers/390-removal-check.cjs'
FAIL H2 a path that is still tracked gives TRACKED: Cannot find module './helpers/390-removal-check.cjs'
FAIL H3 ... (same for H1 to H12)
```

Task 2 RED (template absent), after the helper existed, exit 1:

```
ok   H1 ... H12
FAIL H13 the template file is valid JavaScript (node --check): template is missing: .planning/phases/390-.../390-removal-test.template.cjs
FAIL H14 the unfilled template exits non-zero and prints TEMPLATE-NOT-FILLED: template is missing: ...
FAIL H15 the template header names the copy target and the proof gates: template is missing: ...
```

## GREEN output

- `node tests/test-390-removal-helper.cjs`: H1 to H15 all print `ok`, exit 0.
- Unfilled template, `node .../390-removal-test.template.cjs`: prints `FAIL TEMPLATE-NOT-FILLED: TEMPLATE-NOT-FILLED`, exit 1.
- A scratch copy with the four constants filled (removed afterward) failed with `NAMED deep-links in tests/test-385-deep-links-removed.cjs`. This is correct: that file names the needle in its own name. It shows the template can fail on a real tree.
- `TEST_390_PREFIX=tests/test-390-nonexistent- bash tests/run-all-390.sh`: prints `!!! no tests/test-390-nonexistent-* files discovered`, exit 1.
- `bash tests/run-all-390.sh`: helper test PASSED, dash fence PASSED, `Phase 390: PASS=2 FAIL=0 SKIPPED=0`, exit 0.
- Non-ASCII scan of all four new files: no hit (no em dash, no en dash).

run-all-390.sh is not registered in tests/run-all-366.sh because a peer session holds uncommitted edits there; the first later wave registers it.

## Deviations from Plan

**1. [Process] Arms H13 to H15 were written in the same first Write as H1 to H12.**
- The RED output for Task 1 therefore shows H13 to H15 failing for a missing template as well. The helper arms H1 to H12 failed for the missing helper, as required. A separate Task 2 RED run was kept after the helper existed (above).
- Task 1 verify command expects 12 `ok   H` lines; the final file has 15 by design (Task 2 adds H13 to H15).

**2. [Scope] STATE.md and ROADMAP.md.** The plan text says not to edit them. The orchestrator asked for gsd-tools updates with unrelated-line revert. See the orchestrator report for what changed.

No other deviation. Known stubs: none (the FILL-ME values in the template are the intended guard).

## Self-Check: PASSED

Four new files exist; helper test, aggregator and guard runs verified above. Commit sha is in the report.
