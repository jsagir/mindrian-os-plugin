---
phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy
plan: 09
subsystem: doctor-retirement
status: complete-with-waiver-dependency
tags: [doctor, retirement, class-a, class-h, tripwire, waiver]
requirements: [D-13]
canon_parts: [7, 8, 11]
requires:
  - phase: 341-07
    provides: install.sh deleted, one install location, legacy-directory migrator
  - phase: 341-08
    provides: session-start verification tier, doctor --only flag
provides:
  - "doctor class H (install-incomplete) retired: module, registry entry, tests, docs"
  - "doctor class A (legacy install versus marketplace cache drift, with swap recovery) retired: check, recovery, renderer, report keys, preflight banner, docs, tests"
  - "tests/test-341-retired-classes-a-h.cjs: 16-arm tripwire, retired half plus surviving half plus behavioral half"
key-files:
  created:
    - tests/test-341-retired-classes-a-h.cjs
    - tests/test-doctor-class-g-effective-command.cjs
  modified:
    - scripts/doctor.cjs
    - scripts/preflight-doctor.cjs
    - scripts/check-onboard-statusline.cjs
    - lib/core/doctor/shared.cjs
    - data/doctor-modules.json
    - data/command-registry.json
    - data/layer-backfill.json
    - data/harness-manifest.json
    - commands/doctor.md
    - skills/doctor/SKILL.md
    - lib/memory/run-feynman-tests.cjs
    - tests/run-all-126.sh
    - tests/run-all-217.sh
    - tests/run-all-956.sh
    - tests/test-doctor-doc-parity.cjs
    - tests/test-doctor-fix-renderer.cjs
    - tests/test-statusline-visibility-self-heal.cjs
  deleted:
    - lib/core/doctor/install-incomplete-module.cjs
    - scripts/doctor-preflight-format.cjs
    - scripts/test-doctor-recovery.cjs
    - tests/test-doctor-class-h.cjs
    - tests/test-doctor-class-h-fix.cjs
    - tests/test-doctor-class-h-topology-blind.cjs
    - tests/test-install-receipt.cjs
    - tests/test-doctor-class-a-vestigial-legacy.cjs
    - tests/test-doctor-class-a-topology-drift.cjs
    - tests/test-doctor-atomic-swap.cjs
    - tests/test-marketplace-cache-prerelease-pick.cjs
    - tests/test-doctor-preflight-format.cjs
    - tests/test-session-start-preflight.sh
completed: 2026-10-29
---

# Phase 341 Plan 09: Retire doctor classes A and H Summary

Doctor class H (the shell-installer receipt check) and class A (the legacy-install versus marketplace-cache drift check with its rename-and-copy recovery) are removed from every surface in two commits, and a 16-arm tripwire pins both what left and what must stay.

## Waiver note (read first)

Cold install proof WAIVED by the navigator, not observed. The navigator typed the waiver on 2026-10-28 (PROVEN, verbatim: "i pprove imagisn that we did theis and it a go !"). The cold install is proven on no platform of this version. The plan action step b ("loader swap on all three platforms") is waived by that ruling. This summary does NOT claim a loader swap was observed on any platform. "Unreachable" below rests only on code and tests run on temp HOME trees: no producer of the artifact remains, and no code path creates the state.

## Commits

| Step | Commit | Result |
|------|--------|--------|
| Pre-step: document `--session-start` and `--only` | ae7c76b09 | `test-doctor-doc-parity.cjs` was RED at HEAD (flags parsed, not documented, left by 341-08). Fixed first so the retirement commits show a green gate. |
| Task 1: retire class H | 85b5072f7 | 16 files, 198 insertions, 1061 deletions. |
| Task 2: retire class A | a768bbd85 | 20 files. |
| Task 3: tripwire | 0bb723ab6 | `tests/test-341-retired-classes-a-h.cjs`, 16 arms. |

## Task 1 evidence: class H

### No remaining writer of `.install-receipt.json` (PROVEN)

The plan's grep, run after the change:

```
grep -rn "install-receipt" --include=*.cjs --include=*.sh --include=*.md --include=*.json . | grep -v '^\./\.planning' | grep -v '^\./node_modules' | grep -v '^\./\.claude/worktrees'
```

