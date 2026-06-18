---
phase: 166-gated-chain-executor
plan: 03
subsystem: chain-executor-reliability
tags: [EXEC-05, D-166-01, D-166-02, B2, B3, part-3, part-4, part-7, part-8, part-9]
requires:
  - lib/core/chain-executor.cjs (Wave 2: runChain -- EXTENDED, not forked)
  - lib/mcp/pipeline-state.cjs (Wave 1: recordStep / read / checkPosition resume journal, D-166-02)
provides:
  - lib/core/chain-retry.cjs -- isTransient(err) + withBackoff(fn, opts); bounded retry on the four transient 5xx codes (500/502/503/529), reusable by any onStep
  - runChain resilient async path -- onStep wrapped in withBackoff; transient exhaustion or a hard fault folds a graceful-partial failure marker into the ONE trace, preserves upstream, journals the position, returns partial:true (never null)
affects:
  - Wave-2 runChain legacy synchronous path preserved byte-for-byte (no reliability opt -> unchanged contract)
  - Phases 164 + 165 (RIDE the resilient runChain spine instead of cloning a futures orchestrator)
tech-stack:
  added: []
  patterns:
    - bounded exponential-with-cap backoff with an INJECTABLE sleep (deterministic; no Math.random)
    - closed transient-code allow-list (500/502/503/529 only; 501/504 and all 4xx fail fast)
    - graceful partial on exhaustion (upstream trace preserved + failure marker; never a silent drop -- the SEED-028 / AION fix)
    - opt-gated async dispatch from one entry point (runChain stays the single door; legacy sync path untouched)
    - resume via the Wave-1 pipeline-state journal cursor (skip journaled steps; re-enter at the failed step)
key-files:
  created:
    - lib/core/chain-retry.cjs
    - tests/test-chain-retry-backoff.cjs
    - tests/test-chain-graceful-partial.cjs
  modified:
    - lib/core/chain-executor.cjs
    - tests/run-all-166.sh
decisions:
  - "isTransient is a CLOSED allow-list of the four codes 500/502/503/529; 501/504 + all 4xx + validation/type errors are non-transient and fail fast (T-166-11)"
  - "withBackoff bounds attempts at retries+1 and the delay at maxDelayMs (T-166-09); the sleep is injectable so tests run instantly and assert exact delays"
  - "runChain is EXTENDED, not forked: a new opt-gated resilient async path triggers ONLY when a reliability opt (retries/journal/roomDir/resume/sleep) is present; the Wave-2 synchronous path is byte-identical for all prior callers (D-166-04 single door preserved)"
  - "on exhaustion (or a non-transient hard fault) runChain folds a { step, failure:{code,reason,attempts}, partial:true } marker into the ONE trace, preserves upstream chain_outputs, and returns { completed:false, partial:true, haltedAt } -- never null (SEED-028 / the AION failure mode)"
  - "partial re-run reuses the Wave-1 pipeline-state recordStep/read journal (D-166-02): completed steps advance the cursor; a resume skips at-or-before the cursor and re-enters at the failed step; NO new orchestration path"
  - "B2 preserved: decide()'s decision_trace recorded reference-equal / UNCHANGED on the resilient path too; B3 preserved: no convergence 'all-passing' branch added"
metrics:
  duration_minutes: 5
  completed: 2026-06-18
  tasks: 3
  files_created: 3
  files_modified: 2
---

# Phase 166 Plan 03: Wave 3 Reliability (retry/backoff + graceful partial) Summary

EXEC-05 / D-166-01 closes the SEED-028 failure mode: a transient remote hiccup on the load-bearing terminal synthesis step no longer discards an entire chain. `lib/core/chain-retry.cjs` ships the bounded retry-with-backoff substrate; `runChain` (extended, not forked) now wraps its onStep dispatch in that backoff and, on exhaustion or a hard fault, returns a GRACEFUL PARTIAL -- upstream results preserved, a failure marker folded into the single trace, the position journaled for partial re-run -- never `null`, never a silent drop (the AION failure mode observed in the 2026-06-16 dogfood). The resume/journal substrate is the SHIPPED Wave-1 `pipeline-state.cjs`; no new orchestration path was built.

## What Was Built

