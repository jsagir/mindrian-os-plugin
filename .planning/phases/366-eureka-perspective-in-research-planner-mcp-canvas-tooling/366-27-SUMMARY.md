---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 27
status: complete
subsystem: runner-retirement
tags: [runner-retire, slice-c, D-02, 355-record, filing-stamped]
requires:
  - 366-21 (the runner inventory and slice C assignments)
  - 366-02 (lib/core/research-planner/filing-stamped.cjs)
  - 366-07 (ambient-run files through filing-stamped; the eureka producer only offers)
provides:
  - slice C (the 355 / 3551 cluster) off the standalone runner, so 366-22 can delete it
affects: [366-22]
tech-stack:
  added: []
  patterns: [migrate keeps assertions and swaps the seam, retire-with-reason, retarget a static chokepoint leg to the file that now carries the write]
key-files:
  created: []
  modified:
    - tests/test-355-filing.cjs
    - tests/test-355-stamp-coverage.cjs
    - tests/test-355-no-decimal.cjs
    - tests/test-355-part8-egress.cjs
    - tests/test-355-floor-sweep.cjs
    - tests/test-3551-ambient-run.cjs
    - tests/run-all-355.sh
    - tests/run-all-366.sh
    - lib/memory/run-feynman-tests.cjs
  deleted:
    - tests/test-355-eureka-ranking-pin.cjs
    - tests/test-355-producer-eureka.cjs
decisions:
  - "test-355-filing drives fileStampedOpportunity through the same composition its live caller ambient-run.cjs runs (BEGIN, filer, COMMIT, writeStampedSideChannel); runner-only legs are restated against the filer, not dropped"
  - "test-355-eureka-ranking-pin retires as inventoried: scorePairDimensions + composeScore (the composite ranking it byte-pins) have no caller outside the runner"
  - "run-all-355's Part 9 navigation-chokepoint leg retargets to lib/core/research-planner/filing-stamped.cjs rather than retiring"
metrics:
  tasks_done: 2
  tasks_total: 2
  duration: ~13 min
  completed: 2026-10-02
---

# Phase 366 Plan 27: Runner retirement slice C (355 / 3551) Summary

The Phase 355 filing record is now proven against the research planner's one stamped filer (filing-stamped.cjs), not the standalone runner. Six slice C tests were migrated and two were retired with reasons. The 355 aggregator's Part 9 chokepoint leg now checks the filer. No slice C file mentions either runner file anymore.

## Commits

| Commit | Message |
|--------|---------|
| 86480e758 | test(366-27): slice C part 1, the 355 filing-record tests migrate to filing-stamped.cjs |
| a44b322ac | test(366-27): slice C part 2, retire the runner-only 355 pins and retarget the 355 aggregator |

## Slice C rows (executed)

