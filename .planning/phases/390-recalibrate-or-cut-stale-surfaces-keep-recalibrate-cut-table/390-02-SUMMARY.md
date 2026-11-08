---
phase: 390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table
plan: 02
subsystem: planning
tags: [audit, no-caller-scan, caller-matrix, read-only, part-11]
requires: []
provides:
  - verbatim output of the Phase 385 no-caller scan at HEAD 1960c31e9 (390-scan-output.txt)
  - 390-SCAN.md with counts, 385-PROOF reconciliation, a 26-row caller matrix, the dynamic require read, the live Phase 389 state and the limits of the record
affects: [390-03, 390-04, 390-05]
tech-stack:
  added: []
  patterns: [git grep caller matrix with exclusion pathspecs, scan reconciliation by git log]
key-files:
  created:
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-scan-output.txt
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-SCAN.md
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-02-SUMMARY.md
  modified: []
key-decisions:
  - "No product file changed. The matrix is a cost indicator, not a cut verdict. R9 and R10 (keep all, delete none) still hold for every row."
  - "The raw scan file is rewritten at the final HEAD, because Phase 389 commits add modules while this plan runs. The lib/core dead set did not change."
requirements-completed: [R390-TABLE]
duration: about 15 min
completed: 2026-11-08
---

# Phase 390 Plan 02: Re-run of the 385 no-caller scan and the caller matrix Summary

The 385 no-caller scan ran at the current HEAD and its output is saved verbatim. 390-SCAN.md adds the caller proof the scan cannot give: a 26-row matrix across require, code, prose, hooks, Desktop sources, mcp-server-brain, tests and r-and-d. No product file changed.

## Commit

One commit holds the three files of this plan. Its sha is printed by `git log -1 --format=%h -- .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-SCAN.md`. The sha is reported in the hand-back message, because a file cannot hold the sha of the commit that contains it.

## Counts (HEAD 1960c31e9, exit code 0)

| Scope | Scanned | No-reference | Test-only | Closure extra | Dead set |
|-------|---------|--------------|-----------|---------------|----------|
| lib/core | 568 | 0 | 18 (4268 lines) | 2 (260 lines) | 20 modules, 4528 lines |
| scripts plus lib/hmi plus lib/workflow | 376 | 8 (2004 lines) | 39 (15190 lines) | 9 (4640 lines) | 56 modules, 21834 lines |

## Differences from the planner baseline (dcbe73eee)

- lib/core dead set: equal to the baseline (18 test-only, 2 closure, 4528 lines). Scanned +3: `radar/changelog-slice` (391-01), `pyramid-seed-record` (389-05), `pyramid-seed-cells` (389-03). None is dead.
- scripts scope: scanned +2 (`radar-changelog-slice.cjs`, wired by commands/radar.md; `pyramid-seed-run.cjs`, new in 389-03). The second has only its own test as a caller, so the test-only count is 39 instead of 38 (+227 lines). It is in-flight Phase 389 work and not a 390 candidate. Without it the scripts scope equals the baseline.
- 385-PROOF section 10 reconciliation: `deep-links` and `platform-gates` GONE (385-04, 385-05). `part8-sprout-shape` GONE from the dead set: it entered with `f16751402` (386-37) and `e7dc09253` (386-42) wired it through `lib/core/part8-split-route.cjs`. The other 18 test-only modules and 2 closure extras are SAME. No NEW module. R9 holds for every row.
- 385-PROOF section 11 reconciliation: `extract-room-intelligence` removed by `67c3d61cf` (385-06); `telemetry-command-invocation` is now test-only because `33c004d2a` (385-11) removed its hook entry.

## Verdict word per matrix row

- LIVE (1): navigation/synthetic-expert (required by navigation.cjs, expert-genesis.cjs, scripts/close-loop.cjs).
- TEST-ONLY (16): nl-graph-queries, tone-filter, cross-room-triggers, coverage-monitor, synthetic-expert-construction-gate, synthetic-expert-behavior-gate, behavioral/observation-schema, card-fire-gate, futures/subsystem-render, ignite-branch-gate, metrics/larryreach-loop-health, navigation/memory-cortex-packet, reader/ab-harness, recovery/controller, salient-governance, temporal/supersession-gate.
- COMMENT-ONLY (6): expert-genesis (comment in a dead-set gate, r-and-d copy exists), grill-engine (two comments in the egress guard; four tests incl. the Part 8 boundary test 213), fusion-router (comments plus a rule name in find-analogies prose), ralph-loop-gate and planning/artifact-brain-packet (named in comments of dead-set modules), voice-transition-detector (comment in fork-declaration.cjs:41).
- WIRED-IN-PROSE-ONLY (3): methodology-ingest (command and skill prose call it "WIRED", no code loads it), session-register (ignite prose tells Larry to call it, no code loads it), graph-refine-loop (find-analogies prose says to preview through it, no code loads it).
- HOOK, DESKTOP and MCPB are 0 for all 26 rows. Cowork is UNVERIFIED for all rows.

## Other results

- The five PRD names absent from the dead set (fusion-router, grill-engine, methodology-ingest, session-register, voice-transition-detector) have NR 0; a comment or a prose path makes the scan count them as referenced. The deciding token is named for each in 390-SCAN.md section 4.
- Dynamic requires: 625 hit lines; 55 comments; 360 literal-only path forms; 210 non-literal hits in 91 files, all read. No file with a non-literal hit contains any key stem, so no site builds one of the 26 names. A name from a user room at run time is UNVERIFIED (no room was read).
- Phase 389 state at the last reading (05:31 UTC): 14 PLAN files, 4 SUMMARY files (389-01, 389-02, 389-03, 389-05), verdict "part executed". The state is live and changes while 4 executors work. Overlaps with 390 files: ignite prose (389-05, done) and `data/help-groups.json` (389-08, 389-09, 389-11, open), plus the generated registries (389-06, 389-08, 389-09, 389-11), `hooks/hooks.json` and `scripts/session-start` (389-07, 389-10), `scripts/verify-release` (389-13).
- MVA-family modules in the dead sets: NONE. Phase 389 owns the family (D-12).

## TDD and RED

The plan has no `tdd="true"` task, so there is no RED commit. The verify command of Task 1 compares a fresh scan with the raw file. It could not pass before the raw file existed.

## Deviations from Plan

None to the method. Two points to know:

1. [Rule 3 - blocking] The dead-set counts in the raw file had to be rewritten once at the final HEAD, because Phase 389 commits added `lib/core/pyramid-seed-record.cjs`, `lib/core/pyramid-seed-cells.cjs` and `scripts/pyramid-seed-run.cjs` while this plan ran. The verify step compares a fresh scan with the raw file, so the raw file must match the HEAD at the end. The change is documented in 390-SCAN.md section 1. A later 389 commit can again move the `scanned:` lines and the scripts test-only line.
2. The plan text says the 385-PROOF section 10 scan ran at `361463852`. That HEAD does not contain `part8-sprout-shape` (it came 30 seconds later), so the sha in 385-PROOF section 12 is not the tree of that scan. Recorded as UNVERIFIED in 390-SCAN.md section 3.

## Known Stubs

None. The files hold records, not UI data.

## Threat Flags

None. No new network endpoint, auth path or file access. Names, counts and line numbers only (Canon Part 8).
