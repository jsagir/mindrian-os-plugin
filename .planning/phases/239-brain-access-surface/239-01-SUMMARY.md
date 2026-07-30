---
phase: 239-brain-access-surface
plan: 01
subsystem: testing
tags: [test-infrastructure, mcp, brain-client, sse, bash-aggregator, canon-part-8]

# Dependency graph
requires: []
provides:
  - "tests/helpers/brain-capture-server.cjs: shared SSE-shaped Brain capture server (startCaptureServer, captured, resetCaptured, stopCaptureServer)"
  - "tests/run-all-239.sh: Phase 239 SKIP-safe verification aggregator with two anti-vacuity legs"
affects: [239-02-brain-egress-guard, 239-03-brain-tool-liveness, 239-04-hooks-json-fix, 239-05-query-egress-canary, 239-06-sendpacket-park, 239-07-verify-release-section-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract-not-invent: pulled the already-shipped SSE capture server out of tests/test-brain-client-params.cjs into a shared tests/helpers/ module instead of writing a new one (Canon Part 7)"
    - "Anti-vacuity aggregator legs: two legs in tests/run-all-239.sh bind unconditionally (not run_if-guarded) so the phase gate cannot report all-green with zero real coverage"

key-files:
  created:
    - tests/helpers/brain-capture-server.cjs
    - tests/run-all-239.sh
  modified:
    - tests/test-brain-client-params.cjs

key-decisions:
  - "Anti-vacuity probe for Leg A used the session scratchpad directory instead of the plan-specified /tmp/hooks-probe.json path; functionally identical, avoids writing outside the sandboxed scratch area per environment convention. Real hooks/hooks.json was never touched (confirmed via git diff --stat)."
  - "The seam-liveness.test.cjs and test-brain-response-sanitize.cjs legs are guarded run_if on their own file (both already exist and pass today), so they RUN and PASS in Wave 1 rather than SKIP -- this satisfies 239-VALIDATION.md's per-task-commit sampling rate without inventing a third leg category."

patterns-established:
  - "Pattern: any future phase needing an SSE-shaped Brain wire capture reuses tests/helpers/brain-capture-server.cjs instead of standing up a new node:http listener."
  - "Pattern: a phase verification aggregator can carry non-run_if legs that are expected RED on Wave 1 landing day, specifically to prove the gate has real teeth (not vacuous coverage) before the fixing plans exist."

requirements-completed: [BRAIN-01, BRAIN-02, BRAIN-03]

# Metrics
duration: 15min
completed: 2026-07-30
---

# Phase 239 Plan 01: Wave 0 Verification Scaffolding Summary

**Extracted the SSE-shaped Brain capture server into a shared test helper and authored `tests/run-all-239.sh`, an aggregator that is honestly RED (Failed: 2) on the day it lands because the fixes it gates have not shipped yet.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-30T11:00:00Z (approx, first file read)
- **Completed:** 2026-07-30T11:08:05Z
- **Tasks:** 2
- **Files modified:** 3 (1 new helper, 1 new aggregator, 1 existing test re-pointed)

## Accomplishments
- `tests/helpers/brain-capture-server.cjs` now holds the ONE SSE-shaped Brain capture server in the repo (`startCaptureServer`, `captured`, `resetCaptured`, `stopCaptureServer`), extracted verbatim from `tests/test-brain-client-params.cjs` rather than reinvented, per 239-PATTERNS.md Correction 2.
- `tests/test-brain-client-params.cjs` re-points at the shared helper and its original 6-assertion suite still passes with the identical `PASS (0 failures)` result before and after the extraction, proving the extraction is behavior-preserving.
- `tests/run-all-239.sh` is the single command (`bash tests/run-all-239.sh`) that shows the whole Phase 239 gate: 7 `run_if` legs (5 not-yet-authored `tests/test-239-*.cjs` files SKIP; 2 already-shipped tests -- `lib/core/seam-liveness.test.cjs` and `tests/test-brain-response-sanitize.cjs` -- RUN and PASS) plus 2 anti-vacuity legs that bind immediately and are OBSERVED RED today.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract the SSE capture server into tests/helpers/brain-capture-server.cjs** - `1877286` (feat)
2. **Task 2: Author tests/run-all-239.sh with two anti-vacuity legs that are RED today** - `9b07c05` (test)

_No TDD tasks in this plan; both are `type="auto"` per the plan frontmatter._

## Files Created/Modified
- `tests/helpers/brain-capture-server.cjs` - New shared SSE-shaped `node:http` loopback server (`startCaptureServer`, `captured`, `resetCaptured`, `stopCaptureServer`), lifted from the inline server in `tests/test-brain-client-params.cjs`. Binds `127.0.0.1` only, ephemeral port, in-memory capture only (never persisted).
- `tests/test-brain-client-params.cjs` - Now `require`s the shared helper instead of duplicating the listener; assertions byte-identical; `captured` re-pointed at the helper's export.
- `tests/run-all-239.sh` - New SKIP-safe aggregator (executable, bash-only) modeled on `tests/run-all-196.sh`'s header contract, `run`/`run_if` helpers, and footer summary block. Declares 7 `run_if` legs plus 2 always-run anti-vacuity legs (Leg A: BRAIN-01 dead-matcher literal census; Leg B: 239 test-file completeness).

## Before/After Proof of Behavior-Preserving Extraction (Task 1 acceptance)

**Before (baseline, pre-extraction):**
```
brain-client param schema regression suite
  ok  brain.query sends { cypher } not { query }
  ok  brain.write sends { cypher } not { query }
  ok  brain.search sends { query, namespace, topK } per brain_search schema
  ok  brain.schema sends {} (no params)
  ok  brain.stats sends {} (no params)
  ok  brain-client exported wrappers are fully covered
  SKIP live brain smoke test (set BRAIN_LIVE_TESTS=1 and MINDRIAN_BRAIN_KEY to run)

brain-client params suite: PASS (0 failures)
EXIT CODE: 0
```

**After (post-extraction, identical result):**
```
brain-client param schema regression suite
  ok  brain.query sends { cypher } not { query }
  ok  brain.write sends { cypher } not { query }
  ok  brain.search sends { query, namespace, topK } per brain_search schema
  ok  brain.schema sends {} (no params)
  ok  brain.stats sends {} (no params)
  ok  brain-client exported wrappers are fully covered
  SKIP live brain smoke test (set BRAIN_LIVE_TESTS=1 and MINDRIAN_BRAIN_KEY to run)

brain-client params suite: PASS (0 failures)
EXIT: 0
```

**Live SSE shape probe** (`initialize` POST to the helper's `url`):
```
BODY: "data: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{}}}\n"
starts with "data: " -> true
ends with newline -> true
```

## Observed RED State (Task 2 anti-vacuity proof, transcribed verbatim)

```
--- BRAIN-01 dead-matcher literal census ---
hooks/hooks.json still contains the dead literal matcher: mcp__brain_.*
lib/core/brain-response-sanitize.cjs still contains the dead prefix test: indexOf('mcp__brain_')
>>> BRAIN-01 dead-matcher literal census: FAILED

--- 239 test-file completeness ---
missing: tests/test-239-brain-tool-liveness.cjs
missing: tests/test-239-pii-sanitizer-liveness.cjs
missing: tests/test-239-query-egress-canary.cjs
missing: tests/test-239-sendpacket-parked.cjs
missing: tests/test-239-verify-release-section-18.cjs
>>> 239 test-file completeness: FAILED

--- BRAIN-01 tool liveness handshake + mutations ---
>>> ... SKIPPED (file not present: tests/test-239-brain-tool-liveness.cjs)

--- BRAIN-01 isBrainTool matcher unit (mcp__brain_response_sanitize) ---
>>> ... PASSED (15/15 node:test subtests)

--- BRAIN-01 PII sanitizer hook liveness ---
>>> ... SKIPPED (file not present: tests/test-239-pii-sanitizer-liveness.cjs)

--- BRAIN-02 query egress canary + regressions ---
>>> ... SKIPPED (file not present: tests/test-239-query-egress-canary.cjs)

--- BRAIN-03 sendPacket parked census ---
>>> ... SKIPPED (file not present: tests/test-239-sendpacket-parked.cjs)

--- BRAIN-01 verify-release section 18 wiring ---
>>> ... SKIPPED (file not present: tests/test-239-verify-release-section-18.cjs)

--- seam-liveness unit suite (shipped, first 239 consumer) ---
>>> ... PASSED (10/10 assertions)

========================================
  Summary (239 verification)
  Passed: 2   Failed: 2   Skipped: 5
========================================
EXIT_CODE: 1
```

This is exactly the plan's contracted anti-vacuity shape: `Failed: 2` with Leg A and Leg B named as FAILED, and every `tests/test-239-*` leg SKIPPED. Leg A turns GREEN when 239-02 lands; Leg B turns GREEN when 239-07 lands.

**Anti-vacuity probe for Leg A itself:** copied `hooks/hooks.json` to a scratch file, replaced the dead `mcp__brain_.*` literal with the corrected `mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*` pattern, and confirmed Leg A's own grep expression returns no match against that corrected copy (`grep -qF 'mcp__brain_.*'` exit code 1 = no match). The real `hooks/hooks.json` was never touched: `git diff --stat hooks/hooks.json` is empty.

## Decisions Made

- **Scratch-probe path substitution.** The plan specifies `/tmp/hooks-probe.json` for the anti-vacuity probe copy. Per this environment's standing convention to prefer the session scratchpad over `/tmp`, the probe copy was written to the scratchpad directory instead. This is a location-only substitution with no functional difference: the probe result (no match against the corrected literal) and the untouched-real-file result (`git diff --stat hooks/hooks.json` empty) are identical either way.
- **Leg guard choice for already-shipped tests.** `lib/core/seam-liveness.test.cjs` and `tests/test-brain-response-sanitize.cjs` both already exist and pass. Rather than inventing a third leg category, both were declared as ordinary `run_if` legs guarded on their own file path, so they naturally RUN (not SKIP) in Wave 1 while the five not-yet-authored `tests/test-239-*.cjs` files naturally SKIP. This directly satisfies 239-VALIDATION.md's per-task-commit sampling rate ("the single test file the task touches ... plus `node lib/core/seam-liveness.test.cjs`") inside the aggregator itself.

## Deviations from Plan

None - plan executed exactly as written. The one adjustment (scratch-probe file location) is a verification-mechanics substitution documented above, not a change to any acceptance criterion, deliverable, or file this plan owns.

## Issues Encountered

None. Both tasks' acceptance criteria were met on first implementation:
- Task 1: byte-identical before/after test run, `http.createServer` grep count 0, helper-require grep count >= 1, exports typecheck `function function true`, live SSE shape probe confirmed, zero em-dashes in the new helper.
- Task 2: `bash -n` clean, executable bit set, observed `Failed: 2` with Leg A/Leg B named and all five `tests/test-239-*` legs SKIPPED, anti-vacuity probe for Leg A confirmed against a scratch copy, `hooks/hooks.json` untouched, `WAVE 0 CONTRACT` present, zero em-dashes.

## User Setup Required

None - no external service configuration required. This plan is pure test infrastructure; it adds no library, calls no network, and touches zero production files (`lib/core/brain-client.cjs`, `lib/core/brain-response-sanitize.cjs`, `hooks/hooks.json` are all confirmed untouched via `git diff --stat`).

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced. The five `run_if` legs that SKIP today are an intentional, explicitly-contracted Wave-0 gap (sibling plans 239-02 through 239-07 author those files), not a stub -- the plan's own artifact table documents which sibling plan closes each one.

## Threat Flags

None. This plan's threat model (`<threat_model>` in 239-01-PLAN.md) is fully addressed by the delivered artifacts: T-239-T7 (vacuous coverage) is mitigated by the two anti-vacuity legs observed RED above; T-239-01-A (info disclosure via the capture server) is mitigated by the `127.0.0.1`-only bind and in-memory-only capture array (unchanged from the original inline implementation); T-239-01-B (silent behavior change during extraction) is mitigated by the recorded before/after test parity. No new network endpoints, auth paths, or schema changes were introduced.

## Next Phase Readiness

- `tests/helpers/brain-capture-server.cjs` is ready for 239-02's `tests/test-239-query-egress-canary.cjs` (BRAIN-02) to consume directly instead of standing up a fifth mock server.
- `tests/run-all-239.sh` is ready to receive each sibling plan's test file; as each of the five `tests/test-239-*.cjs` files lands, its leg flips from SKIP to a real run, and Leg B (test-file completeness) tightens toward GREEN. Leg A (dead-matcher census) turns GREEN specifically when 239-02 fixes `hooks/hooks.json` and `lib/core/brain-response-sanitize.cjs`.
- No blockers. This plan's cross-phase scope fence held: zero files claimed by Phase 237 or Phase 238 were touched, and zero files owned by sibling 239 plans (`hooks/hooks.json`, `lib/core/brain-response-sanitize.cjs`, `lib/core/brain-client.cjs`) were modified.

---
*Phase: 239-brain-access-surface*
*Completed: 2026-07-30*
