---
phase: quick-261019-gct
plan: 261019-gct
subsystem: part8-egress-guard
tags: [part8, egress-guard, theo-parity, release-gate]
requires: []
provides:
  - PROCESS_STEP_ID_RE equal to Theo PROCESS_STEP_ID_PATTERN (Theo a338354a)
  - behavior test for the framework_step step_id arm, hard leg in run-all-366.sh
key-files:
  created:
    - tests/test-gct-process-step-id-parity.cjs
  modified:
    - lib/core/part8-egress-guard.cjs
    - tests/run-all-366.sh
metrics:
  completed: 2026-10-19
---

# Quick 261019-gct: Sync PROCESS_STEP_ID_RE to Theo's widened pattern

One-liner: the plugin framework_step step_id regex now equals Theo's widened PROCESS_STEP_ID_PATTERN byte-for-byte (phase42::, export13- ids, 160-char cap), with a behavior test wired into the release suite.

## Commits

- 0c6e3ed55 test(quick-261019-gct): pin the widened framework_step step_id shapes (RED)
- 75b803667 fix(quick-261019-gct): sync PROCESS_STEP_ID_RE to Theo's widened PROCESS_STEP_ID_PATTERN

Each commit touches only its owned files (verified with git show --stat). The guard commit numstat is 2 added, 1 removed.

## RED and GREEN

RED (before the fix): `node tests/test-gct-process-step-id-parity.cjs` exit 1. The FAIL lines named only A2 (phase42 framework id), A3 (phase42 command id), A4 (export13 id) and R4 (161-char id, allowed by the old copy). Leg P and the no-network check passed.

GREEN (after the fix):
- test-gct-process-step-id-parity: `PASSED=72 FAILED=0 (checks=72)`, exit 0.
- test-361-theo-parity: `PASS: test-361-theo-parity (8 checks)`, Leg 3b PASS.
- test-361-egress-shapes: `PASS (121 assertions)`. test-369.26-part8: `15 passed, 0 failed`.
- The one-off scratchpad script (outside the repo) copied the literal from Theo's vocabulary.ts and printed EQUAL.

## run-all-366 before and after

Before (gct-366-fails-before.txt), PASSED=71 FAILED=3 KNOWN=1:
- 270 tool schema budget
- 366 guard navigator release (check G9 tests/test-361-theo-parity.cjs exit 1)
- 366 semantic index integrity

After (gct-366-fails-after.txt), PASSED=73 FAILED=2 KNOWN=1:
- 270 tool schema budget (pre-existing, unrelated: toolCount +12 delta check)
- 366 semantic index integrity (known I3 out-of-scope red)

The new gct leg is PASSED. The "366 guard navigator release" leg is PASSED (48 pass, 0 fail); G9 now passes for test-361-theo-parity.cjs. No new FAILED leg.

## Note

tests/test-361-theo-parity.cjs itself runs in run-all-361.sh and run-all-363.sh, and through check G9 of tests/test-366-guard-navigator-release.cjs, which is in run-all-366.sh (the release gate suite). The new gct leg adds a direct behavior pin in the release suite.

## Deviations from Plan

None - plan executed as written. The baseline suite run finished before the run-all-366.sh edit, so the baseline was not disturbed by the edit.

## Known Stubs

None.

## Threat Flags

None. T-gct-01 (accepted): the widened phase42 slug form can admit a lowercase slug of a name; scanForContent and the exact CANONICAL_PHRASES framework check still run first. T-gct-02 to T-gct-04 mitigations applied.

## Self-Check: PASSED

- FOUND: tests/test-gct-process-step-id-parity.cjs
- FOUND commits 0c6e3ed55 and 75b803667, both ancestors of HEAD.
- No em-dash or en-dash in the 3 owned files.
