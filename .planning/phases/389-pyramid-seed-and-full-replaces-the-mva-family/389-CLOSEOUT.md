# Phase 389 closeout (plan 389-14)

HEAD at the run: 35f99cff7 (plan 13 dispatcher rename). Plugin version of record: 2.0.0-beta.82 (in progress). Scratch HOME, MINDRIAN_BRAIN_URL on closed port 127.0.0.1:9, MINDRIAN_EUREKA_ROOT, VERCEL_TOKEN and Tavily and Brain keys unset in the run. No Brain, Tavily, Vercel or Jev call was made. The working tree was clean at the start (git status empty).

## 1. Item table (owner items D1 to D11)

All 11 tokens in the answer block of 389-DECISION.md read APPROVE. Every plan SUMMARY states the same token it read from the gate. No plan SUMMARY says CHANGED NONE. No item is DECLINED. The changelog therefore writes one group of lines for every item.

| item | token | plan | commit sha | effect |
|------|-------|------|------------|--------|
| D1 entry | APPROVE | 07 | 7f93a9ccf | per-message hook scripts/mva-detect.cjs removed (hooks row, catalogue row, markers row); Larry offers the Seed in conversation |
| D2 first-install | APPROVE | 07 | 3d3ba0e79 | router classifies once with the sync heuristic, stores two booleans and no text, no pending record, no child process |
| D3 pipeline skill | APPROVE | 08 | d32f394cb | skills/mva-pipeline removed with its registry rows |
| D4 option router | APPROVE | 08 | d2b487fd7, 1acb2f39c | /mos:mva-option, its skill and lib/core/mva-option-router removed; deprecation entry written |
| D5 brief | APPROVE | 09 | 35922a28b | /mos:mva-brief and its skill became a soft-alias stub that forwards to /mos:structure-argument |
| D6 core | APPROVE | 10 | e44e97b37 | orchestrator, state, progressive renderer, telemetry shim, run script, lib/agents/mva, agent prompts, Dror harness removed |
| D7 session-report | APPROVE | 11 | 8adc3ccc7 | /mos:mva-report renamed to /mos:session-report, body equal, name replaced |
| D8 alias | APPROVE | 09, 11 | 35922a28b, 8adc3ccc7 | soft-alias stubs for mva-brief and mva-report for one release; mva-option has a deprecation entry only |
| D9 survivors | APPROVE | 13 | 3fd4db52c, eadc1746b, b7a95d9b4, 155527bf9, 35f99cff7 | five modules and five tests renamed (classifier, rule linter, budget, agent contract, dispatcher) |
| D10 share | APPROVE | 12 | 6815f7c4b | opt-in share behind a card that shows the exact page text and names Vercel; single-use confirm bound to the page hash |
| D11 posture | APPROVE | 06 | d5f638f7a, f7e7a18d0, b2b0f8f41 | autonomous_safe stays true; the Seed fetch sits behind a card and a code refusal |

Supporting plan commits: 01 (475d20403, 5db064df2, fb6266d83), 02 (1960c31e9), 03 (e7c2d736d), 04 (5f4ed8ded, 4fb6c5c52), 05 (09b721ce8, d11376c88, ce0babce7).

## 2. Requirement table PYR389-01 to PYR389-14

The requirement number equals the plan number. Result column: the leg was run on the final tree.

