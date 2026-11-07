---
phase: 388-ship-less-keep-tests-and-dead-weight-out-of-the-install
plan: 04
subsystem: packaging
tags: [npm-files, ship-less, payload-test, fresh-install-check, release-gate]
requires: [388-03]
provides:
  - package.json files array with 22 approved negation patterns
  - tests/test-388-ship-less.cjs (6 arms) and tests/run-all-388.sh
  - hard run line for the phase aggregator in tests/run-all-366.sh
  - 388-before-after.json (pack numbers, per-leg gate record, removed bytes per pattern)
affects: [release gate suite, npm package size]
key-files:
  created:
    - tests/test-388-ship-less.cjs
    - tests/run-all-388.sh
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-gate-run.cjs
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-before-after.json
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-probe-before-apply.json
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-probe-after.json
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-probe-after-contended.json
  modified:
    - package.json
    - tests/run-all-366.sh
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-measure.cjs
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-installed-diff.cjs
decisions:
  - The plan applied token APPROVE (baseline stays at evals/eureka/212-critic-baseline.json, no MOVE).
  - package.json differs from the before state only in the files array (22 entries inserted after !evals/eureka/README.md).
duration: 1 session
completed: 2026-11-07
---

# Phase 388 Plan 04: Apply the ship-less list Summary

One-line: 22 approved `files` negation patterns remove 222 paths (208 test files, 2 runners, 8 pyc, 3 data files, 1 html template) from the npm package: entryCount 2417 to 2195, unpacked 46,291,666 to 43,430,957 bytes (-6.18 percent), packed 14,042,864 to 13,330,812 bytes; every release-gate leg that passed before still passes, and the installed-layout differential shows no difference.

## Answer applied

- OWNER-ANSWER: APPROVE (OWNER-ANSWER-DATE 2026-11-06). Baseline KEEP.
- LIST-SHA256: dce0040835ddffe8a31a4a1fc43b59a74991daa88170f3322e0b772a672416c1 (recomputed from the pattern table by `388-measure.cjs gate-answer`, matched).
- HEAD-AT-DECISION 4ec4efdfc5659771fb9f6c40910f4b23f3c78a7d is an ancestor of HEAD (checked with git merge-base).
- `gate-drift`: the probe on the current tree removed the same 222 paths as the card (222 on the card, 222 now, no DRIFT-NOT-SAFE line).

## Size, before and after (PROVEN, from npm pack --dry-run --json)

| Measure | Before | After | Delta | Percent |
|---|---|---|---|---|
| entryCount | 2417 | 2195 | -222 | -9.18 |
| size (packed) | 14,042,864 | 13,330,812 | -712,052 | -5.07 |
| unpackedSize | 46,291,666 | 43,430,957 | -2,860,709 | -6.18 |
| installed file bytes (sum of files in the extracted tarball) | 46,291,666 (from the pack list) | 43,430,957 (find, 2195 files) | -2,860,709 | -6.18 |
| installed disk use (du -sk, extracted tarball) | not measured before | 48,360 KB | n/a | n/a |

Removed bytes are 2,861,559. The unpacked delta is 850 bytes smaller because the 22 new lines grew package.json. The before entryCount is 2417, not the 2416 of the card: a peer session added one shipped file (5,401 bytes) after the card was made. It is not a candidate. The test arm 1 found exactly 222 matching paths at the RED state.

