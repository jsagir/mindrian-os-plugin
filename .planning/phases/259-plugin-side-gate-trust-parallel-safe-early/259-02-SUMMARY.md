---
phase: 259-plugin-side-gate-trust-parallel-safe-early
plan: 02
subsystem: infra
tags: [refusal-messaging, honest-refusal, rate-limit, doctor]

requires:
  - phase: 259-01
    provides: the rate_limited sentinel minted by lib/core/brain-client.cjs::callTool() that this plan gives an honest render path
  - phase: 250-01
    provides: the four-member REFUSAL_KINDS honesty rail this plan amends to five
provides:
  - "rate_limited as the fifth REFUSAL_KINDS member: status BRAIN_RATE_LIMITED, own reason/next_moves/render copy/larry line"
  - "STRUCTURED_REFUSAL_STATUSES in doctor's class-m-brain-smoke.cjs recognizes BRAIN_RATE_LIMITED"
affects: [259-04]

tech-stack:
  added: []
  patterns:
    - "amend a byte-locked frozen enum by appending, never reordering, with an explicit phase-amendment comment naming what changed and why"

key-files:
  created:
    - tests/test-259-refusal-rate-limited.cjs
  modified:
    - lib/core/refusal-messaging.cjs
    - tests/test-250-refusal-shapes.cjs
    - lib/core/doctor/class-m-brain-smoke.cjs

key-decisions:
  - "F-09 Option B taken (per RESEARCH.md's own recommendation, restated here): closing the coercion trap is worth amending two contracts three prior phases froze, because Option A ships a sentinel no surface can render honestly. Verified zero production callers route the sentinel through refusalResponse today and zero consumers read the next_moves handles anywhere in the repo, so the blast radius was exactly the two pinned assertions amended in Task 2, nothing else."
  - "This plan makes no wiring change: it does not alter the shim's r == null pattern and does not route the sentinel through refusalResponse. It only closes the trap and completes the rail so a future consumer can render honestly."

requirements-completed: [TRUST-01]

duration: 30min
completed: 2026-08-20
---

# Phase 259 Plan 02: Rate-Limited Refusal Rail Summary

**`REFUSAL_KINDS` grows from four to five members (`rate_limited` appended last), closing the coercion trap that would have silently rendered Plan 259-01's new sentinel as `BRAIN_UNREACHABLE` the moment anything routed it through this chokepoint.**

## Performance

- **Tasks:** 2 (add the fifth kind RED->GREEN, amend the two pinned contracts)
- **Files modified:** 4 (1 new, 3 modified)

## Accomplishments
- Wrote `tests/test-259-refusal-rate-limited.cjs` (8 tests) and confirmed RED: `refusalResponse('rate_limited').status` came back `BRAIN_UNREACHABLE` before the fix (5/8 tests failing, exit 1) -- the coercion trap made visible and reproducible.
- Added `rate_limited` as REFUSAL_KINDS' fifth, last member with its own `KIND_STATUS` (`BRAIN_RATE_LIMITED`), `REASONS`, `NEXT_MOVES` (`retry_after_wait`/`continue_without`, not the existing `retry` -- retrying immediately is wrong on a rate limit), `RENDER_COPY`, and `larryRefusalLine` case. Suite now GREEN (8/8).
- Confirmed the three unrecognized-kind coercion sites in `refusalResponse`/`renderRefusal`/`larryRefusalLine` are byte-untouched: `grep -c "'unreachable'"` stayed at 8 before and after (had to trim one incidental mention out of my own new comment to hold that count exactly, since the substance -- not just the count -- had to stay unchanged).
- Amended the two pinned four-member contracts deliberately: `tests/test-250-refusal-shapes.cjs` Test 1's `deepStrictEqual` target, and `lib/core/doctor/class-m-brain-smoke.cjs`'s `STRUCTURED_REFUSAL_STATUSES`. Both enum-iterating tests (refusal-shapes Test 6, refusal-queue Test 4) pass unedited, now exercising the fifth kind for free.

## Task Commits

1. **Task 1: add rate_limited as the fifth refusal kind (RED then GREEN)** - `c9f10e0e` (feat) -- RED captured (5/8 failing, `BRAIN_UNREACHABLE` visible), then GREEN (8/8)
2. **Task 2: amend the two pinned four-member contracts** - `6c0f9edd` (test)

