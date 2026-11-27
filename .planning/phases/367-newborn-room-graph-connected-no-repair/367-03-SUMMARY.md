---
phase: 367-newborn-room-graph-connected-no-repair
plan: 03
subsystem: graph-index
tags: [lazygraph, batch-writer, savepoint, r9, ac11, begin-immediate]
requires:
  - "367-01 (content-artifacts.cjs, getArtifactId re-export)"
provides:
  - "lazygraph-ops indexArtifactsBatch(conn, roomDir, items, canonCtx) -> {indexed, failed}"
  - "lazygraph-ops exports computeHash and _readArtifactContent"
  - "_indexArtifactBody optional 5th parameter content"
affects:
  - "plan 367-05 (the runner batch path)"
  - "plan 400.3-06 (owns BEGIN IMMEDIATE on indexArtifact and rebuildGraph; arms I1 and I2 wait for it)"
tech-stack:
  added: []
  patterns: ["one SAVEPOINT per item inside the caller transaction", "two-process AC11 harness (holder commits on its own timer)"]
key-files:
  created:
    - tests/test-367-begin-immediate.cjs
  modified:
    - lib/core/lazygraph-ops.cjs
    - tests/test-sqlite-ops.cjs
decisions:
  - "AC11 on lazygraph indexArtifact and rebuildGraph is transferred to plan 400.3-06 by owner ruling C10; this plan changes neither BEGIN line."
  - "The AC11 holder writes one row into the existing nodes table (type T367Holder), not a new scratch table: the Phase 108 schema drift guard refuses a new table."
metrics:
  duration: "about 25 min"
  completed: 2026-11-26
  tasks: 2
  files: 3
---

# Phase 367 Plan 03: Batch writer and R9 on the runner path Summary

`indexArtifactsBatch` gives the catch-up runner a synchronous, SAVEPOINT-per-item writer that reads no file inside the caller's BEGIN IMMEDIATE transaction; AC11 proves the runner path waits for a concurrent writer and succeeds (I3), while the lazygraph indexArtifact path stays KNOWN-OPEN for plan 400.3-06 (owner ruling C10).

BASE = 5c5035ae62aba86006acbc2b5cdddce60af12e56 (git rev-parse HEAD at the start of Task 1).

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | indexArtifactsBatch, the content parameter and the exports | 0adbed43c | lib/core/lazygraph-ops.cjs, tests/test-367-begin-immediate.cjs, tests/test-sqlite-ops.cjs |
| 2 | AC11 arms I1, I2, I3 on two processes | 92ce637d6 | tests/test-367-begin-immediate.cjs |

## AC11 on the lazygraph index path: transferred to plan 400.3-06 (owner ruling C10)

Owner ruling C10 (400.3-CONTEXT.md "Owner rulings after the build"; 367-OWNER-RULING-C10-SCOPE-2026-11-26.md) owns BEGIN IMMEDIATE on lazygraph indexArtifact and rebuildGraph. This plan does not change either `if (owns) conn.prepare('BEGIN').run();` line. PROVEN: `git diff c8180a3de -- lib/core/lazygraph-ops.cjs | grep -E "^[+-].*prepare\('BEGIN"` gives no line.

Output of `node tests/test-367-begin-immediate.cjs ac11` (first run, the R9 reproduction):

```
test-367-begin-immediate (Phase 367 plan 03) group ac11
  I3 run: {"ok":true,"start_at":1795716538957,"end_at":1795716540441,"committed_at":1795716540381,"waited_ms":1484}
PASS: I3 batch in withRoomTx waits for the holder and succeeds (R9 closed on the runner path)
PASS: I3 the Artifact node exists after the worker ends
  I1 indexArtifact run: {"ok":false,"errcode":5,"message":"database is locked","start_at":1795716540748,"committed_at":1795716542228,"waited_ms":null}
KNOWN-OPEN: I1 indexArtifact busy under a concurrent writer :: errcode 5; BEGIN IMMEDIATE on the index path is plan 400.3-06 (owner ruling C10)
  I2 rebuildGraph run: {"ok":true,"start_at":1795716542486,"end_at":1795716544085,"committed_at":1795716543971,"waited_ms":1599}
PASS: I2 rebuildGraph waits for the holder and succeeds
3 passed, 0 failed, 1 known-open
```

- I3 (withRoomTx BEGIN IMMEDIATE around indexArtifactsBatch): waited about 1.5 s for the holder and succeeded. R9 is closed on the runner path.
- I1 (lazygraph indexArtifact): KNOWN-OPEN, errcode 5 "database is locked" at once. The deferred BEGIN reads (PRAGMA table_info in node-insert.cjs isMigratedSchema) before its first write. Plan 400.3-06 owns the fix.
- I2 (lazygraph rebuildGraph): a real PASS. Its first statement inside the deferred BEGIN is the DELETE of clearIndexerOwnedRows (a write), so SQLite takes the write lock through the busy timeout and waits. The arm stays as written: a later regression to errcode 5 turns it KNOWN-OPEN, any other outcome fails.