| Pattern | Files | Bytes |
|---|---|---|
| `!data/arbitration-rule-catalogue.json` | 1 | 19,650 |
| `!data/capability-map-registry.json` | 1 | 1,005 |
| `!data/connector-out-of-spine-allowlist.json` | 1 | 7,262 |
| `!lib/__pycache__/*.pyc` | 1 | 154 |
| `!lib/conversation/*.test.cjs` | 2 | 12,475 |
| `!lib/core/*.test.cjs` | 39 | 396,573 |
| `!lib/core/__pycache__/*.pyc` | 7 | 91,512 |
| `!lib/core/breakthrough/*.test.cjs` | 11 | 123,619 |
| `!lib/core/migrations/*.test.cjs` | 1 | 6,706 |
| `!lib/core/navigation/*.test.cjs` | 2 | 9,878 |
| `!lib/core/security/*.test.cjs` | 2 | 17,769 |
| `!lib/core/telemetry/*.test.cjs` | 3 | 26,844 |
| `!lib/core/temporal/*.test.cjs` | 7 | 52,110 |
| `!lib/hmi/*.test.cjs` | 7 | 34,336 |
| `!lib/import/*.test.cjs` | 12 | 93,219 |
| `!lib/import/run-all-tests.cjs` | 1 | 1,081 |
| `!lib/mcp/app-html/mindrian-platform.html` | 1 | 57,150 |
| `!lib/memory/!(feynman-prompts-drift\|post-compact-reinjection).test.cjs` | 117 | 1,716,452 |
| `!lib/memory/run-feynman-tests.cjs` | 1 | 157,044 |
| `!lib/render/*.test.cjs` | 1 | 10,492 |
| `!lib/vault/*.test.cjs` | 1 | 6,483 |
| `!lib/workflow/*.test.cjs` | 3 | 19,745 |
| Total | 222 | 2,861,559 |

These figures come from the pack list difference (first pack versus second pack), not from the plan 388-03 estimate. They are equal to the card. No removed path was left without a pattern (unmatched 0). No path was added (added 0).

## RED and GREEN (PROVEN)

RED (commit dcbe73eee, before the files edit):

```
FAIL: arm 1: the pack payload holds no path that matches an approved pattern
    222 excluded path(s) still ship; first 10: data/arbitration-rule-catalogue.json, data/capability-map-registry.json, ...
PASS: arm 2 ... PASS: arm 3 ... PASS: arm 4 ... PASS: arm 5
FAIL: arm 6: package.json files holds each approved pattern once
RESULT: PASS=4 FAIL=2   (exit 1)
```

`TEST_388_PREFIX=tests/test-388-nonexistent- bash tests/run-all-388.sh` exited 1 with "no ... files discovered" (the found-equals-0 guard works).

GREEN (commit a5e88deea):

```
PASS: arm 1: the pack payload holds no path that matches an approved pattern
PASS: arm 2: the pack payload holds all 44 must-ship paths
PASS: arm 3: unpackedSize 43430957 is within 5242880 bytes of the approved 43425555
PASS: arm 4: the matcher flags a planted path for all 22 patterns and spares the must-keep paths
PASS: arm 5: npm removes the target and keeps the sibling for each of the 22 patterns, alone and combined
PASS: arm 6: package.json files holds each approved pattern once and no tests, docs, tools or ui entry
RESULT: PASS=6 FAIL=0
```

Arm 3 passes at RED too. It is a tripwire with a 5 MiB margin, as the plan states, not a budget.

## Edit scope (PROVEN)

- package.json: every key other than `files` is equal as parsed JSON. The new `files` array is the old array with the 22 patterns inserted after `!evals/eureka/README.md` (checked by a script: old array plus 22 equals new array).
- npm-shrinkwrap.json: git hash-object 371d79984756c366e688dd83c3df5a248967e608 before and after.
- Version files and CHANGELOG.md: `git diff --quiet HEAD` exits 0 for npm-shrinkwrap.json, CHANGELOG.md and .claude-plugin/plugin.json.
- No test was edited to pass. The baseline tests (`test-quick-261106-critic-baseline-ships`, `test-387-eureka-installed-layout`) pass unchanged.

## Release gate legs, before and after (PROVEN, 388-gate-run.cjs)

All 25 legs: PASS before and PASS after, except `ship-less` (FAIL before, the RED state; PASS after). `388-gate-run.cjs compare` exits 0: "no leg went from PASS to not PASS". No leg is ENVGAP, TIMEOUT or ABSENT.

