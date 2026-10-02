---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 26
status: complete
subsystem: runner-retirement
tags: [runner-retire, slice-d, migrate-or-retire, D-02]
requires:
  - 366-21 (the runner inventory and the RR1-RR5 gate)
provides:
  - slice D off the standalone runner (341 / 363.1 cluster, the live room check, test-eureka-mcp-tools)
  - the phase-366 handover list for plan 366-22
affects: [366-22]
tech-stack:
  added: []
  patterns: [migrate keeps assertions and moves the seam, retire-with-reason, non-vacuous exclusion fixture]
key-files:
  created: []
  modified:
    - tests/test-341-eureka-no-brain-reach.cjs
    - tests/run-all-341.sh
    - tests/run-all-363.1.sh
    - tests/test-363.1-eureka-exclusion.cjs
    - tests/test-363.1-eureka-tail.cjs
    - tests/test-363.1-opp-statement.cjs
    - tests/test-eureka-mcp-tools.cjs
  deleted:
    - tests/test-363.1-eureka-status-race.cjs
    - tests/live-363.1-room-check.cjs
decisions:
  - "test-341-eureka-no-brain-reach guards every perspective module (perspectives/*.cjs, discovered from disk) instead of the runner; the single-egress arm still finds exactly one network call (eureka-enable)"
  - "Three inventory rows flipped (this plan owns every aggregator naming them): 363.1-eureka-tail and 363.1-opp-statement retire -> partial migrate (their lib-only unit legs stay), test-eureka-mcp-tools retire -> migrate (the plan's Task 2 action)"
  - "The Eureka perspective drops every FEYNMAN by basename, authored or seeded; the runner admitted an authored FEYNMAN as content (B51-01). Recorded as a follow-on, not changed here (lib is not in this plan's files)"
metrics:
  tasks_done: 2
  tasks_total: 2
  completed: 2026-10-02
---

# Phase 366 Plan 26: Slice D runner retirement Summary

Slice D no longer touches the standalone runner. The no-Brain-reach guard now covers the perspective modules that replaced the runner. The 363.1 exclusion test proves structural rows stay out of eureka-recall's candidates on a fixture where only the exclusion can keep them out. The unaggregated MCP test moved from the dead legacy compute path to the research_run perspective ops and passes again (it was red before this plan).

## Commits

| Commit | Message |
|--------|---------|
| 22c0005e0 | test(366-26): slice D part 1, the 341 / 363.1 cluster off the standalone runner |
| 887dbfa35 | test(366-26): migrate test-eureka-mcp-tools to the research_run perspective ops |

Both commits used `git add -f` and `git commit --only <paths>`. Each one carries only this plan's paths (8 files, then 1).

## Slice D rows, executed

