---
phase: 259-plugin-side-gate-trust-parallel-safe-early
plan: 01
subsystem: infra
tags: [brain-client, http-429, retry, rate-limit, honest-refusal]

requires:
  - phase: 250-01
    provides: AVAIL-02 bounded transport retry budget (RETRY_MAX_DEFAULT/RETRY_BASE_MS_DEFAULT, _sleep, _envNonNegativeInt) that this plan reuses without touching
provides:
  - "429 branch in lib/core/brain-client.cjs::callTool() honoring Retry-After (D-01), falling back to 500/1000/2000ms (D-02)"
  - "rate_limited sentinel { error, tool, retry_after_s, attempts, message } after budget exhaustion (D-03), never null"
  - "_parseRetryAfterMs / _rateLimitWaitMs pure helpers on module.exports._test"
  - "opt-in scripted-response mode on tests/helpers/brain-capture-server.cjs (D-04)"
affects: [259-02, 259-03, 259-04]

tech-stack:
  added: []
  patterns:
    - "separate retry-budget env vars per failure class (MINDRIAN_BRAIN_RATELIMIT_* distinct from MINDRIAN_BRAIN_RETRY_*), never shared"
    - "strict IMF-fixdate regex gate before Date.parse to avoid V8's lenient legacy-date heuristic"

key-files:
  created:
    - tests/test-259-brain-client-429.cjs
  modified:
    - lib/core/brain-client.cjs
    - tests/helpers/brain-capture-server.cjs

key-decisions:
  - "OQ-4: MINDRIAN_BRAIN_RATELIMIT_MAX_WAIT_MS ships unset by default so D-01 (honor Retry-After exactly) is literal out of the box; the ceiling is an explicit, self-declaring operator escape hatch, never a silent Math.min."
  - "Found and fixed a real bug during GREEN: V8's Date.parse mis-parses non-date garbage like \"-5\" and \"1.5\" into real (wrong) timestamps instead of NaN. Gated the HTTP-date fallback behind a strict RFC 7231 IMF-fixdate regex (the exact shape toUTCString() emits) before ever calling Date.parse."

requirements-completed: [TRUST-01]

duration: 45min
completed: 2026-08-20
---

# Phase 259 Plan 01: Brain-Client 429 Handling Summary

**`brain-client.cjs::callTool()` now honors HTTP 429 Retry-After with bounded backoff and a distinct `rate_limited` sentinel, replacing the bare `return null` that rendered as `BRAIN_UNREACHABLE` with zero retries actually spent.**

## Performance

- **Tasks:** 3 (capture-server extension, RED-proof test suite, GREEN implementation)
- **Files modified:** 3 (1 new, 2 modified)

## Accomplishments
- Extended `tests/helpers/brain-capture-server.cjs` with an opt-in, default-off scripted-response mechanism (`setToolScript`/`getToolCallCount`/`resetToolScript`), ported from `test-250-transport-retry.cjs`'s proven design, per D-04 -- no fifth mock server stood up. All four pre-existing consumers pass unchanged.
- Wrote `tests/test-259-brain-client-429.cjs` (12 tests, Tests A-I + 2 regressions) and confirmed it RED against the pre-fix ladder (9/12 failing, exit 1).
- Implemented the 429 branch in `brain-client.cjs`: reads `Retry-After` fresh per attempt, retries up to 3 times (4 attempts total), falls back to 500/1000/2000ms when the header is absent or unparseable, and returns `{ error: 'rate_limited', tool, retry_after_s, attempts, message }` after the budget exhausts. Suite now GREEN (12/12).
- Added a separate rate-limit retry budget (`RATE_LIMIT_RETRY_MAX_DEFAULT=3`, `RATE_LIMIT_BASE_MS_DEFAULT=500`, `MINDRIAN_BRAIN_RATELIMIT_RETRY_MAX`/`_BASE_MS`/`_MAX_WAIT_MS`) that never reads AVAIL-02's `MINDRIAN_BRAIN_RETRY_MAX`/`_BASE_MS`, proven independent by Test G.
- Exposed `_parseRetryAfterMs` / `_rateLimitWaitMs` on `module.exports._test` so the exact D-02 schedule (500/1000/2000) and every Retry-After parse case are unit-tested with zero sleeps (Tests E, F).