## Regression runs (base-red rule)

The BASE list is every file of `grep -l "lazygraph-ops" tests/*.cjs | xargs grep -l "indexArtifact\|rebuildGraph"` (22 files at BASE: the 21 of the plan plus tests/test-367-artifact-set.cjs of plan 367-01) plus tests/test-400-3-room-root-detection.cjs. The base was run twice: in the worktree (it overlapped the Task 1 edit) and on a clean `git archive 5c5035ae6` export in the scratchpad. The two agree on every file except tests/test-400-3-mcp-filing-index.cjs, which fails on the export only because it runs `git show` (the export is not a git repo).

| File | BASE | After 92ce637d6 |
|------|------|-------|
| tests/test-232-wiki-server.cjs | PASS | PASS |
| tests/test-233-graph-derive-health.cjs | PASS | PASS |
| tests/test-236-ecosystem-graph-preserves-journal.cjs | PASS | PASS |
| tests/test-236-rebuild-crash-mid-transaction.cjs | PASS | PASS |
| tests/test-236-rebuild-preserves-journal.cjs | PASS | PASS |
| tests/test-236-rebuild-wal-concurrent-read.cjs | PASS | PASS |
| tests/test-240-jtbd-event-survives-rebuild.cjs | PASS | PASS |
| tests/test-240.1-layer-doctrine-presence.cjs | PASS | PASS |
| tests/test-244-fts-build-orphan-prune.cjs | PASS | PASS |
| tests/test-244-fts-rebuild-reconcile.cjs | PASS | PASS |
| tests/test-366-canon-at-filing.cjs | PASS | PASS |
| tests/test-367-artifact-set.cjs | PASS | PASS |
| tests/test-369-change-log-compaction.cjs | PASS | PASS |
| tests/test-369-tx-ownership.cjs | PASS | PASS |
| tests/test-369-writer-inventory.cjs | FAIL | FAIL |
| tests/test-400-3-mcp-filing-index.cjs | PASS | PASS |
| tests/test-400-3-room-root-detection.cjs | PASS | PASS |
| tests/test-graph-derivation-verdict.cjs | PASS | PASS |
| tests/test-graph-derive-health-stale-skip.cjs | PASS | PASS |
| tests/test-nested-artifact-indexing.cjs | PASS | PASS |
| tests/test-sqlite-battle.cjs | PASS | PASS |
| tests/test-sqlite-concurrent.cjs | FAIL | FAIL |
| tests/test-sqlite-ops.cjs | FAIL | FAIL |

The 3 FAIL files are base-red. The failing set did not grow (PROVEN by a diff of the not-ok lines): test-369-writer-inventory.cjs (scan arm: scripts/eureka-portfolio-calibrate.cjs 2 unlisted sites), test-sqlite-concurrent.cjs (WAL mode is active on database), test-sqlite-ops.cjs (BASE pass 48, fail 4; after pass 49, fail 3: WAL mode, wikilink INFORMS, EDGE_TYPES 19; the export-count arm passes at 34).

## Verification

- `node tests/test-367-begin-immediate.cjs all`: 25 passed, 0 failed, 1 known-open; exit 0.
- `node tests/test-sqlite-ops.cjs`: "ok 1 - module exports exactly 34 keys".
- `node tests/test-400-3-room-root-detection.cjs cascade`: 13 passed; "C10 busy is reported within 750 ms (measured 2 ms)".
- `node tests/test-367-artifact-set.cjs`: 7 passed.
- `node scripts/check-substrate.cjs --diff` on each staged diff: exit 0. No em-dash in any touched file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The AC11 holder writes into the existing nodes table**
- **Found during:** Task 2 commit
- **Issue:** the pre-commit Phase 108 schema drift guard refused the commit: the test created `t367_scratch`, a table that is not in aliases.yml (D-05, no parallel schema).
- **Fix:** resolution option 2 of the guard. The holder runs `INSERT OR REPLACE INTO nodes (id, type, properties)` with type T367Holder (not an indexer type, so the rebuild wipe does not touch it). No --no-verify.
- **Files modified:** tests/test-367-begin-immediate.cjs
- **Commit:** 92ce637d6

**2. [Rule 1 - Test] The dispatch moved to the end of the test file.** The first RED run hit a temporal dead zone (`main()` ran before `const ROOTS`). Fixed before the Task 1 commit.

**3. [Process] One commit per task.** The RED runs were done and seen (batch group 3 passed, 8 failed before the source change).

## Notes

- lazygraph-ops exports 34 keys (30 at c8180a3de, +1 in 367-01, +3 here).
- The AC11 holder holds 1500 ms (AC11 names 300 ms); the plan records why.
- Agent runs: the same single gsd-executor run as 367-01. Tokens: not measurable from inside the agent.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND tests/test-367-begin-immediate.cjs; FOUND commits 0adbed43c, 92ce637d6
