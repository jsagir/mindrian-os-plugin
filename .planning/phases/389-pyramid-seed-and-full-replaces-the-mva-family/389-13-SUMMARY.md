---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 13
subsystem: mva-retirement
tags: [rename, survivors, d9-approve, telemetry-frozen, release-gate-label]
requires: [389-02, 389-10, 389-11, 389-12]
provides:
  - five modules and five tests carry names that say what they do (names only, behavior byte equal)
  - 389-rename.cjs (rename tool: selftest, dry-run, apply, --only)
  - tests/test-389-renames.cjs (43 checks)
affects: [389-14, 390]
key-files:
  created:
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-rename.cjs
    - tests/test-389-renames.cjs
  renamed:
    - lib/core/mva-classifier(.test).cjs to venture-sentence-classifier(.test).cjs
    - lib/core/mva-rule-linter(.test).cjs to reward-rule-linter(.test).cjs
    - lib/core/mva-budget(.test).cjs to pyramid-seed-budget(.test).cjs
    - lib/core/mva-agent-contract(.test).cjs to pyramid-seed-agent-contract(.test).cjs
    - lib/core/mva-dispatcher(.test).cjs to pyramid-seed-dispatcher(.test).cjs
decisions:
  - D9 APPROVE (owner, 2026-11-08), read from the gate.
  - The six mva_* telemetry event names stay frozen (plan 10 rule).
  - Internal error string __mva_dispatcher_timeout__ (underscore form, not a module name) is not renamed; behavior stays byte equal.
metrics:
  tasks: 2
completed: 2026-11-08
---

# Phase 389 Plan 13: Rename the five surviving modules (owner D9)

One line: the classifier, the rule linter, the budget, the agent contract and the dispatcher, with their tests, now carry the names venture-sentence-classifier, reward-rule-linter, pyramid-seed-budget, pyramid-seed-agent-contract and pyramid-seed-dispatcher; 46 files and 131 name hits were rewritten by one tool, and the new files equal the old files with only the names replaced.

## Owner gate (Task 1)

```
$ node 389-decision.cjs gate 389-DECISION.md D9
D9 APPROVE APPROVED
GATE PASS            (exit 0)
```

Scope guard snapshot 389-13 taken before any edit. The tree was clean at start (HEAD 6815f7c4b). `git diff --quiet HEAD` was clean for every file of each dry-run list before each apply.

## Rename tool

`389-rename.cjs` (node built-ins only): `selftest`, `dry-run [--only M]`, `apply [--only M]`. Apply runs `git mv` first, then rewrites callers. A name is replaced only as a whole name (not glued to a longer name, and a `\n` escape before it counts as a boundary). Skips .planning, CHANGELOG.md, r-and-d, command-deprecations, dated docs and any Eureka path (a Eureka path that holds a name prints SKIPPED-EUREKA and exits 1).

Self-test: 24 checks (apply, dry-run writes nothing, Eureka, longer word, --only, five single applies equal one full apply, unknown module exit 1). RED proof: with the scan and write steps stubbed out the self-test printed 11 passed, 13 failed; with the real tool 24 passed, 0 failed.

Dry-run on the live tree before the apply (HEAD 6815f7c4b): 10 renames, 46 files, 131 hits, 0 LONGER lines, 0 Eureka files. Per module (files can hold more than one module): classifier 24 files and 41 hits, rule-linter 16 and 41, agent-contract 8 and 16, dispatcher 9 and 19, budget 7 and 14. A first dry-run reported one LONGER line (`'\nmva-rule-linter tests: '` in the rule linter test); the tool was fixed to treat a backslash escape as a boundary and the self-test pins it.

Dry-run after the fifth module: TOTAL files=0 hits=0 renames=0.

## Caller proof

Scan with `git grep` over tracked files outside .planning, CHANGELOG.md and r-and-d (docs included), for the five old names: 0 hits (RESULT: zero stale require, spawn or path-string hits). Variants: one underscore string `__mva_dispatcher_timeout__` (an internal error text in pyramid-seed-agent-contract.cjs, not a module name) was left as is. History hits stay in .planning (expected). No Eureka path holds an old name.

## Parity (T-389-13-01)

Test 2 of tests/test-389-renames.cjs: each of the 10 new files equals `git show 6815f7c4b:<old path>` with the five names replaced and nothing else. 10 of 10 equal.

## Label and sed (T-389-13-03)

The checker `node scripts/check-reward-before-investment.cjs --surfaces <root>` prints `reward-rule-linter: scanning 4 declared surfaces`. The sed line of `scripts/verify-release` (SURFACES_COUNT) now reads `^reward-rule-linter: scanning \([0-9]*\) declared surfaces$` and returns 4. Test 4 extracts that sed script from verify-release itself and runs it on the real output. The diff of both files was read by eye: require path, label and sed agree.