Result: no code line. The hits are `CHANGELOG.md` (history), `lib/core/stale-copy-scanner.cjs:41` (a comment), the two `dist/` skill snapshots (generated, see RISKS), and the new tripwire, run-all comments and a test comment. `git ls-files install.sh` prints 0 and `git log -1 -- install.sh` is `d9027f153 feat(341-07): retire install.sh`. The only writer was `install.sh`. Before the change, the readers were `install-incomplete-module.cjs`, three class H suites and `test-install-receipt.cjs`.

### Capability coverage: class H versus class G (PROVEN by reading both modules and the manifest)

| Class H capability | Covered by class G | Decision |
|--------------------|--------------------|----------|
| Receipt tail check (`.install-receipt.json` steps) | no | Input has no producer. Dropped. |
| Warn when `~/.claude/settings.json` has no `statusLine` block | no | Dropped on purpose. Under marketplace-cache topology class H already returned ok. The plugin's own `settings.json` carries `statusLine` with `${CLAUDE_PLUGIN_ROOT}`, and class G Step 2 checks that it resolves. |
| `--fix` writes a user-level `statusLine` override at the legacy install path | no | Dropped on purpose. The path is `INSTALL_DIR`, which `install.sh` created and which no longer exists. Class G Step 3 says this exact write "broke the statusline" (RCA intern-w1-statusline-room-mismatch). Moving it into class G would ship a defect as a capability. |
| Stale user-level `statusLine` path detection and removal | yes (class G check 1, its `--fix`) | Stays in class G. |
| Plugin `statusLine.command` resolves, `statusline-mos` runs, `disableAllHooks` | yes (class G checks 2 to 4) | Stays in class G. |
| User-level statusline reconciliation on version change | `data/deployment-surfaces.json` entries `statusline-dispatch-shim` and `settings-statusline-command` (class J, owner session-start) | Covered elsewhere. |

The plan said to move any uncovered capability into class G. Two uncovered items exist. Both are deliberately NOT moved, for the reasons in the table. This is a plan deviation, recorded below. It is ASSUMED, not run, that Claude Code honors `statusLine` in a plugin-root `settings.json`; class G Step 2 and the pre-existing RCA record assume it.

### A real consumer found beyond the plan (Rule 1)

`scripts/check-onboard-statusline.cjs::attemptStatuslineSelfHeal` (the first-session statusline self-heal) reported success only when BOTH `statusline-visibility` and `install-incomplete` re-checked ok. With class H gone the second term is always false, so the self-heal could never report "repaired". It now keys on class G alone. `tests/test-statusline-visibility-self-heal.cjs` drops the class H key from its stub and passes.

### Registry count

Before: 30 entries. After: 29. The plan text says 22 to 21; that number is stale (the registry grew in earlier phases). The tripwire asserts 29 from the parsed array. `tests/test-353-doctor-section-ruling.cjs` pins 28 and was RED before this plan (30 is not 28) and stays RED (29 is not 28); see Deferred.

### Shared symbols (class H)

`CLASS_H_CANONICAL_STEPS` and `classHActionString` were local to the deleted module; they were never in `shared.cjs`. Zero consumers remain (tripwire arm 3).

## Task 2 evidence: class A

### Unreachability proofs

(a) Plan 341-07 retired the second location and ships `scripts/migrate-legacy-install-location.cjs` (PROVEN):

```
$ git ls-files install.sh | wc -l
0
$ ls scripts/migrate-legacy-install-location.cjs
scripts/migrate-legacy-install-location.cjs
```

(b) WAIVED, not observed. `docs/install/COLD-INSTALL-PROOF-341.md` records `Status: WAIVED by the navigator, not observed`. It shows the loader swap on NO platform. The retirement is therefore NOT defended by a loader swap. It is defended by what (c) and the behavioral arms show: after this change nothing writes the legacy directory.

(c) Every code path that names the legacy directory, after the change (PROVEN, `grep` over lib, scripts, bin, hooks):

```
lib/core/doctor/install-state-module.cjs:142,337   class I (legacy-topology half, plan 341-10)
lib/core/active-plugin-root.cjs:115,136            resolver: classifies a legacy dir, never creates one
lib/core/doctor/shared.cjs:46                      INSTALL_DIR constant (class I, class J, checkInstallVersion)
scripts/migrate-legacy-install-location.cjs        the 341-07 migrator (removes, never creates)
scripts/statusline-mos-dispatch:109                read-only candidate path
```

