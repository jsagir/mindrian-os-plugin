---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 21
status: complete
subsystem: runner-retirement
tags: [runner-retire, inventory, static-gate, slice-a, D-02]
requires:
  - 366-20 (366-SPIKE-RULINGS.md `runner: retire`)
provides:
  - tests/test-366-runner-retired.cjs (RR1-RR5 static gate, RED until 366-22)
  - the runner inventory (below) that plans 366-25 (slice B), 366-27 (slice C), 366-26 (slice D) and 366-22 execute
affects: [366-22, 366-25, 366-26, 366-27]
tech-stack:
  added: []
  patterns: [frozen inventory list in a static gate, retire-with-reason, migrate keeps assertions]
key-files:
  created:
    - tests/test-366-runner-retired.cjs
  modified:
    - tests/run-all-215.sh
    - tests/run-all-216.sh
    - tests/run-all-226.sh
    - tests/run-all-363.1.sh
    - tests/test-215-reproduction.cjs
    - tests/test-216-field-contract.cjs
    - lib/memory/run-feynman-tests.cjs
  deleted:
    - tests/test-215-field-contract.cjs
    - tests/test-215-portfolio-report.cjs
    - tests/test-216-eureka-command.cjs
    - tests/test-226-degrade-cause.cjs
    - tests/test-226-field-contract.cjs
    - tests/test-226-mode-disclosure.cjs
    - tests/test-226-pair-cap.cjs
    - tests/test-226-posture.cjs
decisions:
  - "RUNNER_FILES is exactly scripts/eureka-command.cjs and scripts/eureka-portfolio-report.cjs; entity-extract and eureka-room-report have other consumers"
  - "RR5 is scoped to the frozen runner-test inventory; older aggregators carry unrelated guarded legs for files other phases retired"
  - "test-366-eureka-alias and test-366-eureka-filing are owned by 366-22 (its files_modified), not a slice"
metrics:
  tasks_done: 2
  tasks_total: 2
  completed: 2026-10-02
---

# Phase 366 Plan 21: Runner inventory, retirement gate, slice A Summary

The standalone Eureka runner's footprint is inventoried and every test that references it has a decision and an owner. A static gate (RR1-RR5) waits RED for 366-22's deletion, and slice A (the 215 / 216 / 226 cluster) no longer touches the runner.

## Ruling check (before anything ran)

`grep -qE "^runner: *retire\b" 366-SPIKE-RULINGS.md` matched (`runner: retire`, ruled 2026-10-02, "Accept all six (Recommended)").

## Commits

| Commit | Message |
|--------|---------|
| 7240bf896 | test(366-21): static runner-retirement gate (RED until 366-22 deletes the runner) |
| d5527fb8b | test(366-21): slice A off the standalone runner (215/216/226 cluster) |

## RUNNER_FILES