| requirement | plan | proof | result |
|-------------|------|-------|--------|
| PYR389-01 caller proof, baseline, stale text | 01 | tests/test-389-stale-text.cjs; 389-caller-scan.cjs selftest; 389-BASELINE.md | PASS (run-all-389) |
| PYR389-02 decision card and gate | 02 | 389-decision.cjs gate (66 asserts in its selftest) | PASS (all 11 lines APPROVED) |
| PYR389-03 Seed cells, Part 8 phrase check, card and consent | 03 | tests/test-389-seed-egress.cjs, tests/test-389-seed-cells.cjs, tests/test-389-seed-cli.cjs | PASS |
| PYR389-04 Full depth on the pyramid engine | 04 | tests/test-389-full-pyramid.cjs | PASS |
| PYR389-05 Seed record and --from-brief hand-off | 05 | tests/test-389-seed-record.cjs | PASS |
| PYR389-06 Seed and Full in /mos:structure-argument, D11 posture | 06 | tests/test-389-seed-structure.cjs | PASS |
| PYR389-07 first-install reward on the Seed, hook removed (D1, D2) | 07 | tests/test-389-first-install-seed.cjs, tests/test-389-hook-unwire.cjs | PASS |
| PYR389-08 pipeline skill and option router retired (D3, D4) | 08 | tests/test-389-retire-option.cjs | PASS |
| PYR389-09 brief command retired, soft alias (D5, D8) | 09 | tests/test-389-retire-brief.cjs | PASS |
| PYR389-10 old core retired, telemetry names frozen (D6) | 10 | tests/test-389-retire-core.cjs (42 checks) | PASS |
| PYR389-11 session-report rename and alias (D7, D8) | 11 | tests/test-389-session-report.cjs (45 checks) | PASS |
| PYR389-12 opt-in share (D10) | 12 | tests/test-389-share.cjs (49 checks) | PASS |
| PYR389-13 survivor renames (D9) | 13 | tests/test-389-renames.cjs (43 checks) | PASS |
| PYR389-14 gates and closeout | 14 | this file; tests/run-all-389.sh registered in tests/run-all-366.sh | PASS for the registration; see section 3 for the gate findings |

tests/run-all-389.sh on the final tree: PASS=16 FAIL=0 SKIPPED=0 (15 test files plus the dash fence). No test file for a declined item exists, because no item was declined.

## 3. Gate table (baseline against final)

Exit map: 0 PASS, 77 ENVGAP, other FAIL. The baseline column is 389-BASELINE.md (HEAD b7fdd9708). The final column was run on HEAD 35f99cff7.

| leg | baseline | final | verdict |
|-----|----------|-------|---------|
| run-all-118 | FAIL, 16 suites, 13 pass, 3 fail | FAIL, 9 suites, 8 pass, 1 fail (mva-deck-builder.test, Test 12 palette parity) | PRE-EXISTING, 2 red suites left with their removed suites (plans 08, 10) |
| router test | FAIL, 13 of 18 | file removed (plan 08, D4) | removed by D4 |
| test-mva-from-brief | PASS 21 of 21 | file removed (plan 08, D4) | removed by D4 |
| run-all-267 | FAIL, PASS=26 FAIL=7 SKIP=1 | FAIL, PASS=31 FAIL=2 SKIP=1 | improved; see finding F1 |
| run-all-267.2 | not recorded | PASS=19 FAIL=0 SKIP=1 | PASS |
| run-all-267.3 | PASS 5 | PASS 5 | same |
| hk1 hook timeouts | PASS | PASS | same |
| hk2 tier-d hooks | FAIL (CHECK 4) | FAIL (CHECK 4) | PRE-EXISTING |
| hk3 hooks.json top level | PASS | PASS | same |
| hk4 catalogue schema | FAIL 18 of 19 (assert 12) | FAIL 18 of 19 (assert 12) | PRE-EXISTING |
| hk5 hook require graph | PASS | PASS | same |
| connector registry --check | PASS | PASS | same |
| orchestration projection --check | PASS | PASS | same |
| render coverage | PASS | PASS | same |
| shape declaration --check | PASS (advisory) | PASS (advisory) | same |
| registry drift --check | PASS | PASS | same |
| command registry --check | PASS | PASS | same |
| skill mirrors --check | PASS | PASS | same |
| harness manifest --check | PASS | PASS | same |
| face-commands --check | PASS | PASS | same |
| irreversibility ledger --check | PASS, WARN 20 | PASS, WARN 24 | see section 6 |
| dist --check-stale | FAIL (beta.52 bundle) | FAIL | PRE-EXISTING |
| test-209 declared implies wired | FAIL | FAIL | PRE-EXISTING |
| section command ledger --check | FAIL (version drift) | FAIL | PRE-EXISTING |
| backfill-hitl-shape --check | FAIL | FAIL | PRE-EXISTING (the two retired surfaces left the list) |
| backfill-layer --check | FAIL | FAIL | PRE-EXISTING |
| workspace registry sync (test-369.26) | FAIL | FAIL | PRE-EXISTING |
| test-252 guard census | not recorded | FAIL, 4 of 6 green (census.1 and census.5b) | census.1 lost the two lib/agents/mva entries in plan 10; the remaining reds are from other phases |
| test-220 part 8 egress | not recorded | PASS | PASS |
| test-270 family (9 files, one by one) | not recorded | 8 pass; test-270-resource-session-room exit 1 | PRE-EXISTING (red before and after plan 12) |
| run-all-380 | not recorded | PASSED=17 FAILED=2 SKIPPED=1 | same as plan 11 |
| run-all-3696 | not recorded | PASSED=125 FAILED=5 SKIPPED=2 KNOWN=19 | plan 11 read FAILED=6; no new red |
| node scripts/doctor.cjs --acceptance | not recorded | FAIL 20 of 25 points, ENVGAP for all 5 failing points | see below |

