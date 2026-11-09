---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 14
subsystem: phase-closeout
tags: [closeout, gates, release-gate-registration, changelog, carry-over]
requires: [389-03, 389-04, 389-05, 389-06, 389-07, 389-08, 389-09, 389-10, 389-11, 389-12, 389-13]
provides:
  - 389-CLOSEOUT.md (item table, requirement table, gate table, residual caller table, carry-over list)
  - tests/run-all-389.sh registered as a hard run in tests/run-all-366.sh
  - CHANGELOG.md [Unreleased] entries for Phase 389 (12 lines, tags 389-04 to 389-13)
affects: [390]
key-files:
  created:
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-CLOSEOUT.md
  modified:
    - tests/run-all-366.sh
    - CHANGELOG.md
decisions:
  - No Jev rescore was run. Neither plan 14 nor 389-DECISION.md records approval for an external or paid call.
  - No fix was made for finding F1 (267 CIRS check b). The fixture is outside the file list of this plan.
metrics:
  tasks: 2
completed: 2026-11-09
---

# Phase 389 Plan 14: Gates and closeout

One line: every gate was re-run on the final tree against the baseline with no leg that passed now failing, the closeout record names the carry-over, the phase aggregator rides the release gate suite, and the changelog lists what the owner approved (all 11 items).

## Items

All 11 tokens (D1 to D11) read APPROVE, in the card and in each plan SUMMARY. No item is DECLINED. No SUMMARY says CHANGED NONE. The changelog has one group of lines per item; there is no declined item to list.

## Commits

| task | sha | message |
|------|-----|---------|
| 1 | 4c0c7139e | docs(389-14): closeout record, gates against the baseline, carry-over list |
| 2 | see the report | docs(389-14): register the phase tests in the release gate suite, changelog for Phase 389 |

## Gate summary (full table in 389-CLOSEOUT.md section 3)

| leg | baseline | final |
|-----|----------|-------|
| run-all-118 | 16 suites, 13 pass, 3 fail | 9 suites, 8 pass, 1 fail (mva-deck-builder.test, pre-existing) |
| run-all-267 | PASS=26 FAIL=7 SKIP=1 | PASS=31 FAIL=2 SKIP=1 |
| run-all-267.2 / 267.3 | n.r. / PASS 5 | PASS 19 SKIP 1 / PASS 5 |
| run-all-389 | n.r. | PASS=16 FAIL=0 SKIPPED=0 |
| test-270 family (9 files) | n.r. | 8 pass, resource-session-room red (pre-existing) |
| test-252 census | n.r. | 4 of 6 green (census.1 and 5b red, other phases) |
| Part 11 generators (connector registry, projection, render coverage, skill mirrors) | PASS | PASS |
| hooks hk1 to hk5 | 0, 1, 0, 1, 0 | 0, 1, 0, 1, 0 |
| irreversibility ledger --check | WARN 20 | WARN 24 |
| doctor --acceptance | n.r. | 20 of 25 points; 5 failing points under the scratch HOME (4 ENVGAP, deployment-surfaces not read further) |

n.r. means the baseline did not record the leg.

## Ledger count

Before the phase: WARN 20. Now: WARN 24 (STALE /mos:mva-brief, STALE /mos:mva-report, UNSCORED /mos:session-report, REMOVED /mos:mva-option). The Jev rescore was not run. Rows owed: /mos:mva-brief, /mos:mva-report, /mos:session-report. The ledger files were not edited.

## Registration line

Added after the Phase 374 block of tests/run-all-366.sh, with a comment block in the style of the neighbours: run "389 pyramid seed and full, MVA family replaced (Seed cells, record, Full engine adapter, retirements and renames that the owner approved)" bash tests/run-all-389.sh. bash -n passes. The leg is a hard run.

## Changelog lines

Under [Unreleased]: Added (4 lines: Seed 389-06, Seed record 389-05, Full upgrade 389-04, opt-in share 389-12); Changed (4 lines: first-install reward 389-07, entry without the hook 389-07, session-report 389-11, renamed modules 389-13); Removed (4 lines: hook 389-07, mva-pipeline skill and mva-option 389-08, mva-brief forwards to the Seed 389-09, old core 389-10). No version number was added. Version files are unchanged.

## Deviations from Plan

1. [Finding, not fixed] F1: tests/test-267-mcpv2-cirs-gates.cjs check (b) passed at the baseline and now fails because of the four soft-alias stub surfaces of plans 09 and 11. The leg was already red for checks (a) and (c), so the stop rule of the plan (a passing leg now fails) is not triggered. Fix for the owner: add the four paths to tests/fixtures/267/shape-violations-baseline.txt, or drop the F.0 shape from the stubs. Both are outside the file list of this plan.
2. [Correction] Plan 10 listed detectActiveRoom of lib/core/navigation.cjs as a caller-less export. It has live callers. Only getRecentDecisionNeighborhood has no runtime caller.
3. [Scope] 389-CONTEXT.md does not exist in the phase folder (the plan context list holds 389-PRD.md, which was used).
4. [Not run] Jev rescore (needs approval, see above). The live measure of 389-MEASURE.md (NOT-MEASURED, needs the owner go).

## Carry-over (full list with files in 389-CLOSEOUT.md section 5)

buildDeck and buildSlide dead code (Phase 390 candidates); room naming selector unreachable (spawn site removed with D6); getRecentDecisionNeighborhood has no runtime caller; six frozen mva_* telemetry names; hook cold-start fixture row for mva-detect (tests/fixtures/369/hook-cold-start-baseline.json L692); stale prose in docs/reward-before-investment-rule.md L305; deprecation entries for /mos:mva-brief and /mos:mva-report owed at beta.84; 341 drift-baseline rows (L377, L383); dist regeneration (bundles from beta.52); ledger WARN 24 and the Jev rescore; pre-existing reds listed in the closeout.

## NEXT for the main session

1. Review every commit ahead of origin before any push (push gate). 
2. Decide F1 (267 shape baseline lines, or stub shape).
3. Decide the Jev rescore (needs approval for an external call) and the MOS_389_LIVE=1 measure.
4. Record the plan in STATE.md, ROADMAP.md and REQUIREMENTS.md by hand (this plan did not touch them).
5. Theo and the Desktop copy follow at the next cut.

## Known Stubs

commands/mva-brief.md, skills/mva-brief/SKILL.md, commands/mva-report.md and skills/mva-report/SKILL.md are intentional soft-alias stubs with a dated removal (v2.0.0-beta.84). No other stub.

## Threat Flags

None. This plan adds no endpoint, auth path or file access pattern.

## Self-Check: PASSED

389-CLOSEOUT.md exists and is committed (4c0c7139e). tests/run-all-366.sh names run-all-389. No non-ASCII byte in the added lines.