| File | Inventory decision | Executed | Reason / what changed | Result |
|---|---|---|---|---|
| test-355-filing | migrate | migrated | The runner's bankStatements was replaced by the composition the live caller lib/core/ambient-run.cjs runs: BEGIN, `fileStampedOpportunity`, COMMIT, then `writeStampedSideChannel` with the minted id. These legs are kept unchanged: proposed-only, stamp re-parse, formula_version, reason, pws_stage, engine_mode, SOURCED_FROM to artifacts, no rogue node type, the v2 side channel, the agent-promote refusal, and the MINDRIAN_DISABLE_MEMORY_EVENT leg. Three runner-only legs were restated against the filer (see deviation 3). Part 9 static leg now checks filing-stamped.cjs (no INSERT INTO / openGraph( / DatabaseSync, requires navigation.cjs). D-56 order leg: the filer is sync and opens no transaction, and ambient-run has no await between BEGIN and COMMIT | PASS 42 / FAIL 0 |
| test-355-stamp-coverage | migrate | migrated | The runner producer left the sweep. The eureka leg now stamps the same fixture pairs through `stampForPair` and keeps produced == parsed integer equality and judge none. It adds "backend not_called" because the filer never calls a tool. The rendered-block count retired with the runner's renderReport | PASS 30 / FAIL 0 |
| test-355-no-decimal | migrate | migrated | The runner Markdown writer legs (replay + null) retired with the runner. The eureka HTML export and the F.1 qualify card keep their sweep and their planted-0.87 negative controls. Their stamps now come from `stampForPair` | PASS 65 / FAIL 0 |
| test-355-part8-egress | migrate | migrated | runner stampRankedPairs became `stampForPair` (asserted zero-call at filing) plus the Theo-lane wire (verificationStamp.stampFindings over endpoints resolved through resolveEndpoint). Those captured calls join leg B's {from,to}/canon-name sweep. filing-stamped.cjs was added to leg A's no-egress target list | PASS 34 / FAIL 0 |
| test-355-floor-sweep | migrate | migrated | Leg 4b drops the runner Markdown render (the only eureka render that carried disclosureLine('eureka')). It now asserts that the four live 355 producers (find-connections, find-bottlenecks, hsi, whitespace) are rendered, so none can silently skip. The ledger shape, anchors, negative control and disclosure legs are unchanged | PASS |
| test-3551-ambient-run | migrate | migrated | Dropped the runner re-export identity assertion. It now asserts that ambient-run.cjs resolves `fileStampedOpportunity` from research-planner/filing-stamped.cjs. The SENS-13 legs already ran through the non-eureka producers since 366-07 and are unchanged | FAIL 0 (integration leg SKIPs: python deps / fixture room) |
| test-355-eureka-ranking-pin | retire | retired (`git rm`) | It byte-pins the runner's composite ranking step (`pdims.scorePairDimensions` + `ahp.composeScore`, then sort). A grep confirms that pair has no caller outside scripts/eureka-portfolio-report.cjs, so the pin's subject is deleted | n/a |
| test-355-producer-eureka | retire | retired (`git rm`) | The producer under test is the runner itself (stampRankedPairs, renderReport, renderReasoningReport, the stamp-before-bank source order) | n/a |

### Aggregators

| File | Action |
|---|---|
| tests/run-all-355.sh | The (3b) Part 9 chokepoint leg was retargeted from scripts/eureka-portfolio-report.cjs to lib/core/research-planner/filing-stamped.cjs, the file that now carries the stamped opportunity write and the navigation require. The header leg (3) and section comments were rewritten so they no longer name the runner. The glob leg picks up the two deletions automatically |
| tests/run-all-3551.sh | No edit needed. It names test-355-side-channel-v2, part8-egress, filing, sens13-fire-once, no-decimal and tri-polar, all of which still exist and pass, and it never mentioned a runner file |
| tests/run-all-366.sh | Only the `pin 355 eureka ranking` leg was removed (replaced by a one-line comment with the reason). The floor-sweep and 3551 ambient-run legs stay because both tests migrated |
| lib/memory/run-feynman-tests.cjs | The two retired entries were removed, with a comment naming them. Every remaining path.join entry exists |

## Suite results (hermetic: temp HOME/USERPROFILE/MINDRIAN_ROOMS_HOME, CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID unset)

- Task 1 verify loop: `slice-C1-green`.
- Task 2 runner-reference grep over tests/test-355-*.cjs, test-3551-ambient-run.cjs, run-all-355.sh, run-all-3551.sh: clean.
- run-all-seed103: PASSED=20 FAILED=0 (exit 0).
- run-all-3551: PASS=62 FAIL=6. This is identical to the pre-plan baseline the orchestrator gave (PASS=62 FAIL=6). The six fails are dependency-diff (peer package/release drift), the doctor leg, nested run-all-355, test-auto-explore-fingerprint, test-connector-tier-d-hooks and test-198-adapter-budget. All of them are named in that file's KNOWN EXTERNAL REDS table or come from peer drift.
- run-all-355: PASS=67 FAIL=4. Every 355 test the glob runs passes, including all six migrated files, and both chokepoint legs pass. The four fails are all documented reds that run-all-3551's header already attributes to run-all-355:
  - test-355-direction-agreement leg H (rs-chain-feeder / test-rs-discovery-engine, the documented pending item)
  - the doctor leg (install-state, deployment-surfaces, version-of-record-published, session-start-active-version and activation-reached-the-wire fail under a hermetic temp HOME with no install; verify-release-clean-tree is baseline)
  - no-regression run-all-272 (with its nested 272-cache-probe)
  - part8-egress-guard.test.cjs PB8-03 ('ambiguous' vs 'allow')

  None of them touches a slice C file.
