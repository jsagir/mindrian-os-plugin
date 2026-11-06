---
phase: 388-ship-less-keep-tests-and-dead-weight-out-of-the-install
plan: 01
subsystem: packaging
tags: [npm-pack, payload, measurement, test-files]
requires: []
provides:
  - 388-MEASURE.md (headline numbers, per folder tables, class table, claim verdict)
  - 388-pack-baseline.tsv (before state, 2416 payload files with bytes)
  - 388-candidates.tsv (462 candidate files in classes T1 to T8)
  - 388-guard.cjs (scope guard for plans 388-02 to 388-04)
  - 388-measure.cjs (measure, check, drift, selftest)
affects: [388-02, 388-03, 388-04]
key-files:
  created:
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-guard.cjs
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-measure.cjs
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-MEASURE.md
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-pack-baseline.tsv
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-candidates.tsv
  modified: []
key-decisions:
  - "Claim verdict uses the plan strict set T1+T2+T3 and the plan rule 2.0 to 3.0 MB"
  - "No npm ci was run (offline rule); the per machine tree stays the carried +460M, UNVERIFIED"
duration: 1 session
completed: 2026-11-06
---

# Phase 388 Plan 01: Measure the npm payload Summary

One-line: the npm pack ships 2,416 files, 14,033,242 bytes packed and 46,271,498 bytes unpacked; the strict test set is 253 files and 3,468,442 bytes, so the auditor claim "about 2.5 MB of tests" is REFUTED-HIGHER under the plan rule (the `*.test.*` files alone are 2,742,221 bytes).

## Headline numbers (PROVEN)

- entryCount 2416, size 14033242, unpackedSize 46271498, version 2.0.0-beta.80. Measured at HEAD efab47263 (three shipped files carry uncommitted peer edits, listed in the baseline file). The first run at 2d4c3947b gave 14,030,456 packed and 46,263,781 unpacked; the difference is peer edits. The planner saw 2415 entries at c6c364eb3; a peer commit added one script (41 KB).
- CLAIM-2.5MB-TESTS: REFUTED-HIGHER 3468442 unpacked bytes (T1 251 files 3,310,317 bytes; T2 2 files 158,125; T3 0 files).
- Repo `tests/` folder: 63,202,896 bytes, 2,812 files; none of it ships.
- Built runtime assets that stay: lib/ui-shell/dist 10,583,606; lib/wiki/editor-dist 4,802,390; assets/fonts 893,468.

## Candidate classes (462 files, 5,774,012 bytes, 12.48 percent of unpackedSize)

| Class | Files | Bytes |
|---|---|---|
| T1 test-file | 251 | 3,310,317 |
| T2 test-runner | 2 | 158,125 |
| T3 fixture | 0 | 0 |
| T4 bytecode-cache | 11 | 216,053 |
| T5 doc-in-code | 54 | 202,427 |
| T6 dev-tool-script | 16 | 441,123 |
| T7 unreached-module | 114 | 1,404,118 |
| T8 test-only-module (ruled keep) | 14 | 41,849 |

## Task commits

Both tasks are committed in one commit (the plan commit instruction: one commit, six exact paths). See the git log entry "docs(388-01): measure the npm payload, classify shipped files, record the 2.5 MB claim verdict".

## Deviations from Plan

1. The baseline file has two comment lines (`# head=...`, `# dirty-shipped-paths=...`) above the header row. Reason: `388-measure.cjs check` needs entryCount and the packed size, which cannot be derived from the file list.
2. No `npm ci` leg. The caller rule "offline, no install from the registry" overrides the optional leg of Task 2. The loader section marks the per machine tree ENV GAP, UNVERIFIED, and quotes the carried +460M.
3. One `npm view` call (HTTP 404) probed registry reachability before this rule was applied to the ci leg. Nothing was installed.
4. The planner HEAD c6c364eb3 and the start HEAD differ from the measurement HEAD because peers committed during the run; the payload drift check shows the payload was unchanged between the two measured HEADs.
5. Correction during plan 388-02: the reach scan did not read extensionless hook scripts (scripts/on-stop and similar), so 33 files were listed as T6/T7 that those scripts load. Fixed in 388-measure.cjs, outputs regenerated (495 candidates became 462). See the correction section of 388-MEASURE.md. Follow-up commit: fix(388-01).

## Known Stubs

None.

## Self-Check

- selftests: guard 4 tests pass; measure 4 tests pass including a wrong-expectation mutation that is caught (RED shown first: both scripts were missing).
- `388-measure.cjs check 388-MEASURE.md` passes (166 generated lines verified); a copy with one edited number fails with exit 1.
- Exactly one CLAIM-2.5MB-TESTS line; no protected path in 388-candidates.tsv; `388-guard.cjs check 01` shows no changed path outside the phase folder.