### Task 1 (EXEC-05 / D-166-01): chain-retry.cjs -- bounded backoff on the four transient codes
- `isTransient(err)` is a CLOSED allow-list of the four named transient remote codes 500 / 502 / 503 / 529, read from `err.status`, `err.statusCode`, or a word-boundary regex over `err.message`. Everything else -- 4xx, validation, type errors, `null`, AND 501/504 (deliberately out of the overload class SEED-028 targets) -- is non-transient and fails fast (T-166-11).
- `withBackoff(fn, { retries, baseDelayMs, maxDelayMs, sleep, returnMarkerOnExhaust })` calls `fn`; on a transient throw it waits an exponential-with-cap delay (`baseDelayMs * 2^attempt`, capped at `maxDelayMs`) via an INJECTABLE `sleep` and retries up to `retries` times; on a non-transient throw it rethrows immediately (no retry, no sleep); on exhaustion it returns (when `returnMarkerOnExhaust:true`) or throws an exhaustion marker carrying the LAST transient code and the attempt count so the caller can branch to a graceful partial. Attempts are BOUNDED at `retries+1` and the delay at `maxDelayMs` (T-166-09).
- Pure node built-ins, zero new packages, no `Math.random` (delays are deterministic), no network. Canon Part 8: zero Brain wire, no raw fetch -- a pure timing/error-inspection helper.

### Task 2 (EXEC-05 / D-166-01): graceful-partial on exhaustion + resume from the journal
- `runChain` is EXTENDED, not forked. A new opt-gated async path (`_runChainResilient`) is dispatched ONLY when a reliability opt is present (`retries` / `journal` / `roomDir` / `resume` / `sleep`); the Wave-2 synchronous path is byte-identical for every prior caller (D-166-04 single door preserved, verified by the Wave-2 suites staying green).
- The resilient path wraps each step's onStep dispatch in `chain-retry.withBackoff(isTransient)`. On retry exhaustion (transient) OR a non-transient hard fault, the chain is NEVER silently dropped: a `{ step, failure: { code, reason, message, attempts }, partial:true }` marker is folded into the ONE trace, the upstream `chain_output`s are PRESERVED in that same trace, the position is journaled, and the return is `{ trace, completed:false, partial:true, haltedAt:{ step, reason, code } }` -- never `null` (the SEED-028 / AION fix).
- The `reason` distinguishes `transient_retry_exhausted` from `non_transient_hard_failure`, so a downstream filer knows whether to re-run-from-cache (transient) or hand-fix (hard).
- Partial re-run reuses the Wave-1 `pipeline-state.cjs` journal (D-166-02): each COMPLETED step is journaled via `recordStep` (advancing the chain cursor); a resume reads the journal and SKIPS any step whose command sits at-or-before the cursor, re-entering at the first un-journaled (failed) step -- upstream steps are NOT re-run. No new orchestration path.
- B2 preserved on the resilient path: `decide()`'s `decision_trace` is recorded reference-equal / UNCHANGED. B3 preserved: the stop condition stays posture / quality / maxSteps / fault -- no convergence "all-passing" branch was added.

### Task 3: register the Wave-3 suites in run-all-166.sh
- Appended `test-chain-retry-backoff.cjs` + `test-chain-graceful-partial.cjs` to `CJS_SUITES` after the Wave-2 entries (Wave 1/2 entries untouched).
- Extended the Part-8 grep sweep to cover `lib/core/chain-retry.cjs` (same BRAIN_WRITE / RAW_FETCH / external-http / brain-client regexes, comment-line filtering). chain-retry.cjs is a pure timing/error helper with zero network surface.
- Extended the em-dash sweep (U+2014 codepoint escape) to cover chain-retry.cjs + both new suites.

## Canon Compliance