| Leg | Before | After |
|---|---|---|
| test-341-payload-ceiling | PASS | PASS |
| test-341-payload-shrinkwrap-present | PASS | PASS |
| test-341-shrinkwrap-no-dev | PASS | PASS |
| test-341-release-shrinkwrap-gate | PASS | PASS |
| test-369-walled-manifest | PASS | PASS |
| test-369-installed-layout | PASS | PASS |
| test-369.1-desktop-artifact | PASS | PASS |
| test-369.1-bin-relocation | PASS | PASS |
| test-369.1-sharp-out | PASS | PASS |
| test-369.1-release-lockstep | PASS | PASS |
| test-345-lockstep | PASS | PASS |
| test-release-bump-tag-and-publish-gates | PASS | PASS |
| test-quick-261106-critic-baseline-ships | PASS | PASS |
| test-387-eureka-installed-layout | PASS | PASS |
| test-380-installed-layout | PASS | PASS |
| check-release-payload-ceiling --check | PASS | PASS |
| run-harness --check | PASS | PASS |
| build-connector-registry --check | PASS | PASS |
| build-orchestration-projection --check | PASS | PASS |
| check-render-coverage | PASS | PASS |
| build-desktop-artifact --check | PASS | PASS |
| bash -n tests/run-all-366.sh | PASS | PASS |
| step-9.5-grep (npm pack output vs the Step 9.5 regex) | PASS | PASS |
| bash scripts/verify-release | PASS | PASS |
| ship-less (tests/test-388-ship-less.cjs) | FAIL | PASS |

`tests/test-369-installed-layout.cjs` exited 0 (registry reachable, `npm ci --ignore-scripts` ran), so it is a real PASS and not an ENV GAP.

## Fresh-install check (PROVEN)

- Real tarball: `npm pack --ignore-scripts`, extracted in a scratch folder. 2195 files. No `*.test.cjs` under `lib/` other than the two kept names (`lib/memory/feynman-prompts-drift.test.cjs`, `lib/memory/post-compact-reinjection.test.cjs`), no `.pyc` under `lib/`, no `run-all-tests.cjs`, no `run-feynman-tests.cjs`, no `mindrian-platform.html`. `evals/eureka/212-critic-baseline.json` is present. (`scripts/` still holds test files and `.pyc`; the card did not list them and they stay.)
- Differential run (388-installed-diff.cjs, scratch HOME, dead Brain URL, no Brain key variables, fs trace): `compare --full 388-probe-before-apply.json --reduced 388-probe-after.json` exits 0 with "no difference in any stable probe": 40 hook commands (1 network-capable hook not run), 75 MCP tools for both client identities, 8 read-only tool calls, 50 doctor points, 87 syntax checks. 0 unstable probes.
- Same-time pair run (extra evidence): the pre-edit package was rebuilt by putting the 222 paths back into the packed copy, then both sides ran in one invocation. Exit 0, no difference, and the session-start stdout text is equal (5052 bytes).

### A finding to read: one transient difference

The first after-run (kept as `388-probe-after-contended.json`) showed one difference: the stdout hash of the SessionStart `session-start` hook (before 342ff31bedc9, after e6febbe8a838). I started `npm pack`, `tar`, `find` and `du` while that run was active. The cause is NOT PROVEN. A re-run on a quiet machine gave hash 342ff31bedc9 in both full runs, equal to the before record, and the same-time pair run also gave 342ff31bedc9 on both sides. The hook output text is identical between the pre-edit-like and post-edit installs. The final `388-probe-after.json` is the quiet re-run. The likely cause is load-dependent hook output, but this was not shown.

## Tooling changes (phase folder)

- 388-measure.cjs: added `gate-answer` and `gate-drift` with self-test cases for all of gate tests 1 to 6 (PENDING, NO, unknown token, hash mismatch, APPROVE, APPROVE-BASELINE-UNDER-DATA with MOVE, head not an ancestor, drift with an unknown path, drift with a SAFE path, drift with an UNCERTAIN path).
- 388-gate-run.cjs: new; `run`, `compare`, `record`, `selftest` (run tests 1 and 2 plus status mapping and the Step 9.5 pattern).
- 388-installed-diff.cjs: added an optional `--readd TSV` for `runall` and an optional env `MOS388_KEEP_TEXT=1`. Neither changes default behavior.

