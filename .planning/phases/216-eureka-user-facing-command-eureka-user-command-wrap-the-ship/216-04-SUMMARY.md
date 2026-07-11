---
phase: 216-eureka-user-command
plan: 04
subsystem: eureka
tags: [eureka, phase-gate, regression, aggregator, human-verify, gap-logged]

# Dependency graph
requires:
  - phase: 216-01
    provides: "buildRoomNativeSubstrate: room-native pairs so a plain room.db produces a full report"
  - phase: 216-02
    provides: "scripts/eureka-command.cjs fire-and-return dispatcher (start/status/report) + status.json lifecycle"
  - phase: 216-03
    provides: "commands/eureka.md born-wired /mos:eureka surface, F.8 close, 4-zone render spec"
provides:
  - "tests/run-all-216.sh: hermetic offline aggregator, 9 legs, PASS=9 FAIL=0 SKIP=0"
  - "Navigator spot-check verdict on a real, non-JHU room (recorded below)"
  - "One confirmed, root-caused gap for /gsd-plan-phase 216 --gaps"
affects: [eureka, 216 phase-close, room-native-substrate.cjs]
status: gap-logged
requirements: [216-R5, 216-R6]
---

# 216-04 SUMMARY -- the two-leg phase gate (aggregator green, human spot-check finds a gap)

## What ran

**Task 1 (automated aggregator, LEG 1).** `tests/run-all-216.sh` built on the run-all-215.sh
scaffold: substrate + dispatcher e2e + the six 216-03 governance gates (connector registry,
shape declaration --strict, command registration, help coverage, skill mirror, render coverage)
+ the run-all-215 regression leg (216-R6; 211 rides along inside 215's own leg 7).

- `bash tests/run-all-216.sh` -> `Phase 216: PASS=9 FAIL=0 SKIP=0`, exit 0.
- `bash tests/run-all-211.sh` -> `PASS=10 FAIL=0`, exit 0 (belt-and-suspenders direct run).
- `bash -n tests/run-all-216.sh` -> exit 0 (syntax-clean).
- `eureka-offline-preload` grep count 1 (zero-network guard wired), `run-all-215` grep count 2
  (regression leg present).

**Task 2 (human-verify, LEG 2).** Per the plan's own instruction ("in a normal Claude Code
session, not a dev shell"), the spot-check ran against a real, non-JHU room. This session's
installed plugin (beta.12, cut 2026-07-08) predates Phase 216 (landed 2026-07-10), so
`/mos:eureka` was not literally registered yet in this session; the identical dispatcher and
render code that the command wraps (`scripts/eureka-command.cjs` + `commands/eureka.md`'s Zone
1-4 spec) ran directly instead, against `ador-ip-test` (68 nodes, 57 edges, a real case study
room, not synthetic), with a second pass against `shamir-nir-opportunity` (23 nodes) to exercise
the below-30 tail-honesty branch.

Results against the plan's 8-step how-to-verify:

| # | Check | Verdict |
|---|---|---|
| 1 | Real, tens-of-entries room | PASS (ador-ip-test, 68 nodes/57 edges) |
| 2 | Fire-and-return (D-05) | PASS (`start` returns instantly; scan finished detached in ~1.3s) |
| 3 | 4-zone anatomy renders | PASS |
| 4 | Tail honesty, >=30 entries | PASS (`insufficient_structure=false`, real tail) |
| 5 | Tail honesty, <30 entries | PASS (shamir-nir-opportunity, 23 nodes: `insufficient_structure=true`, honest empty read, no crash) |
| 6 | Statement honesty (D-03) | PASS on state (`banked:false`, `critic:pending` always correct) / FAIL on content, see gap below |
| 7 | F.8 AskUserQuestion close | not exercised on the test room (would be a stale-artifact card outside the navigator's real decision context); render spec correct on inspection |
| 8 | `report` re-renders, no rescan | PASS (0.053s, byte-identical JSON, status.json timestamps unchanged) |

## Navigator verdict (recorded verbatim from the Task 2 checkpoint)

Presented as a Decision Gate via AskUserQuestion after the spot-check surfaced a defect.
Navigator selected: **"Log as gap-closure (Recommended)."**

Per the plan's resume-signal contract, this does NOT close Phase 216. The defect below becomes
a gap-closure item for `/gsd-plan-phase 216 --gaps`, not a hot-patch past this checkpoint.

## The gap

25 of 25 Opportunity Statements generated against `ador-ip-test` read literally "...creates a
Section x Section approach to a Section x Section cross-domain bridge that addresses the a
Section x Section cross-domain bridge gap neither side closes alone..." instead of naming real
domains.

**Root cause:** `lib/core/eureka/room-native-substrate.cjs:139-145` derives the statement
template's `section` field from the node's schema-level `type` column, which is generically the
literal string `"Section"` for every PWS room-section node (the ICM node type; see
`lib/core/migrations/phase-162-section-nodes.cjs`), not a domain or topic label.
`scripts/eureka-portfolio-report.cjs:217`'s `deriveSharedProblems()` then falls back to
`'a ' + (a.section || 'unknown') + ' x ' + (b.section || 'unknown') + ' cross-domain bridge'`
whenever neither side has `problems`/`primary_problem` populated -- the common case for a
typical room, since those are PWS-specific fields not present on generic Section-level nodes.

This repeats the exact failure class Phase 215 already found and fixed once
(215-05-SUMMARY.md: the graph-mode `section` field meant "lens-role" in
`csv-to-idea-graph.cjs`'s actual emitted output, not "domain" as the runner assumed) -- same
field, same assumed-meaning-vs-actual-source-meaning mismatch, new substrate. That fix shipped
a permanent regression guard (`tests/test-215-field-contract.cjs`, wired into `run-all-215` leg
5b); the room-native path has no equivalent yet.

**Suggested shape for the gap-closure plan (not yet actioned, for `/gsd-plan-phase 216 --gaps`
to scope properly):**
- Give `buildRoomNativeSubstrate` a real section/category source for room-native nodes (the
  node's containing folder/category, distinct from the ICM `type` column), or omit the
  `section` field entirely when no real label exists so `deriveSharedProblems` falls through to
  its `'unknown'` branch honestly rather than a false-typed literal.
- Add `tests/test-216-field-contract.cjs` mirroring `test-215-field-contract.cjs`, asserting the
  room-native adapter's emitted fields match what the shared modules (`ahp-weights`,
  `portfolio-dimensions`, `tail-quadrant`, `opportunity-statement`) actually expect them to mean.

## Verification (Task 1 leg, all green)

- `bash tests/run-all-216.sh` -- `PASS=9 FAIL=0 SKIP=0`, exit 0.
- `bash tests/run-all-215.sh` -- unregressed (216-R6).
- `bash tests/run-all-211.sh` -- `PASS=10 FAIL=0` (216-R6).

## Success criteria

- 216-R5 (hermetic aggregator): MET.
- 216-R6 (211/215 unregressed): MET.
- Phase 216 closes only after the human spot-check verdict is recorded: verdict recorded above,
  Phase 216 stays OPEN pending the logged gap.

Phase 216 (Eureka User-Facing Command) is NOT complete: 216-01 through 216-03 done, 216-04's
automated leg green, human-verify leg surfaced one real, root-caused gap. Next: `/gsd-plan-phase
216 --gaps`.