No consumer outside classes I and J, the resolver, the migrator and one read-only statusline probe. The STOP condition in the plan did not trip. The only code that CREATED the directory (`performRecoveryAtomic`: copy to `mindrian-os.new`, rename the legacy directory to `mindrian-os.stale-*`, rename `.new` into place) is the code this task deleted.

Behavioral proof on temp HOMEs (tripwire arms 13 and 14, PROVEN): with a stale legacy directory and a newer cache, `doctor --fix` leaves the legacy tree hash identical and creates no `.new` or `.stale-*` sibling. With no legacy directory and a populated cache under a non-cache topology, `doctor --fix` does not create it.

Negative control (PROVEN): the same arms 11 to 14 run against the pre-retirement doctor (`git archive` of ae7c76b09) FAIL: `doctor --json` exits 3, `--fix` exits 2 (the old recovery ran), and the class H row is still reported.

### What state can still exist (honest limit)

The retirement removes the CAUSE and the REPAIR, not every instance of the state. A user machine can still hold an old `~/.claude/plugins/mindrian-os` directory, possibly stale (this box does: 341-07 saw it and this plan did not touch it). Nothing keeps it current and nothing recreates it. Class I (`--install-state`) reports it and `--install-state --fix` backs it up, verifies and removes it through the 341-07 migrator. `commands/doctor.md` now has a "Retired classes" note that says this in plain words. A user who still LOADS the plugin from the legacy directory (resolver topology `legacy`, still classifiable) loses the old swap-to-latest repair and relies on class I; plan 341-10 owns the legacy-topology halves.

### What was removed

Check, atomic-swap recovery and `safeRename`, the renderer branch, both generic-loop carve-outs, the Bug 7 reinterpretation, the report keys `install`, `cache`, `drift`, `classARecovered`, `recoveryError`, `recoverySkipped`, bare-run exit codes 2, 3 and 4, help text, the class inventory line, the "class-A install-cache check" section, the three Example output sections for class A (rewritten for the generic render), and the carve-out count (three became two).

`data/doctor-modules.json` was NOT changed by Task 2: class A was never a registry module (PROVEN by reading the registry).

### `--drift` survived

`node scripts/doctor.cjs --drift --json` exits 0 on a temp HOME (PROVEN). `--drift` is the class P/Q/R flag; it never depended on class A except through the exit-0 invariant comment, which was reworded.

### Shared symbols (class A)

| Symbol | Fate | Reason |
|--------|------|--------|
| `checkMarketplaceCache` | removed | Only class A and the deleted prerelease-pick test used it. |
| `checkInstallVersion` | KEPT | The accumulative engine reads the running version through it (`doctor.cjs`, engine section). Its legacy-directory fall-through is for plan 341-10. |
| `checkDevSourceConsistency`, `report.dev` | KEPT | A separate `dev-source` row, not class A. |
| `INSTALL_DIR`, `resolveActivePluginRoot` | KEPT | Class I, class J and the resolver. |
| `MARKETPLACE_CACHE_DIR`, `parseVersion`, `cmpVersion` | still exported by `shared.cjs` | Dropped from the `doctor.cjs` import because it no longer uses them. |

### Consumers found beyond the plan (Rule 1 and Rule 3)

| Consumer | Action |
|----------|--------|
| `scripts/preflight-doctor.cjs` (SessionStart `install-drift` slot) | Its banner "install dir missing or drifted; run /mos:doctor --fix" read class A's `drift` and `install` keys. Banner removed. The release-drift sentence and the Phase 233 graph re-derive nudge stay on the frozen slot. The pointer for the release-drift-only case no longer says "install drifted". |
| `scripts/doctor-preflight-format.cjs` | Deleted (only the banner used it). |
| `scripts/test-doctor-recovery.cjs` | Deleted (drove the recovery). |
| `lib/memory/run-feynman-tests.cjs`, `tests/run-all-126.sh`, `run-all-217.sh`, `run-all-956.sh` | Suite lists updated. |
| `tests/test-doctor-doc-parity.cjs` | `ID_TO_CLASS` lost H; the derived fix set no longer seeds A. |
| `data/command-registry.json`, `data/layer-backfill.json`, `data/harness-manifest.json` | Regenerated or edited because the doctor frontmatter wording changed (the pre-commit hook caught the manifest digest). `layer-backfill --check` is back at its 4 pre-existing offenders, not 5. |

