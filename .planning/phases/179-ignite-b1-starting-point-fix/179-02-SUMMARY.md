---
phase: 179-ignite-b1-starting-point-fix
plan: 02
subsystem: api
tags: [scratchpad, birth-gate-answers, role-blend, blueprint-family, hypothesis, persistence, cjs]

# Dependency graph
requires:
  - phase: 155-01
    provides: writeScratchpadBirthAnswer + readScratchpad + birth_gate_answers journal + drainBirthGateAnswers delegation
  - phase: 179-01
    provides: GA-4 card-fire interceptor (Wave 1) + tests/run-all-179.sh aggregator scaffold
provides:
  - "writeScratchpadBirthAnswer persists role_blend (object-guard) + blueprint_family (string-guard) + hypothesis_text (string-guard) additively"
  - "the B1 persona/hypothesis signal now survives a session boundary to B2 (no longer silently dropped)"
  - "tests/test-scratchpad-birth-whitelist-179.cjs round-trip proof (16/16) wired into run-all-179.sh Wave 2"
affects: [179-03, 179-04, 179-06, 179-07, ignite-b1, room-birth, drainBirthGateAnswers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive optional-field whitelist: object-shape guard (plain non-null non-array) for role_blend; typeof-string guard for the two string fields; absent fields leave the entry byte-identical (keys absent, not present-as-null)"
    - "Session-boundary round-trip test via fresh module re-require after an on-disk write (HOME isolated with fs.mkdtempSync)"

key-files:
  created:
    - tests/test-scratchpad-birth-whitelist-179.cjs
  modified:
    - lib/core/scratchpad-ops.cjs

key-decisions:
  - "Test filename is tests/test-scratchpad-birth-whitelist-179.cjs (the -179 path the run-all-179.sh aggregator already references), not the bare path the plan body names -- so the phase gate goes green without editing the aggregator"
  - "role_blend guarded by a plain-object check (truthy AND typeof object AND not Array), mirroring the existing defensive typeof-string idiom; null/array/number/object-for-strings are dropped"

patterns-established:
  - "Pattern 1: widen a persistence whitelist additively without touching the function signature or the always-present fields"
  - "Pattern 2: prove read-side survival (drainBirthGateAnswers) via the round-trip test rather than mutating the drain -- the drain reads the whole entry object, so additive keys ride for free"

requirements-completed: [REQ-09]

# Metrics
duration: 9min
completed: 2026-06-25
---

# Phase 179 Plan 02: Widen the Scratchpad Birth-Answer Whitelist Summary

**writeScratchpadBirthAnswer now persists role_blend + blueprint_family + hypothesis_text additively, so the B1 persona/hypothesis signal survives a session boundary to B2 instead of being silently dropped (SPEC Req 9).**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-25T00:00:00Z
- **Completed:** 2026-06-25
- **Tasks:** 1 (TDD)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Widened the `writeScratchpadBirthAnswer` optional-field whitelist (scratchpad-ops.cjs) to persist three new fields the B1 4-door gate captures: `role_blend` (plain-object guard), `blueprint_family` (string guard), `hypothesis_text` (string guard).
- Proved the full session-boundary round-trip: a write followed by a fresh-module re-read recovers all three intact (role_blend deep-equal, the two strings ===); the drain reads the whole entry so the additive keys ride for free.
- Confirmed the additive guarantee: an entry written with none of the three new fields is byte-identical to the pre-change shape (the keys are absent, not present-as-null); existing `free_text` + `arrival_asset` persistence is byte-identical.

## Task Commits

Each step was committed atomically (TDD cycle):

1. **Task 1 RED: failing round-trip test** - `5f815954` (test)
2. **Task 1 GREEN: widen the whitelist** - `ef3e41d5` (feat)

No REFACTOR commit: the change is a minimal additive block; no cleanup warranted.

**Plan metadata:** see final docs commit below.

## Files Created/Modified
- `lib/core/scratchpad-ops.cjs` - widened the `writeScratchpadBirthAnswer` optional-field block (lines after the free_text/arrival_asset guards) with role_blend (object-shape guard) + blueprint_family + hypothesis_text (string guards). Function signature and the always-present fields (gate_id/option_key/canonical_verb/alias_label/ts) untouched; `_writeAtomic` untouched.
- `tests/test-scratchpad-birth-whitelist-179.cjs` - new round-trip proof suite (16 assertions across 4 groups): session-boundary round-trip of the three new fields, additive-shape (keys absent not null), existing-field invariance, type discipline (malformed dropped).

## Decisions Made
- Named the test `tests/test-scratchpad-birth-whitelist-179.cjs` (the `-179` path `tests/run-all-179.sh` already references via `run_if`), rather than the bare `tests/test-scratchpad-birth-whitelist.cjs` the plan body names. This makes the phase aggregator pick the suite up and flip Wave 2 from SKIP to PASS with zero aggregator edit. Documented as a minor naming reconciliation, not a behavior change.
- `role_blend` guarded by a plain-object check (`answer.role_blend && typeof === 'object' && !Array.isArray`), mirroring the existing `typeof === 'string'` defensive idiom; arrays, null, and non-objects are dropped (T-179-05 tampering guard exercised by the test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test path reconciled to the aggregator-referenced name**
- **Found during:** Task 1 (authoring the round-trip test)
- **Issue:** The plan body names the test `tests/test-scratchpad-birth-whitelist.cjs`, but `tests/run-all-179.sh` (shipped by 179-01) wires the Wave-2 SKIP guard to `tests/test-scratchpad-birth-whitelist-179.cjs`. Using the bare name would have left the phase gate SKIPPING Wave 2 forever (the success criterion "Wave 2 now passing" would not be met).
- **Fix:** Authored the test at the `-179` path the aggregator references. No aggregator edit needed.
- **Files modified:** tests/test-scratchpad-birth-whitelist-179.cjs (created)
- **Verification:** `bash tests/run-all-179.sh` now reports "179-02 scratchpad-whitelist (W2): PASSED" (was SKIPPED); exit 0.
- **Committed in:** 5f815954 (RED) / ef3e41d5 (GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** A naming reconciliation required to satisfy the phase gate. No scope creep; no behavior change; the SPEC Req 9 contract (round-trip the three fields) is met exactly as written.

## Issues Encountered
None.

## Verification (acceptance commands, all GREEN)
- `node tests/test-scratchpad-birth-whitelist-179.cjs` -> 16/16, exit 0 (session-boundary round-trip + additive shape + existing-field invariance + type discipline).
- `grep -n 'role_blend' | 'blueprint_family' | 'hypothesis_text' lib/core/scratchpad-ops.cjs` -> each returns matches.
- `grep -nE 'fetch|http|curl|brain\.mindrian|tavily|mcp__brain' lib/core/scratchpad-ops.cjs` -> zero matches (Part 8 LOCAL sweep clean; role_blend weights + hypothesis_text never egress to Brain).
- `grep -nP '\x{2014}|\x{2013}'` over both touched files -> zero matches (no em-dashes).
- `node tests/test-scratchpad-birth-answers.cjs` -> exit 0 (pre-existing 155-01 suite, no regression).
- `lib/core/navigation/room-birth.cjs` -> `git status --short` empty (drain-side txn byte-unchanged, as the hard rules require).
- `bash tests/run-all-179.sh` -> Passed 6 / Failed 0 / Skipped 5, exit 0. Wave 1 (179-01 GA-4 interceptor) still green; Wave 2 (this plan) now passing; frozen drift fences (reach-ids 6, posture-ids 3) green.

## Known Stubs
None. The three fields are wired end-to-end (write -> persist -> fresh read -> drain reads the whole entry). The weighted multi-axis role_blend computer and the 3 missing CV detectors are explicitly OUT of this plan (SPEC out-of-scope, deferred fast-follow) and are not stubs introduced here.

## Threat Flags
None. No new network endpoint, auth path, file access pattern, or schema change at a trust boundary. The change widens an existing LOCAL persistence chokepoint only; the plan's threat register (T-179-04 info-disclosure, T-179-05 tampering) is mitigated (Part 8 LOCAL sweep clean; object-shape guard + the malformed-input test).

## Next Phase Readiness
- The B1 -> B2 bus now carries `{role_blend, blueprint_family, hypothesis_text}`. Wave 3 (179-03, the 4-door persona-first B1) can pass these through the untouched birth txn; Wave 4 (179-04, hypothesis family) can ride `hypothesis_text`.
- No blockers.

## Self-Check: PASSED
- FOUND: lib/core/scratchpad-ops.cjs
- FOUND: tests/test-scratchpad-birth-whitelist-179.cjs
- FOUND: .planning/phases/179-ignite-b1-starting-point-fix/179-02-SUMMARY.md
- FOUND commit: 5f815954 (RED test)
- FOUND commit: ef3e41d5 (GREEN feat)

---
*Phase: 179-ignite-b1-starting-point-fix*
*Completed: 2026-06-25*
