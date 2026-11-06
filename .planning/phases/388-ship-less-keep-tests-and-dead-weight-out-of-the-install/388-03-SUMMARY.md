---
phase: 388-ship-less-keep-tests-and-dead-weight-out-of-the-install
plan: 03
subsystem: packaging
tags: [decision-card, files-negation, pattern-probe, owner-gate]
requires: [388-02]
provides:
  - 388-DECISION.md (22 patterns, effects, not-recommended list, baseline options, answer block)
  - 388-pattern-probe.tsv (per removed path: bytes, class, pattern; before and after numbers)
  - 388-measure.cjs commands probe-patterns and check-decision
affects: [388-04]
key-files:
  created:
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-DECISION.md
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-pattern-probe.tsv
  modified:
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-measure.cjs
duration: 1 session
completed: 2026-11-06
---

# Phase 388 Plan 03: Decision card Summary

One-line: 22 `files` negation patterns remove exactly 222 paths (2,861,559 unpacked bytes, 6.18 percent) from the package: entries 2,416 to 2,194, unpacked 46,286,265 to 43,425,555, packed 14,039,639 to 13,327,216; the card passes check-decision.

## Result (PROVEN)

- Probe in a scratch extraction (real tarball, extracted package.json, patterns appended, `npm pack --dry-run --json --ignore-scripts` before and after): the removed set is exactly the 220 SAFE rows plus the two owner-named runners. No NEEDED, UNCERTAIN (other than the two approved runners) or RULED-KEEP file is removed. No protected path is removed. Nothing appears that was not there.
- The extended glob `!lib/memory/!(feynman-prompts-drift|post-compact-reinjection).test.cjs` works in npm and removes 117 files, keeping the two NEEDED tests.
- Differential run with all 222 paths removed from a scratch install: 0 unstable probes, no difference in hooks (40), MCP tools (75 and 75), read-only calls (8) or doctor points (50).
- Baseline: recommendation KEEP; a MOVE touches package.json, lib/core/eureka-critic.cjs, scripts/eureka-critic-run.cjs, evals/eureka/212-calibration-report.md, two tests and the file, and saves no bytes.

## Owner answer

The owner answered on cards on 2026-11-06 (Fork 1: take the 208 test files and the runner out; Fork 2: keep the doctor lints; baseline stays shipped). The main session instruction was to record token APPROVE in the OWNER-ANSWER line of 388-DECISION.md, with the owner's words quoted, in its own commit. That commit follows the commit of this summary. The card hash line is unchanged by it.

## Deviations from Plan

1. The plan stops at a NEEDS_HUMAN checkpoint. The coordinator already held the owner answer, so Task 2 became the separate answer commit instead of a stop.
2. The two test runners are UNCERTAIN in 388-safe-set.tsv (doctor lints read their text). The owner named the runner in Fork 1. They are in the list through the explicit `--approve` option of probe-patterns, and the card marks them OWNER. The 222-path differential run is the evidence. The owner figure "220 files, about 2.7 MB" counts the SAFE rows only; with the two runners the list is 222 files and 2.86 MB.
3. Drift check at start: HEAD moved and 6 shipped files changed bytes (same path set, none a candidate). The 388-01 baseline files were not regenerated; the probe measures fresh before and after numbers at HEAD 4ec4efdfc.
4. `388-guard.cjs check 03` lists peer-edited files (lib/mcp/stop-gate-handler.cjs and several tests) as outside the phase folder. They are not mine; no product file was touched by this plan. package.json is unchanged.

## Known Stubs

None.

## Self-Check

- `388-measure.cjs selftest` exits 0, including the probe exit-1 cases (non-SAFE removed, SAFE still present, protected removed) and the card cases (edited pattern, edited byte sum).
- `check-decision` exits 0 on the card and exits 1 on a copy with one pattern edited (checked).
- `git diff --quiet HEAD -- package.json` exits 0.
