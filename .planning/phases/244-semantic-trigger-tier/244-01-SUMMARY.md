---
phase: 244-semantic-trigger-tier
plan: 01
subsystem: sensors
tags: [sqlite-fts5, bm25, sensor-types, tri-modal-index, trigger-tier, canon-part-11]

# Dependency graph
requires: []
provides:
  - "tests/run-all-244.sh: the phase 244 test aggregator (glob discovery + found-eq-0 guard + no-em-dash fence)"
  - "TRIGGER_TIERS grown to 4: ['signal','context','content','keyword'], frozen, R3-doctrine-ordered"
  - "isFallbackTier(tier): the explicit-allowlist companion to isContextTier, exported from sensor-types.cjs"
  - "tri-modal-index.cjs::tableExists promoted to a public export (the _test alias preserved)"
affects: [244-02, 244-03, 244-05, 244-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit-allowlist tier predicates (isContextTier / isFallbackTier), never a negated denylist, so a future 5th tier cannot silently fall into either bucket"
    - "Public-export promotion of a function that already existed under _test, keeping the _test alias pointing at the SAME function reference so no existing test breaks"

key-files:
  created:
    - tests/run-all-244.sh
    - tests/test-244-trigger-tier-vocab.cjs
    - tests/test-244-fts-query-sanitize.cjs
  modified:
    - lib/core/sensors/sensor-types.cjs
    - lib/core/eureka/tri-modal-index.cjs

key-decisions:
  - "content tier inserted between context and keyword in TRIGGER_TIERS, per 244-RESEARCH.md Q1: not navigator problem-state (so below context, Canon Part 11 R3), but corpus-relative bm25 evidence rather than a hand-picked keyword list (so above keyword)"
  - "isFallbackTier implemented as an explicit allowlist (tier === 'content' || tier === 'keyword'), deliberately NOT as !isContextTier(tier), matching 244-PATTERNS.md's explicit instruction that a negated form would silently absorb a future 5th tier"
  - "The now-wrong `=== 'keyword'` binary-idiom doctrine comment was amended as a doc fix, not a live-defect fix -- 244-PATTERNS.md Correction 2 confirmed zero production consumers followed that idiom (only 4 unrelated test assertions on evidence.mode, none reachable by a content tier)"
  - "toFtsMatch was NOT promoted to public, only tableExists was -- production code must never call the MATCH sanitizer directly; lexicalSearch already calls it internally, and the new test reads it via _test.toFtsMatch, which is what that seam is for"

requirements-completed: [TRIG-01]

# Metrics
duration: 55min
completed: 2026-07-30
---

# Phase 244 Plan 01: Trigger-Tier Vocabulary + Public tableExists Summary

**Fourth `content` trigger tier landed in the frozen R3 vocabulary, `isFallbackTier` allowlist added, `tableExists` promoted from a `_test` seam to a public export of `tri-modal-index.cjs`, and the phase 244 test aggregator now discovers and runs both new test files green.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-30T18:54:02Z
- **Tasks:** 3/3
- **Files modified:** 5 (3 new, 2 modified)

## Accomplishments

- `tests/run-all-244.sh` authored RED-first (Task 1), observed failing loudly on empty discovery, then went green once Tasks 2-3 landed two real test files.
- `TRIGGER_TIERS` grew from 3 to 4 members (`signal`, `context`, `content`, `keyword`), frozen, ordered per the Canon Part 11 R3 precedence doctrine, with `isFallbackTier` added as the allowlist companion to `isContextTier`.
- `tableExists` promoted to a public export of `lib/core/eureka/tri-modal-index.cjs`, closing the gap that forced `lazygraph-ops.cjs` (a future plan) to either reach into a test seam or hand-roll a duplicate `sqlite_master` probe.
- The Pitfall-1 punctuation fence, the forced-absent degrade (on a db with AND without the table), and the documented `index_absent` vs `zero_hits` indistinguishability fact are all pinned by `tests/test-244-fts-query-sanitize.cjs`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author tests/run-all-244.sh, RED-first** - `9695add6` (test)
2. **Task 2: Add the content trigger tier and the isFallbackTier allowlist** - `b53a0eb4` (feat)
3. **Task 3: Promote tableExists to a public export and fence the FTS query path** - `42e0f675` (feat)

_No separate plan-metadata commit: SUMMARY.md is committed as part of this worktree's final commit per the parallel-executor protocol (STATE.md/ROADMAP.md are excluded and owned by the orchestrator)._

## Files Created/Modified

- `tests/run-all-244.sh` - Phase 244 test aggregator: glob discovery over `tests/test-244-*`, the load-bearing `found -eq 0` guard, `run`/`run_may_skip` carried from the `run-all-236.sh` analog, plus a new no-em-dash fence leg (`grep -lP '\x{2014}'` over every file this phase touches)
- `tests/test-244-trigger-tier-vocab.cjs` - Pins the full Task 2 `<behavior>` block: frozen 4-element order, `isContextTier`/`isFallbackTier` mutual exclusion + union coverage, `classifyTriggerTier` never yielding `content`
- `tests/test-244-fts-query-sanitize.cjs` - Pins the full Task 3 `<behavior>` block: public `tableExists` reachability, its false/true/never-throws contract, the Pitfall-1 punctuation fence, the forced-absent degrade on both table-present and table-absent dbs, and the `index_absent` vs `zero_hits` indistinguishability fact
- `lib/core/sensors/sensor-types.cjs` - `TRIGGER_TIERS` grows to 4 (`content` inserted between `context` and `keyword`); doctrine block gains a `content` line; the now-wrong `=== 'keyword'` NOTE comment amended to point at `isContextTier`/`isFallbackTier`; `isFallbackTier(tier)` added and exported
- `lib/core/eureka/tri-modal-index.cjs` - `tableExists` added to the public `module.exports` block (the `_test.tableExists` alias unchanged, same function reference)

## Decisions Made

- **content tier placement (Task 2):** between `context` and `keyword`, per 244-RESEARCH.md Q1's doctrine derivation (R3 forbids ranking non-problem-state as context-tier; corpus-relative bm25 evidence is stronger than a hand-picked keyword list, so content outranks keyword). This was NAVIGATOR-CONFIRMED research, not an executor call.
- **isFallbackTier as an explicit allowlist, not `!isContextTier(tier)`:** 244-PATTERNS.md and the plan's own acceptance criteria (MUTATION PROOF 3) specifically required this shape so a future fifth tier cannot be silently absorbed into either bucket. Verified live: rewriting it as the negated form turns `isFallbackTier(null) === false` red.
- **Doc-fix framing for the amended NOTE comment, not a live-defect claim:** 244-PATTERNS.md Correction 2 confirmed via repo-wide grep that the only `=== 'keyword'` occurrences are the doctrine comment itself and four test assertions on `evidence.mode` that a `content` tier can never reach. The comment was still fixed (doctrine rot), but the SUMMARY does not claim a live bug was closed.
- **toFtsMatch stays unpromoted:** only `tableExists` needed a public export. `toFtsMatch` is called internally by `lexicalSearch`; promoting it would let production code bypass the intended single call path. The new test reads it via `_test.toFtsMatch`, which is the seam's designed purpose.

## Deviations from Plan

None - plan executed exactly as written. All four `<must_haves>` truths and five `<must_haves>` artifacts are present. No architectural changes, no scope additions, no package installs.

## Issues Encountered

- **Pre-existing, out-of-scope test failures unrelated to this plan.** `bash tests/run-all-205.sh`, `bash tests/run-all-219.sh` (specifically the `219-01` banking leg and the nested `run-all-218.sh` substrate-no-regression leg), plus a spot-check of every `tests/test-*.cjs` file that requires `sensor-types.cjs` (`test-203-reach-sensor.cjs`, `test-205-fusion-router.cjs`, `test-205-sens10-circularity.cjs`, `test-unknowns-rank-in.cjs`) all fail with the SAME root cause: `table edges has no column named review_status` (a schema-drift condition from a concurrent session committing to this repo in parallel, per 244-RESEARCH.md's own concurrency note). **Confirmed via `git stash`** that every one of these failures is present BYTE-IDENTICAL with and without this plan's changes. Per the executor's SCOPE BOUNDARY rule, these are logged here as out-of-scope and left untouched, not auto-fixed.
- **`node lib/memory/run-feynman-tests.cjs` did not complete within a reasonable window** (backgrounded, still running after several minutes with zero output). Rather than block on it, every individual `tests/test-*.cjs` file that `require`s `sensor-types.cjs` (21 files) was run directly; all pass except the four pre-existing failures documented above, none of which are new. This satisfies the acceptance criterion's intent ("legs touching sensor-types stay green") via a more targeted, faster check.
- **Unrelated files touched by a concurrent session** (`dashboard/graph.json`, `evals/plurai/211-baseline.json`) appeared modified in `git status` throughout this plan's execution. Per the task-commit protocol (stage files individually, never `git add -A`), neither was staged or committed by this plan.

## Mutation Proofs (6 total, all executed live and reverted)

### Task 1 -- the found-eq-0 guard

Softened `if [ $found -eq 0 ]; then` to `if [ 1 -eq 0 ]; then` (unconditional false), re-ran with zero `tests/test-244-*` files present:

```
--- 244 no-em-dash fence ---
>>> 244 no-em-dash fence: PASSED

======================================
Phase 244: PASS=1 FAIL=0 SKIP=0
======================================
```

Exit code 0 -- a GREEN summary over zero discovered tests, proving the guard is load-bearing. Restored, re-ran, exit code 1 again with:

```
!!! no tests/test-244-* files discovered
```

**The exact empty-discovery failure line, observed BEFORE Tasks 2-3 landed (RED-first, as designed):**

```
!!! no tests/test-244-* files discovered
```
(exit code 1)

### Task 2 -- MUTATION PROOF 1 (TRIGGER_TIERS order)

Moved `'content'` above `'context'`. `node tests/test-244-trigger-tier-vocab.cjs` turned RED:

```
FAIL: TRIGGER_TIERS is exactly the 4-element ordered array [signal, context, content, keyword] -- TRIGGER_TIERS order is the R3 precedence doctrine
+ actual - expected
  [ 'signal', + 'content', 'context', - 'content', 'keyword' ]
Phase 244-01 trigger-tier vocab: PASS=9 FAIL=1
```

Restored; re-ran green (`PASS=10 FAIL=0`).

### Task 2 -- MUTATION PROOF 2 (isContextTier as a denylist)

Rewrote `isContextTier` as `return tier !== 'keyword';`. Turned RED (two assertions, since the mutual-exclusion assertion also depends on the allowlist):

```
FAIL: isContextTier: content returns false (R3 -- content is not problem-state) -- true !== false
FAIL: isContextTier and isFallbackTier are mutually exclusive over every TRIGGER_TIERS member -- tier "content" must be exactly one of context/fallback, got ctx=true fb=true
Phase 244-01 trigger-tier vocab: PASS=8 FAIL=2
```

Restored; re-ran green.

### Task 2 -- MUTATION PROOF 3 (isFallbackTier as a negated denylist)

Rewrote `isFallbackTier` as `return !isContextTier(tier);`. Turned RED:

```
FAIL: isFallbackTier: signal, context, null, undefined, nonsense are false -- true !== false
Phase 244-01 trigger-tier vocab: PASS=9 FAIL=1
```

Restored; re-ran green (`PASS=10 FAIL=0`). File diffed byte-identical to pre-mutation state.

### Task 3 -- MUTATION PROOF 1 (tableExists export removal)

Removed `tableExists: tableExists,` from the public export block. `node -e "...tableExists!=='function'..."` exited 1 (no "public tableExists ok" printed) -- confirmed RED. Restored; re-ran, printed `public tableExists ok`, exit 0.

### Task 3 -- MUTATION PROOF 2 (bypass the sanitizer)

Changed `lexicalSearch` to pass raw `query` to `MATCH` instead of `matchExpr`, and removed the `catch` so the raw error surfaces. `node tests/test-244-fts-query-sanitize.cjs` turned RED with the **exact observed error text**:

```
FAIL: lexicalSearch does not throw on raw punctuated text and returns an array -- Got unwanted exception: raw punctuation must never throw fts5: syntax error
Actual message: "fts5: syntax error near "'""
```

Restored; re-ran green (`PASS=11 FAIL=0`). File diffed byte-identical to pre-mutation state.

### Task 3 -- MUTATION PROOF 3 (delete resetFtsProbe() from the forced-absent leg)

Deleted the `tri._test.resetFtsProbe();` call from the "forced-absent: lexicalSearch returns [] ... db that HAS eureka_fts" test leg. **Stayed GREEN** -- documented per the acceptance criterion's "or document precisely why it does not" clause.

**Observed ordering, precisely:** `ensureFtsAvailable`'s forced-env branch reads `process.env.MINDRIAN_FORCE_FTS_ABSENT` and returns `{ ok: false, detail: 'forced_absent' }` **unconditionally** whenever that env var is a non-empty string -- this check runs BEFORE the cached `_ftsVerdict` is ever consulted (`tri-modal-index.cjs` lines ~226-233). The `_ftsVerdict === null` check inside that branch only gates whether `_ftsProbeComputations` increments; it never gates the return value. So entering forced-absent mode from ANY prior cached state (including a real `ok:true` verdict from a preceding `openIndex` call in the same test file) does not require a reset -- the forced check short-circuits before the cache matters. `resetFtsProbe()` is mandatory only for the OPPOSITE direction: flipping BACK from a previously-forced-absent verdict to a genuine probe (which the file's other legs, and `test-219-fts5-degrade.cjs`, correctly do call it for). Restored the deleted line; re-ran green (`PASS=11 FAIL=0`).

## Baselines Captured (pre-task, for regression comparison)

**`bash tests/run-all-205.sh`** (captured before any edit): exit 1, `AssertionError: expected ok:true, got {"ok":false,"reason":"edge_write_failed","detail":"table edges has no column named review_status"}` at `tests/test-205-frame-node.cjs:230`. Post-Task-3 re-run: **byte-identical** (`diff` clean).

**`bash tests/run-all-219.sh`** (captured before any edit): `Phase 219: PASS=11 FAIL=2 SKIP=0`. Post-Task-3 re-run: **PASS/FAIL/SKIP counts identical** (`PASS=11 FAIL=2 SKIP=0`); the only diff lines are non-deterministic noise (process PIDs, `mkdtemp` random suffixes, and a 1ms timing jitter between two `ok` lines).

**`node scripts/build-connector-registry.cjs --check`**: exit 0 both before and after (`connector-registry: OK`).

**`node scripts/check-substrate.cjs --diff`**: exit 0 both before and after.

## Next Phase Readiness

- Plan 02 (`ftsIndexState`), Plan 03 (the FTS reconcile guard), Plan 05 (the content sensor's ctx-assembly producer + the `'content'` tier stamp), and Plan 06 (the doctor module) can now consume `tableExists` as a public API and `isFallbackTier`/the 4-tier `TRIGGER_TIERS` array without reaching into any test seam.
- No blockers. `tests/run-all-244.sh` is green (2/8 planned test files discovered; the remaining six are owned by later plans in this phase, per the reading checklist in the aggregator's header).

---
*Phase: 244-semantic-trigger-tier*
*Completed: 2026-07-30*
