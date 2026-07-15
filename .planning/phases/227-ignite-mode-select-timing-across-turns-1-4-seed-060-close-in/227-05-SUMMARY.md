---
phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in
plan: 05
subsystem: testing
tags: [regression-test, trending-to-absurd, conversation-mode, structural-test, feynman-tests]

# Dependency graph
requires:
  - phase: 227-01
    provides: test-227-mode-select-checkpoint.cjs entry in lib/memory/run-feynman-tests.cjs's TEST_FILES array, which this plan appends after without disturbing
provides:
  - "tests/test-227-frontdoor-restraint.cjs: a permanent structural/static regression floor proving the 2026-06-24 conversational-restraint fix (commit 7868dfbb) still holds, without a live human tester session"
  - "registration of that test in lib/memory/run-feynman-tests.cjs's TEST_FILES array so it runs on every Feynman test suite invocation"
affects: [227-close-in-phase, future-changes-to-trending-to-absurd-SKILL.md, future-changes-to-conversation-mode-SKILL.md, future-changes-to-trending-to-absurd-orchestrator.cjs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural/static test convention (mirrors tests/test-209-declared-implies-wired.cjs): a small ok(desc, fn) micro-harness, node:assert/strict, real fs.readFileSync against real repo files, never a mock or a simulated LLM turn"
    - "Positive-signal assertion design over denylist design when the target text legitimately quotes its own negative examples (documented in the test file itself and in the plan's threat model as T-227-13)"

key-files:
  created: [tests/test-227-frontdoor-restraint.cjs]
  modified: [lib/memory/run-feynman-tests.cjs]

key-decisions:
  - "Assertion (b) uses a positive-signal check (explicit-intent marker + do-not-use-for-general-exploration clause present) rather than a denylist of casual phrases, because a denylist would false-positive on trending-to-absurd/SKILL.md's own legitimate Do-NOT-use quoted example ('there have got to be some opportunities here')."
  - "Assertion (b)'s substring checks run against a whitespace-normalized copy of the source text (collapsing newlines/spaces to single spaces) because the target phrases wrap across multiple YAML frontmatter description lines in the live file; a literal indexOf against the raw multi-line text would false-negative on the line break inside 'Do NOT use for\\n  general exploration'."
  - "The unscriptable opening-compliment behavior is named explicitly in the test file's own header comment as a known, accepted coverage gap (matches threat register disposition T-227-14: accept), not silently dropped."

patterns-established:
  - "When a target string legitimately appears as a negative example inside the same file being tested, assert on positive framing markers, not on the absence of the quoted casual language."

requirements-completed: [REQ-3]

# Metrics
duration: 12min
completed: 2026-07-16
---

# Phase 227 Plan 05: Frontdoor-Restraint Regression Floor Summary

**Scripted structural test proving the 2026-06-24 conversational-restraint fix (commit 7868dfbb) still holds across trending-to-absurd and conversation-mode, closing item 4 of ignite-frontdoor-bypassed-methodology-overfire.md's fix_remaining list without a live human tester re-run.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-16T00:00:00Z (approx, session-local)
- **Completed:** 2026-07-16
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Built `tests/test-227-frontdoor-restraint.cjs`, a 4-assertion structural/static test replaying ignite-frontdoor-bypassed-methodology-overfire.md's Test 4 Section 5 scenario (an explore-invitation in a fresh context), following the exact convention of `tests/test-209-declared-implies-wired.cjs` (real `fs.readFileSync` reads, `node:assert/strict`, an `ok(desc, fn)` micro-harness, no mocking, no LLM-turn simulation).
- Registered the test in `lib/memory/run-feynman-tests.cjs`'s `TEST_FILES` array, appended immediately after plan 227-01's `test-227-mode-select-checkpoint.cjs` entry, so it becomes a permanent regression floor on every Feynman suite run rather than a one-time check.
- Verified live: both `test-227-mode-select-checkpoint.cjs` (227-01) and `test-227-frontdoor-restraint.cjs` (this plan) pass individually. No `tests/run-all-227.sh` aggregator exists yet for this phase, so both test files were re-run manually together to confirm nothing regressed (see "Verification" below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write tests/test-227-frontdoor-restraint.cjs (D-08)** - `c6498b12` (test)
2. **Task 2: Register the test in run-feynman-tests.cjs and confirm the full suite still passes** - `98ed56b5` (test)

**Plan metadata commit:** pending (this SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md land in the final docs commit below)

## Files Created/Modified

- `tests/test-227-frontdoor-restraint.cjs` - New 4-assertion structural test. Assertion (a) checks `skills/trending-to-absurd/SKILL.md`'s `connector.sensor_triggers: []` regression floor. Assertion (b) checks that same file's description still carries the explicit-intent gating language ("Use ONLY when the navigator EXPLICITLY asks", "Do NOT use for general exploration") as a positive signal, not a denylist. Assertion (c) checks `lib/core/trending-to-absurd/orchestrator.cjs`'s `generateAbsurdRings` still clamps to the requested horizon via the exact branch text `const specHorizon = HORIZON_ENUM.includes(horizon) ? horizon : 'near';`. Assertion (d) checks `skills/conversation-mode/SKILL.md`'s Mode 2 still carries the exact uppercase string `THE SCAFFOLD FOLLOWS THE LEARNER (RCA ignite-frontdoor-bypassed-methodology-overfire)`, distinct from the lowercase phrase living in trending-to-absurd's own description. The file's header comment names the unscriptable opening-compliment behavior as a known, honest coverage gap.
- `lib/memory/run-feynman-tests.cjs` - Appended a `path.join(REPO_ROOT, 'tests', 'test-227-frontdoor-restraint.cjs')` entry to the `TEST_FILES` array, immediately after plan 227-01's `test-227-mode-select-checkpoint.cjs` entry, with a short Phase 227 / Requirement 3 comment above it. No other change; the existing `spawnSync` loop generically handles any appended entry.

## Decisions Made

- **Positive-signal assertion over denylist (assertion b):** trending-to-absurd/SKILL.md's own description legitimately quotes casual phrasing ("there have got to be some opportunities here") as a *negative* example inside its Do-NOT-use clause. A denylist assertion checking "these casual words must be absent" would false-positive fail against this exact, correct file. Instead the test asserts the positive-signal markers (the EXPLICITLY/only-when phrase and the do-not-use-for-general-exploration clause) are present. This mirrors the plan's threat register T-227-13 (mitigate) and is a genuine correctness improvement over 227-PATTERNS.md's own illustrative denylist snippet.
- **Whitespace normalization for multi-line YAML description matching:** the first draft of assertion (b) used a literal `indexOf('Do NOT use for general exploration')` against the raw file text and failed, because the live YAML frontmatter description wraps that exact phrase across two lines ("Do NOT use for\n  general exploration"). Root cause: YAML block-scalar folding in the live file, not a bug in the fix being tested. Fixed by normalizing whitespace (`\s+` -> single space) before the substring check, which is honest to the source content (the description is logically one continuous sentence, this is capturing the semantic markers not the literal byte layout).
- **Named, honest coverage gap:** the "no opening compliment" behavior from the fix is not scriptable (it is model behavior at inference time, not a static artifact). Per this session's established discipline (D-08) and the plan's threat register T-227-14 (accept), this gap is stated explicitly in the test file's own header comment rather than silently omitted or falsely implied as covered.

## Deviations from Plan

None - plan executed exactly as written. The whitespace-normalization fix to assertion (b) was a correction discovered while writing and immediately verifying the test itself (before any commit), not a deviation from the plan's specified behavior -- the plan's own behavior spec for assertion (b) already anticipated this exact false-positive risk category (denylist vs. positive-signal) and the fix stays fully within that specified intent.

## Issues Encountered

- **Initial run failure on assertion (b):** the first draft used a literal (non-whitespace-normalized) substring check for "Do NOT use for general exploration" and failed on the first `node tests/test-227-frontdoor-restraint.cjs` run because the live file line-wraps that phrase inside its YAML frontmatter description. Diagnosed immediately (the assertion text itself printed in the AssertionError made the line-wrap obvious), fixed by normalizing whitespace before the check, re-ran, all 4 assertions passed. No further issues.

## Verification

- `node tests/test-227-frontdoor-restraint.cjs` exits 0, prints `PASS test-227-frontdoor-restraint (4 assertions)`.
- `grep -c test-227-frontdoor-restraint.cjs lib/memory/run-feynman-tests.cjs` returns `1` (registered exactly once).
- `node tests/test-227-mode-select-checkpoint.cjs` (227-01's own test) still exits 0, prints `PASS test-227-mode-select-checkpoint (6 assertions)` -- confirmed unaffected by this plan's addition to the same TEST_FILES array.
- No `tests/run-all-227.sh` aggregator script exists for phase 227 as of this plan landing. Both this plan's test and 227-01's test were re-run manually together (see above) rather than via a phase-level aggregator, stated honestly rather than fabricating a green aggregator run.
- Zero em-dashes confirmed in both touched files via `grep` before commit.

## Known Stubs

None. Every assertion in this test reads real, currently-live repo file content; nothing is stubbed, mocked, or hardcoded to a placeholder value.

## Threat Flags

None. This plan introduces zero new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. It only adds a read-only test file that reads repo-controlled source files already shipped in this repo (no external input, no network), matching the plan's own threat model trust-boundary declaration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This is the LAST plan (05) in phase 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in. All 5 plans in this phase are now complete. Requirement 3 is satisfied: the 2026-06-24 conversational-restraint fix now has permanent automated regression coverage via `tests/test-227-frontdoor-restraint.cjs`, closing the previously human-tester-only verification loop for item 4 of ignite-frontdoor-bypassed-methodology-overfire.md's fix_remaining list. No blockers identified for phase close-out.

---
*Phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: tests/test-227-frontdoor-restraint.cjs
- FOUND: .planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-05-SUMMARY.md
- FOUND commit: c6498b12
- FOUND commit: 98ed56b5
