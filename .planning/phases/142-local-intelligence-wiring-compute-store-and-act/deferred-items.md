# Phase 142 Deferred Items

Out-of-scope discoveries logged during execution. Not fixed here per the
executor SCOPE BOUNDARY rule (only auto-fix issues DIRECTLY caused by the
current task's changes).

## DI-142-01 (from 142-04 execution): test-derivation-drain-fires.cjs is cold-start flaky

- **Owner:** Plan 142-03 (NAV-03), not 142-04.
- **Symptom:** `tests/test-derivation-drain-fires.cjs` subtest (b) -- the shipped
  drain SCRIPT `--dry-run` end-to-end check -- intermittently fails on the FIRST
  invocation after an idle gap with empty stdout ("got: "), then PASSES on the
  immediate re-run. Observed: run1 exit 1, run2 exit 0, with NO preceding test.
- **Decoupled from 142-04:** the failing test and its script
  (`scripts/brain-derivation-drain.cjs`, `lib/core/brain-derivation-queue.cjs`)
  import none of the three files 142-04 touched
  (`lib/core/brain-derivation.cjs::ensureSectionDerived`,
  `lib/core/navigation/file-evidence-readback.cjs`, `lib/core/navigation.cjs`).
  `ensureSectionDerived` touches neither the derivation queue nor
  `MINDRIAN_BRAIN_KEY`, so it cannot pollute the drain test's state. Re-running
  `bash tests/run-all-142.sh` twice in a row yielded 7/7 PASS both times.
- **Likely root cause:** a first-run cold-start / Brain session-init timing race
  in the drain script subprocess when `MINDRIAN_BRAIN_KEY` is force-set by the
  test (test line ~88). Needs a deterministic wait / retry or a stubbed Brain
  session in the subtest.
- **Action:** leave to the 142-03 owner. Do NOT fix in 142-04 (out of scope).
