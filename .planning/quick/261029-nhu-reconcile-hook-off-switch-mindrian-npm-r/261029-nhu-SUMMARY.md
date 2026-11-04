---
phase: quick-261029-nhu
plan: 01
subsystem: hooks
tags: [hooks, sessionstart, operator-switch, isolation, 369.6-startup-chain]
status: complete
requirements: [QUICK-261029-nhu]
key-files:
  modified:
    - scripts/sessionstart-npm-reconcile.cjs
    - docs/ENV-TUNING.md
    - CHANGELOG.md
    - tests/test-369.1-review-fixes.cjs
  created:
    - tests/test-sessionstart-npm-reconcile-skip.cjs
completed: 2026-10-29
---

# Quick 261029-nhu: operator off switch for the SessionStart npm reconcile hook

STATUS: DONE. Commit 58a997ca8. Codex round 1 returned BLOCK; round 2 (after removing the real node_modules probe) returned APPROVE.

## Changes (commit 58a997ca8)

- `scripts/sessionstart-npm-reconcile.cjs`: header paragraph, comment block, and the line `if (process.env.MINDRIAN_NPM_RECONCILE_SKIP === '1') return emit();` after the uncaughtException handler and before `require('node:fs')`. Only added lines.
- `docs/ENV-TUNING.md`: `### MINDRIAN_NPM_RECONCILE_SKIP` entry after `MINDRIAN_DERIVE_SKIP`.
- `CHANGELOG.md`: one Added bullet under Unreleased.
- `tests/test-369.1-review-fixes.cjs`: `'MINDRIAN_NPM_RECONCILE_SKIP'` added to SCRUB (1 line changed).
- `tests/test-sessionstart-npm-reconcile-skip.cjs`: new, 8 checks.

## Verification

| Command | Result |
|---------|--------|
| `node --check scripts/sessionstart-npm-reconcile.cjs` | exit 0 |
| Task 1 hook-order check | `hook-order: OK` |
| Task 1 env-tuning check | `env-tuning: OK` |
| `node tests/test-sessionstart-npm-reconcile-skip.cjs` | `RESULT: PASS=8 FAIL=0` |
| same with `MINDRIAN_NPM_RECONCILE_SKIP=1` in parent env | `RESULT: PASS=8 FAIL=0` |
| `node tests/test-369.1-review-fixes.cjs --arm cr-02 --arm wr-01 --arm wr-02` | `RESULT: PASS=11 FAIL=0` |
| same with the switch in parent env | `RESULT: PASS=11 FAIL=0` |
| `node tests/test-266-connect-path-process-budget.cjs` | `7 passed, 0 failed` |
| `node tests/test-266-dep-heal-connect-budget.cjs` | `9 passed, 0 failed` |
| `node tests/test-341-update-collapsed.cjs` | `PASS=8 FAIL=0` |
| `node tests/test-369-hook-require-graph.cjs` | `5 passed, 0 failed` |
| `node scripts/check-hook-schema-compatibility.cjs` | `check-hook-schema-compatibility: PASS` |
| Task 3 changelog check | `changelog: OK` |
| Dash check on staged added lines | `0` |
| `git diff --stat HEAD hooks/hooks.json` | empty |
| leftover `tnrs-*` temp dirs | `0` |

RED proof (new test against `git show HEAD:scripts/sessionstart-npm-reconcile.cjs`): `red-exit=1`, `FAIL: T1b ... node_modules appeared`, `FAIL: T5 ... the switch expression must occur exactly once`, `RESULT: PASS=6 FAIL=2`.

## Deviations from Plan

- [Rule 1 - Bug] The Write tool turned the escapes in the T6 regex into literal en and em dash characters, so T6 failed on the test file itself. Fixed by building the regex from `String.fromCharCode(0x2013)` and `String.fromCharCode(0x2014)`. No literal dash remains (grep count 0).
- [Codex round 1] The T7 probes of the real plugin root (statOrNull, REPO_NM_STAT, REPO_NM_BEFORE, REPO_PKG_MTIME) were removed on the owner's instruction to apply the Codex remarks. T7 is now `T7 temp-dir cleanup: the temp directory is removed and absent`. The test count stays 8: `RESULT: PASS=8 FAIL=0`. The test still copies package.json, npm-shrinkwrap.json and lib/core files from the repo into the temp copy; it no longer stats node_modules or package.json of the repo.

