---
phase: quick-260705-m9g
plan: 01
subsystem: testing
tags: [stop-hook, card-fire, seed-021, envelope, systemMessage, gate-relevance, ci]

# Dependency graph
requires:
  - phase: 210-05
    provides: "gate-relevance.cjs extractOptionLabels + the two relevance pass-reasons the binary exemption sits behind"
  - phase: 209
    provides: "the card-fire force-fire floor (a genuine relevant unanswered fork still intercepts)"
provides:
  - "buildEnforcementEnvelope intercept branch carries a fixed human systemMessage (no leaked slug)"
  - "gate-is-simple-binary pass-reason exempting plain 2-option yes/no closers"
  - "live-transcript regression leg proving the binary exemption end to end"
affects: [check-card-fire, card-fire, stop-hook, seed-021, gate-relevance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A decision:'block' Stop-hook envelope is a user-facing surface: carry a fixed human systemMessage, reserve the reason slug for logs"
    - "Force-fire exemptions live at the END of the pass-reason chain so they never change earlier pass-reason precedence; exempting condition is exact (=== 2)"

key-files:
  created: []
  modified:
    - scripts/check-card-fire.cjs
    - tests/test-ga4-card-fire-interceptor.cjs
    - tests/test-card-fire-relevance-gate.cjs

key-decisions:
  - "systemMessage is a FIXED literal, never interpolated from transcript content or the reason slug (T-m9g-01)"
  - "Binary exemption condition is exactly gateLabels.length === 2, never <= 2, so 0-label degenerate detections stay conservative and keep intercepting (T-m9g-02)"
  - "Placed the binary exemption after gate-already-answered / gate-irrelevant-to-turn to preserve their precedence"

patterns-established:
  - "Block-envelope user-facing text pattern: systemMessage for humans, reason slug for telemetry"
  - "Pass-reason chain ordering is load-bearing: new exemptions append, never prepend"

requirements-completed: [RCA-FINDING-1, RCA-FINDING-2]

# Metrics
duration: 5min
completed: 2026-07-05
---

# Phase quick-260705-m9g Plan 01: Card-Fire Leaked-Slug + Binary Over-Trigger Fix Summary

**The SEED-021 card-fire Stop hook now renders a calm human line on intercept instead of leaking the raw classification slug as a fake "Stop hook error", and exempts plain 2-option yes/no closers via a new gate-is-simple-binary pass-reason while preserving the Phase 209 force-fire floor for genuine 3+-way forks.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-05T13:11:03Z
- **Completed:** 2026-07-05T13:15:30Z
- **Tasks:** 3
- **Files modified:** 3 (code) + 2 (debug resolve artifacts)

## Accomplishments
- Finding 1 closed: `buildEnforcementEnvelope()` intercept branch carries a fixed human `systemMessage` ("Re-rendering your choices as a selectable card..."); the raw slug stays in `reason` for logs/telemetry only. The user no longer sees "Stop hook error: ascii-box-backstop-no-card".
- Finding 2 closed (navigator decision 2026-07-05): a new `gate-is-simple-binary` pass-reason in `classifyCardFire()` exempts plain 2-option binaries; genuine 3+-option forks and 0-label degenerate detections still intercept.
- Phase 209 floor preserved: the Leg 3 PRESERVE-FLOOR fixture was upgraded from 2 to 3 options so it keeps asserting the floor, and a new Leg 4 proves the binary exemption through the live transcript path.
- Full card-fire regression sweep plus `run-all-209.sh` all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Finding 1 - systemMessage on the intercept envelope branch** - `c822793c` (fix)
2. **Task 2: Finding 2 - gate-is-simple-binary pass-reason + Leg 3 floor fixture upgrade** - `560753ed` (fix)
3. **Task 3: live-transcript binary-exemption leg + full regression sweep** - `9d00d4a8` (test)

**Debug resolve artifacts:** `76183cf4` (docs: move RCA to resolved/ + knowledge-base entry)

## Files Created/Modified
- `scripts/check-card-fire.cjs` - intercept branch now sets a fixed human `systemMessage`; new `gate-is-simple-binary` pass-reason after the two relevance checks, reusing the already-extracted `gateLabels` with the exact `=== 2` condition; header comments updated for both changes.
- `tests/test-ga4-card-fire-interceptor.cjs` - four new ENVELOPE assertions: intercept envelope has a non-empty `systemMessage`, no slug substring, `reason` still equals the slug, degrade envelope has no `systemMessage`.
- `tests/test-card-fire-relevance-gate.cjs` - `ROOM_PICK_GATE` fixture upgraded 2 to 3 options (with explanatory comment); new Leg 4 asserting a relevant unanswered 2-option binary passes as `gate-is-simple-binary` through the live transcript path.
- `.planning/debug/resolved/card-fire-block-surface.md` - RCA moved from `.planning/debug/`, status set to `resolved`.
- `.planning/debug/knowledge-base.md` - new resolved-session block (slug, date, error-pattern keywords, root cause, fix, files changed, pattern lesson).

## Decisions Made
None beyond the plan - executed exactly as specified. The three load-bearing choices (fixed literal systemMessage, exact `=== 2` condition, exemption placed after the two relevance pass-reasons) were all pre-specified in the plan and honored verbatim.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. All verification commands passed on first run. The only surprise was cosmetic: the `git add .planning/...` printed a "paths are ignored" warning because `.planning/` is gitignored, but both files were already tracked, so the commit succeeded and both changes landed (verified in HEAD).

## Verification Results

All green:
- `node tests/test-card-fire-relevance-gate.cjs` - 4 passed, 0 failed (already-answered, irrelevant, 3-option floor, binary exemption)
- `node tests/test-ga4-card-fire-interceptor.cjs` - 26 assertions PASS (includes 4 new systemMessage assertions)
- `node tests/test-ga4-card-fire-e2e-179.cjs` - 47 assertions PASS
- `node tests/test-209-incident-replay.cjs` - exit 0, 4 assertions PASS
- `node tests/test-209-card-fire-gate.cjs` - 7 assertions PASS
- `bash tests/run-all-209.sh` - PASS=9 FAIL=0 SKIP=0 (extra insurance)
- `grep -c "gate-is-simple-binary" scripts/check-card-fire.cjs` - 2

## House Rules Checked
- No em-dashes introduced (grep on the new `+` diff lines confirmed clean).
- CJS + Node built-ins only; no new dependencies (T-m9g-03 accept).
- Canon Part 8 untouched: pure local string work, zero new I/O, no Brain/network symbols (the existing PART 8 assertion still passes).
- Constitutional floor untouched: MAX_FORCE_RETRIES, MAX_SESSION_INTERCEPTS, degrade envelope, else branch all byte-unchanged.

## Next Phase Readiness
- Both RCA findings resolved and captured in the knowledge base for future `gsd-debugger` pattern surfacing.
- Non-code follow-up from the RCA (cross-reference to `beta13-curing-sequence-persona-and-commands-bisect.md` Step 5) remains open and is documented in the moved RCA file; not in scope for this quick task.

## Self-Check: PASSED
- `scripts/check-card-fire.cjs` - FOUND, contains `gate-is-simple-binary` (x2) and `systemMessage` on intercept branch
- `tests/test-ga4-card-fire-interceptor.cjs` - FOUND, contains `systemMessage` assertions
- `tests/test-card-fire-relevance-gate.cjs` - FOUND, contains `gate-is-simple-binary` Leg 4
- `.planning/debug/resolved/card-fire-block-surface.md` - FOUND (moved)
- Commits c822793c, 560753ed, 9d00d4a8, 76183cf4 - all FOUND in git log

---
*Phase: quick-260705-m9g*
*Completed: 2026-07-05*