| File | Inventory decision | Executed | Reason |
|---|---|---|---|
| test-341-eureka-no-brain-reach | migrate | migrated | The runner entry in EUREKA_SURFACE_FILES is replaced by every `lib/core/research-planner/perspectives/*.cjs`, discovered from disk and sorted, with a floor leg that requires eureka-recall and eureka-judge. Arms 1-4 are unchanged. Arm 3 still finds exactly one network call, in eureka-enable. The stale self-respawn comment is gone. 21/21 PASS. |
| test-363.1-eureka-exclusion | migrate | migrated | U1-U10 are untouched (they test candidate-exclusion.cjs and reasoning-mode). The E legs now run `eureka-recall.runRecall` over the same nine structural rows. Each structural row carries the same drivetrain text as the real content, so only the exclusion keeps it out. New E1: no structural endpoint among the candidates. New E2: the substrate's things include the three content rows and none of the nine structural rows. New E3: known-pair exclusion. claim:one x claim:two is recalled, then an INFORMS edge is added, and the pair drops out with `known_pairs` and `excluded_known` >= 1 (shared.makeCandidateStore). 15/15 PASS. |
| (same file, retired legs) | | retired | Old E2 (provenance `structural_excluded_by_reason`), E4 (step 4b counters), E5 (md provenance row) and E6 (renderReport) asserted the runner's report, which has no perspective analog. Old E3 (an authored FEYNMAN ranks) cannot carry over; see the finding below. |
| test-363.1-eureka-status-race | retire | retired (git rm) | It pinned the `eureka-command start` status-file race. The perspective writes no runner status file, and its STATUS.md is derived from the stage files (shared.deriveStatus). |
| test-363.1-eureka-tail | retire | FLIPPED: partial migrate | U1-U4 test lib/core/eureka/room-native-substrate.cjs and tail-quadrant.cjs directly, with no runner, so they stay. E1/E2 read the runner's report tail block and renderReport, and they are retired: the perspective has no tail quadrant. 4/4 PASS. The flip is allowed because run-all-363.1 (glob) is the only aggregator naming it, and this plan owns it. |
| test-363.1-opp-statement | retire (slice D may keep pure legs) | FLIPPED: partial migrate | S1 (sectionFor) and R1-R4 (opportunity-statement and reasoning-mode) stay. S2 catalogId, S3 deriveBankSection and S4 deriveSharedProblems were runner functions and are retired. The R2/R3 fixture's `shared_problems` seam now uses the literal string the runner fallback returned (the one S4 pinned), so the assertions are unchanged. 5/5 PASS. |
| live-363.1-room-check | retire | retired (git rm) | It is a manual live verifier. Every check reads the runner's portfolio-report.json (provenance, tail, statements) or races `eureka-command start/status`. Pointing it at `research-planner perspective-recall` would mean a rewrite with different checks, not a retarget. No aggregator names it. |
| test-eureka-mcp-tools | retire | FLIPPED: migrate | No aggregator names it, and plan Task 2 directs a migrate. CHECK 1 keeps the enum/parity pin: eureka-run/status/report stay out of ALL_TOOL_COMMANDS, unique count 65. It also reads research_run's op enum for the three perspective ops and three aliases, read-only, with no description or schema change. CHECK 2 checks in-process perspective_recall with candidates on disk at return. CHECK 3 checks a verbatim perspective_candidates page, perspective_judge, and candidates_missing for an unknown run_tag. CHECK 4 checks the deprecated eureka_* aliases. CHECK 5 checks the unknown-room guard (no_bound_room). Plus zero network attempts. 6/6 PASS. Retired: the legacy branch's source-shape checks (`_eurekaScanInFlight`, the detached spawn of the runner, `.main(` without await). They pin the branch 366-22 deletes, and the redirect is pinned by test-366-router-redirects. |

Aggregators: run-all-341.sh dropped `scripts/eureka-command.cjs` from PHASE_341_SURFACES. run-all-363.1.sh dropped both runner files from DASH_TARGETS. The test-216 regress entry was already handled by 366-21, and the BASELINE_RED list is untouched. Neither aggregator named the two retired files, because both are glob-discovered or unaggregated.

No MCP tool description or inputSchema was changed. test-eureka-mcp-tools only reads `research._internal.OPS` / `inputSchema` and checks that the registered schema is that object.

## Slice D closure and the phase-366 handover list (for 366-22)