## Fate of the test suites

| Suite | Decision |
|-------|----------|
| `test-doctor-class-a-vestigial-legacy.cjs` | DELETED. Every arm drove the retired recovery or the `recoverySkipped` field. Its coexistence fixture is now tripwire arm 13, rewritten to assert the legacy tree is untouched. |
| `test-doctor-class-a-topology-drift.cjs` | DELETED. Every arm asserted `report.drift` or the banner. Its "absent legacy plus cache" shape is now tripwire arm 14. |
| `test-doctor-class-h.cjs`, `test-doctor-class-h-fix.cjs`, `test-install-receipt.cjs` | DELETED. Class H only. |
| `test-doctor-class-h-topology-blind.cjs` | KEPT in part as `test-doctor-class-g-effective-command.cjs`: arms h.1 to h.3 (class H) removed, arm h.4 (class G Step 3 tests the EFFECTIVE user-level command) kept as g.1. |
| `test-doctor-atomic-swap.cjs`, `test-marketplace-cache-prerelease-pick.cjs`, `test-doctor-preflight-format.cjs`, `test-session-start-preflight.sh` | DELETED. Class A recovery, cache pick and banner only. |
| `test-doctor-fix-renderer.cjs` | REWRITTEN. Tests 1 to 7 (class A recovery render) removed; the generic renderer arms stay, plus a new arm proving a report with no class A keys renders and counts correctly. 6 of 6 pass. |

Neither class A suite was left passing vacuously.

## Task 3: tripwire and the surviving-half demonstration

`node tests/test-341-retired-classes-a-h.cjs`: PASS=16 FAIL=0 (PROVEN). Arms: 1 to 6b retired (module, registry count 29, helper symbols, class A identifiers, doc, receipt references, producers), 7 to 10 surviving (class G, class I and J, `resolveActivePluginRoot` and friends, the two acceptance point ids), 11 to 14 behavioral, 15 dash scan. The plan said twelve arms; the extra arms cover the kept `install-cache` forms, the producers, the legacy tree and the dash scan.

Surviving-half demonstration (PROVEN): in a scratch copy of the tree under the scratchpad, `lib/core/doctor/statusline-visibility-module.cjs` was renamed. The tripwire then reported `FAIL 7 class G module survives...` and `FAIL 12 ...` (PASS=14 FAIL=2). The scratch copy was deleted. The real tree was never modified for this.

The `bash tests/run-all-341.sh` leg `341: retired-classes-a-h` now PASSES (it was SKIPPED).

## Verification (temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME in the scratchpad)

| Check | Result |
|-------|--------|
| `tests/test-doctor-module-contract-parity.cjs` | exit 0 (PROVEN) |
| `tests/test-doctor-doc-parity.cjs` | exit 0, after the pre-step (PROVEN) |
| `doctor.cjs --json`, `--fix --json`, `--statusline-visibility --json`, `--drift --json` | all exit 0, valid JSON (PROVEN) |
| MCP tool counts | `mindrian-os=75 tools, mindrian-brain=6 tools` printed by the `mcp-surface` row (PROVEN). `git diff --name-only` since the first commit names no MCP file, so tool descriptions and schema drift are untouched (PROVEN). |
| `bash tests/run-all-341.sh` | PASS=31 FAIL=3 SKIP=1 EXPECTED-RED=0. The 3 FAILs are exactly `341: run-all-310.sh`, `341: version-of-record-source-version`, `341: step-block tripwire`. NO NEW RED (PROVEN). The 1 SKIP is `retired-topology-halves` (plan 341-10). Inside run-all-310, legs 3 (step-block hashes) and 9 (the `scripts/__pycache__/compute-hsi.cpython-312.pyc` change from another executor) fail; neither comes from this plan. |
| `bash tests/run-all-217.sh` | PASS=13 FAIL=2. The same 2 FAILs (class B, class E) occur on a `git archive` of HEAD before the retirement (PROVEN). PASS fell from 15 to 13 because two class H legs were removed. |
| `build-command-registry --check`, `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage`, `build-skill-mirrors --check` | all OK (PROVEN) |
| `tests/test-344-surface-layer-parity.cjs` | PASS=9 FAIL=0 (PROVEN) |
| Dash scan | 0 U+2013 or U+2014 in the added lines of the diff and in every touched file (PROVEN) |

