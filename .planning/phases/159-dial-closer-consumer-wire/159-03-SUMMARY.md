---
phase: 159-dial-closer-consumer-wire
plan: 03
subsystem: dial-decision-loop
tags: [dial, integration-test, live-suppression, part4, part8, part9, tri-polar, phase-gate, tdd]
requires:
  - "scripts/intent-classifier.cjs::consumePriorF1Pick (Phase 159-02 turn-start helper)"
  - "lib/workflow/f1-pick-consumer.cjs::consumeF1Pick (Phase 159-01)"
  - "lib/hmi/f1-pick-capture-cli.cjs::captureCliPick + CAPTURE_ADAPTER_CONTRACT (Phase 159-01)"
  - "lib/workflow/reach-reject-reader.cjs::computeReachPenalties (Phase 158)"
  - "lib/hmi/dial-reach-orchestrator.cjs::buildReachList (Phase 143.1 / 158-03)"
  - "lib/core/navigation.cjs::logMemoryEvent / openRoomDbForCaller / findRecentChanges (Phase 109)"
  - "tests/run-all-158.sh (14/14) + tests/run-all-148.sh (18/18)"
provides:
  - "tests/test-159-integration-2turn-suppress.cjs (DCW-09 LIVE producer->consumer->penalty proof; RED on consumer removal)"
  - "tests/test-159-part8-secretreason-sweep.cjs (DCW-05 behavioral + source Part 8 sweep over the real consumer path)"
  - "tests/run-all-159.sh (DCW-10 one-command phase gate; 158 + 148 passthroughs + Part 8/9 sweeps)"
  - "docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md (DCW-07 Desktop/Cowork capture-adapter seam contract + deferral)"
affects:
  - "Phase 158 is now proven to suppress LIVE from REAL recorded rejects (not only seeded rows)"
  - "the v1.13.1 milestone gate: run-all-159.sh is the one-command 159 phase gate"
tech-stack:
  added: []
  patterns:
    - "REAL-row fixture mechanism (trace files + real room.db via consumePriorF1Pick) mirroring test-159-turn-start-wiring.cjs -- NOT the 158 roomState injection seam (MEDIUM-1)"
    - "one parameterized driver (runLoop, consumer on/off flag) shared by Test 2 (suppress) + Test 3 (negative-control RED-on-removal)"
    - "MEDIUM-1 anti-vacuous guard: roomState passed to computeReachPenalties asserts NO presentationsCount / NO rejectCountInWindow key, so suppression reads the db"
    - "SECRETREASON159 tripwire (Phase 158 idiom) seeded into the pick text, read back over EVERY stored row value"
    - "run-all-15x.sh aggregator idiom (strip_comments grep-gate hygiene; gate on exit code, never a tally)"
key-files:
  created:
    - "tests/test-159-integration-2turn-suppress.cjs"
    - "tests/test-159-part8-secretreason-sweep.cjs"
    - "tests/run-all-159.sh"
    - "docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md"
    - ".planning/phases/159-dial-closer-consumer-wire/deferred-items.md"
  modified: []
decisions:
  - "the integration test drives the REAL Wave-2 consumePriorF1Pick over REAL trace files + a real room.db, NOT the 158 injection seam (MEDIUM-1 anti-vacuous guard)"
  - "Test 2 (suppress) and Test 3 (negative-control) share ONE parameterized driver (runLoop) differing only in a consumer-on/off flag, so removing the consumer flips Test 2 into Test 3's outcome (RED-on-removal)"
  - "the M-floor is satisfied with M(=2) REAL reach_presented rows via navigation.logMemoryEvent (parole-safe: 2 % 5 != 0), never an injected presentationsCount"
  - "run-all-159.sh gates on EXIT CODE only (the 158/148 aggregators add sweep parts to their TOTALs, so the real CJS-suite counts are 11/8 not 14/18); 148 runs twice by design per the DCW-10 literal"
metrics:
  duration: "~30m"
  completed: "2026-06-15"
  tasks: 3
  files: 5
---

# Phase 159 Plan 03: dial-closer-consumer-wire Wave 3 Summary

The whole producer->consumer->penalty loop is now proven to fire LIVE and is locked behind a one-command gate. A scripted 2-turn integration test drives turn N (persist a REAL `f1_closer_payload` to the decision-trace file) then turn N+1 (feed a reject pick through the Wave-2 `consumePriorF1Pick`) against a real `room.db`, repeats to 3 REAL recorded rejects of one reach plus M(=2) REAL `reach_presented` rows, then runs `computeReachPenalties` (over a `roomState` carrying NO injected-counter keys) into the PURE `buildReachList` and asserts `deep_research` is ABSENT. A negative-control sharing the same parameterized driver proves the test goes RED if the consumer is removed. `tests/run-all-159.sh` is the one-command phase gate (all 159 suites + Part 8/9 sweeps + the carried 158 and 148 passthroughs), and the Desktop/Cowork capture-adapter seam is documented with the live-capture deferral recorded.