Doctor --acceptance under the scratch HOME: failed points are install-state (no active plugin install resolved), deployment-surfaces (1 surface drifted, not read further), version-of-record-published (no marketplace.json under the scratch HOME), session-start-active-version (installed_plugins.json absent) and activation-reached-the-wire (MCP handshake skipped because a prior layer failed). Four are caused by the scratch HOME and are ENVGAP. deployment-surfaces was not investigated and is UNVERIFIED as ENVGAP. The points coverage-gate, verify-release-clean-tree, release-dry-run-output, harness-policies and doctor-all PASS.

No baseline leg that passed now fails at the leg level.

### Finding F1: 267 CIRS gates, sub-check (b), is a new red caused by this phase

tests/test-267-mcpv2-cirs-gates.cjs failed at the baseline on checks (a) and (c) (the leg was red). Check (b), the shape-declaration drift check, PASSED at the baseline ("51 current violation(s), all within the recorded baseline"; proven by running the test on a git archive of b7fdd9708). It now FAILS: "new shape-declaration violation(s) not in baseline: commands/mva-brief.md, commands/mva-report.md, skills/mva-brief/SKILL.md, skills/mva-report/SKILL.md". The four are the soft-alias stubs of plans 09 and 11 (hitl_shape F.0 with connector.excluded true, the same advisory WARN that commands/heal.md and skills/heal/SKILL.md carry; the heal rows are in the baseline file). The leg stays red for the same leg-level reason, so the rule "a passing leg now fails" is not triggered, but the sub-check is a regression of this phase. Fix, owner decision: add the four paths to tests/fixtures/267/shape-violations-baseline.txt (the stubs are removed at beta.84, and the lines go then), or drop the F.0 shape from the stubs. This plan did not change either file (not in its file list).

## 4. Residual caller table

Source: node 389-caller-scan.cjs scan and classes on the final tree: 139 rows. Classes: spawn 0, require 3, path-string 4, data 30, doc 30, comment 19, test 53. Tokens named by D1 to D9 (retired or renamed) have 0 hits of class require, spawn or path-string, with one exception (below). The counts of the three caller classes per token:

| token | state | spawn | require | path-string | file and line of a caller |
|-------|-------|-------|---------|-------------|---------------------------|
| mva-detect | retired | 0 | 0 | 0 | |
| mva-pipeline | retired | 0 | 0 | 0 | |
| mva-option-router | retired | 0 | 0 | 0 | |
| mva-option | retired | 0 | 0 | 0 | |
| mva-orchestrator | retired | 0 | 0 | 0 | |
| mva-state | retired | 0 | 0 | 0 | |
| mva-progressive-renderer | retired | 0 | 0 | 0 | |
| mva-telemetry | retired | 0 | 0 | 0 | |
| mva-run | retired | 0 | 0 | 0 | |
| lib/agents/mva | retired | 0 | 0 | 0 | |
| mva-agent-prompts | retired | 0 | 0 | 0 | |
| mva-report | renamed, stub | 0 | 0 | 0 | |
| mva-classifier | renamed | 0 | 0 | 0 | |
| mva-rule-linter | renamed | 0 | 0 | 0 | |
| mva-dispatcher | renamed | 0 | 0 | 0 | |
| mva-budget | renamed | 0 | 0 | 0 | |
| mva-agent-contract | renamed | 0 | 0 | 0 | |
| mva-brief | retired, stub | 0 | 0 | 1 | scripts/room-naming-selector.cjs L80 (reads <room>/.mindrian/mva-brief.json; no writer exists) |
| mva-deck-builder | kept (D10 APPROVE) | 0 | 2 | 1 | lib/core/pyramid-seed-share.cjs L39 (require), lib/memory/run-feynman-tests.cjs L1501 (test list) |
| mva-vercel-deploy | kept (D10 APPROVE) | 0 | 1 | 1 | lib/core/pyramid-seed-share.cjs L211 (require), lib/memory/run-feynman-tests.cjs L1500 |
| resolve-vercel-key | kept (D10 APPROVE) | 0 | 0 | 1 | lib/memory/run-feynman-tests.cjs L1499 |

