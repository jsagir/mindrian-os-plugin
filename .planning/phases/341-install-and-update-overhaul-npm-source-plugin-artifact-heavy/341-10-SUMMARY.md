---
phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy
plan: 10
subsystem: doctor-retirement-and-closeout
status: partial-by-audit-with-waiver-dependency
tags: [doctor, class-i, class-j, topology, tripwire, closeout, waiver]
requirements: [D-13]
canon_parts: [6, 7, 8, 11]
requires:
  - phase: 341-09
    provides: classes A and H retired, 16-arm tripwire
provides:
  - "audit result: the legacy-topology halves of classes I and J are still reachable, so none was removed"
  - "tests/test-341-retired-topology-halves.cjs: 15-arm tripwire that pins the audit result"
  - "docs/install/INSTALL-OVERHAUL-341.md: tracked phase close-out"
  - "docs/OPEN-HANDOFFS.md: one dated entry"
key-files:
  created:
    - tests/test-341-retired-topology-halves.cjs
    - docs/install/INSTALL-OVERHAUL-341.md
  modified:
    - docs/OPEN-HANDOFFS.md
completed: 2026-10-29
---

# Phase 341 Plan 10: Topology-half audit and phase close-out Summary

The audit found every legacy-topology half of doctor class I still reachable, so none was retired; a 15-arm tripwire pins that finding, and a tracked close-out plus an OPEN-HANDOFFS entry carry the phase record, with the cold-install waiver and six open items stated in plain words.

## Waiver note (read first)

Cold install proof WAIVED by the navigator, not observed on Windows or macOS. The navigator typed the waiver on 2026-10-28 (PROVEN, verbatim: "i pprove imagisn that we did theis and it a go !"). The cold install is proven on no platform of this version. The close-out and the handoff entry say this.

## Commits

| Task | Commit | Result |
|------|--------|--------|
| 1. Trim legacy-topology halves | none | No code change. Audit showed every half reachable. See below. |
| 2. Tripwire | 2e9ac403c | `tests/test-341-retired-topology-halves.cjs`, 15 arms, PASS=15 FAIL=0 |
| 3. Close-out and handoff entry | e7a042c55 | `docs/install/INSTALL-OVERHAUL-341.md`, `docs/OPEN-HANDOFFS.md` |

Each commit carries `Co-Authored-By:` only. No `Claude-Session:` value was available to this executor (same as 341-07 to 341-09).

## Task 1: the audit (no code change, deviation from plan)

The plan said to retire a half only when its failure mode cannot happen, and to keep it otherwise. Result for each half:

| Half | Verdict | Evidence |
|------|---------|----------|
| `legacy` topology value (class I) | KEPT, reachable | PROVEN: on a temp HOME holding only `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json` (version = repo version), `doctor --install-state --json` reports `topology: legacy`. `lib/core/active-plugin-root.cjs` (`fromLegacyClone`, `classifyTopology`) still produces it. That file is outside the plan's file list. |
| Legacy clone beside a marketplace cache, migration candidate | KEPT, reachable and needed | PROVEN: temp HOME with legacy directory plus a cache gives a recoverable `topology` finding "migration candidate" (tripwire arm 12). This finding is the only doctor path to `scripts/migrate-legacy-install-location.cjs`. Removing it would leave the migrator with no caller. The plan's claim that the `--fix` spawn alone keeps the machine handled is wrong, because the fix runs only for a recoverable finding. |
| F11 `legacy-config-pin-drift`, `readLegacyConfigPin` | KEPT, plan's proof does not hold | PROVEN: `git show d9027f153~1:install.sh` has no reference to `config.json`. `~/.claude/plugins/config.json` is a file of the platform's old plugin system (per the `shared.cjs` comments; the comment is ASSUMED to be accurate about origin), so the retired installer did not write it. |
| `checkInstallVersion` legacy fall-through | KEPT, reachable | PROVEN: tripwire arm 8 returns the legacy directory version on a legacy-only temp HOME. The engine reads the running version through it (`scripts/doctor.cjs` around line 2805). On an old fixture version the engine returns no checks at all. |
| Class J legacy branch | Nothing to retire | PROVEN: `grep -n -i legacy lib/core/doctor/deployment-surfaces-module.cjs` has no hit. Class J never had a legacy branch. |
| Surfaces scoped `legacy` | Nothing to retire | PROVEN census before and after: `{ all: 5, dev-clone: 1 }`, total 6, zero `legacy`. `data/deployment-surfaces.json` unchanged. |
| `INSTALL_DIR` in `shared.cjs` | KEPT | Consumers outside the migrator: `shared.cjs` `checkInstallVersion` (lines 140, 145, 165) and `INSTALL_PLUGIN_JSON`. The plan said move it only if the migrator is the sole consumer. It is not. |
| `isLegacyDevClone`, `legacyDirtyOrUnpushed` | KEPT, not renamed | Still guard the class I `--fix` path. |
| `dev-clone` | KEPT | Live in both modules; `topology_scope: dev-clone` surface count 1 before and after. |