## Files Created/Modified
- `lib/core/refusal-messaging.cjs` - `rate_limited` fifth kind across `REFUSAL_KINDS`, `KIND_STATUS`, `REASONS`, `NEXT_MOVES`, `RENDER_COPY`, `larryRefusalLine`
- `tests/test-259-refusal-rate-limited.cjs` - the coercion-trap closure proof (new)
- `tests/test-250-refusal-shapes.cjs` - Test 1 amended to the five-member array
- `lib/core/doctor/class-m-brain-smoke.cjs` - `STRUCTURED_REFUSAL_STATUSES` gains `BRAIN_RATE_LIMITED`

## RED-Proof Output (Task 1, captured)

Before the source edit: `node --test tests/test-259-refusal-rate-limited.cjs` exited 1 with 5/8 failing, including `RED PROOF (coercion trap closure): ... actual: 'BRAIN_UNREACHABLE'` -- the exact conflation TRUST-01 exists to kill, one layer up.

## Final Copy Strings

- `REASONS.rate_limited` (with wait): `"The methodology graph is rate limiting <tool> right now, not down. The Brain asked for <N>s before the next try. Larry will not fake what it would say."`
- `REASONS.rate_limited` (no wait known): `"The methodology graph is rate limiting <tool> right now, not down. Larry will not fake what it would say."`
- `RENDER_COPY.rate_limited`: two-line block, first line names the rate limit + observed wait, second line offers wait-and-retry or continue-without.
- `larryRefusalLine('rate_limited')`: `"Brain is rate limiting right now, not down. Waiting it out, not faking it."` (75 chars, distinct from `larryRefusalLine('unreachable')`).

## Pinned-Contract Amendment Ledger

| File | Line (approx.) | From | To | Why |
|---|---|---|---|---|
| `tests/test-250-refusal-shapes.cjs` | Test 1, `~:57` | `deepStrictEqual(mod.REFUSAL_KINDS, ['no_key','unreachable','tier_denied','not_ready'])` | five-member array with `'rate_limited'` appended last | The coercion trap is live: an unrecognized enum member silently renders as `BRAIN_UNREACHABLE`. |
| `lib/core/doctor/class-m-brain-smoke.cjs` | `STRUCTURED_REFUSAL_STATUSES`, `~:94-99` | 4-member array | 5-member array, `'BRAIN_RATE_LIMITED'` appended | Without this, `doctor --acceptance` reports a structured rate-limited refusal as an unstructured failure -- the same class of dishonesty this phase closes. |

## Decisions Made
- F-09 Option B taken, as RESEARCH.md recommended: the coercion trap is a live landmine, not hypothetical, and the cost was measured at exactly two pinned assertions (both amended here).
- No wiring change made: the shim's `r == null ? refusalResponse('unreachable') : asContent(r)` pattern is untouched; sentinels still pass through raw. This plan only completes the rail for a future consumer.

## Deviations from Plan
None - plan executed exactly as written, aside from one trivial self-correction (a new comment incidentally used the word `'unreachable'` in quotes, inflating the byte-count acceptance check by one; reworded before committing so the count-based proof that the three coercion sites are untouched holds exactly).

## Issues Encountered
- `node scripts/doctor.cjs --acceptance` reports `FAIL verify-release-clean-tree` due to one tracked-file drift: `.planning/phases/261-enrichment-ceremony-single-admin-window/261-RESEARCH.md`. This is NOT from this plan -- it belongs to a concurrent background agent working Phase 258/260/261 in this same shared working tree (per the execute-phase orchestrator's own WORKSPACE GUARD note). All of this plan's files are committed; `git status --short` shows zero drift attributable to Plan 259-02. 15/16 acceptance points pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The honesty rail is complete for TRUST-01: a rate-limited call is distinguishable from an actually-down Brain at both the transport layer (259-01) and the human-facing refusal layer (259-02).
- Plan 259-03 (TRUST-02) is unaffected by this plan (disjoint files: `check-flagship-floor.cjs` does not import `refusal-messaging.cjs`).
- Plan 259-04 (wave 2, human gate) can proceed once 259-03 lands.

---
*Phase: 259-plugin-side-gate-trust-parallel-safe-early*
*Completed: 2026-08-20*