Named exceptions, none of them a stale caller:
- mva-deck-builder, mva-vercel-deploy and resolve-vercel-key are not retired. D10 APPROVE keeps them behind the share card. The two requires in lib/core/pyramid-seed-share.cjs are the intended call path. The three path strings in lib/memory/run-feynman-tests.cjs are the test list.
- scripts/room-naming-selector.cjs L80 reads mva-brief.json. The shim is unreachable (section 5, item 6), and it was a known, recorded read in plans 09 and 10 (tests/test-389-retire-brief.cjs Test 5 pins it).

No other residual of class require, spawn or path-string exists. The plan stop rule (STATUS PARTIAL for an unnamed residual) is not triggered.

## 5. Carry-over list for Phase 390 and the owner

Each item has a file and a reason.

1. buildDeck and buildSlide in lib/core/mva-deck-builder.cjs: no caller. Only DECK_PALETTE is used (by lib/core/pyramid-seed-share.cjs). The module loads data/mva-deck-template.html at load time for this reason. Phase 390 candidate.
2. Unreachable room naming suggestion: scripts/room-naming-selector.cjs, lib/core/room-naming-selector.cjs and tests/test-room-naming-selector-integration.cjs. The only spawn site (orchestrator block phase-119-01-naming-selector-hook) was removed with D6. Phase 390 is KEEP-ALL by its table, so the files stay. The owner decides whether the feature comes back with a new trigger or is cut later.
3. lib/core/navigation.cjs exports with no runtime caller. PROVEN: getRecentDecisionNeighborhood (lib/core/navigation/dashboard-helpers.cjs L86) has only tests/test-363-cli.cjs and docs as callers (its non-test caller was the removed dashboard cell). Correction of the plan 10 note: detectActiveRoom has live callers (scripts/act-command.cjs, mos-status.cjs, claim-checks.cjs and others) and is not unreachable. A quick scan of all 191 exports for a name hit under lib, scripts, hooks and bin (excluding tests and navigation files) lists 40 more names with no hit (mostly constants and Phase 355 to 363 helpers); that list is a rough scan, UNVERIFIED as dead, and it is not specific to this phase.
4. Six frozen telemetry names in lib/core/telemetry/schema.cjs, its test and docs/TELEMETRY-SCHEMA.md: mva_pipeline_started, mva_agent_returned, mva_brief_rendered, mva_option_selected, mva_brief_deployed, mva_pipeline_failed. They can leave only after scripts/migrate-telemetry-v1.cjs loses its mva source (SOURCES[0], reads ~/.mindrian/telemetry/v1.13/mva.jsonl).
5. Cold-start baseline fixture still lists the removed hook: tests/fixtures/369/hook-cold-start-baseline.json L692 (mva-detect.cjs, UserPromptSubmit). tests/test-369-hook-require-graph.cjs passes with it. The row is stale and can leave with the next fixture refresh.
6. Stale prose: docs/reward-before-investment-rule.md L305 names tests/test-mva-dror-harness.cjs as the implementation; the file is gone. docs/ENV-TUNING.md L67 prose.
7. Comment mentions of retired modules (no caller): lib/core/doctor/mode-select-checkpoint-module.cjs:48, lib/core/recovery/case-file.cjs:23, lib/core/recovery/controller.cjs:16, lib/core/research-cache.cjs:31, lib/core/semantic-index/embedding-spine.cjs:323, tests/272-cache-location.test.cjs, tests/test-room-registry-windows-atomic-replace.cjs, lib/core/eureka-deps-resolver.cjs:37 (Eureka path, never edited), r-and-d copy r-and-d/breakthrough-engines/engines/eureka/lib/core/eureka-deps-resolver.cjs.
8. Deprecation entries owed at beta.84, when the stubs are removed: /mos:mva-brief (replaced_by /mos:structure-argument) and /mos:mva-report (replaced_by /mos:session-report), decided_by navigator, date 2026-11-08, retired_in 2.0.0-beta.84. Also drop both names from tests/fixtures/341-registry-drift-baseline.json and the help-groups alias map then. data/command-deprecations.json already holds /mos:mva-option (written by plan 08).
9. 341 drift-baseline rows: tests/fixtures/341-registry-drift-baseline.json holds /mos:mva-brief (L377) and /mos:mva-report (L383). The file snapshots the previous release and stays true until beta.84. It does not hold /mos:session-report. check-registry-drift passes (0 findings).
10. dist regeneration: dist/generic-claude-dir and dist/zed are stale since beta.52 and were never regenerated in this phase (standing instruction). They hold old skills/mva-brief, mva-report and structure-argument text with no Seed block. Needs node scripts/build-dist-bundles.cjs at a release, with the baseline drift it brings.
11. Irreversibility ledger: WARN 24 (section 6). Jev rescore owed and NOT run (section 6).
12. Frozen soft-alias text: scripts/soft-alias-runner.cjs prints "Scheduled removal: v1.14.0" for any stub; the stub files say v2.0.0-beta.84. The runner is shared and unchanged.
13. Pre-existing reds left as they were: run-all-118 mva-deck-builder.test Test 12 (palette parity); test-270-resource-session-room; run-all-267 and run-all-3696 legs listed in section 3; the three face-commands WHY drift rows (doctor, rs-experts, eureka-portfolio).
14. User files under ~/.mindrian/mva and ~/.mindrian/telemetry stay on disk by design. Old Vercel deployments named mos-brief-<sha8> stay on third-party accounts. Theo and the Desktop copy still list /mos:mva-option, /mos:mva-brief and /mos:mva-report until the next release cut.
15. The Phase 390 table row "mva-pipeline follows Phase 389" is done (D3 was APPROVE and the skill is gone). This plan did not edit .planning/audits/PHASE-390-KEEP-RECALIBRATE-CUT-TABLE.md.