## What shipped

| Task | What | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | 2-turn producer->consumer->penalty LIVE suppression test (RED on consumer removal) | `23a5fb4b` | tests/test-159-integration-2turn-suppress.cjs |
| 2 | Part 8 SECRETREASON159 behavioral + source sweep over the real consumer path | `7f384b82` | tests/test-159-part8-secretreason-sweep.cjs |
| 3 | run-all-159.sh one-command gate + Desktop/Cowork seam doc + deferred-items | `39059029` | tests/run-all-159.sh, docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md, .planning/.../deferred-items.md |

## The MEDIUM-1 anti-vacuous guard (load-bearing, do NOT regress)

The integration test uses REAL rows, NOT the Phase 158 `roomState` injection seam, for the FIXTURE mechanism:

- The fixture mirrors `test-159-turn-start-wiring.cjs` (REAL decision-trace files + a real `room.db` via the shipped `openRoomDb`) and `test-158-reach-presentation-counter.cjs` + `test-158-reach-reject-only.cjs` (REAL rows via `navigation.logMemoryEvent` / the live consumer -> `recordSelectorDecision`).
- `test-158-reach-hard-suppress.cjs` is used ONLY as the reference for a parole-safe presentation count (pres meets M=2 and is not on a P=5 boundary: `2 % 5 != 0`), NEVER for its `roomState` injection style.
- The M-floor is satisfied with M(=2) REAL `reach_presented` rows via `navigation.logMemoryEvent(db,'reach_presented',{reach_id:'deep_research'})`.
- The `roomState` passed to `computeReachPenalties` carries **NO** `presentationsCount` key and **NO** `rejectCountInWindow` key -- asserted explicitly via `hasOwnProperty` in both Test 2 and Test 3 -- so suppression is provably **READ FROM THE DB**, not the injection seam. Otherwise "reach absent" could pass for the wrong reason and the LIVE proof would be vacuous.

Test 2 additionally reads back the DB through the chokepoint and asserts `rejectCountInWindow(db, ...) === 3` and `presentationsCount(db, ...) >= 2` from the REAL rows before computing penalties, so the suppression is grounded in observed DB state.

## RED-on-consumer-removal (proven, not asserted)

Test 2 (suppress) and Test 3 (negative-control) share ONE parameterized driver (`runLoop`) differing only in a `consumer` on/off flag:

- `consumer: true`  -> turn N+1 drives the LIVE `consumePriorF1Pick`; 3 REAL keyed reject rows land; `deep_research` is suppressed -> ABSENT from `buildReachList`.
- `consumer: false` -> the consumer is bypassed; 0 rejects recorded; `computeReachPenalties` reads 0 -> `deep_research` is NOT suppressed -> PRESENT.

Removing the consumer flips Test 2 into Test 3's outcome. This was verified empirically during execution: neutering `consumeF1Pick` (injecting an early `{ok:false}` return) made the suite exit 1 on Test 1/2; restoring it returned to PASS. The test is genuinely load-bearing, not incidental (T-159-09 mitigated).

## Test results

| Suite / sweep | Result |
| ------------- | ------ |
| tests/test-159-integration-2turn-suppress.cjs | PASS (3 checks: one-loop keyed row, 3-reject live suppress from DB, negative-control NOT-suppressed) |
| tests/test-159-part8-secretreason-sweep.cjs | PASS (3 checks: reject-path zero leak, Free-Text-escape zero decision leak, source backstop) |
| tests/run-all-159.sh (the one-command gate) | PASS -- exit 0 (159: 10/10) |
| -- 6 test-159-*.cjs suites | all PASSED |
| -- Part 8 pick-text-to-Brain sweep | PASSED |
| -- Part 9 chokepoint sweep | PASSED |
| -- 158 passthrough (bash tests/run-all-158.sh) | PASSED (14/14) |
| -- frozen-148 passthrough (bash tests/run-all-148.sh) | PASSED (18/18) -- runs twice by design (nested in 158 + standalone) |

## run-all-159.sh structure (DCW-10)

Mirrors `run-all-158.sh` exactly (`set -uo pipefail`, `strip_comments` grep-gate hygiene, per-suite PASS/FAIL line, final tally, exit 1 if anything failed). It gates on the **EXIT CODE only**, never a hardcoded count tally: the 158/148 aggregators add their own sweep parts to TOTAL, so the published 14/14 + 18/18 figures count those sweeps; the bare CJS-suite counts are 11/8. Asserting a literal tally here would be brittle. A one-line comment notes 148 runs twice by design (the DCW-10 literal requires both the 158 and 148 passthroughs present in `run-all-159.sh`, and 158 already carries 148 internally).