## Task Commits

1. **Task 1: extend brain-capture-server with opt-in scripted responses** - `e80d6aff` (test)
2. **Task 2: forced-429 RED-proof suite** - `45c1db31` (test) -- confirmed RED, 9/12 failing, exit 1
3. **Task 3: 429 branch + pure helpers in brain-client.cjs** - `d2b5cd2d` (feat) -- GREEN, 12/12 passing

## Files Created/Modified
- `lib/core/brain-client.cjs` - 429 branch, rate_limited sentinel, rate-limit constants/env readers, `_parseRetryAfterMs`/`_rateLimitWaitMs`
- `tests/helpers/brain-capture-server.cjs` - opt-in scripted-response mode, default-off
- `tests/test-259-brain-client-429.cjs` - forced-429 suite (new)

## RED-Proof Output (Task 2, captured)

Before the GREEN edit: `node --test tests/test-259-brain-client-429.cjs` exited 1 with 9/12 tests failing. Failing: Test A, Test B, RED PROOF, Test D, Test D (exhaustion leg), Test E (`_rateLimitWaitMs is not a function`), Test F (`_parseRetryAfterMs is not a function`), Test G, Test I. Passing (unaffected by the bug): Test H (Canon Part 8 capture shape), the two pre-existing-behavior regressions.

## Sentinel Shape As Shipped

```js
{ error: 'rate_limited', tool: toolName, retry_after_s: <number|null>, attempts: <number>, message: <string, capped at 300 chars> }
```

`MINDRIAN_BRAIN_RATELIMIT_MAX_WAIT_MS` was left **unset by default** (confirmed: `_rateLimitMaxWaitMs()` returns `null` when the env var is absent, and D-01 ships literally).

## Decisions Made
- OQ-4 (Retry-After ceiling): shipped D-01 literally, no default cap; the ceiling env var is an explicit operator escape hatch, off by default.
- Kept the 429 retry budget as a fully separate counter (`rlAttempt`) and env-var pair from AVAIL-02's, per F-02's rationale (an operator disabling transport retries for fast-fail must not silently also disable 429 honoring).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `_parseRetryAfterMs` mis-parsed non-date garbage as valid timestamps**
- **Found during:** Task 3, running the GREEN suite (Test F failed: `_parseRetryAfterMs("-5")` returned `0` instead of `null`)
- **Issue:** The HTTP-date fallback called `Date.parse(trimmed)` unconditionally on any string that wasn't a bare delay-seconds integer. V8's `Date.parse` falls back to a lenient, implementation-specific legacy-format heuristic for non-standard strings, and mis-parses `"-5"` and `"1.5"` into real (wrong) past timestamps instead of `NaN` -- confirmed live on this machine (`Date.parse("-5") === 988664400000`, year 2001).
- **Fix:** Added a strict `HTTP_DATE_RE` gate (`^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$`, the exact IMF-fixdate shape `toUTCString()` emits) before ever calling `Date.parse`. Only a string matching that shape reaches `Date.parse` now; everything else returns `null` immediately.
- **Files modified:** `lib/core/brain-client.cjs`
- **Verification:** Test F (all 8 invalid-input cases plus the future/past HTTP-date cases) passes; full suite green.
- **Committed in:** `d2b5cd2d` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary correctness fix inside the pure helper the plan already specified; no scope change, no new files, no architectural change.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TRUST-01's transport-layer half is done: `callTool` never returns null on a 429 exhaustion, and a rate-limited call is now distinguishable from an actually-down Brain at the transport layer.
- Plan 259-02 (the refusal-rail honesty half of TRUST-01: `REFUSAL_KINDS` gains `rate_limited`) can now render the sentinel this plan mints -- ready to proceed, no blockers.
- Plan 259-03 (TRUST-02) is independent of this plan (different files, `check-flagship-floor.cjs` does not use `brain-client.cjs`).

---
*Phase: 259-plugin-side-gate-trust-parallel-safe-early*
*Completed: 2026-08-20*