## Codex diff review

Command: `codex exec --skip-git-repo-check --sandbox read-only --ephemeral -` with the full staged diff of the 5 paths. Exit code 0. Verdict line present on the first run, so no retry ran. Prompt was 21997 bytes.

Verdict: BLOCK. Verbatim output:

```
VERDICT: BLOCK

1. Pass: `1` calls hoisted `emit()` before filesystem access, install module loads, or npm spawning.
2. Pass: unset and all other values follow the unchanged path.
3. Pass: the error handler is armed before the switch; existing defensive handling remains intact.
4. Pass: no new network surface.
5. Block: the test calls `fs.statSync` on the real plugin root’s `node_modules`, both during setup and T7. That reads the real directory, violating the explicit “never touches” requirement and the test’s own claim. Remove those probes. Child HOME and room paths otherwise use temporary locations.
6. Pass: no added lines contain an em dash or en dash.
```

Analysis of the single block reason (point 5): the `fs.statSync` calls are the T7 hygiene probe that the plan requires (compare existence and mtime of the repo `node_modules` and `package.json` before and after). They only read metadata and never write. The plan wording is "never touches the real plugin root's node_modules ... or anything under ~/MindrianRooms", while T7 in the plan requires the probe. The two plan texts conflict. Points 1 to 4 and 6 passed.

Commit after round 1: none (BLOCK).

## Codex diff review (round 2)

Same prompt, full staged diff of the 5 paths after the T7 change. Exit code 0, verdict on the first run, no retry. Verbatim output:

```
VERDICT: APPROVE

1. Exact value `1` calls hoisted `emit()` before filesystem access, module loading, or npm spawning, printing `{"continue":true}` and exiting 0.
2. Unset and all other values retain the existing execution path.
3. The error handler is armed before the switch; existing defensive handling remains intact.
4. No new network surface is introduced.
5. Tests use temporary plugin copies, HOME, rooms, and fake npm; reviewed paths avoid real user directories and plugin node_modules.
6. No added lines contain em dashes or en dashes. Full test execution was unavailable in the read-only sandbox.
```

Round 2 gate re-run (all after the T7 change): node --check ok; new test PASS=8 FAIL=0 with and without the switch in the parent env; 369.1 arms PASS=11 FAIL=0 both ways; 266 pair 7/0 and 9/0; 341 PASS=8; 369 require-graph 5/0; hook schema PASS; dash check 0; hooks.json unchanged; RED run red-exit=1 with FAIL T1b and T5 (PASS=6 FAIL=2); 0 leftover tnrs dirs.

Commit: 58a997ca8 (exactly the 5 paths; subject does not contain "(369.6"). Not pushed.

## Downstream

1. Plan 369.6-02 classifies the reconcile as not containable and its acceptance criterion asserts `containable===false` with reason `plugin_root_maintenance_not_containable`. After this commit, plans 02 and 05 need a revision to set `MINDRIAN_NPM_RECONCILE_SKIP=1` in the isolation env and to classify the reconcile as contained by that switch.
2. The RCA that plan 02 Task 2 step 4 writes (`.planning/debug/sessionstart-npm-reconcile-no-isolation-switch.md`) describes the defect this switch closes.
3. The MCP connect-path dependency heal in `lib/core/mcp-dep-heal.cjs` is a second writer under the plugin root when its tree is not trusted. This switch does not cover it.

## Self-Check

Commit 58a997ca8 exists and holds exactly CHANGELOG.md, docs/ENV-TUNING.md, scripts/sessionstart-npm-reconcile.cjs, tests/test-369.1-review-fixes.cjs, tests/test-sessionstart-npm-reconcile-skip.cjs. PASSED.
