---
phase: 367-newborn-room-graph-connected-no-repair
plan: 01
subsystem: graph-index
tags: [lazygraph, artifact-set, backfill, design-5.1]
requires: []
provides:
  - "lib/core/content-artifacts.cjs listContentArtifacts(roomDir) -> {files, collisions}"
  - "lib/core/content-artifacts.cjs getArtifactId (lazygraph-ops re-exports the same function)"
affects:
  - "lib/core/graph-backfill.cjs _artifactsToIndex (now the shared set)"
  - "plans 367-05 (runner) and 367-10 (doctor) read the same set"
tech-stack:
  added: []
  patterns: ["lazy require inside the function to break a load-time cycle"]
key-files:
  created:
    - lib/core/content-artifacts.cjs
    - tests/test-367-artifact-set.cjs
    - .planning/phases/367-newborn-room-graph-connected-no-repair/deferred-items.md
  modified:
    - lib/core/lazygraph-ops.cjs
    - lib/core/graph-backfill.cjs
decisions:
  - "W1 reads the Artifact ids that rebuild writes from the Artifact nodes plus the BELONGS_TO sources, because rebuild retypes a root-file node to Section (D-367-01)."
metrics:
  duration: "about 15 min"
  completed: 2026-11-26
  tasks: 2
  files: 4
---

# Phase 367 Plan 01: One shared artifact set Summary

One walker, `listContentArtifacts(roomDir)` in the new `lib/core/content-artifacts.cjs`, now defines the content files of a room (the rebuildGraph passes with isFile on every pass, minus scaffold files, minus top-level sub-room files, with a fixed collision order); `getArtifactId` moved there and the derive backfill delegates to it.

BASE = b0fb5a1abc9753f10bd2b6480ba80901812a85f0 (git rev-parse HEAD at the start of Task 1).

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | content-artifacts.cjs and the moved getArtifactId | fef769b16 | lib/core/content-artifacts.cjs, lib/core/lazygraph-ops.cjs, tests/test-367-artifact-set.cjs |
| 2 | derive backfill uses the shared set | 4d322fe95 | lib/core/graph-backfill.cjs, tests/test-367-artifact-set.cjs |

## Regression runs (base-red rule)

| File | BASE b0fb5a1ab | After 4d322fe95 |
|------|------|-------|
| tests/test-224-backfill-idempotent.cjs | PASS | PASS |
| tests/test-224-proposed-only.cjs | PASS | PASS |
| tests/test-233-graph-heal-pipeline.cjs | FAIL (G3 CONTROL, PRE-EXISTING) | FAIL (same assertion) |
| tests/test-233-drain-backfill-producer-parity.cjs | PASS | PASS |
| tests/test-236-backfill-default-preserves-journal.cjs | PASS | PASS |
| tests/test-36925-never-ready.cjs | PASS | PASS |
| tests/test-36925-readiness-gate.cjs | PASS | PASS |
| tests/test-derive-backfill-acceptance.cjs | PASS | PASS |
| tests/test-graph-derivation-verdict.cjs | PASS | PASS |
| tests/test-400-3-mcp-filing-index.cjs | PASS (25 passed) | PASS (25 passed) |
| tests/test-sqlite-ops.cjs | pass 48, fail 4 (WAL mode, wikilink INFORMS, EDGE_TYPES 19, exports 21) | pass 48, fail 4 (the same 4; diff of the not-ok lines is empty) |
| tests/test-367-artifact-set.cjs | n/a (new; 0 passed 6 failed before the module) | 7 passed, 0 failed |

The failing set did not grow. lazygraph-ops now exports 31 keys (was 30): getArtifactId. Plan 367-03 re-bases the sqlite-ops export count.

## Verification

- `node tests/test-367-artifact-set.cjs`: 7 passed, 0 failed (W1 to W7).
- `lazygraph-ops.getArtifactId === content-artifacts.getArtifactId`: true.
- `git diff --quiet b0fb5a1ab -- lib/core/section-registry.cjs`: exit 0.
- `node scripts/check-substrate.cjs --diff` on each staged diff: exit 0.
- `grep -cP '\x{2014}'` on every touched file: 0.
- rebuildGraph, indexArtifact, openGraph and both BEGIN lines are unchanged (C10 ruling).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test read] W1 reads rebuild Artifact ids from nodes plus BELONGS_TO sources**
- **Found during:** Task 1
- **Issue:** rebuildGraph writes a room root file as an Artifact node and then the Section upsert of the same id (`section = id.split('/')[0]`) retypes it to Section. A read of `type = 'Artifact'` alone gives a false W1 difference `walker - rebuild = ['root-note']`.
- **Fix:** the test reads the ids rebuild writes as Artifact nodes plus every BELONGS_TO source. No source change: rebuildGraph keeps its scope in this phase. The defect is logged as D-367-01 in deferred-items.md.
- **Files modified:** tests/test-367-artifact-set.cjs
- **Commit:** fef769b16

**2. [Process] One commit per task, not separate RED and GREEN commits.** The RED run was done and seen (0 passed, 6 failed; then W6 alone red before Task 2). The caller asked for atomic commits per task.

**3. [Tooling] Files were written with Bash heredocs.** The Write tool hook binds to the worktree MindrianOS-Plugin-4005 and refuses every path in MindrianOS-Plugin-367.

## Notes

- `_artifactsToIndex` now also drops the loser of an id collision (the old walker kept both files). Order is by rel, not by section.
- W7 pins section-registry.cjs against the BASE sha. A later phase that changes section-registry.cjs makes W7 red; set `MOS_367_01_BASE` or re-pin.
- Agent runs: 1 gsd-executor run for plans 01, 03, 05, 06. Tokens: not measurable from inside the agent.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND lib/core/content-artifacts.cjs, tests/test-367-artifact-set.cjs, deferred-items.md
- FOUND commits fef769b16, 4d322fe95