## Deviations from Plan

1. [Rule 3 - Blocking] `test-doctor-doc-parity.cjs` was RED at HEAD because plan 341-08 added `--session-start` and `--only=` without documenting them. Fixed first in ae7c76b09. The plan requires this gate green.
2. [Rule 1 - Bug] `scripts/check-onboard-statusline.cjs` required class H ok for its self-heal to report success (see above). Fixed in the Task 1 commit.
3. [Rule 2/3 - Blocking] The plan lists a short `files_modified`. Retiring class A also required `scripts/preflight-doctor.cjs`, `scripts/doctor-preflight-format.cjs`, `scripts/test-doctor-recovery.cjs`, seven more test files, three run-all scripts, `lib/memory/run-feynman-tests.cjs`, `skills/doctor/SKILL.md` (mirror), and three generated data files.
4. The plan acceptance `grep -c 'install-cache' scripts/doctor.cjs` returns 0 is not met literally. Five lines remain: the autopsy filename citation (the plan asks to keep it) and the `--report-registration-bug` cause (a), which compares `installed_plugins.json` with the newest cache. That cause is a live, separate check pinned by `tests/test-doctor-report-registration-bug.cjs`. The tripwire bans every quoted `'install-cache'` check name and every other `install-cache` text. `commands/doctor.md` keeps two such mentions for the same reason (acceptance said 0).
5. The plan says registry 22 to 21 and a retired-class doc count; the real counts are 30 to 29.
6. Two class H capabilities were not moved into class G (see the coverage table).
7. The cold install proof the plan action step b asks for was waived by the navigator and not observed.
8. `Claude-Session:` trailer omitted from commits: no session value was available to this executor (same as 341-07 and 341-08). Each commit carries `Co-Authored-By:`.
9. The plan said `checkInstallVersion` may go if it has no consumer. It has one (the engine), so it stays.

## Deferred Issues (out of scope, not fixed)

| Item | Evidence |
|------|----------|
| `tests/test-353-doctor-section-ruling.cjs` pins 28 registry modules | RED before this plan (30 modules). Now 29. |
| `tests/test-369.26-registry-sync.cjs` 2 arms RED | The mod asset copies of `command-registry.json` and `framework-names.json` differ from `data/`. Same 2 arms RED before this plan (6 passed, 2 failed on both). Fix is `node ui/mindrian-workspace-mod/scripts/sync-assets.cjs`, not run here. |
| `tests/test-92-rename-no-long-leaves.cjs` RED | RED on the HEAD archive too. |
| `tests/test-233-graph-derive-heal-retrofit.cjs` scenario 8 RED in the real tree | It expects an empty fragment, but `preflight-release-drift` returns a message on this repo (local plugin.json is behind origin). Independent of this plan; it passes on a git-less archive. |
| `tests/test-doctor-acceptance-preflight-checks.cjs` Test 6 RED in the real tree | It runs the live-workspace acceptance, which fails `verify-release-clean-tree` because the tree has uncommitted files from other executors. It passes on the git-less archive. UNVERIFIED on a clean tree. |
| `scripts/backfill-layer.cjs --check` 4 offenders, `tests/run-all-956.sh` `test-release-npm-gate.sh` | Pre-existing, not touched. |

## Known Stubs

None.

## Threat Flags

None new. This plan deletes a destructive repair path (T-341-05 accepted: rename of a user directory) and adds no new surface. T-341-31 (retiring a check whose mode is still reachable): the receipt writer is gone and the legacy-directory writer is gone, with the residual state named above. T-341-32 (capability regression disguised as cleanup): coverage table and the self-heal fix. T-341-33: tripwire surviving arms 7 to 10, demonstrated to fail. T-341-34: each class landed in one commit with both parity gates green at each commit.

## Self-Check: PASSED

- Created files exist: `tests/test-341-retired-classes-a-h.cjs`, `tests/test-doctor-class-g-effective-command.cjs` (FOUND).
- Commits exist: ae7c76b09, 85b5072f7, a768bbd85, 0bb723ab6 (FOUND in `git log`).
- Deleted files are absent from the tree (tripwire arms 1 and 6b).
