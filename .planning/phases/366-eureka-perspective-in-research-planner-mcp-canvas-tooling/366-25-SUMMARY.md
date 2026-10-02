---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 25
status: complete
subsystem: runner-retirement
tags: [runner-retire, slice-b, D-02, tests, aggregators]
requires:
  - 366-21 (the runner inventory and slice B assignments)
provides:
  - slice B (218 / 219 / 223 / 343) off the standalone runner; RR2 no longer flags any slice B file
affects: [366-22]
tech-stack:
  added: []
  patterns: [migrate keeps the assertion at the new seam, retire-with-reason, partial migrate (keep the legs whose subject survives)]
key-files:
  created: []
  modified:
    - tests/test-218-noise-reduction.cjs
    - tests/test-218-scaffold-pair-filter.cjs
    - tests/test-218-low-trust-exclusion.cjs
    - tests/run-all-218.sh
    - tests/test-219-banking.cjs
    - tests/test-343-path-hygiene.cjs
    - tests/run-all-219.sh
  deleted:
    - tests/test-218-cohort-stratification.cjs
    - tests/test-218-eureka-auto-extract.cjs
decisions:
  - "test-218-low-trust-exclusion flipped from retire to partial migrate: its stamping leg tests scripts/entity-extract.cjs, not the runner, so it stays; the two runner exclusion legs retire"
  - "test-219-banking DERIVED_FROM assertion moved seam: fileStampedOpportunity writes SOURCED_FROM provenance and carries the evidence pair in stage_history; a perspective pair's DERIVED_FROM edges are written by research-planner/filing.cjs and pinned by test-366-eureka-filing F8"
  - "run-all-219 no-raw-insert gate scans lib/core/research-planner/filing-stamped.cjs (where the filer moved) instead of the retired runner"
  - "run-all-223 and run-all-343 need no edit: neither names a retired file on any line"
metrics:
  tasks_done: 2
  tasks_total: 2
  completed: 2026-10-02
---

# Phase 366 Plan 25: Slice B runner retirement (218 / 219 / 223 / 343) Summary