## 6. Irreversibility ledger

Count before the phase (389-BASELINE.md): WARN 20 (14 STALE, 2 REMOVED, 2 UNSCORED, 1 ANSWER_KEY_DRIFT, 1 LABEL_SET_MISMATCH). Count now: WARN 24 (16 STALE, 3 REMOVED, 3 UNSCORED, 1 ANSWER_KEY_DRIFT, 1 LABEL_SET_MISMATCH). The 4 new warnings come from this phase:

| row | warning | cause | plan |
|-----|---------|-------|------|
| /mos:mva-brief | STALE | teaching text changed on purpose (stub) | 09 |
| /mos:mva-report | STALE | teaching text changed on purpose (stub) | 11 |
| /mos:session-report | UNSCORED | new name, no Jev score | 11 |
| /mos:mva-option | REMOVED | command retired, deprecation entry written | 08 |

/mos:session-report also appears in the LABEL_SET_MISMATCH line. The check prints warnings and exits 0. data/command-irreversibility-ledger.json and data/jev-labels/command-irreversibility.json were not edited.

Jev rescore: NOT run by this plan. Reason: neither plan 14 nor 389-DECISION.md names a Jev rescore or records approval for a paid or external call. Plan 14 lists no ledger file in files_modified. A TYPESAFE_API_KEY exists in the environment, but the live mode of scripts/build-command-irreversibility-ledger.cjs calls the external Jev service and rewrites the ledger file, so the plan stops at NEEDS_HUMAN. Rows owed for a rescore: /mos:mva-brief, /mos:mva-report, /mos:session-report. /mos:mva-option needs no score (it is a removed command; how the tool clears a REMOVED warning is UNVERIFIED).

## 7. State of 389-MEASURE.md

Status NOT-MEASURED. No live Brain or Tavily call ran in the phase. The command for the main session (needs the owner go, it calls Theo and Tavily with the real identity):

    MOS_389_LIVE=1 node .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-measure-live.cjs

The Seed ships either way. Every cell degrades to empty with a typed reason (tests/test-389-seed-egress.cjs Test 7, tests/test-389-seed-cells.cjs Test 8).

## 8. Release consequence

The change is on main only. It is not live until a release is cut and picked up. Theo and the Desktop copy follow at the cut. The stubs for /mos:mva-brief and /mos:mva-report live for one release, and their removal and deprecation entries are due at beta.84. Nothing was pushed, tagged or released by this plan, and no version file was touched.