`'legacy'` grep, before and after (identical, no edit made): `lib/core/doctor/shared.cjs:42` (comment), `lib/core/doctor/install-state-module.cjs:128` (`topology === 'legacy'`), `:335` (the fix selector). Other hits in `scripts/` are unrelated (`compute-hsi.py`, `intent-classifier.cjs`). Each remaining hit is justified by the table above.

Dev-box topology: with `MINDRIAN_OS_ROOT` pinned at this repo, `doctor --install-state --json` on a temp HOME reports `dev-clone` (tripwire arm 13, PROVEN). A bare temp HOME reports `not-found`.

Files NOT changed: `lib/core/doctor/install-state-module.cjs`, `deployment-surfaces-module.cjs`, `shared.cjs`, `data/deployment-surfaces.json`, `data/doctor-modules.json`, `commands/doctor.md`. The registry descriptions still say "legacy-config-pin" and "legacy-clone"; they stay true. The acceptance criteria that demand `grep -c "legacy-clone" data/doctor-modules.json` be 0 are NOT met on purpose.

## Task 2: tripwire

`node tests/test-341-retired-topology-halves.cjs`: PASS=15 FAIL=0 (PROVEN). The plan had ten arms. This file has 15: 3 already-true retirement arms, 4 kept-half arms, then 8 more (kept and behavioral). Its header says plainly that it freezes an audit result, not a retirement.

Surviving-half demonstration (PROVEN, in a `git archive HEAD` copy under the scratchpad with a symlinked `node_modules`; deleted afterward; the real tree was not modified):

| Scratch change | Result |
|----------------|--------|
| none | PASS=15 FAIL=0 |
| `scripts/migrate-legacy-install-location.cjs` renamed away | arms 10 and 14 FAIL, PASS=13 |
| `topology === 'legacy'` renamed in the class I module | arm 4 FAILS, PASS=14 |

Zero network: the grep for URLs, `api.github`, `npm view`, `npm publish` in the test returns 0. Dash scan: 0.

## Task 3: close-out

`docs/install/INSTALL-OVERHAUL-341.md` is tracked (committed e7a042c55). It has the six sections the plan lists plus an "Open items" section. Numbers and sources:

| Number | Source |
|--------|--------|
| 755 MB full clone of `v2.0.0-beta.29` | `341-FINDINGS.md` line 16 |
| 738 MB, 16,597 files shallow checkout | `341-FINDINGS.md` line 15 |
| 410.3 MB, 8,880 files `node_modules` in the tag | `341-FINDINGS.md` line 30 |
| 392.6 MB of 441 MB (local install, NOT of the 410.3 MB) | `341-RESEARCH.md` line 68; corrects the plan wording, as 341-07 did |
| 1,829 to 1,831 entries, 29,101,156 to 29,114,166 bytes, 8,936,433 to 8,942,158 packed | `341-04-SUMMARY.md` |
| 1,833 entries, 29,126,083 bytes | `341-05-SUMMARY.md` |
| 20,000 entries and 268,435,456 bytes | `341-RESEARCH.md` F-4 (`Ce = 20000`, `Te = 268435456`); `341-FINDINGS.md` lines 77 to 80 for the documented 256 MiB. F-4: the platform does not enforce it on the npm path. |

"Shipped" line: it says dev repo only, not live until a release carries it. The packaging cut (plans 01 to 05) is in v2.0.0-beta.31 per `CHANGELOG.md` line 747. Plans 06 to 10 are in no release (tags end at beta.75 and this branch is not merged; UNVERIFIED which branch each tag sits on).

The six open items the navigator required are all present: Windows and macOS cold-install runs; the legacy-clone migrator gap with the dangling symlinks; the brain-shim stdin-EOF defect; nothing displays `surface` and `surface_reason`; the three red legs; the 341-09 deferred items. The wording "cold install proof WAIVED by the navigator, not observed on Windows or macOS" is in both the close-out and the handoff entry. The word PROVEN is absent from the close-out.

Decision coverage: all 13 ids plus D-07a, D-07b and the folded registry-drift todo are present with a plan and a test. D-05 has no test (unbuilt by design, stated). D-13 step 5 is stated as partly done.

Tracked docs scan: `tests/test-341-install-sh-retired.cjs` scans `docs/install/` and turned RED on the first draft of the close-out (it named the deleted installer file). The close-out was reworded; the test is PASS=7 FAIL=0. See Deviations.

Room-side research trail (Dev-Research Compositing): NOT written. See Deviations and Deferred.

## Verification (temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME in the scratchpad)