## Deviations from Plan

1. **[Rule 3 - Blocking] The plan names `388-installed-diff.cjs run --mode full` and `compare --safe`. Those commands do not exist.** The tool has `runall` and `compare --full --reduced`. I ran `runall` (full1, full2 and a reduced copy are written by one call) and compared the before record with the after record using `compare --full BEFORE --reduced AFTER`. The `--reduced` output of the before run and of the after run is not used.
2. **[Rule 3 - Blocking] The gate-run self-test and the gate-answer cases were written in the same step as the code, not as a separate failing step.** The product RED step (the payload test failing first) was done as the plan requires.
3. **[Rule 1 - Bug, tooling] First version of `record` was corrupted by a JavaScript replace special pattern in my patch script.** Fixed by rebuilding the file from the two clean halves. The self-test passes.
4. The before gate record and the before probe were taken at HEAD ce3886f73 (before the RED commit). The before pack numbers were taken at the RED commit dcbe73eee (the same shipped files; tests are not shipped).
5. Worktree HEAD check: this tree is a linked worktree on branch `main`. The agent branch namespace check (`worktree-agent-*`) would refuse every commit. The task brief states branch main with no worktree isolation, so commits were made on main with `git commit --only` and exact paths. No update-ref, stash, clean or reset was used.
6. The doctor `--acceptance` roll-up shows 24/25 while 388-measure.cjs and 388-installed-diff.cjs are uncommitted (point `verify-release-clean-tree`, tracked-file drift). See the doctor result below.

## Doctor acceptance

Before the phase files were committed: `node scripts/doctor.cjs --acceptance` gave 24/25; the one failing point is `verify-release-clean-tree` (2 tracked files modified: 388-measure.cjs and 388-installed-diff.cjs). After the commit of those two files (commit 21f512a9a) the roll-up gave 25/25 points passed (exit 0). `real-room-run` shows a WARN (receipt is for ce3886f731e9, behind HEAD); that WARN is a pass state and is not caused by this plan.

## UNVERIFIED

- Desktop copy size (the Desktop build was run only as `build-desktop-artifact --check`, which passed).
- Python rebuilds the 8 removed `.pyc` files on demand (ASSUMED; Python was not traced).
- The cause of the one transient session-start hash difference (see above).
- `sessionstart-npm-reconcile.cjs` (network capable) was not run in any probe.
- A real `claude plugin install` from a published version: nothing was released.
- The full tests/run-all-366.sh suite was not run; the legs in the table were. The new hard run line was only syntax checked (`bash -n`) and its aggregator was run alone (PASS=2).

## Notes

- docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 1 describes a package of about 164KB. That figure is stale (the package is about 13.3 MB packed). This plan did not edit the docs.
- Remaining ship-less candidates not in the approved list: `scripts/*.test.cjs` files (10 or more), `scripts/**/__pycache__/*.pyc` files. They need a new decision card.
- Release consequence: the change is on `main` only. It is not live until a release is cut and picked up. This plan cut nothing, pushed nothing, tagged nothing and ran `scripts/release.sh` never.

## Commits

- dcbe73eee test(388-04): payload test for the approved ship-less list (RED)
- a5e88deea build(388-04): ship less, exclude tests and dead weight from the npm payload
- the docs commit for this summary and the phase tooling (hash in the final report)

## Known Stubs

None.

## Threat Flags

None. The change removes files from the package and adds no endpoint, auth path or file read.

## Self-Check

- tests/test-388-ship-less.cjs: FOUND. tests/run-all-388.sh: FOUND. package.json holds 22 new entries: FOUND.
- Commits dcbe73eee and a5e88deea: FOUND (`388-guard.cjs commit-files` for both: all paths allowed).