## RED and GREEN

RED (`node tests/test-389-renames.cjs` before any rename): 10 passed, 33 failed, exit 1 (Test 1: 20 legs; Test 2: 10; Test 3; Test 4 label and sed name; the dash check had a literal dash in the first draft and was fixed to escapes).
GREEN (after the fifth module): `test-389-renames: 43 passed, 0 failed`, exit 0.

## BEFORE and AFTER (scratch HOME, Brain URL on a closed port, MINDRIAN_EUREKA_ROOT unset)

| leg | before | after |
|-----|--------|-------|
| run-all-118 | exit 1, 9 suites, 8 pass, 1 fail (mva-deck-builder.test, pre-existing) | same |
| run-all-169 | exit 0 | exit 0 |
| run-all-218 | exit 0, PASS=17 | same |
| run-all-267 | exit 1, PASS=31 FAIL=2 SKIP=1 | same |
| run-all-267.2 | PASS=19 FAIL=0 SKIP=1 | same |
| run-all-267.3 | PASS=5 FAIL=0 | same |
| run-all-389 | PASS=15 | PASS=16 (the new test) |
| test-245, test-265, test-267-1 | 0, 0, 0 | 0, 0, 0 |
| check-reward --surfaces + sed | exit 0, label mva-rule-linter, sed 4 | exit 0, label reward-rule-linter, sed 4 |
| test-232, 218, 169, room-registry atomic replace | 0 | 0 |
| test-267.3 session-start and surface declarations | 0 | 0 |
| test-270 family (9 files) | 8 pass, resource-session-room exit 1 (pre-existing) | same |
| test-252 guard census | exit 1, 4/6 green | exit 1, 4/6 green (same output) |
| irreversibility ledger --check | WARN 24 | WARN 24 (ledger not edited) |
| connector registry --check, check-registry-drift --check, shape declaration --check, projection --check, render coverage | 0 | 0 |
| build-dist-bundles --check-stale | exit 1 (bundle from beta.52, pre-existing) | exit 1 |
| hooks hk1 to hk5 | 0, 1, 0, 1, 0 | 0, 1, 0, 1, 0 |
| lib/core/llm-name-suggester.test.cjs | 3 not ok (tests 5, 7, 8) at base 6815f7c4b | 3 not ok (same tests) |
| Seed tests (cells, egress, cli, record, structure, full-pyramid) | 0 | 0 |
| renamed module unit tests (classifier, linter, budget, contract, dispatcher) | 0 | 0 |

Part 11 generators stay exit 0. The Seed tests of plans 03 to 06 are the six test-389-seed-* and full-pyramid files above. doctor --acceptance was not run (see UNVERIFIED).

## Commits (first four; the fifth sha is in the report)

| module | sha |
|--------|-----|
| classifier (also adds 389-rename.cjs) | 3fd4db52c |
| rule-linter | eadc1746b |
| budget | b7a95d9b4 |
| agent-contract | 155527bf9 |

The fifth commit (dispatcher, tests/test-389-renames.cjs, this SUMMARY) is the one after 155527bf9. Each commit used `git commit --only` with the exact paths the tool listed; the guard commit-files check passed for the first four.

## Living docs changed

docs/reward-before-investment-rule.md (5 name mentions, in the rule-linter commit). Data prose: data/first-reward-surfaces.json, data/hooks-markers.json. Dated docs and .planning were not touched.

## Deviations from Plan

**1. [Rule 1 - Bug] Tool boundary for a backslash escape.** The first dry-run flagged `'\nmva-rule-linter tests: '` as a longer name because the letter n of the escape sits before the name. Fixed in 389-rename.cjs with a boundary for `\n`, `\r`, `\t`; pinned by selftest 4. Found during Task 1.

**2. [Rule 1 - Bug] Test 3 hit its own pair table.** Once tracked, tests/test-389-renames.cjs holds the old names in its pair table and failed Test 3. The test now excludes its own path. Found before the fifth commit.

**3. Node verify leg of the plan.** The plan verify line runs `bash tests/run-all-389.sh` which includes test-389-renames, so it is red until the fifth module is renamed; no commit was made on a red leg.

The carry-over (T6 of the classifier test lost in plan 10) was not restored.

## Known Stubs

None.

## UNVERIFIED

- A full `bash scripts/verify-release` run: not run (it has no dry or reward-only mode that finishes under a scratch HOME). The reward leg was run by hand: the checker with --surfaces and the sed command taken from verify-release (result 4).
- `node scripts/doctor.cjs --acceptance`: not run.
- The installed pre-commit hook of other clones keeps calling the repo script by path (scripts/check-reward-before-investment.cjs), which did not move; only the library it requires moved. A clone that has a stale checkout between the commits would load the old library name until it pulls all five commits.

## Self-Check: PASSED