| Check | Result |
|-------|--------|
| `bash tests/run-all-341.sh` | PASS=32 FAIL=3 SKIP=0 EXPECTED-RED=0 (PROVEN, second run after the close-out reword). The `retired-topology-halves` leg PASSES (it was SKIPPED). The 3 FAIL legs are exactly `341: run-all-310.sh` (inner legs 3 and 9), `341: version-of-record-source-version`, `341: step-block tripwire`. They are the 3 known reds. No new red remains. |
| First run of the same suite | PASS=31 FAIL=4. The extra FAIL was `341: install-sh-retired`, caused by my first draft of the close-out. Fixed before the second run. |
| `tests/test-doctor-module-contract-parity.cjs`, `test-doctor-doc-parity.cjs`, `test-341-legacy-install-teardown.cjs`, `test-doctor-class-i.cjs`, `test-doctor-class-j.cjs` | all exit 0 (PROVEN) |
| `build-harness-manifest --check`, `check-release-payload-ceiling --check`, `check-shape-declaration --check`, `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage`, `run-harness --check`, `run-harness --tier pre-tag` | all exit 0 (PROVEN) |
| `migrate-legacy-install-location --dry-run --json` | exit 0, `already-clean` (arm 14, PROVEN) |
| `doctor --acceptance --pre-tag` | the `mcp-surface-tool-count` point PASSES in 15415 ms. The overall exit code was not captured (UNVERIFIED). |
| MCP tool counts | `git diff --name-only HEAD~2 HEAD` names three files: the new test and two docs. No MCP file, no tool description changed. mindrian-os=75 and mindrian-brain=6 stay as 341-09 recorded (PROVEN by the diff; the live count was not re-read as a number in this run). |
| Dash scan | 0 U+2013 or U+2014 in the three files written or changed here (PROVEN) |

Not run: `doctor --acceptance` full tier (it makes the `npm view` network call, and this task forbids network), `bash tests/run-all-310.sh` as a separate command (it ran inside run-all-341: 310 legs 3 and 9 fail, both known), and `doctor --acceptance --pre-flight`.

## Deviations from Plan

1. [Rule 4 avoided, safety rule] Task 1 made no code change. The plan's premise that the legacy halves are unreachable does not hold (table above). The standing safety rule says to keep a reachable half and say so. Registry descriptions, `commands/doctor.md`, the modules and `shared.cjs` stay as they were.
2. The tripwire has 15 arms, not 10, and several arms assert that things survive instead of being retired. Arm 3 asserts 29 registry entries (the plan says 21; 341-09 already corrected the count).
3. The plan acceptance "`run-all-341.sh` FAIL=0 and EXPECTED-RED=0 and zero SKIP" is NOT met: FAIL=3. The three reds are known and were not hidden, skipped, renamed or repinned.
4. [Rule 1] The close-out first named the deleted installer file and turned `test-341-install-sh-retired.cjs` RED. Reworded; green.
5. The room-side research trail was not written. Reasons: the task goal did not authorize writes under `~/MindrianRooms/` or `mindrianOS/research/` (outside the repo), earlier phases note a room write-scope hook, and this run must not touch the real home.
6. `Claude-Session:` trailer omitted (no value available).
7. The plan names `CHANGELOG.md` neither in `files_modified` nor in tasks. Not edited. No release is cut and no version is bumped.

## Deferred Issues

| Item | Evidence |
|------|----------|
| Room-side trail to `~/MindrianRooms/rethinking-mindrianos/research/<dated>/` plus the `mindrianOS/research/` mirror | Not written. Needs navigator authorization for the write scope. |
| Retire the legacy-topology halves | Only after the producers are gone: the resolver's legacy path, the platform `config.json`. Then edit the tripwire in the same commit. |
| Registry description wording | Still names "legacy-clone" and "legacy-config-pin". Correct while the halves stay. |
| Repin of the 3 known reds | Separate quick, as the navigator said. |
| Legacy-clone migrator gap (belt refuses the target clone; dangling symlinks) | Navigator decision on `isLegacyDevClone`. |
| All items in `deferred-items.md` (341-09) | The last row (plan 341-10 owns the legacy halves) is now answered: audited and kept. |

## Known Stubs

None.

## Threat Flags

None new. T-341-35 (retiring classification and teardown together): mitigated, in fact stronger than planned, because the classification was kept and arm 10 plus arm 14 fail without the migrator (demonstrated). T-341-36 (collateral removal of dev-clone): arm 7 and arm 13. T-341-34: no code changed, so no parity gate moved. T-341-37: the close-out carries paths, counts and versions only; `grep -Eic 'gary|laben'` returns 0. T-341-38: the close-out and the handoff entry are tracked; the room-side half is deferred.

## Self-Check: PASSED

- Files exist: `tests/test-341-retired-topology-halves.cjs`, `docs/install/INSTALL-OVERHAUL-341.md` (FOUND, tracked).
- Commits exist: 2e9ac403c, e7a042c55 (FOUND in `git log`).
- Failing set of `run-all-341.sh` equals the 3 known reds; no new red.