## Part 8 sweep (DCW-05): a real finding-detector, clean result

The SECRETREASON159 sweep seeds a unique marker into the navigator's raw pick text, drives the full `captureCliPick -> consumeF1Pick -> closeOffer -> recordSelectorDecision` path over a real `room.db` (both the reject decision-edge path and the Free-Text miss escape), reads back EVERY stored `f_selector_decision` + `memory_event` row value, and asserts the marker appears in ZERO of them. A source backstop confirms neither new consumer file (`f1-pick-consumer.cjs` + `f1-pick-capture-cli.cjs`) forwards pick text toward `buildBrainPacket` / a Brain client / a network call. Result: clean -- the pick text rode the FIX-05 LOCAL lane and was classified to a scalar at the write seam, never stored (T-159-11 mitigated). No real finding to report.

## Desktop/Cowork seam (DCW-07)

`docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md` documents the Tri-Polar capture-adapter seam: the `captureSurfacePick(surfaceAnswer, priorPayload) -> { pick:{verb,outcome}, sentence? }` contract, the expected pick shape `consumeF1Pick` consumes, the Part 8 LOCAL-lane discipline, and the Part 9 chokepoint discipline. CLI is recorded as live + tested; Desktop and Cowork are seam-only with LIVE conversational capture explicitly DEFERRED (DI-159-01 in `deferred-items.md`). The doc references the exported `CAPTURE_ADAPTER_CONTRACT` constant from Wave 1 as the source of truth.

## Deviations from Plan

### Auto-fixed blocking issue

**1. [Rule 3 - Blocking] Pass the offer framework scaffold to consumeF1Pick in the Part 8 sweep**
- **Found during:** Task 2 (first run returned `invalid_framework`).
- **Issue:** `recordSelectorDecision` hard-requires a non-empty `framework` (the decision edge `target_id` is `framework:<framework>`). When calling `consumeF1Pick` directly (not via the Wave-2 helper that reads `payload.framework` into `roomState.offer`), the offer scaffold lacked a framework, so the reject path no-opped with `invalid_framework` and the sweep could not exercise a real write.
- **Fix:** Pass `roomState.offer = { framework: FW }` on the direct `consumeF1Pick` calls in the sweep (the same generic handle the Wave-2 helper carries; a methodology name, never user content -- Part 8 safe). This is a TEST-side fix, not a production-logic change.
- **Files modified:** tests/test-159-part8-secretreason-sweep.cjs (only).
- **Commit:** `7f384b82`

No production logic was changed in this wave. The plan's "no production logic changes" constraint held: `git diff --name-only 99a4d163..HEAD` shows exactly the 5 new artifacts (2 tests, the gate, the seam doc, deferred-items) -- zero `lib/` / `scripts/` edits.

## Frozen-contract / spine integrity (DCW-10)

- No frozen-148 constant, the `0.40/0.30/0.30` weights, or any closer outcome semantic was edited anywhere in this wave (T-159-10 mitigated). `run-all-148.sh` (18/18) + `run-all-158.sh` (14/14) green INSIDE `run-all-159.sh`.
- The integration test uses the frozen `REACH_IDS` member `'deep_research'` and reads N/M/P from the shipped reader; it declares no penalty constants of its own.
- Zero new dependencies (Phase 87 invariant). CJS + bash, no em-dashes (verified with a U+2014 scan).

## Threat register dispositions met

- **T-159-09** (loop claims live but only seeded): mitigated -- the 2-turn test drives the REAL consumer (REAL rows, no injection seam) and the negative-control proves RED-on-removal (verified empirically).
- **T-159-10** (frozen-148 / weights drift): mitigated -- run-all-159.sh carries both 148 (18/18) and 158 (14/14) passthroughs; any drift fails the gate.
- **T-159-11** (pick text leaks): mitigated -- SECRETREASON159 behavioral + source sweep, zero stored marker.
- **T-159-12** (grep-gate self-invalidation): mitigated -- strip_comments before every grep sweep.
- **T-159-SC** (installs): mitigated -- zero new dependencies, no install task.

## Self-Check: PASSED

- Created files: all 5 FOUND on disk (2 tests, gate, seam doc, deferred-items).
- Commits: 23a5fb4b, 7f384b82, 39059029 all FOUND in git log.
- bash tests/run-all-159.sh exits 0 (verified; 159: 10/10, 158: 14/14, 148: 18/18).
- LIVE 2-turn suppression passes from REAL rows (not injected): verified, MEDIUM-1 hasOwnProperty assertions in place.
- RED-on-consumer-removal: verified empirically (neuter -> exit 1; restore -> exit 0).
- No em-dashes in any new file (U+2014 scan clean).
- No production logic changed (git diff 99a4d163..HEAD = 5 non-production files).