- Slice D closure check (the plan's Task 2 verify): `slice-D-closed`. No slice D file that still exists names `eureka-command` or `eureka-portfolio-report`.
- `tests/test-366-runner-retired.cjs` RR2 offenders on disk at the end of this plan: `lib/core/doctor/class-s-eureka-smoke.cjs`, `lib/mcp/tool-router.cjs`, `tests/test-366-eureka-alias.cjs`, `tests/test-366-eureka-filing.cjs`. All four belong to 366-22, and no slice B/C/D file remains.
- tests/test-366-*.cjs files that still name a runner file on purpose:
  - `tests/test-366-runner-retired.cjs`: the gate itself (its RUNNER_FILES and RUNNER_TESTS lists).
  - `tests/test-366-eureka-alias.cjs` (plan 366-03): legacy legs; 366-22 rewrites them as "flag ignored, pointer answered".
  - `tests/test-366-eureka-filing.cjs` (plan 366-02): leg F4, runner re-export identity; 366-22 drops it.
  - `tests/test-366-ambient-offer.cjs`: names `eureka-portfolio-report` only to assert it is ABSENT from ambient-run (leg O5). It survives the deletion, RR2 does not flag it, and it needs no change.
- The global grep over all of tests/ stays 366-22's preflight.

## Suite results (hermetic: temp HOME / USERPROFILE / MINDRIAN_ROOMS_HOME, CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID unset)

- `bash tests/run-all-363.1.sh`: PASS=10 FAIL=0 SKIP=1 (the opt-in regression block), exit 0.
- `bash tests/run-all-341.sh`: PASS=21 FAIL=1 SKIP=6 EXPECTED-RED=0. All 341 legs pass, including eureka-no-brain-reach 21/21. The one failed leg is the nested `run-all-310.sh` leg 9 ("scoped working-tree diff"). It fails only because the shared working tree holds uncommitted files from the parallel slices: when last run it listed tests/run-all-219.sh, run-all-355.sh, run-all-366.sh, test-219-banking, test-343-path-hygiene and the 355/3551 files from slices B and C. None of those files are this plan's. Once this plan's files were committed they dropped out of that list, so the leg clears when the parallel slices commit.
- `node tests/test-eureka-mcp-tools.cjs`: 6 passed, 0 failed (before this plan it failed with FATAL `server.registerTool is not a function`).
- `node tests/test-363.1-eureka-exclusion.cjs` 15/15, `test-363.1-eureka-tail.cjs` 4/4, `test-363.1-opp-statement.cjs` 5/5, `test-341-eureka-no-brain-reach.cjs` 21/21.
- `bash tests/run-all-366.sh`: PASSED=67 FAILED=1 SKIPPED=2 KNOWN=1. The one failed leg is `366 runner retired` (RR1-RR4), the documented expected RED until 366-22. RR5 PASS. The count is 67 rather than 366-21's 68 because slice C (366-27) edited its own legs in the same window. That is not this plan's change.
- Not used as a gate, per the orchestrator: run-all-355.

## Deviations from Plan

**1. [Inventory flip] Three rows changed decision** (table above). Each one is owned by this plan's aggregators or has no aggregator. The flips keep coverage of lib modules that outlive the runner. Plan 366-23 moves lib/core/eureka/* and its codemod updates test importers.

**2. [Finding, not fixed] Authored FEYNMAN is no longer a candidate.** `eureka-recall.buildSubstrate` drops every row whose basename matches `/^(CONTEXT|FEYNMAN|ROOM|MINTO|STATE|BRAIN)$/`, whatever the body says. The runner's candidate-exclusion (363.1 B51-01, U3) treated a FEYNMAN with an authored line as content, so the old E3 leg cannot carry over. The fix belongs in lib/core/research-planner/perspectives/eureka-recall.cjs, which is outside this plan. Recommend a follow-on (or 366-22/24 triage) that routes FEYNMAN through `scaffold-predicate.isScaffoldFile` the way candidate-exclusion does.

**3. [Fixture honesty] Why each structural row is excluded in the migrated E legs.** memory_artifact rows are excluded by NON_THING_TYPES. CONTEXT/FEYNMAN are excluded by basename. The four egress-label `focus_area` domains are excluded because they carry no section (source_path `domain:sess:*`), not because of an egress-label check. The `Lab` entity is an entity type (a bridge, never an endpoint). E2 asserts the outcome, which is what the perspective guarantees. It does not assert a per-reason count, which the perspective does not keep.

**4. [Pre-existing red cleared] test-eureka-mcp-tools** was red at the base: its stub server had no `registerTool`, the 366-03 deferred item. The migrated file's harness captures both registration shapes.

## Known Stubs

None.

## Threat Flags

None. T-366-103: every retired test or leg has its reason above, and migrated legs keep their assertions. T-366-104: the no-Brain-reach assertion moved to the perspective modules and was not retired. T-366-105: RR2 offenders are down to 366-22's own four files, and 366-22's preflight runs the global grep.

## Self-Check: PASSED

- 22c0005e0 and 887dbfa35 exist and are ancestors of HEAD.
- The seven modified files exist, and tests/test-363.1-eureka-status-race.cjs and tests/live-363.1-room-check.cjs are absent.
- The plan's Task 1 grep and Task 2 closure grep both pass.
