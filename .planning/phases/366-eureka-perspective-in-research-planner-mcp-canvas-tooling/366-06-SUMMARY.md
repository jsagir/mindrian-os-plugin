---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 06
subsystem: release-gate
tags: [release, lockstep, rule5, canon-snapshot, theo-stamp, suite-gate, d-17]
requires:
  - 366-01 (run-all-366 aggregator with run_if legs for test-366-snapshot-gate.cjs and test-366-suite-gate.cjs)
provides:
  - data/framework-names.json theo_stamp {mapped_by, plugin_version, refreshed_at}, written only by refresh-framework-names.cjs --live
  - scripts/release-lib/canon-snapshot-gate.sh (mos_canon_snapshot_gate plugin_dir dry_run no_check)
  - scripts/release-lib/suite-gate.sh (mos_suite_gate plugin_dir dry_run no_check over RELEASE_GATE_SUITES=(tests/run-all-366.sh))
  - release.sh Step 0.6b (canon snapshot freshness) and Step 0.6c (phase suite gate), flags --no-canon-snapshot-check and --no-suite-check
  - RULE 5 place 9 (canon snapshot freshness) in docs/RELEASE-CEREMONY-RULING-SYSTEM.md
affects:
  - every future release (refuses until the snapshot is stamped against the current version and run-all-366 is green)
  - 366-24 (lists the D-17 leading-edge wiring into the Phase 349 dispatch step as a follow-on)
tech-stack:
  added: []
  patterns:
    - sourced release-lib gate with env seams, PASS / LAGGING / READ FAILURE verdicts, dry-run reports, audited opt-out line (theo-stamp-gate precedent)
    - release.sh previews heavy gates under --dry-run to stay inside doctor's 30s release-dry-run budget
key-files:
  created:
    - scripts/release-lib/canon-snapshot-gate.sh
    - scripts/release-lib/suite-gate.sh
    - tests/test-366-snapshot-gate.cjs
    - tests/test-366-suite-gate.cjs
  modified:
    - scripts/refresh-framework-names.cjs
    - scripts/release.sh
    - docs/RELEASE-CEREMONY-RULING-SYSTEM.md
    - .claude/includes/release-process.md
    - tests/test-349-docs-lockstep.cjs
decisions:
  - "theo_stamp.mapped_by stores Theo's raw mappedBy (command-registry@<version>); the gate compares the part after the last @ (a bare version also works)"
  - "An unreadable mappedBy on --live still writes the names but no stamp and exits 3, so the release gate keeps refusing (fail closed, never an invented stamp)"
  - "runLive dials the default mappedBy reader only on the real wire path; an injected askOp without readMappedBy never stamps and never loads brain-client (keeps test-355 hermetic)"
  - "release.sh previews the suite gate under --dry-run instead of running it: the aggregator takes about 46s and doctor's release-dry-run-output self-test gives release.sh --dry-run 30s"
  - "RULE 5 place 9 is a separate place from place 8 (different artifact); the include gains one pointer sentence with no count"
metrics:
  duration: ~45min
  completed: 2026-10-01
  tasks: 2
  files: 9
---

# Phase 366 Plan 06: Canon snapshot lockstep and release suite gate Summary

The canon snapshot is now RULE 5 place 9. `refresh-framework-names.cjs --live` stamps the snapshot with Theo's mappedBy, an offline LAGGING gate in release.sh refuses a cut when the stamp is missing or names an older version, and release.sh now runs `tests/run-all-366.sh` as a fail-closed phase gate. Each gate has an audited opt-out.

## What was built

- **Theo stamp on the snapshot** (`scripts/refresh-framework-names.cjs`): `--live` reads Theo's command-registry `mappedBy` with the same `callTool('command_neighborhood', {command: '/mos:act'})` call the place-8 gate's default reader makes (no new Theo op, generic handle only, Part 8). It writes `theo_stamp {mapped_by, plugin_version, refreshed_at}`. `validateSnapshot` accepts an absent stamp and requires the three fields to be non-empty strings when the stamp is present. `--check` still passes the committed, unstamped snapshot (410 names, hash verified).
- **Canon snapshot gate** (`scripts/release-lib/canon-snapshot-gate.sh`): `mos_canon_snapshot_gate plugin_dir dry_run no_check` is offline. It has two seams, `MINDRIAN_CANON_SNAPSHOT_PATH` and `MINDRIAN_PLUGIN_VERSION_CMD`. It returns one of three verdicts:
  - PASS.
  - LAGGING: the stamp is missing ("never been stamped" plus the refresh command), or it names an older version (the message names both versions).
  - READ FAILURE: the file is missing, the JSON does not parse, or the stamp is malformed. A READ FAILURE is never reported as LAGGING.
  Under dry-run the gate reports and returns 0. `--no-canon-snapshot-check` prints one audited line. The function contains no `exit`.
- **Suite gate** (`scripts/release-lib/suite-gate.sh`): `RELEASE_GATE_SUITES=(tests/run-all-366.sh)`. `mos_suite_gate` runs each suite with `bash` from the plugin root and prints one PASS or FAIL line per suite, plus the tail of the output when a suite fails. A missing suite fails closed. Under dry-run it reports and returns 0. `--no-suite-check` prints one audited line and runs nothing. `MINDRIAN_RELEASE_SUITES` is the test seam.
- **release.sh**:
  - Both libs are sourced in the preamble with the same missing-file refusal the theo gates use.
  - Step 0.6b and Step 0.6c run right after the theo stamp gate and before Step 1, using the `if ! ...; then ... exit 1; fi` shape with Recovery lines.
  - New defaults `NO_CANON_SNAPSHOT_CHECK=0` and `NO_SUITE_CHECK=0`. Both flags are in the usage block and the case statement, and the header comment documents the two steps.