Slice B no longer touches the standalone Eureka runner: two 218 tests retired (their subject was runner-only), three 218 tests and test-219-banking / test-343-path-hygiene now assert at the seams that replaced the runner (eureka-recall's substrate stage and filing-stamped.fileStampedOpportunity), and run-all-218 / run-all-219 are green.

## Commits

| Commit | Message |
|--------|---------|
| 0152e0b3a | test(366-25): slice B part 1, the 218 cluster off the standalone runner |
| fdb0cc7a2 | test(366-25): slice B part 2, the 219 / 343 cluster off the standalone runner |

## Executed slice B rows

| File | Inventory decision | Executed | Reason | Aggregator result |
|---|---|---|---|---|
| test-218-cohort-stratification | retire | retired (`git rm`) | asserts the percentile cohort stratification inside the runner's all-pairs scoring loop (scripts runner line ~1115); the Eureka perspective has no percentile cohort | run-all-218 leg removed; PASS=17 FAIL=0 |
| test-218-eureka-auto-extract | retire | retired (`git rm`) | asserts the runner dispatcher's freshness-gated auto-extract-before-run pre-step; entity extraction itself stays covered by the extractor, tier-2 and noise-reduction legs | run-all-218 leg removed; PASS=17 FAIL=0 |
| test-218-low-trust-exclusion | retire | FLIPPED: partial migrate | leg 1 (STAMPING: evidenceTier low_confidence / None written by scripts/entity-extract.cjs runExtraction) never touched the runner and its subject survives, so it stays; legs 2-3 (the runner's 4b low-trust pair exclusion and its pure-Tier-0 guard) retire because the perspective has no low-trust pair filter (entities are bridges there, not endpoints). Flip allowed: run-all-218 is the only naming aggregator and this plan owns it | run-all-218 leg relabeled "low-trust entity stamping"; PASS |
| test-218-noise-reduction | migrate | migrated | seam is now eureka-recall.runRecall (memory_artifact rows dropped in buildSubstrate). Kept: PRE honest empty, extraction rc 0, every minted entity proposed, POST structural share exactly 0. One assertion changed with the seam: the runner paired entity nodes with each other so its POST list was non-empty; the perspective pairs content things and uses entities as bridges, so a scaffold-only room stays empty after extraction. POST now asserts zero memory_artifact endpoints and that every minted entity reaches the recall substrate; the "real pairs survive" half moved to scaffold-pair-filter leg 2 | PASS |
| test-218-scaffold-pair-filter | migrate | migrated | seam is eureka-recall.runRecall. Leg 1: scaffold-only room recalls empty, counts.things 0, no scaffold row in things.jsonl (the runner's structural_excluded_by_reason counter has no perspective analog). Leg 2: mixed room recalls non-empty, zero both-scaffold and zero one-side-scaffold candidates (memory_artifact AND scaffold Artifact BRAIN rows, through scaffold-predicate), and the entity-bridged content pair ranks on lane shared_entity. The fixture gained two content Artifacts and two scaffold Artifacts because the perspective's endpoints are content things, not entities | PASS |
| test-219-banking | migrate | migrated (Task 2 hooks) | Task 1 (typed-opportunity writer, 12 checks) untouched. Task 2 now requires filing-stamped.fileStampedOpportunity. Kept at the new seam: Hook 1 (N filings -> N proposed nodes, two SOURCED_FROM edges, evidence pair in stage_history, stamp props, engine_mode, caller section), Hook 3 (invalid pair / no stamp / no db files nothing, never throws), Hook 6 (idempotent UPSERT, one mint entry), Hook 7 (filer source hygiene). Retired with the runner: Hooks 2 and 5 (critic / critic+tail / all banking predicate and its MINDRIAN_OPPORTUNITY_BANK_PREDICATE env seam, a runner batch gate; the perspective files only the pair the navigator chose), the batch half of Hook 3 (all-or-nothing rollback across a statements batch; the filer is one pair per call and the caller owns the transaction) and Hook 4 (deriveBankSection, the runner's section deny-list; the filer takes the caller's section as given). Hook 1's DERIVED_FROM assertion moved: fileStampedOpportunity never wrote DERIVED_FROM (bankStatements did in its own loop); for a perspective pair filing.cjs writes them, pinned by test-366-eureka-filing F8 | PASS (16/16); run-all-219 PASS=13 FAIL=0 |
| test-343-path-hygiene | migrate | migrated | dropped scripts/eureka-command.cjs from the Arm 4 annotated-site list (its file is being retired; no skip-list left to annotate); header and Arm 4 comment say four sites now | PASS (26 checks) |
| run-all-218 | legs follow decisions | updated | cohort and auto-extract legs removed with a dated note; the (a.1) runner comment rewritten so it names no runner file; (f) / (f.1) / (f.2) comments describe the new seams | rc 0, PASS=17 FAIL=0 SKIP=0 |
| run-all-219 | remove path at ~156 | updated | the no-raw-insert gate's runner path replaced by lib/core/research-planner/filing-stamped.cjs (the filer's new home, so the Part 9 gate still covers the writer); banking leg comment updated | rc 0, PASS=13 FAIL=0 SKIP=0 |
| run-all-223 | names test-219-banking | no change | it names test-219-banking only in a "deliberate exclusions" comment and that file still exists; no leg, no runner path | rc 1, identical failure set to the base tree (see below) |
| run-all-343 | names test-343-path-hygiene | no change | its leg runs the migrated test, which passes | rc 1, identical failure set to the base tree (see below) |

## Verification

All runs hermetic (temp HOME / USERPROFILE / MINDRIAN_ROOMS_HOME, CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID unset, node v22.23.1).

- run-all-218: rc 0, PASS=17 FAIL=0 SKIP=0 (re-run after both commits, inside run-all-219).
- run-all-219: rc 0, PASS=13 FAIL=0 SKIP=0.
- run-all-223: rc 1, failing legs DESENSITIZE asymmetry, Req 5 / Req 7 doctor --acceptance, 222-08 read-only rank, no-regression run-all-222, no-regression run-all-224.
- run-all-343: rc 1, failing legs counter-metric declaration parity, contract parity (test-298 "git status --porcelain is empty").
- Base comparison: a detached worktree at e4b387305 (before any slice B commit), same hermetic env, gives exactly the same failing set for run-all-223 (PASS=16 FAIL=3) and run-all-343 (PASS=9 FAIL=2). Neither aggregator's red comes from slice B; none of their failing legs touches a slice B file. The worktree was removed afterwards.
- Plan grep: no remaining test-218-*, test-219-banking, test-343-path-hygiene, run-all-218 / 219 / 223 / 343 file mentions eureka-command or eureka-portfolio-report.
- test-366-runner-retired: RR5 PASS; RR2 offenders are now only lib/core/doctor/class-s-eureka-smoke.cjs, lib/mcp/tool-router.cjs, tests/test-366-eureka-alias.cjs, tests/test-366-eureka-filing.cjs (all 366-22's). RR1, RR3, RR4 are the documented RED until 366-22.
- run-all-366 (informational, after slices C and D landed): PASSED=67 FAILED=1 SKIPPED=2 KNOWN=1; the one failure is `366 runner retired`, the documented expected RED.

## Deviations from Plan

**1. [Inventory flip] test-218-low-trust-exclusion: retire -> partial migrate.** The inventory allowed a flip; the stamping leg never used the runner and covers live extractor behavior. Only run-all-218 names it. Commit 0152e0b3a.

**2. [Seam change] test-218-noise-reduction POST non-empty assertion replaced.** Not reachable at the perspective seam for a scaffold-only room (see the observation below). Replaced with "zero memory_artifact endpoints" plus "every minted entity reaches the substrate"; the non-empty-pairs claim is carried by scaffold-pair-filter leg 2. Commit 0152e0b3a.

**3. [Seam change] test-219-banking Hook 1 DERIVED_FROM -> SOURCED_FROM + stage_history evidence.** fileStampedOpportunity never wrote DERIVED_FROM; the first run of the migrated hook failed on exactly that, which is how this was found. The DERIVED_FROM half is pinned elsewhere (test-366-eureka-filing F8). Commit fdb0cc7a2.

**4. [Rule 2] run-all-219 gate path retargeted, not just removed.** Removing the runner path alone would leave the moved filer outside the Part 9 no-raw-insert gate; filing-stamped.cjs replaces it. Commit fdb0cc7a2.

**5. Hermetic env set inside the three migrated 218 tests** (temp HOME / USERPROFILE / MINDRIAN_ROOMS_HOME, session vars unset), matching the seed103 idiom.

**6. Housekeeping (no commit).** A scratch symlink command briefly created `node_modules/node_modules` (a self-link inside the untracked node_modules dir) because a peer's scratchpad snapshot dir already existed at the path I picked; I removed the link right away. Nothing tracked was touched.

## Observation for 366-22 / 366-23 (not fixed, out of scope)

scripts/entity-extract.cjs writes its DESCRIBES edges entity -> memory_artifact only (its per-file anchor, or the section's memory_artifact ROOM anchor for non-memory files). eureka-recall's buildSubstrate puts memory_artifact in NON_THING_TYPES and only counts an entity's things from thing ids, so entities minted by entity-extract never bridge two things: the shared_entity lane cannot fire from extractor output on a room whose content things are not also wired by another DESCRIBES writer. The seed103 fixture and the migrated scaffold-pair-filter leg 2 wire DESCRIBES straight onto content Artifacts, which is why they see the lane. Worth a look when the perspective's recall is tuned (lib/core/eureka/* and eureka-recall.cjs are not slice B files).

## Known Stubs

None.

## Threat Flags

None. T-366-100 (every retired test and retired leg has its reason above), T-366-101 (every touched aggregator was run before its commit; the two red ones match the base tree exactly), T-366-102 (disjoint files, `git add -f` + `git commit --only`, no stash, no reset) held.

## Self-Check: PASSED

Commits 0152e0b3a and fdb0cc7a2 are ancestors of HEAD; tests/test-218-cohort-stratification.cjs and tests/test-218-eureka-auto-extract.cjs are absent; the five kept slice B tests pass; run-all-218 and run-all-219 exit 0.
