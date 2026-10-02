---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 23
status: complete
subsystem: semantic-index
tags: [ADR-E12, refactor, reference-integrity, codemod, EPV366-29]
requires:
  - 366-22 (the runner deleted, so the importer map no longer counts it)
provides:
  - scripts/check-require-integrity.cjs (the reference-integrity gate)
  - lib/core/semantic-index/ (13 shared semantic-index modules, with CONTEXT.md)
  - tests/test-366-semantic-index-integrity.cjs (I1-I4; already wired as a run_if leg in run-all-366)
  - the production orphan set of lib/core/eureka/ (hand-off for a follow-on retirement)
affects: [366-24]
tech-stack:
  added: []
  patterns: [string-masking lexer for static reference scans, batch codemod with path.relative rewrites, gate after every batch]
key-files:
  created:
    - scripts/check-require-integrity.cjs
    - tests/test-366-semantic-index-integrity.cjs
    - lib/core/semantic-index/CONTEXT.md
    - .planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-23-codemod.cjs
  modified:
    - lib/core/semantic-index/*.cjs (13, moved by git mv from lib/core/eureka/)
    - scripts/check-floor-ledger.cjs
    - data/floor-ledger.json
    - data/capability-ledger.json
    - docs/ENV-TUNING.md
    - lib/core/research-planner/CONTEXT.md
    - tests/test-218-what-why-classifier.cjs
    - 79 importer files across lib/, scripts/ and tests/ (codemod rewrites, listed in the dry-run blocks below)
decisions:
  - "An importer means production code (lib/, scripts/, hooks/, bin/, excluding tests and *.test.cjs). Path lists such as check-floor-ledger's FLOOR_SCAN_FILES do not count. Every module has test importers, so counting tests would move the whole folder"
  - "Eureka-named feature modules stay even when they have outside production importers (eureka-enable, eureka-reach-runner, opportunity-harvest), per the plan's stay list. candidate-exclusion and room-native-substrate stay: the plan expected them to move, but after 366-22 their only importers are tests, so they go to the orphan set"
  - "The gate checks require and spawn paths only, as the plan defines them. A path.join used to read, write or existence-check a file is not a reference: tests that create scratch files or assert absence would otherwise read as broken"
  - "Frozen JSON records under tests/fixtures/ (tests/fixtures/366-spike/bar.json) keep the path they were written with"
  - "The eureka_ table names (eureka_vec, eureka_fts, eureka_meta) are unchanged: renaming them is a schema migration on every room, outside a folder move"
metrics:
  tasks_done: 3
  tasks_total: 3
  duration: ~2 h
  completed: 2026-10-02
---

# Phase 366 Plan 23: Split the shared semantic index out of lib/core/eureka Summary

The room's shared search machinery now lives in `lib/core/semantic-index/`, under a name that says what it is. That is 13 modules: the embedding spine, the vector store, the tri-modal index and its FTS lifecycle, hybrid retrieval, lexical overlap, the entity extractor and both classifiers, the scaffold template index, analogy fitness, the online pattern query and research filing. What stays in `lib/core/eureka/` is Eureka-specific. A new gate, `scripts/check-require-integrity.cjs`, proves that every static require and spawn path under lib/, scripts/, hooks/, bin/ and tests/ resolves. It was green before the move and after each of the four batches. Behavior is unchanged and there are no shims.

## Commits

| Commit | Task | Message |
|--------|------|---------|
| b277f68be | 1 (RED) | test(366-23): add failing reference-integrity gate legs (I1-I4) |
| 996f57661 | 1 (GREEN) | feat(366-23): reference-integrity gate for require and spawn paths |
| 930a3fbc8 | 2 | chore(366-23): semantic-index move map and dry-run-first codemod |
| 3ab26df38 | 3, batch 1 | refactor(366-23): batch 1, move the semantic-index leaves to lib/core/semantic-index |
| e680bb00e | 3, batch 2 | refactor(366-23): batch 2, move scaffold-template-index, online-pattern-query, vector-store, analogy-fitness |
| 8c6c1fd62 | 3, batch 3 | refactor(366-23): batch 3, move tri-modal-index and embedding-classifier |
| a09fb8728 | 3, batch 4 | refactor(366-23): batch 4, move fts-index-lifecycle, hybrid-retrieve, research-filing |
| 19bf7f067 | 3, final | refactor(366-23): path-keyed artifacts follow the semantic-index move |

Every commit used `git add -f` and `git commit --only <paths>`. The moves went through `git mv` (the codemod's `--apply`), and both rename sides were named in `--only`. Every module landed as an R098-R100 rename.

## Task 1: the gate

`scripts/check-require-integrity.cjs` (CJS, no deps, `--root`, `--json`) works in two steps.

First, a small lexer masks comments and sets every string literal aside. Code that only lives inside a string, such as a test planting a file body, therefore never counts.

Then it checks three kinds of reference:
- **R1:** `require('./x')` and `require.resolve('../x')`, resolved from the file's own folder.
- **R2:** `require(path.join(BASE, ...literals))`, and `require(NAME)` where NAME was declared as such a join. BASE is `__dirname`, or an identifier the file binds to a `__dirname`-relative folder.
- **R3:** spawn, exec and fork argument spans: a repo-root `lib|scripts|hooks|bin|tests/...cjs` literal, a path.join naming a script, or an identifier declared as one.

Resolution follows require: as given, then .cjs, .js, .json, /index.cjs, /index.js. A require it cannot resolve statically counts as `unchecked`, never as a failure. The report names file paths and targets only (T-366-96); I2 proves no file content is printed.

- **RED:** b277f68be, run before the gate existed: 5 FAIL, 3 PASS (the I2 negatives pass vacuously). **GREEN:** I1-I3 pass, and I4 skips until the folder exists.
- **On HEAD before any move:** `check-require-integrity: OK (2693 files, 6913 references resolve, 276 unchecked dynamic)`.
- **Mutation check (scratch copy of the five folders, lexical-overlap.cjs removed):** the gate exits 1 and names each importer: rs-differential-scorer, f-selector-ranker, reasoning-mode, test-211-measured-differential and others.

## Task 2: the move map (importers outside lib/core/eureka/, runner already deleted)

Production importers are named. Test importers are counted. "Inside eureka/" lists the modules in the folder that reference the module.

| Module | Production importers outside eureka/ | Test importers | Referenced inside eureka/ by | Verdict |
|---|---|---|---|---|
| embedding-spine | class-s-eureka-smoke, eureka-critic, hsi-engine, rs-differential-scorer, rs-engine, derive-verb-reach-affinity, eureka-room-report, measure-355-hit-rate, rs-vector-bridge, spike-366 | 10 | analogy-fitness, embedding-classifier, hybrid-retrieve, report-html, tri-modal-index, vector-store | move (1) |
| lexical-overlap | rs-differential-scorer, f-selector-ranker | 4 | reasoning-mode | move (1) |
| entity-extractor | scripts/entity-extract | 4 | embedding-classifier | move (1) |
| entity-classifier | scripts/entity-extract | 2 | | move (1) |
| scaffold-template-index | scaffold-predicate, scripts/entity-extract | 3 | | move (2) |
| online-pattern-query | scripts/analogy-fitness-report | 1 | | move (2) |
| vector-store | class-s-eureka-smoke, rs-vector-bridge | 6 | tri-modal-index | move (2) |
| analogy-fitness | scripts/analogy-fitness-report (check-floor-ledger lists it as a path, not an importer) | 2 | | move (2) |
| tri-modal-index | lazygraph-ops, sensor-content-relevance, build-ecosystem-graph, entity-extract, eureka-room-report, fts-index-drain | 12 | fts-index-lifecycle, hybrid-retrieve, research-filing | move (3) |
| embedding-classifier | scripts/entity-extract | 2 | | move (3) |
| fts-index-lifecycle | eureka-fts-health-module, sensor-content-relevance, fts-index-drain | 4 | | move (4) |
| hybrid-retrieve | f-selector-ranker | 2 | | move (4) |
| research-filing | recovery/dispatcher, research-planner/filing, url-ingest | 3 | explore-chain, explored-artifact | move (4) |
| eureka-enable | class-s-eureka-smoke (and the /mos:eureka enable door) | 4 | | stays (eureka-specific) |
| eureka-reach-runner | ambient-run, navigation-engine, stop-gate-handler | 8 | | stays (eureka-specific) |
| opportunity-harvest | scripts/scout-cadence-runner | 3 | | stays (opportunity-*) |
| explore-chain | none in code; commands/explore-opportunity.md | 5 | | stays (live command surface) |
| explored-artifact | none | 2 | explore-chain | stays (explore-chain's helper) |
| grade-grant | none in code; commands/grade-grant.md, deep-grade.md, agents/grant-reviewer.md | 3 | grade-grant-examine | stays (live command surface) |
| grade-grant-examine | none in code; the same command surfaces | 1 | | stays (live command surface) |
| qualify-opportunity | none in code; commands/qualify-opportunity.md | 5 | | stays (live command surface) |
| ahp-weights | none | 1 | | stays, orphan |
| candidate-exclusion | none | 2 | | stays, orphan |
| compression-meter | none | 2 | | stays, orphan |
| eureka-offer | none | 5 | | stays, orphan |
| lateral-engine-adapter | none | 1 | | stays, orphan |
| opportunity-statement | none | 5 | reasoning-mode | stays, orphan |
| portfolio-dimensions | none | 3 | | stays, orphan |
| reasoning-mode | none | 7 | candidate-exclusion | stays, orphan |
| report-html | none | 3 | | stays, orphan |
| room-native-substrate | none | 5 | | stays, orphan |
| tail-quadrant | none (check-floor-ledger lists it as a path) | 4 | | stays, orphan |

Count: 13 move and 19 stay. `ls lib/core/semantic-index/*.cjs | wc -l` = 13, and no name exists in both folders (I4).

### Batch table (leaves first, at most 4 per batch)

| Batch | Modules | Rewrites (files) | Why this order |
|---|---|---|---|
| 1 | embedding-spine, lexical-overlap, entity-extractor, entity-classifier | 59 (43) | No require into lib/core/eureka/ |
| 2 | scaffold-template-index, online-pattern-query, vector-store, analogy-fitness | 36 (24) | Leaves, or need only embedding-spine (batch 1) |
| 3 | tri-modal-index, embedding-classifier | 38 (30) | tri-modal-index needs spine + vector-store; embedding-classifier needs spine + entity-extractor |
| 4 | fts-index-lifecycle, hybrid-retrieve, research-filing | 30 (23) | Each needs tri-modal-index (batch 3) |

The rewrite counts are from the dry-runs run on the pre-move tree. Each `--apply` re-plans against the tree as it then stands.

### Codemod

`366-23-codemod.cjs` lives in the phase directory and is a planning artifact, not shipped. It reuses the gate's lexer (`mask().spans`) to find every string literal.

- **K1:** A relative literal that resolves to a module whose location changes, or that sits inside a moving module, is recomputed with `path.relative` from the importer's post-move folder, keeping the extension style.
- **K2:** The repo-root form `lib/core/eureka/<moved>` becomes `lib/core/semantic-index/<moved>`. This covers strings, shell path lists and comments, but not frozen fixture JSON.
- **K3:** In a path.join argument list, the literal pair `'eureka', '<moved>.cjs'` gets its segment swapped.

Dynamic references are printed under UNMATCHED and never rewritten. None were found in any batch. Every `--dry-run` exited 0, and `git diff --quiet -- lib scripts hooks bin tests` held afterwards (`dry-run-clean`).

### Orphan set (stays in lib/core/eureka/, no production importer after 366-22)

The strict set ("zero importers anywhere under lib/, scripts/, hooks/, bin/ and tests/") is **empty**: every remaining module still has a test that requires it. The table below is the production orphan set, meaning modules whose only remaining importers are their own tests. That is the hand-off for a follow-on retirement. This plan neither moves nor deletes them.

| Module | Remaining importers | Last production importer before 366-22 | Path-keyed rows to move with a retirement |
|---|---|---|---|
| ahp-weights | test-215-ahp-weights | scripts/eureka-portfolio-report.cjs (the runner) | data/floor-ledger.json |
| candidate-exclusion | test-363.1-eureka-exclusion (U legs), run-all-363.1 | the runner | none |
| opportunity-statement | reasoning-mode (orphan), test-215-opp-statement, test-215-reproduction, test-219-critic-resolution, test-363.1-opp-statement, run-all-363.1 | the runner | data/floor-ledger.json |
| portfolio-dimensions | test-215-score, test-216-room-substrate (and tests/fixtures/355/eureka-ranking-pin.json, itself orphaned) | the runner | data/floor-ledger.json |
| reasoning-mode | candidate-exclusion (orphan), test-226-null-legs, test-226-rejection-replay, test-226-rubric-parity, test-343-path-hygiene, two 363.1 tests | the runner | data/floor-ledger.json, data/icm-parts.json (a notes mention) |
| room-native-substrate | test-216-field-contract, test-216-room-substrate, test-363.1-eureka-tail, test-363.1-opp-statement, run-all-363.1 | the runner | none |
| tail-quadrant | test-215-tail, test-216-room-substrate, test-363.1-eureka-tail, run-all-363.1 | the runner | data/floor-ledger.json, check-floor-ledger FLOOR_SCAN_FILES |
| report-html | test-341-eureka-no-brain-reach, test-341-slim-install-honest-degrade, test-355-no-decimal | scripts/eureka-command.cjs (the runner's dispatcher) | none |
| compression-meter | test-213-compression-meter, test-213-part8-boundary | none: no production importer before 366-22 either | data/floor-ledger.json |
| eureka-offer | test-213-eureka-offer, test-213-no-force, test-213-part8-boundary, test-252-guard-census, test-355-direction-readers | none: no production importer before 366-22 either | none |
| lateral-engine-adapter | test-213-touchpoints | none: no production importer before 366-22 either | none |

## Task 3: applied batch by batch, gate after each

| Batch | `check-require-integrity` | `run-all-seed103` | Commit |
|---|---|---|---|
| 1 | OK (2693 files, 6913 references resolve, 276 unchecked) | first run PASSED=19 FAILED=1 (see deviation 1); after the fix PASSED=20 FAILED=0 | 3ab26df38 |
| 2 | OK (2693 files, 6913 resolve, 276 unchecked) | PASSED=20 FAILED=0 | e680bb00e |
| 3 | OK (2693 files, 6913 resolve, 276 unchecked) | PASSED=20 FAILED=0 | 8c6c1fd62 |
| 4 | OK (2693 files, 6913 resolve, 276 unchecked) | PASSED=20 FAILED=0 | a09fb8728 |

These path-keyed artifacts moved in the final commit (19bf7f067):
- `scripts/check-floor-ledger.cjs`: SCAN_FAMILIES gains `lib/core/semantic-index/*.cjs`. FLOOR_SCAN_FILES' analogy-fitness entry was already rewritten by batch 2 (K2).
- `data/floor-ledger.json`: 3 row paths moved (analogy-fitness x2, embedding-classifier).
- `data/capability-ledger.json`: 6 path mentions moved.
- `docs/ENV-TUNING.md`: 2 operator-facing module paths.
- `lib/core/research-planner/CONTEXT.md`: 2 rows of its reuse inventory.
- Comments in `lib/core/rs_cache.py` and `scripts/rs-engine.py`. The codemod scans JS, shell and JSON only.
- New `lib/core/semantic-index/CONTEXT.md`: what the folder is, the file map, what stays in eureka/, and the boundaries.

The check-substrate allowlist names `lib/core/eureka/research-filing.cjs` only in a comment. Batch 4's K2 rewrote it, and no allowlist pattern keys on a moved path.

Historical docs were left alone because they are records, not load-bearing paths: CHANGELOG.md, the 2026-08-27 handoff, the SEED-097 review, and tests/fixtures/366-spike/bar.json.

Then **795264bf6** regenerated `data/harness-manifest.json`. Batch 4 rewrote a path comment in `lib/core/navigation-engine.cjs`, which is the decide_engine runtime surface the manifest digests. run-all-363's harness-manifest leg caught the drift, and `build-harness-manifest --check` is now OK.

After the move: `ls lib/core/semantic-index/*.cjs | wc -l` = 13 (the move map's count), and `comm -12` of the two folders is empty. `check-floor-ledger --check` gives PASS (62 rows, 84 files scanned, 58 hits, 0 unresolved), the same numbers as before the move. `check-substrate --diff` passed at every commit (pre-commit). The final `check-require-integrity` is OK, and `test-366-semantic-index-integrity` is 12/12 with I4 binding.

## Suite results (hermetic: temp HOME / USERPROFILE / MINDRIAN_ROOMS_HOME, CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID unset)

Post-move runs used the main tree at 19bf7f067. Baselines come from two places: a detached worktree of the pre-move commit 930a3fbc8 (node_modules symlinked in), and the 366-22 runs on the main tree.

| Suite | Post-move | Baseline | Verdict |
|---|---|---|---|
| run-all-366 | PASSED=69 FAILED=0 SKIPPED=1 KNOWN=1 | 68/0/2/1 after 366-22 | green; the semantic-index integrity leg went from SKIP to PASS |
| run-all-355 | PASS=67 FAIL=4 | 67/4, same four legs | the 4 legacy reds, unchanged |
| run-all-363 | PASSED=44 FAILED=4 SKIPPED=1 KNOWN=5 | worktree: 41/4/3/6 | see below |
| run-all-seed103 | PASSED=20 FAILED=0 | 20/0 | green |
| run-all-211 / 213 / 214 | 12/0, 8/0, 3/0 | same | green |
| run-all-244 | PASS=8 FAIL=2 (content-sensor-fires, doctor-fts-health) | same two legs | pre-existing |
| run-all-272 | PASS=14 FAIL=1 (272-cache-probe) | same leg | pre-existing |
| run-all-296 | PASS=7 FAIL=2 (blast-radius, pinecone-residue.sh) | same two legs | pre-existing |
| run-all-218 / 219 / 341 / 363.1 / 215 / 226 | 17/0, 13/0, 22/0, 10/0, 6/0, 4/0 | same | green |
| run-all-3551 | PASS=62 FAIL=6 | the stated baseline | unchanged |
| run-all-216 | PASS=8 FAIL=1 | the strict shape-declaration leg | unchanged |
| run-all-223 | PASS=16 FAIL=3 | the same three legs | unchanged |
| run-all-343 | PASS=9 FAIL=2 | the same two legs (SENS_PRIORITY_IDS order, contract parity) | unchanged |

No post-move log contains `Cannot find module` or `MODULE_NOT_FOUND`.

run-all-363 has 4 FAILED legs, and all of them are pre-existing:
- test-131-e2e, 216 no-regression and 220 no-regression: red in the pre-move worktree too.
- run-all-3551: its recorded signature is 63/5, but the stated baseline is 62/6.
- run-all-221: the leg reads FAILED only because 221 now IMPROVES to PASS=12 FAIL=2 against a recorded KNOWN signature of 11/3. The 218 legs that the pre-move worktree failed pass on the main tree (run-all-218 is 17/0 here), so this is not caused by the move.
- The only post-move-only failure was the harness-manifest leg. 795264bf6 fixed it.

The plan asked for "all four aggregators end FAILED=0" (366, 355, 363, seed103). That holds for run-all-366 and seed103. run-all-355 and run-all-363 end on their pre-existing reds, and none of those reds is new.

## Deviations from Plan

1. **[Rule 3 - Blocking] test-218-what-why-classifier pinned two folder facts.** The m4 Part 7 leg required the exact source text `require('./entity-extractor')`, which reads `../semantic-index/entity-extractor.cjs` while embedding-classifier waits for batch 3. The egress-carrier leg scanned only `lib/core/eureka/`, so the entity-classifier transport left its view. Fix: the m4 regex accepts `./` or `../semantic-index/`, and the carrier scan covers both folders with the same assertion (only entity-classifier.cjs carries the transport). Committed with batch 1 (3ab26df38).
2. **[Rule 3] The harness manifest went stale after batch 4.** The cause was a comment-only path rewrite in navigation-engine.cjs. It was regenerated by script in 795264bf6.
3. **[Plan reading] Move rule.** The plan's rule ("imported from outside") counts tests literally, and under that reading all 32 modules move. Its expected lists show the intent: production importers decide, and the eureka-named families stay. candidate-exclusion and room-native-substrate were on the expected-move list, but after 366-22 their only importers are tests, so they stay and appear in the orphan set. analogy-fitness, online-pattern-query and research-filing were not on the expected list, but the map shows outside production importers, so they move ("and any other the map shows").
4. **[Scope] The gate's reference definition is require and spawn paths only.** A path.join that reads, writes or existence-checks a file does not count. The first draft counted every path.join and flagged 64 false failures: tests that create scratch files under lib/core, tests that assert a file is absent, and planted fixture trees. Comment lines and code inside strings are masked by a lexer instead of being matched by regex.
5. **[Rule 2, small] The new folder got a CONTEXT.md.** It follows the lib/core/research-planner/ and lib/core/navigation/ precedent, so the folder states what it is.
6. **Not done, on purpose:** no `.py` file is scanned by the gate (it covers JS only, as specified). The `eureka_*` table names are unchanged.

## For plan 366-24

- The orphan set above is the hand-off for retiring the runner's leftover helpers: ahp-weights, candidate-exclusion, opportunity-statement, portfolio-dimensions, reasoning-mode, room-native-substrate, tail-quadrant and report-html, plus the three pre-existing orphans compression-meter, eureka-offer and lateral-engine-adapter. Retiring any of them moves its floor-ledger row with it and retires or retargets its tests.
- 366-23 covers none of the four 366-22 carry items (a) to (d) in deferred-items.md. They stay with 366-24.

## Self-Check: PASSED

- Commits b277f68be, 996f57661, 930a3fbc8, 3ab26df38, e680bb00e, 8c6c1fd62, a09fb8728, 19bf7f067 and 795264bf6 exist and are ancestors of HEAD.
- scripts/check-require-integrity.cjs, tests/test-366-semantic-index-integrity.cjs, lib/core/semantic-index/CONTEXT.md and 366-23-codemod.cjs exist. The 13 modules exist under lib/core/semantic-index/ and are absent from lib/core/eureka/.

## Dry-run output (Task 2, every batch, run on the pre-move tree, nothing applied)

```text
batch 1: embedding-spine.cjs, lexical-overlap.cjs, entity-extractor.cjs, entity-classifier.cjs (dry-run)
  lib/core/claude-routing.cjs
    K2 "lib/core/eureka/entity-classifier" -> "lib/core/semantic-index/entity-classifier"
  lib/core/doctor/class-s-eureka-smoke.cjs
    K1 "../eureka/embedding-spine.cjs" -> "../semantic-index/embedding-spine.cjs"
    K1 "../eureka/embedding-spine.cjs" -> "../semantic-index/embedding-spine.cjs"
  lib/core/eureka-critic.cjs
    K1 "./eureka/embedding-spine.cjs" -> "./semantic-index/embedding-spine.cjs"
    K1 "./eureka/embedding-spine.cjs" -> "./semantic-index/embedding-spine.cjs"
  lib/core/eureka-deps-resolver.cjs
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  lib/core/eureka/analogy-fitness.cjs
    K1 "./embedding-spine.cjs" -> "../semantic-index/embedding-spine.cjs"
  lib/core/eureka/embedding-classifier.cjs
    K1 "./embedding-spine.cjs" -> "../semantic-index/embedding-spine.cjs"
    K1 "./entity-extractor.cjs" -> "../semantic-index/entity-extractor.cjs"
  lib/core/eureka/entity-extractor.cjs (moves to lib/core/semantic-index/)
    K2 "lib/core/eureka/entity-classifier" -> "lib/core/semantic-index/entity-classifier"
  lib/core/eureka/hybrid-retrieve.cjs
    K1 "./embedding-spine.cjs" -> "../semantic-index/embedding-spine.cjs"
  lib/core/eureka/reasoning-mode.cjs
    K3 "eureka" -> "semantic-index"
  lib/core/eureka/report-html.cjs
    K1 "./embedding-spine.cjs" -> "../semantic-index/embedding-spine.cjs"
  lib/core/eureka/tri-modal-index.cjs
    K1 "./embedding-spine.cjs" -> "../semantic-index/embedding-spine.cjs"
  lib/core/eureka/vector-store.cjs
    K1 "./embedding-spine.cjs" -> "../semantic-index/embedding-spine.cjs"
  lib/core/hsi-engine.cjs
    K1 "./eureka/embedding-spine.cjs" -> "./semantic-index/embedding-spine.cjs"
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  lib/core/rs-differential-scorer.cjs
    K1 "./eureka/lexical-overlap.cjs" -> "./semantic-index/lexical-overlap.cjs"
    K1 "./eureka/embedding-spine.cjs" -> "./semantic-index/embedding-spine.cjs"
  lib/core/rs-engine.cjs
    K1 "./eureka/embedding-spine.cjs" -> "./semantic-index/embedding-spine.cjs"
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  lib/core/rs-pinecone-bridge.cjs
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  lib/core/verb-reach-affinity.cjs
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  lib/workflow/f-selector-ranker.cjs
    K1 "../core/eureka/lexical-overlap.cjs" -> "../core/semantic-index/lexical-overlap.cjs"
    K2 "lib/core/eureka/lexical-overlap" -> "lib/core/semantic-index/lexical-overlap"
  scripts/derive-verb-reach-affinity.cjs
    K1 "../lib/core/eureka/embedding-spine.cjs" -> "../lib/core/semantic-index/embedding-spine.cjs"
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  scripts/entity-extract.cjs
    K1 "../lib/core/eureka/entity-extractor.cjs" -> "../lib/core/semantic-index/entity-extractor.cjs"
    K1 "../lib/core/eureka/entity-classifier.cjs" -> "../lib/core/semantic-index/entity-classifier.cjs"
    K2 "lib/core/eureka/entity-classifier" -> "lib/core/semantic-index/entity-classifier"
  scripts/eureka-room-report.cjs
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  scripts/measure-355-hit-rate.cjs
    K1 "../lib/core/eureka/embedding-spine.cjs" -> "../lib/core/semantic-index/embedding-spine.cjs"
  scripts/rs-vector-bridge.cjs
    K1 "../lib/core/eureka/embedding-spine.cjs" -> "../lib/core/semantic-index/embedding-spine.cjs"
    K1 "../lib/core/eureka/embedding-spine.cjs" -> "../lib/core/semantic-index/embedding-spine.cjs"
    K1 "../lib/core/eureka/embedding-spine.cjs" -> "../lib/core/semantic-index/embedding-spine.cjs"
  scripts/spike-366.cjs
    K3 "eureka" -> "semantic-index"
  tests/272-cache-location.test.cjs
    K3 "eureka" -> "semantic-index"
  tests/272-cache-probe.test.cjs
    K3 "eureka" -> "semantic-index"
  tests/272-pinecone-inference.test.cjs
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  tests/296-vector-read-both-backends.test.cjs
    K1 "../lib/core/eureka/embedding-spine.cjs" -> "../lib/core/semantic-index/embedding-spine.cjs"
  tests/fixtures/226-reasoning-pairs.cjs
    K2 "lib/core/eureka/lexical-overlap" -> "lib/core/semantic-index/lexical-overlap"
  tests/run-all-218.sh
    K2 "lib/core/eureka/entity-extractor" -> "lib/core/semantic-index/entity-extractor"
    K2 "lib/core/eureka/entity-extractor" -> "lib/core/semantic-index/entity-extractor"
    K2 "lib/core/eureka/entity-classifier" -> "lib/core/semantic-index/entity-classifier"
  tests/run-all-341.sh
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  tests/test-211-embed-batching.cjs
    K1 "../lib/core/eureka/embedding-spine.cjs" -> "../lib/core/semantic-index/embedding-spine.cjs"
  tests/test-211-embedding-spine.cjs
    K1 "../lib/core/eureka/embedding-spine.cjs" -> "../lib/core/semantic-index/embedding-spine.cjs"
  tests/test-211-measured-differential.cjs
    K1 "../lib/core/eureka/lexical-overlap.cjs" -> "../lib/core/semantic-index/lexical-overlap.cjs"
  tests/test-218-extractor.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-218-what-why-classifier.cjs
    K3 "eureka" -> "semantic-index"
    K3 "eureka" -> "semantic-index"
  tests/test-226-null-legs.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-226-rubric-parity.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-244-mmr-diversity.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-341-class-s-layer-split.cjs
    K3 "eureka" -> "semantic-index"
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  tests/test-341-eureka-no-brain-reach.cjs
    K2 "lib/core/eureka/embedding-spine" -> "lib/core/semantic-index/embedding-spine"
  tests/test-341-slim-install-honest-degrade.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-eureka-scaffold-entity-noise.cjs
    K1 "../lib/core/eureka/entity-extractor.cjs" -> "../lib/core/semantic-index/entity-extractor.cjs"
  59 rewrite(s) in 43 file(s)
batch 2: scaffold-template-index.cjs, online-pattern-query.cjs, vector-store.cjs, analogy-fitness.cjs (dry-run)
  lib/core/doctor/class-s-eureka-smoke.cjs
    K1 "../eureka/vector-store.cjs" -> "../semantic-index/vector-store.cjs"
  lib/core/dominant-design/lane-queries.cjs
    K2 "lib/core/eureka/online-pattern-query" -> "lib/core/semantic-index/online-pattern-query"
  lib/core/eureka/analogy-fitness.cjs (moves to lib/core/semantic-index/)
    K1 "./embedding-spine.cjs" -> "../eureka/embedding-spine.cjs"
  lib/core/eureka/tri-modal-index.cjs
    K1 "./vector-store.cjs" -> "../semantic-index/vector-store.cjs"
  lib/core/eureka/vector-store.cjs (moves to lib/core/semantic-index/)
    K1 "./embedding-spine.cjs" -> "../eureka/embedding-spine.cjs"
  lib/core/feynman/feynman-seed-writer.cjs
    K2 "lib/core/eureka/scaffold-template-index" -> "lib/core/semantic-index/scaffold-template-index"
  lib/core/navigation/room-birth.cjs
    K2 "lib/core/eureka/scaffold-template-index" -> "lib/core/semantic-index/scaffold-template-index"
    K2 "lib/core/eureka/scaffold-template-index" -> "lib/core/semantic-index/scaffold-template-index"
  lib/core/scaffold-predicate.cjs
    K1 "./eureka/scaffold-template-index.cjs" -> "./semantic-index/scaffold-template-index.cjs"
    K2 "lib/core/eureka/scaffold-template-index" -> "lib/core/semantic-index/scaffold-template-index"
  scripts/analogy-fitness-report.cjs
    K2 "lib/core/eureka/online-pattern-query" -> "lib/core/semantic-index/online-pattern-query"
    K2 "lib/core/eureka/online-pattern-query" -> "lib/core/semantic-index/online-pattern-query"
    K2 "lib/core/eureka/analogy-fitness" -> "lib/core/semantic-index/analogy-fitness"
    K2 "lib/core/eureka/analogy-fitness" -> "lib/core/semantic-index/analogy-fitness"
  scripts/check-floor-ledger.cjs
    K2 "lib/core/eureka/analogy-fitness" -> "lib/core/semantic-index/analogy-fitness"
  scripts/entity-extract.cjs
    K1 "../lib/core/eureka/scaffold-template-index.cjs" -> "../lib/core/semantic-index/scaffold-template-index.cjs"
    K2 "lib/core/eureka/scaffold-template-index" -> "lib/core/semantic-index/scaffold-template-index"
  scripts/rs-vector-bridge.cjs
    K1 "../lib/core/eureka/vector-store.cjs" -> "../lib/core/semantic-index/vector-store.cjs"
    K1 "../lib/core/eureka/vector-store.cjs" -> "../lib/core/semantic-index/vector-store.cjs"
    K2 "lib/core/eureka/vector-store" -> "lib/core/semantic-index/vector-store"
  tests/fixtures/296/room-fixture.cjs
    K1 "../../../lib/core/eureka/vector-store.cjs" -> "../../../lib/core/semantic-index/vector-store.cjs"
    K2 "lib/core/eureka/vector-store" -> "lib/core/semantic-index/vector-store"
  tests/run-all-218.sh
    K2 "lib/core/eureka/scaffold-template-index" -> "lib/core/semantic-index/scaffold-template-index"
    K2 "lib/core/eureka/vector-store" -> "lib/core/semantic-index/vector-store"
  tests/run-all-363.1.sh
    K2 "lib/core/eureka/scaffold-template-index" -> "lib/core/semantic-index/scaffold-template-index"
  tests/test-211-vec0-capability.cjs
    K1 "../lib/core/eureka/vector-store.cjs" -> "../lib/core/semantic-index/vector-store.cjs"
  tests/test-211-vector-store.cjs
    K1 "../lib/core/eureka/vector-store.cjs" -> "../lib/core/semantic-index/vector-store.cjs"
  tests/test-214-analogy-fitness.cjs
    K1 "../lib/core/eureka/analogy-fitness.cjs" -> "../lib/core/semantic-index/analogy-fitness.cjs"
  tests/test-214-darkmatter-gate.cjs
    K1 "../lib/core/eureka/analogy-fitness.cjs" -> "../lib/core/semantic-index/analogy-fitness.cjs"
  tests/test-214-online-fence.cjs
    K1 "../lib/core/eureka/online-pattern-query.cjs" -> "../lib/core/semantic-index/online-pattern-query.cjs"
    K3 "eureka" -> "semantic-index"
  tests/test-341-eureka-no-brain-reach.cjs
    K2 "lib/core/eureka/vector-store" -> "lib/core/semantic-index/vector-store"
  tests/test-341-shrinkwrap-platform-coverage.cjs
    K2 "lib/core/eureka/vector-store" -> "lib/core/semantic-index/vector-store"
    K2 "lib/core/eureka/vector-store" -> "lib/core/semantic-index/vector-store"
  tests/test-363.1-feynman-seed.cjs
    K2 "lib/core/eureka/scaffold-template-index" -> "lib/core/semantic-index/scaffold-template-index"
  tests/test-eureka-scaffold-entity-noise.cjs
    K2 "lib/core/eureka/scaffold-template-index" -> "lib/core/semantic-index/scaffold-template-index"
  36 rewrite(s) in 24 file(s)
batch 3: tri-modal-index.cjs, embedding-classifier.cjs (dry-run)
  lib/core/eureka/embedding-classifier.cjs (moves to lib/core/semantic-index/)
    K1 "./embedding-spine.cjs" -> "../eureka/embedding-spine.cjs"
    K1 "./entity-extractor.cjs" -> "../eureka/entity-extractor.cjs"
  lib/core/eureka/entity-extractor.cjs
    K2 "lib/core/eureka/embedding-classifier" -> "lib/core/semantic-index/embedding-classifier"
  lib/core/eureka/fts-index-lifecycle.cjs
    K1 "./tri-modal-index.cjs" -> "../semantic-index/tri-modal-index.cjs"
  lib/core/eureka/hybrid-retrieve.cjs
    K1 "./tri-modal-index.cjs" -> "../semantic-index/tri-modal-index.cjs"
  lib/core/eureka/research-filing.cjs
    K1 "./tri-modal-index.cjs" -> "../semantic-index/tri-modal-index.cjs"
  lib/core/eureka/tri-modal-index.cjs (moves to lib/core/semantic-index/)
    K1 "./embedding-spine.cjs" -> "../eureka/embedding-spine.cjs"
    K1 "./vector-store.cjs" -> "../eureka/vector-store.cjs"
  lib/core/lazygraph-ops.cjs
    K1 "./eureka/tri-modal-index.cjs" -> "./semantic-index/tri-modal-index.cjs"
    K2 "lib/core/eureka/tri-modal-index" -> "lib/core/semantic-index/tri-modal-index"
  lib/core/sensors/sensor-content-relevance.cjs
    K1 "../eureka/tri-modal-index.cjs" -> "../semantic-index/tri-modal-index.cjs"
  lib/core/strategy/goal-cadence.cjs
    K2 "lib/core/eureka/tri-modal-index" -> "lib/core/semantic-index/tri-modal-index"
  lib/core/verb-reach-affinity.cjs
    K2 "lib/core/eureka/embedding-classifier" -> "lib/core/semantic-index/embedding-classifier"
    K2 "lib/core/eureka/embedding-classifier" -> "lib/core/semantic-index/embedding-classifier"
  scripts/build-ecosystem-graph.cjs
    K3 "eureka" -> "semantic-index"
  scripts/derive-verb-reach-affinity.cjs
    K2 "lib/core/eureka/embedding-classifier" -> "lib/core/semantic-index/embedding-classifier"
  scripts/entity-extract.cjs
    K1 "../lib/core/eureka/tri-modal-index.cjs" -> "../lib/core/semantic-index/tri-modal-index.cjs"
    K1 "../lib/core/eureka/embedding-classifier.cjs" -> "../lib/core/semantic-index/embedding-classifier.cjs"
  scripts/eureka-room-report.cjs
    K2 "lib/core/eureka/tri-modal-index" -> "lib/core/semantic-index/tri-modal-index"
  scripts/fts-index-drain.cjs
    K1 "../lib/core/eureka/tri-modal-index.cjs" -> "../lib/core/semantic-index/tri-modal-index.cjs"
  tests/272-rank-agreement.test.cjs
    K2 "lib/core/eureka/embedding-classifier" -> "lib/core/semantic-index/embedding-classifier"
    K2 "lib/core/eureka/embedding-classifier" -> "lib/core/semantic-index/embedding-classifier"
    K2 "lib/core/eureka/embedding-classifier" -> "lib/core/semantic-index/embedding-classifier"
  tests/run-all-218.sh
    K2 "lib/core/eureka/embedding-classifier" -> "lib/core/semantic-index/embedding-classifier"
  tests/run-all-244.sh
    K2 "lib/core/eureka/tri-modal-index" -> "lib/core/semantic-index/tri-modal-index"
  tests/test-211-tri-modal.cjs
    K1 "../lib/core/eureka/tri-modal-index.cjs" -> "../lib/core/semantic-index/tri-modal-index.cjs"
  tests/test-211-vec0-capability.cjs
    K1 "../lib/core/eureka/tri-modal-index.cjs" -> "../lib/core/semantic-index/tri-modal-index.cjs"
  tests/test-211-vector-store.cjs
    K1 "../lib/core/eureka/tri-modal-index.cjs" -> "../lib/core/semantic-index/tri-modal-index.cjs"
    K3 "eureka" -> "semantic-index"
  tests/test-218-what-why-classifier.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-219-fts5-degrade.cjs
    K1 "../lib/core/eureka/tri-modal-index.cjs" -> "../lib/core/semantic-index/tri-modal-index.cjs"
  tests/test-244-content-sensor-fires.cjs
    K1 "../lib/core/eureka/tri-modal-index.cjs" -> "../lib/core/semantic-index/tri-modal-index.cjs"
  tests/test-244-doctor-fts-health.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-244-fts-build-orphan-prune.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-244-fts-index-lifecycle.cjs
    K1 "../lib/core/eureka/tri-modal-index.cjs" -> "../lib/core/semantic-index/tri-modal-index.cjs"
  tests/test-244-fts-query-sanitize.cjs
    K1 "../lib/core/eureka/tri-modal-index.cjs" -> "../lib/core/semantic-index/tri-modal-index.cjs"
  tests/test-244-fts-rebuild-reconcile.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-276-busy-timeout-propagation.cjs
    K2 "lib/core/eureka/tri-modal-index" -> "lib/core/semantic-index/tri-modal-index"
  38 rewrite(s) in 30 file(s)
batch 4: fts-index-lifecycle.cjs, hybrid-retrieve.cjs, research-filing.cjs (dry-run)
  lib/core/doctor/eureka-fts-health-module.cjs
    K1 "../eureka/fts-index-lifecycle.cjs" -> "../semantic-index/fts-index-lifecycle.cjs"
    K2 "lib/core/eureka/fts-index-lifecycle" -> "lib/core/semantic-index/fts-index-lifecycle"
    K2 "lib/core/eureka/fts-index-lifecycle" -> "lib/core/semantic-index/fts-index-lifecycle"
  lib/core/eureka/explore-chain.cjs
    K1 "./research-filing.cjs" -> "../semantic-index/research-filing.cjs"
  lib/core/eureka/explored-artifact.cjs
    K1 "./research-filing.cjs" -> "../semantic-index/research-filing.cjs"
  lib/core/eureka/fts-index-lifecycle.cjs (moves to lib/core/semantic-index/)
    K1 "./tri-modal-index.cjs" -> "../eureka/tri-modal-index.cjs"
    K2 "lib/core/eureka/fts-index-lifecycle" -> "lib/core/semantic-index/fts-index-lifecycle"
  lib/core/eureka/hybrid-retrieve.cjs (moves to lib/core/semantic-index/)
    K1 "./tri-modal-index.cjs" -> "../eureka/tri-modal-index.cjs"
    K1 "./embedding-spine.cjs" -> "../eureka/embedding-spine.cjs"
  lib/core/eureka/research-filing.cjs (moves to lib/core/semantic-index/)
    K1 "./tri-modal-index.cjs" -> "../eureka/tri-modal-index.cjs"
  lib/core/navigation-engine.cjs
    K2 "lib/core/eureka/fts-index-lifecycle" -> "lib/core/semantic-index/fts-index-lifecycle"
  lib/core/recovery/dispatcher.cjs
    K1 "../eureka/research-filing.cjs" -> "../semantic-index/research-filing.cjs"
  lib/core/research-planner/filing.cjs
    K1 "../eureka/research-filing.cjs" -> "../semantic-index/research-filing.cjs"
  lib/core/sensors/sensor-content-relevance.cjs
    K1 "../eureka/fts-index-lifecycle.cjs" -> "../semantic-index/fts-index-lifecycle.cjs"
  lib/core/url-ingest.cjs
    K1 "./eureka/research-filing.cjs" -> "./semantic-index/research-filing.cjs"
  lib/workflow/f-selector-ranker.cjs
    K1 "../core/eureka/hybrid-retrieve.cjs" -> "../core/semantic-index/hybrid-retrieve.cjs"
  scripts/check-substrate.cjs
    K2 "lib/core/eureka/research-filing" -> "lib/core/semantic-index/research-filing"
  scripts/fts-index-drain.cjs
    K1 "../lib/core/eureka/fts-index-lifecycle.cjs" -> "../lib/core/semantic-index/fts-index-lifecycle.cjs"
    K2 "lib/core/eureka/fts-index-lifecycle" -> "lib/core/semantic-index/fts-index-lifecycle"
    K2 "lib/core/eureka/fts-index-lifecycle" -> "lib/core/semantic-index/fts-index-lifecycle"
  tests/run-all-219.sh
    K2 "lib/core/eureka/research-filing" -> "lib/core/semantic-index/research-filing"
  tests/run-all-244.sh
    K2 "lib/core/eureka/fts-index-lifecycle" -> "lib/core/semantic-index/fts-index-lifecycle"
  tests/test-211-tri-modal.cjs
    K1 "../lib/core/eureka/hybrid-retrieve.cjs" -> "../lib/core/semantic-index/hybrid-retrieve.cjs"
  tests/test-219-explore-chain.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-219-fts5-degrade.cjs
    K1 "../lib/core/eureka/hybrid-retrieve.cjs" -> "../lib/core/semantic-index/hybrid-retrieve.cjs"
  tests/test-221-matrix.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-244-content-sensor-fires.cjs
    K1 "../lib/core/eureka/fts-index-lifecycle.cjs" -> "../lib/core/semantic-index/fts-index-lifecycle.cjs"
    K2 "lib/core/eureka/fts-index-lifecycle" -> "lib/core/semantic-index/fts-index-lifecycle"
  tests/test-244-fts-build-orphan-prune.cjs
    K3 "eureka" -> "semantic-index"
  tests/test-244-fts-index-lifecycle.cjs
    K1 "../lib/core/eureka/fts-index-lifecycle.cjs" -> "../lib/core/semantic-index/fts-index-lifecycle.cjs"
  30 rewrite(s) in 23 file(s)
```