- **Part 3 (Tri-Context Decision Gate):** unchanged -- the gate still halts at material steps via `onHalt`; the resilient path only adds reliability around the onStep dispatch, never relaxes the gate.
- **Part 4 (Every Choice Is Graph Data):** the failure marker is folded into the ONE chain trace alongside the preserved upstream outputs; the trace remains the resumable journal and observability surface.
- **Part 7 (Reuse Before Build):** chain-retry.cjs is a thin net-new wrapper; the loop, the gate, the trace, the decide() authority, and the resume journal (pipeline-state.cjs) all pre-exist. runChain was extended, not rewritten; the resume substrate is the shipped Wave-1 journal, NOT a parallel orchestrator.
- **Part 8 (Graph Boundary):** chain-retry.cjs and the graceful-partial branch make ZERO Brain calls and no raw fetch (verified by the extended Part-8 sweep + a direct grep). The journal artifact path is a generic `chain-output:<command>` handle -- the step body never leaves onStep.
- **Part 9 (Memory Locality):** the resilient path persists chain-state ONLY through the Wave-1 pipeline-state.cjs chokepoint (the SOLE chain-state truth, D-166-02); it opens no new write path of its own.
- **No em-dashes** anywhere (verified across all 5 touched files via the runner sweep and a direct U+2014 grep).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Corrected the graceful-partial test tally from /4 to /3**
- **Found during:** Task 2 (GREEN run)
- **Issue:** The plan's `<behavior>` lists four behaviors (T1, T2, T3, T4), but T1 and T2 are one combined assertion path (transient exhaustion -> a partial whose marker names BOTH the code and the step). The suite implements three logical test bodies (T1+T2 share one IIFE, plus T3 and T4) -> three `ok()` calls. The initial tally asserted `passed !== 4`, which would never reach 4.
- **Fix:** Corrected the tally to `passed !== 3` (three logical bodies). All four behaviors are still asserted; T1 and T2 simply share one IIFE because they assert the same partial result from one fault injection.
- **Files modified:** tests/test-chain-graceful-partial.cjs
- **Commit:** 88e5417f (landed with the GREEN impl)

### Design note (extend, not fork)

The plan's `<action>` says "Wrap the onStep dispatch inside runChain." A literal in-place wrap would force runChain to become async (withBackoff is async), which would break the Wave-2 suites that call `runChain(...)` synchronously and read `result.trace` without `await`. To satisfy BOTH the EXEC-05 requirement and the Wave-2 contract, the resilient behavior lives in an opt-gated async path dispatched FROM runChain (one entry point, not a consumer-visible fork): callers that pass a reliability opt get the async graceful-partial path; callers that pass none get the byte-identical Wave-2 synchronous path. The graceful-partial test always passes a reliability opt, so it exercises the resilient path exactly as the plan intends. This is the minimal change that keeps runChain the single door (D-166-04) while honoring "extend runChain, do not fork it."

## TDD Gate Compliance

- Task 1 followed RED -> GREEN: test `9eb2f98d` failed (module-missing), feat `0dc840e6` made it green (RETRY_OK 4/4). No REFACTOR needed.
- Task 2 followed RED -> GREEN: test `268cdb95` failed (no `partial` flag / no retry / no marker), feat `88e5417f` made it green (PARTIAL_OK 3/3). No REFACTOR needed.
- Task 3 is test-infrastructure registration (no behavior).

## Verification

- `node tests/test-chain-retry-backoff.cjs` -> RETRY_OK 4/4
- `node tests/test-chain-graceful-partial.cjs` -> PARTIAL_OK 3/3
- `bash tests/run-all-166.sh` -> GREEN 8/8 (6 suites + Part-8 sweep + em-dash sweep)
- Wave-2 suites stay green (legacy synchronous runChain path byte-identical): test-chain-executor-loop.cjs + test-chain-executor-gate.cjs both PASS
- Part 8: zero `mcp__brain` / `brain-client` / `fetch(` / external-http matches in chain-retry.cjs + chain-executor.cjs (direct grep + runner sweep)
- B2: decision_trace recorded UNCHANGED on the resilient path; B3: no convergence branch (direct grep)
- Deterministic: no `Math.random`, no real network in either suite (injected sleep + fault-injecting fn/stub)
- Em-dash sweep clean across all 5 touched files (direct U+2014 grep returns nothing)
- min_lines met: chain-retry.cjs 214 (>=60), test-chain-retry-backoff.cjs 186 (>=50), test-chain-graceful-partial.cjs 215 (>=50)

## Commits

- 9eb2f98d test(166-03): add failing chain-retry test -- isTransient + withBackoff (EXEC-05) [RED]
- 0dc840e6 feat(166-03): chain-retry isTransient + withBackoff bounded backoff (EXEC-05/D-166-01) [GREEN]
- 268cdb95 test(166-03): add failing graceful-partial test for runChain (EXEC-05/D-166-01) [RED]
- 88e5417f feat(166-03): runChain graceful-partial on exhaustion + journal resume (EXEC-05/D-166-01) [GREEN]
- 62c63fd4 test(166-03): register Wave-3 suites + extend Part 8 / em-dash sweeps in run-all-166.sh

## Self-Check: PASSED

All 5 deliverable files present on disk (3 created, 2 modified) and all 5 per-task commits found in git history.
