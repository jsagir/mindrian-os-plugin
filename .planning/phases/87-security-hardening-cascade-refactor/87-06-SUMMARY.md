---
phase: 87-security-hardening-cascade-refactor
plan: 06
subsystem: storage
tags: [sqlite, transaction, rollback, write-lock, cascade-04, node-sqlite, atomicity]

# Dependency graph
requires:
  - phase: 87-02
    provides: atomic write-lock acquireLock/releaseLock (outer lock around enqueueWrite; this plan sits the transaction INSIDE that lock)
  - phase: 87-00
    provides: cascade-e2e fixture exact-match baseline {INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1} (preserved across this change)
provides:
  - _indexArtifactBody private helper: transaction-free insert body, callable inside an outer BEGIN (for rebuildGraph) or inside indexArtifact's own BEGIN/COMMIT
  - indexArtifact wrapped in explicit BEGIN / COMMIT / ROLLBACK (node:sqlite style)
  - rebuildGraph migrated from dead conn.transaction(fn) API to explicit BEGIN/COMMIT + _indexArtifactBody calls (no nested transactions)
  - index-artifact-transaction.test.cjs with 4 distinct tests (happy-path, testMidTransactionRollback, testLockReleaseAfterCommit, testRollbackDoesNotLeakLock)
affects: [87-07 Brain cache (indexArtifact is part of cascade write path; Brain cache must not interact poorly with rolled-back transactions), future indexOpportunity-style writers (same transaction wrap pattern)]

# Tech tracking
tech-stack:
  added: []  # Zero new runtime dependencies. node:sqlite BEGIN/COMMIT/ROLLBACK is a Node 22.5+ builtin.
  patterns:
    - "Explicit BEGIN/COMMIT/ROLLBACK (not conn.transaction(fn)) -- node:sqlite DatabaseSync does NOT expose the better-sqlite3 transaction(fn) higher-order helper. Plans that assume it must use explicit prepared-statement BEGIN/COMMIT/ROLLBACK."
    - "Transaction-free inner helper (_indexArtifactBody) callable from two contexts: (a) from indexArtifact wrapped in BEGIN/COMMIT, (b) from rebuildGraph running inside rebuildGraph's own outer BEGIN. Avoids nested-transaction error (SQLite rejects nested BEGIN without SAVEPOINT)."
    - "Inner try/catch: ROLLBACK goes in the catch branch; the ROLLBACK call is itself wrapped in a defensive try/catch so the original error propagates even if the connection is already aborted."
    - "Lock-layer separation: enqueueWrite (outer, file lock via write-lock.cjs) wraps lazygraph.indexArtifact (inner, SQLite transaction). The SQLite transaction sits INSIDE enqueueWrite's fn callback; graph-ops.cjs is never modified."
    - "Failure-injection test pattern: patch conn.prepare so the Nth prepare returns a stmt whose .run() throws. Placing N such that at least one INSERT has already fired before the throw proves ROLLBACK actually reverted the partial write (countAfter === countBefore) and is not a no-op."

key-files:
  created:
    - lib/memory/index-artifact-transaction.test.cjs
  modified:
    - lib/core/lazygraph-ops.cjs
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "Rule 1 deviation: plan specified conn.transaction(fn) wrap, but node:sqlite DatabaseSync does NOT expose that API (it is a better-sqlite3 API). Switched to explicit BEGIN/COMMIT/ROLLBACK prepared statements. All plan semantics preserved."
  - "Pre-existing broken code (rebuildGraph's rebuildTxn using the same dead conn.transaction API) surfaced and was fixed in the same edit. It was latent (never exercised by cascade-e2e) but would have crashed on first real call."
  - "_indexArtifactBody private helper factors out the INSERT body so rebuildGraph can call it inside its own outer BEGIN without triggering a nested-transaction SQLite error."
  - "Test injection point is prepare #3 (NOT prepare #2), because prepare #1 is BEGIN and prepare #2 is the first INSERT. Throwing on prepare #2's run() would fire BEFORE any real write, meaning the test would pass even if BEGIN/COMMIT were removed. Throwing on prepare #3 ensures at least one real INSERT has fired before the throw -- countAfter - countBefore == 1 is the true regression signal."
  - "Four tests (not three) because testRollbackDoesNotLeakLock combines the concerns of Test 2 (rollback semantics) and Test 3 (lock release) in ONE flow through the public graphOps.indexArtifact API. Having both in one test ensures they interact correctly -- rollback must NOT leak the write-lock."
  - "graph-ops.cjs intentionally untouched: enqueueWrite already handles write-lock acquire/release in its outer try/finally. Adding another lock layer inside indexArtifact would cause same-PID double-acquire."

