---
phase: 126
plan: 05
slug: release-flight-preflight-in-acceptance
subsystem: install-lifecycle-harness
tags: [acceptance-gate, release-flight, doctor-checklist, dog-fooding, test-mode-injection, canon-part-6, canon-part-7]
canon_parts: [6, 7]
wave: 2
beta_target: v1.13.0-beta.15
hotfix_discipline: true
requires:
  - Phase 123 install-lifecycle-harness (v1.13.0-beta.13) -- ships doctor --acceptance 7-point gate + the DOCTOR_TEST_FAIL_POINT injection hook this plan reuses verbatim
  - Phase 126 Plan 03 -- ships the self-coverage aggregator (tests/test-doctor-acceptance-self-coverage.cjs) + release.sh Step 6.6b wiring; Plan 05's 5 new entries land inside the buildAcceptanceChecklist Plan 03 already exercises
  - Phase 126 Plan 07 -- lib/core/install-state.cjs (Plan 07's v2 schema) is what Plan 05's session-start-active-version check cross-references when the resolver vs installed_plugins.json disagree
provides:
  - 5 new doctor --acceptance checklist entries (session-start-active-version, verify-release-clean-tree, frontmatter-yaml-validity, release-dry-run-output, working-tree-housekeeping)
  - tests/test-doctor-acceptance-preflight-checks.cjs (7-case fixture: 1 real broken state + 4 DOCTOR_TEST_FAIL_POINT injections + 1 no-regression guard + 1 isolation guard)
  - tests/run-all-126.sh CJS_SUITES entry for the new fixture
  - Two pre-existing orphan tracked .bak files removed (housekeeping deviation surfaced by the new working-tree-housekeeping check)
affects:
  - Plan 04 (release.sh tag-push + install-minisite lockstep + npx-publish gates, Wave 3) -- Plan 04 patches Entry 4's expectedSteps array to absorb Step 5.5 / 9.7 / 9.8 once it lands
  - Plan 04 still owns the pre-existing acc.5 ordering failure in tests/test-doctor-acceptance.cjs (logged in deferred-items.md, Plan 05 ran in strict isolation)
  - release.sh Step 6.6 (--acceptance --pre-tag, HARD ABORT) + Step 9.6 (--acceptance full, HARD ABORT) automatically gain the 5 new checks; no release.sh edit needed because the gate calls into buildAcceptanceChecklist
tech-stack:
  added: []
  patterns:
    - "DOCTOR_TEST_FAIL_POINT injection (Phase 123 hook reused verbatim for end-to-end test plumbing without polluting dev workspace)"
    - "Real fixture + injection mix: 1 real broken-state scaffold proves the actual detection logic; 4 injection tests prove the per-entry plumbing (mirrors Plan 03's Test 4 simulation strategy)"
    - "expectedSteps maintainer comment block as a forward-compat contract: explicitly warns the next plan (Plan 04 Wave 3) which array to patch and why"
    - "Strict isolation from pre-existing failures: Plan 05's fixture scaffolds its own mktemp HOMEs and never reads release.sh's Step 9 / 9.6 layout (acc.5 territory)"
    - "Dog-fooding deviation (Canon Part 6): the working-tree-housekeeping check caught 2 real orphan .bak files on the maintainer's own box during the cut that introduced it; the cleanup is logged as the plan's first deviation"
key-files:
  created:
    - tests/test-doctor-acceptance-preflight-checks.cjs (342 lines; 7 sub-tests)
    - .planning/phases/126-install-lifecycle-harness-gaps/126-05-SUMMARY.md (this file)
  modified:
    - scripts/doctor.cjs (+208 lines; 5 new checklist entries appended after the existing 'doctor-all' entry inside buildAcceptanceChecklist)
    - tests/run-all-126.sh (+1 CJS_SUITES entry; header comment updated to enumerate Plan 05's suite)
  deleted:
    - .planning/REQUIREMENTS.md.v1.bak (legacy v1 backup of REQUIREMENTS.md; 14267 bytes; last touched 2026-04-05; no live consumer)
    - scripts/self-update.deprecated-2026-04-26.bak (deprecated self-update script kept as backup when 0fe8c0e moved to native delegation; 17264 bytes; no live consumer)
key-decisions:
  - "All 5 entries are pre-tag-applicable (applies_to: ['pre-tag', 'full']) -- they verify pre-release-cut state and are cheap (~ms each, mostly local file reads); Phase 123 reserved 'full'-only for the 2 network-touching entries (version-of-record-published + npx-roundtrip) and Plan 05 inherits that boundary unchanged"
  - "DOCTOR_TEST_FAIL_POINT injection chosen over real broken-state scaffolding for Tests 2-5 because (a) it mirrors the established Phase 123 test pattern (tests/test-doctor-acceptance.cjs uses the same hook), (b) it does NOT pollute the dev workspace, (c) the check implementations include the injection hook so this proves the END-TO-END plumbing"
  - "Test 1 (session-start-active-version) uses REAL state scaffolding (mktemp HOME with installed_plugins.json saying version A while the resolver's plugin.json says version B) to prove the actual detection logic works against a real fixture -- not just the injection plumbing"
  - "The expectedSteps array in Entry 4 carries an explicit maintainer NOTE comment naming Plan 04 (Wave 3) as the patcher. Initial array is 11 steps reflecting CURRENT release.sh state: ['Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 5b', 'Step 6', 'Step 6.5', 'Step 6.6', 'Step 7', 'Step 9.5', 'Step 9.6']. NO Step 5.5, NO Step 9.7, NO Step 9.8 -- those land in Wave 3 with Plan 04's release.sh hardening"
  - "frontmatter-yaml-validity uses a lightweight regex hygiene scan (tabs, key:value shape, list items, indented children) instead of pulling in a YAML parser. The original hot-patch detection target was a stray-tab regression -- the scan catches that class and one more (malformed-leading-line). A real YAML parser would catch more drift but adds a runtime dep; the lightweight scan stays in Canon Part 7 (reuse-before-build)"
  - "working-tree-housekeeping scans git ls-files (tracked files only). Untracked .tmp / .bak files are not the failure mode; tracked orphans that drift across phases are. Mirrors the verify-release-clean-tree check's --untracked-files=no philosophy"
  - "The 2 orphan .bak files surfaced by the new check were removed as a deviation (Canon Part 6 dog-fooding). Removing them was in-scope: the new check would have refused to pass Test 6 (no-regression guard) until the dev workspace satisfied its own gate. The cleanup commit is separate from the implementation commit so the deviation is auditable"
requirements-completed: []
metrics:
  duration_seconds: 1350
  duration_human: "~22.5 minutes"
  task_count: 2
  files_created: 2
  files_modified: 2
  files_deleted: 2
  test_cases_added: 7
  commits: 5
  completed_date: 2026-05-14
---

# Phase 126 Plan 05: Release-Flight Pre-Flight Absorbed into --acceptance Summary

**One-liner:** Promotes the 5 hot-patches that landed during Phase 123's v1.13.0-beta.13 release cut from tribal-knowledge-in-the-operator's-head to doctor --acceptance checklist entries that release.sh runs automatically on every cut; closes Canon Part 6 dog-fooding gap by catching its first real drift (two orphan .bak files) on the maintainer's own box during the cut that introduced it.

## What Shipped

Phase 123 (v1.13.0-beta.13) cut its own release through `release.sh`, and during the Plan-06 pre-flight checklist the operator hand-applied 5 hot-patches before allowing the cut to proceed. Each was caught by the operator's diligence; none were caught by the harness. Tribal knowledge is release risk.

Plan 05 makes the 5 hot-patches structural:

1. **session-start active_version derivation correctness** — session-start (line 202) derives `active_version` from a fallback chain: `resolver-root-basename` → `installed_plugins.json` entry → dev-workspace `plugin.json` → `"unknown"`. The first two sources can drift apart silently. The new check cross-references them and fails when they disagree.

2. **verify-release Step 12 clean-tree** — `verify-release` Step 12 (line 296) calls `git status --porcelain --untracked-files=no | grep -v ^??`. The new check fires the same query directly against the plugin repo (no shell quoting fragility) and surfaces a structured `dirtyCount + dirtyTail` finding when tracked files have drifted.

3. **operator.md / doctor.md frontmatter YAML validity** — Phase 123's hot-patch was a stray-tab regression in `commands/operator.md` frontmatter that broke Claude Code's command discovery silently. The new check scans the frontmatter of `operator.md` + `doctor.md` for tabs, malformed key:value lines, and missing frontmatter blocks.

4. **release.sh --dry-run produces expected output** — Phase 123 added `release.sh --dry-run` so the operator could preview the planned sequence without side effects. The hot-patch was the discovery that the dry-run output drifted away from the real script's step layout. The new check spawns `bash scripts/release.sh --dry-run` and asserts that all 11 expected step names appear in the output. The expectedSteps array is the Wave-2-frozen list of step names; Plan 04 (Wave 3) patches this array to absorb the release.sh hardening it ships.

5. **working-tree housekeeping (no orphan .tmp/.bak files in tracked dirs)** — The new check runs `git ls-files` (tracked only) and filters to `.tmp / .bak / .swp / .swo` suffixes. Two pre-existing orphan tracked `.bak` files surfaced on the maintainer's own box during the cut that introduced this check — the first dog-fooding moment (see Deviations below).

## The 5 New Checklist Entries

| # | id | severity | applies_to | What it does | DOCTOR_TEST_FAIL_POINT support |
| --- | --- | --- | --- | --- | --- |
| 1 | `session-start-active-version` | blocker | pre-tag, full | Cross-checks `installed_plugins.json` mos@mindrian-marketplace version vs the active plugin root's `plugin.json` version; fails if they disagree | Yes |
| 2 | `verify-release-clean-tree` | blocker | pre-tag, full | `git -C <pluginRoot> status --porcelain --untracked-files=no`; fails if any tracked file is dirty | Yes |
| 3 | `frontmatter-yaml-validity` | blocker | pre-tag, full | Scans `commands/operator.md` + `commands/doctor.md` for tabs in frontmatter, malformed key:value lines, missing frontmatter | Yes |
| 4 | `release-dry-run-output` | blocker | pre-tag, full | Spawns `bash scripts/release.sh --dry-run`; asserts all 11 expected step names appear in the output | Yes |
| 5 | `working-tree-housekeeping` | blocker | pre-tag, full | `git ls-files`; filters to `.(tmp|bak|swp|swo)$` suffixes; fails if any tracked orphan exists | Yes |

All 5 entries return `{ ok, finding, detail }` and follow the shape of the existing Phase 123 entries (lines 2167-2382 in `scripts/doctor.cjs`). They are inserted at the END of `buildAcceptanceChecklist` after the existing `doctor-all` entry, so the gate's existing 7 entries stay in their original order.

## The 7 Test Sub-Cases

| # | Name | Strategy | Asserts |
| --- | --- | --- | --- |
| 1 | session-start-active-version: real broken state | mktemp HOME + cache version B + installed_plugins.json version A | `entry.ok === false` with finding describing the mismatch |
| 2 | verify-release-clean-tree: synthesized failure | `DOCTOR_TEST_FAIL_POINT=verify-release-clean-tree` | `entry.ok === false` with synthesized-failure finding |
| 3 | frontmatter-yaml-validity: synthesized failure | `DOCTOR_TEST_FAIL_POINT=frontmatter-yaml-validity` | `entry.ok === false` with synthesized-failure finding |
| 4 | release-dry-run-output: synthesized failure | `DOCTOR_TEST_FAIL_POINT=release-dry-run-output` | `entry.ok === false` with synthesized-failure finding |
| 5 | working-tree-housekeeping: synthesized failure | `DOCTOR_TEST_FAIL_POINT=working-tree-housekeeping` | `entry.ok === false` with synthesized-failure finding |
| 6 | no regression (live workspace) | Real dev tree + verify-release shim | All 5 new entries `ok === true` |
| 7 | isolation (working-tree-housekeeping fail) | Live tree + `DOCTOR_TEST_FAIL_POINT=working-tree-housekeeping` | ONLY that one entry fails; 4 sibling NEW entries + 5 EXISTING entries (install-state, deployment-surfaces, version-of-record-repo, verify-release, doctor-all) all remain `ok === true` |

7/7 GREEN against the dev workspace in ~7s wall-clock.

## The expectedSteps Maintainer Contract (Entry 4)

The release-dry-run-output entry carries an explicit forward-compat contract for Plan 04 (Wave 3):

```javascript
// NOTE: This array is patched by Plan 04 (Phase 126 Wave 3) to add
// Step 5.5, Step 9.7, Step 9.8 and reorder Step 9.6 -> 9.8 for the
// rename. If you edit this list, make sure release.sh --dry-run
// output still matches in order. Wave 2 (this plan) ships the
// initial array; Wave 3 (Plan 04) patches it.
const expectedSteps = ['Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 5b',
                       'Step 6', 'Step 6.5', 'Step 6.6', 'Step 7', 'Step 9.5', 'Step 9.6'];
```

The current `release.sh --dry-run` output emits these 11 step names. Step 6.6b (Phase 126 Plan 03) is also emitted by the script today but is intentionally NOT in the array — the array is the list of REQUIRED steps. Plan 04 will:
- ADD Step 5.5 (tag-push verify) — between Step 5b and Step 6
- ADD Step 9.7 (npx-publish self-test) — between Step 9.6 and Step 10
- ADD Step 9.8 (rename of current Step 9.6) — after Step 9.7
- Patch the array to absorb these three new steps

The NOTE comment exists so the long-term maintainer sees the Wave 3 dependency at the array's declaration site, not buried in a planning doc.

## Wiring into release.sh (NO release.sh edit needed)

Plan 03 already wired the acceptance gate into `release.sh`:
- **Step 6.6** (line 351): `doctor --acceptance --pre-tag` (HARD ABORT, no `--allow` override)
- **Step 6.6b** (line 374): `tests/test-doctor-acceptance-self-coverage.cjs` (Plan 03's aggregator)
- **Step 9.6** (line 668): `doctor --acceptance` (full, HARD ABORT, no `--allow` override)

Plan 05's 5 new entries are appended INSIDE `buildAcceptanceChecklist`, so Step 6.6 and Step 9.6 BOTH gain them automatically. No `release.sh` edit was needed for Plan 05 — the wiring was already there from Plan 03.

## The Test-Mode Injection Reuse (Phase 123 Pattern)

The `DOCTOR_TEST_MODE=1` + `DOCTOR_TEST_FAIL_POINT=<entry-id>` env-var pair is the Phase 123 test hook (declared in `scripts/doctor.cjs` line 2156-2160 comment block). Each Plan 05 entry includes the same conditional at the top of its `run` function:

```javascript
if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === '<entry-id>') {
  return { ok: false, finding: '<entry-id> synthesized failure (test mode)', detail: {} };
}
```

This is byte-identical to how `tests/test-doctor-acceptance.cjs` exercises the existing 7 entries. Tests 2-5 in `test-doctor-acceptance-preflight-checks.cjs` use this hook to prove the END-TO-END plumbing (the injection hook fires → the run function returns the synthesized failure → the `points[].ok === false` lands in the JSON output → the test sees it) without polluting the dev workspace.

## The Isolation Guard (Test 7)

Test 7 sets `DOCTOR_TEST_FAIL_POINT=working-tree-housekeeping` and asserts:

| Surface | Expected |
| --- | --- |
| working-tree-housekeeping (the targeted entry) | `ok === false` |
| session-start-active-version (sibling new entry) | `ok === true` |
| verify-release-clean-tree (sibling new entry) | `ok === true` |
| frontmatter-yaml-validity (sibling new entry) | `ok === true` |
| release-dry-run-output (sibling new entry) | `ok === true` |
| install-state (existing Phase 123 entry) | `ok === true` |
| deployment-surfaces (existing Phase 123 entry) | `ok === true` |
| version-of-record-repo (existing Phase 123 entry) | `ok === true` |
| verify-release (existing Phase 123 entry, shimmed) | `ok === true` |
| doctor-all (existing Phase 123 entry) | `ok === true` |
| Process exit code | non-zero (targeted check failed) |

This proves no cross-check contamination: the gate evaluates each entry independently, and a single injection does not cascade.

## Isolation From the Pre-Existing acc.5 Failure

`tests/test-doctor-acceptance.cjs` Test acc.5 (release.sh Step 9 / Step 9.6 ordering) fails with `Step 9.6 must appear after Step 9 (push); got 9@31312 / 9.6@23779`. This is Plan 04 territory and is logged in `.planning/phases/126-install-lifecycle-harness-gaps/deferred-items.md`. Plan 05 runs in strict isolation:

| Property | Plan 05 fixture | acc.5 |
| --- | --- | --- |
| Scratch HOME | `mkdtempSync` per fixture | reads dev workspace `scripts/release.sh` |
| File under test | `doctor --acceptance --json` output | `scripts/release.sh` raw text |
| Failure mode | None (7/7 GREEN) | Pre-existing (Plan 04 owns) |
| Cross-contamination risk | Zero (no shared state) | n/a |

## Verification Receipts

```
$ node tests/test-doctor-acceptance-preflight-checks.cjs
PASS: Test 1 (session-start-active-version: real broken state -> ok=false)
PASS: Test 2 (verify-release-clean-tree: synthesized failure)
PASS: Test 3 (frontmatter-yaml-validity: synthesized failure)
PASS: Test 4 (release-dry-run-output: synthesized failure)
PASS: Test 5 (working-tree-housekeeping: synthesized failure)
PASS: Test 6 (no regression: all 5 new checks pass on dev workspace)
PASS: Test 7 (isolation: working-tree-housekeeping fail does not cascade to siblings)

7 passed, 0 failed

$ bash tests/run-all-126.sh
Total:  6 | Passed: 6 | Failed: 0 | Time: 6s

$ node scripts/doctor.cjs --acceptance --pre-tag --json
PASS -- session-start-active-version
PASS -- verify-release-clean-tree
PASS -- frontmatter-yaml-validity
PASS -- release-dry-run-output
PASS -- working-tree-housekeeping
(verify-release: pre-existing mid-release CHANGELOG noise -- known acceptable
 per Plan 03 precedent; will resolve when the v1.13.0-beta.15 cut finalizes
 the [Unreleased] heading)

$ node -c scripts/doctor.cjs && echo SYNTAX OK
SYNTAX OK

$ node tests/test-doctor-class-i.cjs    # Phase 123 baseline
All 11 tests PASS                       # no regression

$ node tests/test-doctor-class-j.cjs    # Phase 123 baseline
All 8 tests PASS                        # no regression

$ node tests/test-install-state-record.cjs   # Phase 123 baseline
6/6 passed                                    # no regression

$ node tests/test-install-state-migration.cjs   # Phase 126 Plan 07 baseline
6/6 passed                                       # no regression

$ node tests/test-doctor-acceptance-self-coverage.cjs   # Phase 126 Plan 03 baseline
6 passed, 0 failed                                       # no regression
```

## Commits

| Hash | Type | Task | Summary |
| --- | --- | --- | --- |
| `876304d` | test | 1 RED | add failing fixture coverage for 5 acceptance preflight checks |
| `b5eab04` | feat | 1 GREEN | add 5 release-flight preflight checks to doctor --acceptance |
| `d769522` | chore | 1 deviation | remove pre-existing orphan tracked .bak files surfaced by working-tree-housekeeping check |
| `78813d3` | chore | 2 | wire test-doctor-acceptance-preflight-checks.cjs into run-all-126.sh aggregator |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Auto-add missing critical functionality / Canon Part 6 dog-fooding] Removed 2 pre-existing orphan tracked .bak files**
- **Found during:** Task 1 GREEN verification — Test 6 (no-regression guard against the live dev workspace) failed because the new `working-tree-housekeeping` check correctly identified two pre-existing tracked `.bak` files
- **Issue:** Two tracked `.bak` files had drifted into the repo across earlier phases:
  - `.planning/REQUIREMENTS.md.v1.bak` (legacy v1 backup of REQUIREMENTS.md; 14267 bytes; last touched 2026-04-05)
  - `scripts/self-update.deprecated-2026-04-26.bak` (deprecated self-update script kept as a backup when commit `0fe8c0e` moved to native delegation on 2026-04-26; 17264 bytes)
  - Neither was referenced by any live code path; both were left behind as deprecation artifacts.
- **Fix:** `git rm` both files. The new `working-tree-housekeeping` check is precisely the gate that exists to prevent this class of orphan from accumulating. Per Canon Part 6 (dog-fooding mandate): the gate caught its first real drift on the maintainer's own box during the cut that introduced it; the cleanup is the natural fix.
- **Why in scope:** The plan's `<success_criteria>` explicitly requires "Live `doctor --acceptance --json` continues to pass against current dev workspace" and "all 5 new checks PASS on dev workspace". The dev workspace failed both criteria until the orphans were removed. Refusing to remove the orphans would have meant accepting a perpetually-failing Test 6 — defeating the purpose of the no-regression guard.
- **Files deleted:** `.planning/REQUIREMENTS.md.v1.bak`, `scripts/self-update.deprecated-2026-04-26.bak`
- **Commit:** `d769522`
- **Audit trail:** Filed as a separate `chore(126-05)` commit (not folded into the implementation commit) so the deviation is independently rollback-able and inspectable.

### Deferred Issues (Out of Scope, Logged Elsewhere)

**1. `tests/test-doctor-acceptance.cjs` Test acc.5** — Pre-existing failure in `release.sh` Step 9 / Step 9.6 ordering. Documented in `.planning/phases/126-install-lifecycle-harness-gaps/deferred-items.md` (entry of 2026-05-14, surfaced by Plan 07 and confirmed by Plan 03). Plan 04 (release-pipeline-hardening, Wave 3) owns this. Plan 05 ran in strict isolation — its fixture scaffolds mktemp HOMEs and never reads `release.sh`'s Step 9 / 9.6 layout.

## Forward References

- **Plan 04 (release.sh tag-push + install-minisite lockstep + npx-publish gates):** Will land in Wave 3. Plan 04 patches Entry 4's `expectedSteps` array to absorb Step 5.5 / 9.7 / 9.8. The NOTE comment in `scripts/doctor.cjs` Entry 4 names Plan 04 explicitly so the long-term maintainer sees the dependency at the array's declaration site. Plan 04 also folds in the acc.5 fix (release.sh Step 9 / 9.6 ordering).
- **The release.sh wiring stays unchanged:** Plan 03 already wired `--acceptance --pre-tag` (Step 6.6, HARD ABORT) + `--acceptance` full (Step 9.6, HARD ABORT). Plan 05's 5 new entries are appended INSIDE `buildAcceptanceChecklist`; both Step 6.6 and Step 9.6 gain them automatically.

## Canon Provenance

- **Part 6 (dog-fooding mandate):** Plan 05's purpose was promoting 5 manually-applied operator checks from tribal knowledge to structured gates. The plan itself produced the first dog-fooding receipt: the new `working-tree-housekeeping` check caught two real orphan `.bak` files on the maintainer's own box during the cut that introduced it. The deviation commit (`d769522`) is the dog-fooding artifact.
- **Part 7 (reuse-before-build):** Plan 05 reused the Phase 123 `DOCTOR_TEST_FAIL_POINT` injection hook verbatim (zero new test infrastructure), the Phase 123 `buildAcceptanceChecklist` extension pattern (5 new entries appended to the existing list, not a fork), and the Plan 03 release.sh wiring (no `release.sh` edits needed). The lightweight YAML hygiene scan in Entry 3 (frontmatter-yaml-validity) deliberately stays in Canon Part 7 by NOT pulling in a YAML parser dependency — a regex scan catches the original hot-patch class (stray tabs, malformed key:value, missing frontmatter) without adding runtime weight.

## Self-Check: PASSED

- File `tests/test-doctor-acceptance-preflight-checks.cjs` exists: FOUND
- File `scripts/doctor.cjs` modified (5 new entries present): FOUND
- File `tests/run-all-126.sh` modified (CJS_SUITES entry added): FOUND
- File `.planning/REQUIREMENTS.md.v1.bak` deleted: CONFIRMED (`git log --diff-filter=D` shows commit `d769522`)
- File `scripts/self-update.deprecated-2026-04-26.bak` deleted: CONFIRMED (same commit)
- Commit `876304d` (Task 1 RED) exists: FOUND
- Commit `b5eab04` (Task 1 GREEN) exists: FOUND
- Commit `d769522` (Task 1 housekeeping deviation) exists: FOUND
- Commit `78813d3` (Task 2 wiring) exists: FOUND
- `bash -n scripts/doctor.cjs`: NOT APPLICABLE (`.cjs` is Node, not shell); `node -c scripts/doctor.cjs` exits 0: CONFIRMED
- All 7 preflight-checks sub-tests GREEN: CONFIRMED
- All 6 Phase 126 aggregator suites GREEN: CONFIRMED
- Phase 123 baselines preserved (class-i, class-j, install-state-record, install-state-migration): CONFIRMED
- Phase 126 Plan 03 baseline preserved (acceptance-self-coverage 6/6): CONFIRMED
- `node scripts/doctor.cjs --acceptance --pre-tag --json` shows all 5 new entries with `ok=true`: CONFIRMED

## Known Stubs

None. Zero stubs introduced. The 5 new run functions are fully implemented:
- Entry 1: actual `installed_plugins.json` read + `resolveActivePluginRoot()` + `plugin.json` read + comparison
- Entry 2: actual `git status --porcelain --untracked-files=no` spawn + dirty-count parse
- Entry 3: actual frontmatter regex scan + per-line hygiene check + structured failure list
- Entry 4: actual `bash scripts/release.sh --dry-run` spawn + step-name substring scan
- Entry 5: actual `git ls-files` spawn + suffix filter + orphan list

Verified by grep for `TODO|FIXME|placeholder|coming soon|not available|stub` against the 208 added lines in `scripts/doctor.cjs`: 0 hits.