- **RULE 5 place 9**: canon snapshot freshness. It names `theo_stamp.mapped_by`, the gate, Step 0.6, LAGGING, READ FAILURE, `node scripts/refresh-framework-names.cjs --live`, and the opt-out. It states: "This gate plus that command is the delivered form of D-17's leading edge; the release-to-Theo dispatch step ... does not call it automatically" (navigator ruling 2026-10-01). The single-home rule is kept: `.claude/includes/release-process.md` gains one pointer sentence with no count. `docs/VERSION-BUMP-CHECKLIST.md` still does not exist (WD-14).
- **Tests**:
  - `tests/test-366-snapshot-gate.cjs` (S1-S7, including runLive with injected readers and a check that brain-client is never loaded).
  - `tests/test-366-suite-gate.cjs` (G1-G4 against stub suites, plus static legs over release.sh, including `--help`).
  - `tests/test-349-docs-lockstep.cjs` now pins nine places plus the place 9 tokens.

## Live refresh status

`MOS_366_LIVE` was not set, so `--live` was not run against Theo (Part 8 posture, test fixtures only). The committed `data/framework-names.json` carries no `theo_stamp`. **The next real release will refuse at place 9** ("LAGGING -- data/framework-names.json has never been stamped"). It will keep refusing until someone runs `node scripts/refresh-framework-names.cjs --live` after Theo's re-emit for the current version and commits the snapshot, or passes `--no-canon-snapshot-check`. The gate is working as designed. Confirmed by `bash scripts/release.sh patch --dry-run --no-theo-check`: it printed `[DRY RUN] canon-snapshot-gate: LAGGING ...` and the suite-gate preview line, then exited 0 with no mutation.

## Verification

- `node tests/test-366-snapshot-gate.cjs`: 7 checks passed
- `node tests/test-366-suite-gate.cjs`: 10 checks passed
- `node tests/test-349-docs-lockstep.cjs`: 13 checks passed
- `node tests/test-343-theo-stamp-gate.cjs`: 7 checks passed
- `node tests/test-355-framework-names.cjs`: PASS 64 FAIL 0
- `node scripts/refresh-framework-names.cjs --check`: OK
- `bash -n scripts/release.sh` and `bash -n` on both libs: OK. `grep -c "exit " canon-snapshot-gate.sh` = 0
- Neighbours green: test-349-release-wiring, test-353-release-wiring, test-349-dry-run-never-sends, test-349-contract-doc, test-235-release-shape-gate, test-341-marketplace-npm-source, test-341-release-shrinkwrap-gate, test-release-bump-tag-and-publish-gates, test-139-acceptance, test-339-update-path-single-source
- `LC_ALL=C bash tests/run-all-366.sh`: PASSED=41 FAILED=0 SKIPPED=24 KNOWN=1

## Commits

- 8a72eed9e test(366-06): add failing canon snapshot gate arms S1-S7
- 4366cd4a4 feat(366-06): theo_stamp on the canon snapshot and the offline canon snapshot gate
- 3f1c4d01e test(366-06): add failing suite gate arms G1-G4 and move the RULE 5 pins to nine places
- 6d4053e09 feat(366-06): suite gate, release.sh wiring and RULE 5 place 9 canon snapshot freshness
- cd8cc0485 fix(366-06): build the dash fence regex from char codes so the suite gate test passes the phase dash fence

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] release.sh previews the suite gate under --dry-run instead of running it**
- **Found during:** Task 2
- **Issue:** `tests/run-all-366.sh` takes about 46s. `scripts/doctor.cjs`'s `release-dry-run-output` self-test shells `release.sh patch --dry-run` with a 30s timeout (RULE 4). Running the aggregator under --dry-run would have made the doctor acceptance roll-up fail on every run.
- **Fix:** under `DRY_RUN=1` (and no `--no-suite-check`), release.sh prints `[DRY RUN] suite-gate: would run tests/run-all-366.sh ...` and does not execute it. A real release runs it fail closed. The function's own dry-run arm (report, return 0) is kept and tested (G3). A static leg in test-366-suite-gate pins the preview branch.
- **Files modified:** scripts/release.sh, tests/test-366-suite-gate.cjs
- **Commit:** 6d4053e09

**2. [Rule 1 - Bug] Literal dash characters in the suite gate test's dash check**
- **Found during:** final aggregator run
- **Issue:** the regex in the hyphens-only static leg was written with literal en and em dash characters, so the phase dash fence flagged the test file itself.
- **Fix:** build the character class from `String.fromCharCode`.
- **Commit:** cd8cc0485

**3. [Rule 2 - Correctness] runLive never invents a stamp and never dials Theo under injection**
- When mappedBy is unreadable, `--live` writes the names without a stamp and exits 3, naming theo_stamp. When a test injects askOp without readMappedBy, runLive skips stamping and keeps brain-client unloaded, so test-355 stays hermetic. Both cases are tested in S7.

### Deferred (pre-existing, logged to deferred-items.md)
- `tests/test-310-release-step55-wiring.cjs` (`DRY_RUN: unbound variable` in its Step 5.6 driver) and `tests/test-release-bump-algebra.cjs` (legs F, H, I against retired release shapes) fail on the base commit's release.sh as well. Neither is in run-all-366.

## Threat Flags

None. The only new surface is the `--live` mappedBy read, which reuses the existing place-8 Theo call with a generic command handle (T-366-23 accepted).

## Self-Check: PASSED