requirements-completed: [CASCADE-04]

# Metrics
duration: 14min
completed: 2026-04-19
---

# Phase 87 Plan 06: indexArtifact Transaction Wrap Summary

**Wrapping indexArtifact's INSERT body in explicit BEGIN/COMMIT with ROLLBACK on throw closes CASCADE-04. Four independent tests prove rollback semantics, lock-release semantics, and their interaction -- with a proven regression fence (the mid-transaction rollback test FAILS when the BEGIN/COMMIT is removed).**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-19T18:46:03Z
- **Completed:** 2026-04-19T19:00:24Z
- **Tasks:** 2 (both TDD: verify -> implement -> prove regression catch)
- **Files modified:** 3 (1 source, 1 test runner, 1 new test file)

## Accomplishments

- Wrapped `indexArtifact` body in explicit BEGIN/COMMIT/ROLLBACK. Any throw inside the body (from a malformed file, an unexpected SQLite constraint, or future cascade-step failure) now rolls back every partial write since BEGIN. The public API signature and return value are unchanged.
- Extracted `_indexArtifactBody` private helper: the transaction-free INSERT body, callable both from `indexArtifact` (wrapped in its own BEGIN/COMMIT) AND from `rebuildGraph` (inside `rebuildGraph`'s outer BEGIN). This avoids a nested-transaction error that SQLite would reject.
- Fixed pre-existing broken `rebuildTxn` code in `rebuildGraph`: the existing code used `conn.transaction(fn)` which does not exist on `node:sqlite` DatabaseSync (it is a better-sqlite3 API). `rebuildGraph` would have crashed on first real call. Migrated to explicit BEGIN/COMMIT/ROLLBACK matching `indexArtifact`.
- Added `lib/memory/index-artifact-transaction.test.cjs` with 4 tests:
  - `testHappyPath` (happy flow + lock released after success)
  - `testMidTransactionRollback` (real mid-transaction injection, countAfter === countBefore proves ROLLBACK fired)
  - `testLockReleaseAfterCommit` (DISTINCT named test: fs.readFileSync throws BEFORE the txn starts, enqueueWrite finally must still release the lock)
  - `testRollbackDoesNotLeakLock` (combined concern: throw INSIDE txn body, asserts BOTH rollback AND lock release)
- Proved the mid-transaction rollback test catches regressions: temporarily patched the BEGIN/COMMIT wrap out of `indexArtifact`, ran the test, got the expected "ROLLBACK FAILED: 1 -> 2 -- partial write survived" failure. Restored the wrap and the test passes again. This is the exit-code fence that will catch any future regression of the transaction wrap.
- Registered the new test in `lib/memory/run-feynman-tests.cjs`: feynman suite now 24/24 green (was 23/23).
- `test/fixtures/cascade-e2e/cascade-e2e.test.cjs` still exits 0 with exact baseline `{INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1}` (indexArtifact is in the cascade write path; the exact-match assertion would fail on any behavioral drift).
- `lib/core/graph-ops.cjs` unchanged. `lib/core/write-lock.cjs` unchanged. Both are contracts from earlier plans (87-02 atomic lock is the outer guard); this plan only adds inner transaction semantics.

## Task Commits

Each task committed atomically:

- **Task 6-1** (`52e9b38`): `feat(87-06): wrap indexArtifact INSERT body in explicit BEGIN/COMMIT`
  - `lib/core/lazygraph-ops.cjs` (+74 / -25 lines)
- **Task 6-2** (`013eda4`): `test(87-06): prove indexArtifact transaction wrap + lock-release semantics`
  - `lib/memory/index-artifact-transaction.test.cjs` (new, 231 lines)
  - `lib/memory/run-feynman-tests.cjs` (+5 lines)

## Verification

### Grep counts (on lib/core/lazygraph-ops.cjs)

| Pattern                                   | Count | Meaning                                                  |
| ----------------------------------------- | ----- | -------------------------------------------------------- |
| `BEGIN\|conn.transaction\|db.transaction` | 11    | 2 BEGIN statements + 9 surrounding comments referencing the pattern |
| `ROLLBACK`                                | 8     | 2 explicit ROLLBACK.run() calls + 6 surrounding comments |
| `COMMIT`                                  | 8     | 2 explicit COMMIT.run() calls + 6 surrounding comments   |

### Grep counts (on lib/memory/index-artifact-transaction.test.cjs)

| Pattern                                                    | Count | Meaning                                   |
| ---------------------------------------------------------- | ----- | ----------------------------------------- |
| `write.lock`                                               | 9     | Lock file path references                 |
| `assert.ok(threw`                                          | 2     | Two injected failures exercised           |
| `countAfter...countBefore\|ROLLBACK FAILED`                | 7     | Rollback assertions + diagnostic messages |
| `injected mid-transaction\|runCount >= 2`                  | 5     | Injection markers                         |
| `testLockReleaseAfterCommit\|testMidTransactionRollback`   | 7     | Both tests named distinctly               |

### Test results

```
Feynman test runner: 24/24 passed, 0 skipped, 0 failed
[cascade-e2e] all assertions passed (exact-match vs baseline): {"INFORMS":3,"CONTRADICTS":1,"CONVERGES":0,"INVALIDATES":1}
index-artifact-transaction: all tests passed (happy-path nodes=1, rollback-countBefore=1, rollback-countAfter=1, t4-lock-released-after-rollback=1==1)
```

### Regression-catch proof

Temporarily patched the BEGIN/COMMIT wrap out of `indexArtifact`, ran the new test, observed the expected assertion failure:

```
FAIL: ROLLBACK FAILED: node count changed from 1 to 2 -- partial write survived
2 !== 1
```

Restored the wrap, test passes. This is the exit-code fence.

## Deviations from Plan

### Rule 1 deviation: dead conn.transaction API

**Found during:** Task 6-1 (first run of cascade-e2e after applying plan as written).

**Issue:** The plan specified `conn.transaction(() => { ... })` as the transaction wrap, referencing the "existing rebuildTxn pattern at line ~397" of `lazygraph-ops.cjs`. That existing code used `conn.transaction(fn)`, which is a **better-sqlite3** API. The codebase uses `node:sqlite` (Node 22.5+ builtin `DatabaseSync`), which does NOT expose a `transaction(fn)` higher-order helper. A direct test (`node -e "const { DatabaseSync } = require('node:sqlite'); new DatabaseSync(':memory:').transaction"`) returns `undefined`.

The implication: the pre-existing `rebuildTxn` at line 422 would throw `TypeError: conn.transaction is not a function` on first call. It was never exercised by the cascade-e2e baseline (which goes through `runCascade` -> `graphOps.indexArtifact`, never through `rebuildGraph`), so the latent bug survived. Applying the plan as written produced the same TypeError when my new `indexTxn = conn.transaction(() => {...})` ran.

**Fix:** Switched `indexArtifact` to explicit `BEGIN` / `COMMIT` / `ROLLBACK` prepared statements. Migrated `rebuildGraph`'s `rebuildTxn` to the same pattern. Extracted `_indexArtifactBody` so `rebuildGraph` can call the insert body directly inside its own outer BEGIN (no nested transaction, which SQLite rejects).

**Files modified:** `lib/core/lazygraph-ops.cjs` (indexArtifact + rebuildGraph + new _indexArtifactBody helper).

**Commit:** `52e9b38` (same commit as the Task 6-1 wrap; the fix of rebuildGraph is inline with the wrap of indexArtifact because they share the same API switch).

**Justification for in-scope fix:** The plan's verification criteria (`grep -c "conn.transaction" lib/core/lazygraph-ops.cjs >= 2`) was written against a false API assumption. Leaving the broken `rebuildTxn` in place would (a) leave latent crash waiting for first rebuildGraph call, (b) create two inconsistent transaction patterns in one file, (c) break the plan's own verification count. Fixing both is Rule 1 (bug fix directly caused by the API correction).

### Test 2 injection point adjustment (R-87-06-ROLLBACK refinement)

**Plan specified:** "patch `conn.transaction` to wrap the callback in a spy that counts `prepare().run()` invocations and throws on the 2nd call".

**Adjustment:** Since `conn.transaction` is unavailable, injection had to go through `conn.prepare`. The throw fires on **prepare #3's** `.run()` (not prepare #2) because:

- prepare #1 = BEGIN -> must fire to open the transaction
- prepare #2 = first INSERT (Artifact node) -> must fire to put at least one real write on the wire INSIDE the BEGIN block
- prepare #3 = second INSERT (Section node) -> throw fires here

If the throw were on prepare #2's `.run()`, no real INSERT would have fired, and the test would pass even with the BEGIN/COMMIT wrap removed (no rollback needed because nothing to roll back). Throwing on prepare #3 is the only placement that distinguishes "ROLLBACK fired" from "no write happened". The test's failure message uses `runCount >= 2` as the canonical marker (2 real run() calls already succeeded: BEGIN + first INSERT).

The adjustment preserves R-87-06-ROLLBACK's spirit: force a failure INSIDE the transaction body, AFTER at least one INSERT, BEFORE COMMIT. Proved to catch regressions (see "Regression-catch proof" above).

### Fourth test added (testRollbackDoesNotLeakLock)

Plan specified 3 tests (happy-path + testMidTransactionRollback + testLockReleaseAfterCommit). Critical constraints (the orchestrator prompt) additionally required `testRollbackDoesNotLeakLock` — throw INSIDE transaction + assert lock released in finally. Added as a fourth test. It exercises the public `graphOps.indexArtifact` API (so enqueueWrite is in the stack) and monkey-patches `lazygraph.indexArtifact` to simulate a throw mid-transaction. Asserts BOTH that the partial INSERT is rolled back AND that the write-lock is released. Not a deviation, just a more-complete fulfillment of the orchestrator's critical constraints.

## CHANGELOG entry (v1.10.12)

```markdown
## [1.10.12] - TBD

### Fixed
- CASCADE-04: `indexArtifact()` now wraps its INSERT body in an explicit SQLite BEGIN/COMMIT transaction. Any throw mid-index rolls back every partial write so `room.db` never ends up in a half-written state (dangling nodes without edges, or edges without their source/target nodes). Applies the same fix to `rebuildGraph()`, which previously referenced a nonexistent `conn.transaction(fn)` helper (better-sqlite3 API, not available on node:sqlite DatabaseSync).
```

## Self-Check: PASSED
- lib/core/lazygraph-ops.cjs FOUND (modified in commit 52e9b38)
- lib/memory/index-artifact-transaction.test.cjs FOUND (new file in commit 013eda4)
- lib/memory/run-feynman-tests.cjs FOUND (modified in commit 013eda4)
- Commit 52e9b38 FOUND in git log
- Commit 013eda4 FOUND in git log
