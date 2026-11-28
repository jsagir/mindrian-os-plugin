---
quick: 261128-a8
lane: A8
branch: fix/399-a8-pin
base: 3abd37f86 (stage/400.5-405)
date: 2026-11-28
kind: rca
---

# 261128-a8: re-pin leg A8 of test-399-problem-axes to the accepted Part 8 guard text

## OR-47 points (written before the first edit)

1. What a top professional also does: find the commit that moved the pinned bytes, prove the drift is only that accepted change, and keep every other pin at its old strength.
2. The rawest material: `git diff 24d5ccb6a 1a7d6ad46 -- lib/core/part8-egress-guard.cjs` and `git log 24d5ccb6a..HEAD` over the 4 pinned files.
3. Methods and tools: git diff, git log, git merge-base, the test runners under a temp HOME and a closed Brain port.
4. Outside evidence: the A8 condition is green at db8610775 and red at 3abd37f86. After the fix the leg is green, and the guard diff stays 15 added lines and 0 removed lines.

## Root cause (PROVEN)

- Leg A8 runs `git diff --stat 24d5ccb6a` over 4 files and expects empty output: data/brain-shape-vocabulary.json, lib/core/part8-egress-guard.cjs, lib/mcp/brain-router.cjs, lib/core/brain-shape-packet.cjs.
- `git log 24d5ccb6a..HEAD` over the 4 files gives 1 commit only: 1a7d6ad46 (feat(404-03): the Part 8 guard arm for the recipe walk tool, 2026-11-28).
- The diff of that commit is only the 404-03 arm: the `brain_framework_walk` branch in `_proveKnownToolShape`, the `WALK_OPTION_ID_RE` constant and its export. It has 15 added lines and 0 removed lines. There is no diff of the 4 files between 1a7d6ad46 and HEAD.
- At db8610775 the 4 files have no diff against 24d5ccb6a, and the A8 text is the same. 1a7d6ad46 is not an ancestor of db8610775. So A8 is green there, by the same git computation. A8 is red at 3abd37f86.
- test-400-cause-effect-axis leg C4 runs test-399 as a child. It fails only because A8 fails. run-all-400.sh stops at C4. run-all-400.4.sh calls run-all-400.sh.

## Fix

tests/test-399-problem-axes.cjs, leg A8 only. No assertion is removed.

- The HEAD check stays on all 4 files.
- The 24d5ccb6a base check stays on the vocabulary, brain-router and brain-shape-packet files.
- The guard is pinned to 1a7d6ad46 (`git diff --stat 1a7d6ad46` must be empty).
- A new assertion: `git diff --numstat 24d5ccb6a 1a7d6ad46` of the guard must be `15 0`, so the accepted change stays additions only.
- A comment records the accepting commit 1a7d6ad46 and the date 2026-11-28.

## Gate record

Environment: temp HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME; MINDRIAN_BRAIN_URL=http://127.0.0.1:9. The worktree has no node_modules (ENV GAP). The runs below use NODE_PATH set to the node_modules of the main checkout. Its shrinkwrap differs from this branch (ASSUMED harmless for these tests).

See the RESULTS section for the before and after legs.

## RESULTS (PROVEN, commands run in this worktree)

Before the fix (HEAD 3abd37f86):
- node tests/test-399-problem-axes.cjs: FAILED, 1 failed (A8), 7 passed.
- node tests/test-400-cause-effect-axis.cjs: FAILED, 1 failed (C4), 5 passed.
- bash tests/run-all-400.sh: rc 1, stops at test-400-cause-effect-axis (C4).
- bash tests/run-all-400.4.sh: PASSED=101 FAILED=4 KNOWN=5. Red: test-399-problem-axes, test-400-cause-effect-axis, run-all-400.sh, test-270-tool-schema-budget.

After the fix:
- node tests/test-399-problem-axes.cjs: PASSED, 8 legs.
- node tests/test-400-cause-effect-axis.cjs: 6 passed, 0 failed.
- bash tests/run-all-400.sh: rc 0, run-all-399 PASSED.
- bash tests/run-all-400.4.sh: PASSED=104 FAILED=1 KNOWN=5. The fix turns 3 legs green: test-399-problem-axes, test-400-cause-effect-axis, run-all-400.sh. The KNOWN set is the same.
- bash tests/run-all-404.sh: rc 0 (3 known reds, signature matched).
- bash tests/run-all-261127-bnd.sh: rc 0.
- bash tests/run-all-402.sh: rc 0.

Red that is left: test-270-tool-schema-budget (measured tool count 1, recorded 76). It was red before the fix and it does not touch A8. It is ASSUMED to be an environment red from the NODE_PATH dependency set. Without NODE_PATH, 16 files fail in 400.4 because the worktree has no node_modules.