`scripts/eureka-command.cjs`, `scripts/eureka-portfolio-report.cjs`. Walked requires: the runner pulls `scripts/entity-extract.cjs` (also required by lib/core/eureka/research-filing.cjs, scripts/spike-366-prepare.cjs, scripts/rs-vector-bridge.cjs and nine tests) and `scripts/eureka-room-report.cjs` (also required by lib/core/intel-pipeline.cjs), so neither is in the set. Everything else it requires is under lib/ and stays (lib/core/eureka/* is plan 366-23's call).

## The gate: tests/test-366-runner-retired.cjs

RR1 RUNNER_FILES absent. RR2 no require, spawn argv or quoted path literal of a runner file under lib/ scripts/ hooks/ bin/ tests/ (shell files: any non-comment mention, so path lists count; comment lines never count). RR3 no `--legacy` in commands/eureka.md or skills/eureka/SKILL.md. RR4 no `flags.legacy` in lib/mcp/tool-router.cjs. RR5 no run-all-*.sh names a retired inventory test on a non-comment line. Now: RR1-RR4 FAIL, RR5 PASS; exit 1 (the documented RED leg).

RR2 offenders after slice A (what 366-25/26/27 and 366-22 must clear): lib/core/doctor/class-s-eureka-smoke.cjs, lib/mcp/tool-router.cjs, tests/live-363.1-room-check.cjs, tests/run-all-219.sh, tests/run-all-341.sh, tests/run-all-355.sh, tests/run-all-363.1.sh, every test-218 / 219 / 341 / 343 / 355 / 3551 / 363.1 row below marked migrate or retire, tests/test-366-eureka-alias.cjs, tests/test-366-eureka-filing.cjs.

## Inventory

Aggregator map from literal names (globs noted): run-all-355 globs `tests/test-355-*.cjs`, run-all-3551 globs `test-3551-*`, run-all-341 globs `test-341-*`, run-all-363.1 globs `test-363.1-*`. lib/memory/run-feynman-tests.cjs (the release-train list) also names test-226-* and test-355-* files.

### Tests

| File | Kind | Slice | Decision | Reason | Naming aggregators |
|---|---|---|---|---|---|
| test-215-field-contract | test | A | retired | asserts the emitter vs the runner scorer contract through the runner's loadGraph; runner-only | run-all-215, run-all-226 |
| test-215-portfolio-report | test | A | retired | runner main() all-pairs report e2e; runner-only | run-all-215 |
| test-215-reproduction | test | A | migrated (comment only) | reads the frozen eval JSON plus lib opportunity-statement; no runner require | run-all-215 (run_if on the JSON) |
| test-216-eureka-command | test | A | retired | dispatcher start/status/report and the runner room mode; runner-only | run-all-216, run-all-363.1 (regress loop) |
| test-216-field-contract | test | A | migrated | adapter legs on lib/core/eureka/room-native-substrate.cjs kept; the deriveSharedProblems fallback and candidate-assembly leg dropped (runner code) | run-all-216, run-all-226 |
| test-226-degrade-cause | test | A | retired | runner.main reasoning degrade path; runner-only | run-all-226, run-feynman-tests |
| test-226-field-contract | test | A | retired | runner reasoningStageScore/Emit output shape; runner-only | run-all-226, run-feynman-tests |
| test-226-mode-disclosure | test | A | retired | runner reasoning stages plus the eureka-command html export; runner-only | run-all-226, run-feynman-tests |
| test-226-pair-cap | test | A | retired | runner reasoning fan-out cap; runner-only | run-all-226, run-feynman-tests |
| test-226-posture | test | A | retired | runner reasoning banked-false posture; runner-only | run-all-226, run-feynman-tests |
| test-218-cohort-stratification | test | B | retire | RUNNER.main cohort stratification of the all-pairs scoring loop; no perspective analog | run-all-218 |
| test-218-eureka-auto-extract | test | B | retire | dispatcher.main auto-extract-before-run flow; entity-extract itself stays covered by the other 218 tests | run-all-218 |
| test-218-low-trust-exclusion | test | B | retire | RUNNER.main 4b low-trust pass; the perspective has no low-trust filter (slice B may flip to migrate if one is found) | run-all-218 |
| test-218-noise-reduction | test | B | migrate | scaffold entity noise now lives in scaffold-predicate.cjs, used by perspectives/eureka-recall.cjs | run-all-218 |
| test-218-scaffold-pair-filter | test | B | migrate | scaffold pair filter -> scaffold-predicate.cjs / eureka-recall | run-all-218 |
| test-219-banking | test | B | migrate | the bankStatements legs (Task 2 of that file) -> filing-stamped.fileStampedOpportunity; other legs untouched | run-all-219 (also its path list at about 156), run-all-223 |
| test-343-path-hygiene | test | B | migrate | drop scripts/eureka-command.cjs from its hygiene path list | run-all-343 |
| test-355-eureka-ranking-pin | test | C | retire | byte-pins the runner's ranking step (comments name it; re-implements it from lib scorers); its subject is deleted | run-all-366 (literal), run-all-355 (glob), run-feynman-tests |
| test-355-filing | test | C | migrate | runner.bankStatements -> filing-stamped.fileStampedOpportunity | run-all-3551, run-all-355 (glob), run-feynman-tests |
| test-355-floor-sweep | test | C | migrate | leg 4b drops the eureka runner from the dependent-output renders (or points at the eureka perspective) | run-all-366 (literal), run-all-355 (glob), run-feynman-tests |
| test-355-no-decimal | test | C | migrate | drop the runner stampRankedPairs/renderReport producer from the sweep | run-all-3551, run-all-355 (glob) |
| test-355-part8-egress | test | C | migrate | runner stampRankedPairs egress -> filing-stamped stampForPair | run-all-3551, run-all-355 (glob) |
| test-355-producer-eureka | test | C | retire | the producer under test is the runner (stampRankedPairs, renderReport, renderReasoningReport) | run-all-355 (glob), run-feynman-tests |
| test-355-stamp-coverage | test | C | migrate | drop the runner producer from the coverage sweep | run-all-355 (glob) |
| test-3551-ambient-run | test | C | migrate | drop the re-export identity assertion; filing-stamped stays the writer | run-all-366 (literal), run-all-3551 (glob) |
| test-341-eureka-no-brain-reach | test | D | migrate | drop the runner paths from its no-brain-reach list | run-all-341 (glob and path list at about 78), run-all-363.1 |
| test-363.1-eureka-exclusion | test | D | migrate | known-pair exclusion -> eureka-recall's exclusion upsert (shared.makeCandidateStore) | run-all-363.1 (glob and path list) |
| test-363.1-eureka-status-race | test | D | retire | dispatcher status-file race; runner-only | run-all-363.1 (glob) |
| test-363.1-eureka-tail | test | D | retire | tail quadrant in the runner report; runner-only | run-all-363.1 (glob) |
| test-363.1-opp-statement | test | D | retire | RUNNER.catalogId and deriveSharedProblems; runner-only (slice D may keep any pure opportunity-statement leg) | run-all-363.1 (glob) |
| live-363.1-room-check | test (live) | D | retire | spawns eureka-command run on a live room copy | none |
| test-eureka-mcp-tools | test | D | retire | pre-existing red (366-03 deferred item) on the router legacy path the runner retirement removes | none |
| test-366-eureka-alias | test | 366-22 | migrate | legacy legs become "flag ignored, pointer answered" when 366-22 drops the router branch | run-all-366 |
| test-366-eureka-filing | test | 366-22 | migrate | drop leg F4 (runner re-export identity) | run-all-366 |
| test-366-ambient-offer | test | none | keep | asserts the runner name is ABSENT from ambient-run; survives the deletion; RR2 does not flag it | run-all-366 |

### Aggregators

| File | Slice | Action |
|---|---|---|
| run-all-215 | A | done: legs 5 and 5b removed with a note |
| run-all-216 | A | done: leg 2 and the direct node line removed; header comments no longer name the runner file |
| run-all-226 | A | done: five D-legs and the 215 field-contract leg removed; header list updated |
| run-all-363.1 | A (one entry) / D (rest) | A done: the test-216-eureka-command regress entry removed; D owns the path list at about 139-143 |
| run-all-218 | B | comment-only mention at about 95; legs follow the slice B decisions |
| run-all-219 | B | path list entry at about 156 |
| run-all-223 | B | names test-219-banking |
| run-all-343 | B | names test-343-path-hygiene |
| run-all-355 | C | the Part 9 chokepoint leg on the runner file (about 179-189) retires or retargets to filing-stamped |
| run-all-3551 | C | names test-355-filing, no-decimal, part8-egress |
| run-all-366 | C (legs for 355-eureka-ranking-pin, 355-floor-sweep, 3551-ambient-run) | slice C edits only those legs; plan 366-01 owns the rest |
| run-all-341 | D | path list at about 78 |
| lib/memory/run-feynman-tests.cjs | A (226) / C (355) | A done: five retired 226 entries removed; C removes retired 355 entries |

### Non-test references

| File | Kind | Owner | Action |
|---|---|---|---|
| lib/mcp/tool-router.cjs | lib | 366-22 | delete the legacy branch (in-process require and stdio spawn) |
| lib/core/doctor/class-s-eureka-smoke.cjs | lib | 366-22 Task 2 | smoke the perspective path |
| commands/eureka.md, skills/eureka/SKILL.md | command, skill | 366-22 | drop the "Legacy runner (--legacy)" section |
| lib/core/eureka/{candidate-exclusion,explored-artifact,opportunity-statement,reasoning-mode,room-native-substrate}.cjs | lib (comments) | 366-22 | comment touch-ups only |
| lib/core/ambient-framing.cjs, lib/core/research-planner/filing-stamped.cjs, lib/mcp/tools/gate.cjs | lib (comments) | 366-22 (optional) | comment-only; RR2 does not flag comments |
| scripts/entity-extract.cjs, scripts/measure-355-hit-rate.cjs | script (comments) | 366-22 | comment touch-ups |
| docs/2026-09-24-HANDOFF-phase-355-at-24-of-28-continue.md, docs/343-CLOSE-OUT.md, docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md | doc | none | historical record, keep |

## Task 2 results (slice A)

- Verify loop (hermetic HOME/USERPROFILE/MINDRIAN_ROOMS_HOME, CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID unset): run-all-215 PASS=6 FAIL=0; run-all-226 PASS=4 FAIL=0; run-all-363.1 PASS=11 FAIL=0 SKIP=1; run-all-seed103 PASSED=20 FAILED=0; run-all-216 PASS=8 FAIL=1, and that one fail is the pre-existing strict shape-declaration leg (see deviations).
- No remaining tests/test-215-*, test-216-*, test-226-* file mentions either runner file.
- `bash tests/run-all-366.sh`: PASSED=68 FAILED=1 SKIPPED=2 KNOWN=1. The one failed leg is `366 runner retired`, the documented expected RED.
- lib/memory/run-feynman-tests.cjs: 263 entries, none missing.

## Deviations from Plan

**1. [Rule 3 - Blocking] lib/memory/run-feynman-tests.cjs edited (not in files_modified).** It lists the five retired 226 tests for the release train; leaving them would spawn missing files. Removed the five entries and updated the comment. Commit d5527fb8b.

**2. [Pre-existing red] run-all-216 does not exit 0.** Its leg `216-03 gate: shape declaration (strict)` runs `check-shape-declaration.cjs --check --strict`, which exits 1 on the base tree (skills declaring a hitl_shape and connector.excluded:true together, the advisory conflicts CLAUDE.md Part 11 names). This plan touched no skill or command. Logged in deferred-items.md.

**3. [Gate design] RR5 is scoped to the frozen inventory.** A repo-wide "every aggregator references only existing files" check is red today on 25 references unrelated to the runner (guarded legs and comments for files other phases retired, in run-all-199, 230, 269, 272, 341, 346, 349, 357, 358, 360, 362, 363, 365, 366). RR5 checks that no aggregator still names a retired runner-inventory test, which is what the deletion needs.

**4. [Gate design] RR3 also covers skills/eureka/SKILL.md** (366-22 already owns that file), and RR2 treats any non-comment mention in a shell file as a reference so path lists like run-all-219:156 are caught.

**5. [Inventory] Three 366 tests the interfaces block did not list.** test-366-eureka-alias and test-366-eureka-filing are in 366-22's files_modified, so they go there, not to slice D; test-366-ambient-offer needs no change.

## Known Stubs

None.

## Threat Flags

None. T-366-87 (every retired test has its reason above), T-366-88 (every touched aggregator was run; the one red is pre-existing), T-366-89 (no stash, no reset) held.

## Self-Check: PASSED

tests/test-366-runner-retired.cjs exists and exits 1 (RED by design); commits 7240bf896 and d5527fb8b are ancestors of HEAD; the eight retired files are absent; the two migrated tests pass.