- run-all-366: PASSED=67 FAILED=1 SKIPPED=2 KNOWN=1. The one fail is `366 runner retired` (RR1-RR4), the documented expected RED until 366-22. The pass count is one lower than 366-21's 68 because the ranking-pin leg was removed. RR2's remaining offenders are lib/core/doctor/class-s-eureka-smoke.cjs, lib/mcp/tool-router.cjs, test-366-eureka-alias and test-366-eureka-filing, all owned by 366-22. None is a slice C file.

## Deviations from Plan

**1. [Orchestrator-approved, files_modified addition] tests/run-all-366.sh edited.** It names test-355-eureka-ranking-pin, test-355-floor-sweep and test-3551-ambient-run directly. Only the ranking-pin leg changed (removed, with a reason comment). The other two legs needed no change because both tests migrated. Commit a44b322ac.

**2. [Orchestrator-approved, files_modified addition] lib/memory/run-feynman-tests.cjs edited.** The two retired entries (ranking-pin, producer-eureka) were removed so the release train never spawns a missing file. Commit a44b322ac.

**3. [Migrate, seam swap] Three test-355-filing legs named runner-only behavior and were restated against the filer.** Plan rule: "keep every assertion; change only the require and the seam".
- The banking-predicate skip ("skipped exactly 1") became "the filer refuses the stamp-less pair (skipped exactly 1)".
- "Pre-existing DERIVED_FROM edges still present (2)" became "the filer writes no edge other than SOURCED_FROM". DERIVED_FROM was bankStatements' own caller-side write; the planner's filing.cjs writes its own.
- The cross_connection_stamped telemetry legs (exactly 1 event, key set, 64-char cap) became "the filer mints no cross_connection_stamped event" plus "the event type stays allowlisted". That telemetry was written only by bankStatements after COMMIT, and no surviving producer writes it.

**4. [Migrate, seam swap] Runner render legs retired inside migrated files.** The runner's Markdown renderReport legs left test-355-stamp-coverage (the rendered-block count and the eureka disclosure line), test-355-no-decimal (two Markdown sweeps) and test-355-floor-sweep (the leg 4b eureka render). The function they render through is deleted. Every non-runner render leg is kept.

**5. [Strengthened] filing-stamped.cjs was added to test-355-part8-egress leg A's no-egress target list.** It is where eureka findings now file.

**6. run-all-3551.sh unchanged** although files_modified lists it. It names no retired test and no runner file.

## Findings for later plans (not fixed here, out of scope)

- **No live eureka render carries disclosureLine('eureka') anymore.** The runner Markdown report was the only one, and the research planner's report does not render it. The floor-ledger rows with `dependent_outputs: ["eureka"]` (eureka-critic gates/bands, tail-quadrant, analogy-fitness, the differential floor) now have no rendered disclosure surface. 366-23 (lib/core/eureka/* disposition) or a follow-on should decide whether the eureka perspective's rows disclose these floors or whether the ledger rows retarget.
- **Orphaned fixture tests/fixtures/355/eureka-ranking-pin.json.** Only the retired ranking pin read it. It was left in place because it is outside this plan's files; delete it at 366-22 or close-out.
- **The cross_connection_stamped memory_event now has no producer.** The allowlist entry in lib/core/navigation/memory-events.cjs stays. Whether the planner's filing should emit it is a 366-22/366-23 question.

## Known Stubs

None.

## Threat Flags

None. T-366-106: every retired test and every restated leg has its written reason above, and the migrated tests keep their assertions. T-366-107: run-all-355, run-all-3551 and run-all-seed103 were run before each commit and compared to baseline. T-366-108: only owned paths were staged; every commit used `git commit --only`; no stash, reset or add -A.

## Self-Check: PASSED

The six migrated files exist and pass. The two retired files are absent. Commits 86480e758 and a44b322ac are ancestors of HEAD (peer commits 0152e0b3a, 22c0005e0 and 887dbfa35 are interleaved). No slice C file references either runner file.
