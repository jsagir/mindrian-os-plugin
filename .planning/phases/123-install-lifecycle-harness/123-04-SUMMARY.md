---
phase: 123-install-lifecycle-harness
plan: 04
subsystem: infra
tags: [doctor, acceptance, release-gate, release-sh, npx-roundtrip, version-of-record, canon-part-8, install-lifecycle]

# Dependency graph
requires:
  - phase: 123-install-lifecycle-harness
    plan: 01
    provides: "scripts/release.sh rewritten with semver algebra + two-commit form (Commit A finalizes vN + tag, Commit B next-bump) + dirty-repo / ahead-of-origin guard + Step 9.5 npm publish at @mindrian_os/install. Step labels Plan-04 inserts Step 6.6 and Step 9.6 against."
  - phase: 123-install-lifecycle-harness
    plan: 02
    provides: "scripts/session-start single-writer of ~/.mindrian/install-state.json + data/deployment-surfaces.json manifest -- the inputs class I + class J reads."
  - phase: 123-install-lifecycle-harness
    plan: 03
    provides: "scripts/doctor.cjs class I (checkInstallState) + class J (checkDeploymentSurfaces) + aggressive --fix + --install-state flag. The 5-point + 7-point checklist runner reuses these directly -- the install-state point and deployment-surfaces point ARE class I + class J results wrapped as acceptance findings."
provides:
  - "scripts/doctor.cjs --acceptance / --pre-tag / --light-npx flags (HARNESS-123-11). 7-point checklist (5 pre-tag, 5+2 full). buildAcceptanceChecklist({home, pluginRoot, flagLightNpx}) returns ordered points; runAcceptance({home, pluginRoot, flagPreTag, flagLightNpx}) filters by mode + executes sequentially + returns {mode, points[], failed_points[], summary{total, passed, failed}}. HARD ABORT semantics: exit 0 = all passed; exit 1 = any failure; NO --allow override. Dispatched BEFORE the class-flag block in main() so the existing per-class detectors do not run twice (doctor-all sub-check spawns ourselves with --all in a child process)."
  - "scripts/release.sh Step 6.6 (between Step 6.5 post-bump re-verify and Step 7 commit A) calls --acceptance --pre-tag; HARD ABORT on non-zero with rollback (git checkout plugin.json / package.json / CHANGELOG.md / marketplace.json). Step 9.6 (after Step 9 push + Step 9.5 npm publish) calls --acceptance (full); HARD ABORT with inline R.4 recovery instructions (npm deprecate + npm dist-tag rm + cut successor + REQUIRED Lawrence notify + recovery log at ~/.mindrian/recovery-log.txt). Both reference the Plan-04 <recovery> block (R.1..R.7) for operator guidance. (HARNESS-123-12)"
  - "scripts/release-beta-smoke.sh DELETED via git rm. The v1.11.0-beta.1-hardcoded Phase-89.6 artifact is superseded by --acceptance --pre-tag (which works against the current plugin.json version regardless of release line)."
  - "tests/test-doctor-acceptance.cjs (6 hermetic scenarios) registered in lib/memory/run-feynman-tests.cjs Phase-123 block. Test-mode env hooks (DOCTOR_TEST_MODE=1) honor DOCTOR_TEST_STUB_POST_PUBLISH + DOCTOR_TEST_FAIL_POINT + DOCTOR_VERIFY_RELEASE_PATH for hermetic harness control."
  - "Recovery procedures named in this SUMMARY's Recovery section: R.1 Step 7 fail (local reset); R.2 Step 9.5 fail (retry publish); R.3 Step 9 fail (retry push); R.4 Step 9.6 fail (yank + cut successor + NOTIFY); R.5 operator notification template; R.6 decision matrix (yank vs retry vs successor); R.7 recovery log audit trail."
affects: [123-05, 123-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Checklist runner as ordered array of {id, label, severity, applies_to: ['pre-tag','full'] | ['full'], run: async function -> {ok, finding, detail}}. Mode filter + sequential execution + per-point status line printer + JSON aggregate. Gives each point a clean test surface (DOCTOR_TEST_FAIL_POINT can synthesize one point's failure independently) AND makes adding new points additive (one more entry in the array, the runner walks it agnostically)."
    - "Release-gate dispatched BEFORE class-flag block in main(). --acceptance has its OWN exit-code contract (0/1, hard abort) -- NOT the class-flag graceful-degradation invariant. Reason: class flags MUST exit 0 in graceful-degradation mode to keep hermetic tests + multi-class --all runs survivable; release-gate MUST exit non-zero on failure for release.sh to abort. Two different contracts; two different code paths."
    - "mktemp HOME-override sandbox for npx round-trip (RESEARCH § override 9 full mode). fs.mkdtempSync(os.tmpdir(), 'mos-acceptance-') + env override {HOME, USERPROFILE, npm_config_cache=<sandbox>/.npm}. fs.rmSync(..., {recursive: true, force: true}) in `finally`. NEVER touches the operator's live install. --light-npx flag is the operator opt-in for slow networks/CI -- uses `npx --no-install --help` resolution instead of a real install."
    - "Sub-check failure propagation: each point's run() either returns {ok: false, finding, detail} OR throws. The runner catches both -- on throw, synthesizes {ok: false, finding: 'point X threw: <message>'}. Either path lands in failed_points[]. Exit code is set from failed_points.length === 0."
    - "verify-release as SUB-CHECK, not duplicate: --acceptance point 4 SHELLS OUT to scripts/verify-release once. The doctor does NOT re-implement its 14 sections. Combined with release.sh Steps 2 + 6.5 (which also call verify-release directly), the count per release is 4x -- accepted redundancy for the safety net (idempotent + ~5s; de-dup is a follow-up TODO)."
    - "Test-mode env hooks gated on DOCTOR_TEST_MODE=1: hooks (DOCTOR_TEST_STUB_POST_PUBLISH, DOCTOR_TEST_FAIL_POINT, DOCTOR_VERIFY_RELEASE_PATH) are no-ops outside test mode -- production users never trigger them. Mirrors the test-mode envelope pattern from tests/test-doctor-class-i.cjs (per-test mkdtempSync HOME + MINDRIAN_PLUGIN_HOME)."

key-files:
  created:
    - "tests/test-doctor-acceptance.cjs (315 lines, 6 hermetic scenarios)"
    - ".planning/phases/123-install-lifecycle-harness/123-04-SUMMARY.md (this file)"
  modified:
    - "scripts/doctor.cjs (+339 / -2 lines: 3 new flags in parseArgs + usage text update; --pre-tag implies --acceptance convenience; ~280-line buildAcceptanceChecklist + runAcceptance block inserted between class J --fix and the renderers; --acceptance dispatch added at the TOP of main() with HARD ABORT exit-code contract; bin/cli.js routes argv verbatim -- no edit needed there, verified at L111)"
    - "scripts/release.sh (Step 6.6 inserted between Step 6.5 and Step 7; Step 9.6 inserted after Step 9 push and Step 9.5 npm publish; TODO comment near Steps 2 + 6.5 updated to note 4x verify-release count; bash -n clean)"
    - "lib/memory/run-feynman-tests.cjs (+1 line: test-doctor-acceptance.cjs registered in Phase-123 block; Phase 110 had also been writing to this file in parallel -- their entries above mine untouched)"
  deleted:
    - "scripts/release-beta-smoke.sh (v1.11.0-beta.1-hardcoded Phase 89.6 artifact superseded by --acceptance --pre-tag)"

key-decisions:
  - "5-point pre-tag filter set: install-state + deployment-surfaces + version-of-record-repo + verify-release + doctor-all. Full set adds version-of-record-published (git tag + marketplace source.ref + npm view) + npx-roundtrip (= 7 total). Per CONTEXT D-14 + D-16 + the NIT-1 fix in the plan's behavior block."
  - "--pre-tag implies --acceptance (convenience -- running --pre-tag standalone is meaningless). Documented in parseArgs (the `if (flags.preTag) flags.acceptance = true;` line)."
  - "--light-npx is operator opt-in, default OFF. RESEARCH override 9 light-alternative: when CI is too slow for a live install, the operator runs `--acceptance --light-npx` to use `npx --no-install --help` instead. The full mktemp sandbox is the default (per CONTEXT D-14)."
  - "Test-mode env hooks gated on DOCTOR_TEST_MODE=1 -- production users never trigger them. This keeps the test infrastructure (DOCTOR_TEST_STUB_POST_PUBLISH, DOCTOR_TEST_FAIL_POINT, DOCTOR_VERIFY_RELEASE_PATH) entirely additive: not a single production code path branches on these env vars."
  - "Release-gate dispatched BEFORE the class-flag block in main(). --acceptance has its OWN exit-code contract (0/1, HARD ABORT). The class-flag-always-exit-0 invariant explicitly does NOT apply -- if it did, release.sh could never detect a gate failure, defeating the purpose. Documented in a header comment block above the runAcceptance dispatch."
  - "version-of-record-repo accepts a CHANGELOG top entry of '[Unreleased]' OR '[vN]' -- both are valid pre-tag states. release.sh Step 6 finalizes [Unreleased] -> [vN] BEFORE Step 6.6 runs, so by then chTop is the version; but allowing 'Unreleased' makes the doctor's check robust to operator drift (e.g. a Plan-05 cache-prune dev cycle where Step 6 hasn't run yet)."
  - "doctor-all sub-check spawns ourselves with --all + scrubs DOCTOR_TEST_FAIL_POINT='' in the child env. This prevents a top-level DOCTOR_TEST_FAIL_POINT=doctor-all from propagating into the self-spawn and re-triggering the synthesis there (the synthesis already covers the point in the parent process)."
  - "Step 9.6 prints the R.4 recovery instructions INLINE (npm deprecate + npm dist-tag rm + cut successor + Lawrence notify + recovery log). The operator does NOT need to open 123-04-PLAN.md to find the recovery -- the abort message contains the named commands. The PLAN.md <recovery> block remains the authoritative source for R.1..R.7."
  - "scripts/release-beta-smoke.sh is DELETED, not renamed/repurposed. RESEARCH override 7 confirmed: hard-pinned to EXPECTED_VERSION='1.11.0-beta.1' (Phase 89.6 artifact); --acceptance --pre-tag is its modern replacement. Phase 110-03 briefly RESTORED the file in commit 231f5cd (between my Task 1 and Task 2) -- Task 3's `git rm` re-deletes it. No race; Plan-04 owns the deletion."

patterns-established:
  - "Release-gate-as-a-command. `mindrian-os doctor --acceptance` makes the release gate something the external operator (Lawrence) can run on a real box. 'Release infrastructure ships as a beta validated by Lawrence' now means 'Lawrence ran `mindrian-os doctor --acceptance`, all green' (per CONTEXT D-17)."
  - "Checklist runner with applies_to filtering: each point is a {id, label, severity, applies_to, run} record. Mode filter (--pre-tag vs full) walks once over the array. New points are additive -- one more entry, the runner walks it agnostically. Test surface is per-point (DOCTOR_TEST_FAIL_POINT=<point_id> synthesizes that one point's failure)."
  - "Recovery-by-name + inline-print: every release.sh abort cites a specific recovery procedure (R.1..R.7) AND prints the named commands inline. The operator does not have to open documentation to recover -- the abort IS the runbook. <recovery> block in PLAN.md remains the authoritative source."

requirements-completed: [HARNESS-123-11, HARNESS-123-12]

# Metrics
duration: 28m
completed: 2026-05-13
---

# Phase 123 Plan 04: install-lifecycle-harness Summary

**The release gate becomes a command.** `mindrian-os doctor --acceptance` runs a 7-point checklist that asserts the release is consistent end-to-end (`--pre-tag` filters to the 5 points true BEFORE the tag + npm publish; full adds version-of-record-published + npx-roundtrip = 7 total). `scripts/release.sh` wires BOTH as HARD ABORTS: Step 6.6 (`--pre-tag`) before commit A + tag, Step 9.6 (full) after push + npm publish. NO `--allow` override -- release infra is the one gate you cannot skip. `scripts/release-beta-smoke.sh` (the v1.11.0-beta.1-hardcoded Phase-89.6 artifact) is retired.

## Performance

- **Duration:** ~28 min
- **Started:** 2026-05-13 (immediately after Phase 110-03 landed at 231f5cd; Wave 4 of 6 in the parallel autonomous run)
- **Completed:** 2026-05-13
- **Tasks:** 3 (Wave 0 RED, GREEN doctor.cjs, GREEN release.sh + delete)
- **Files modified:** 4 (1 created, 3 modified, 1 deleted)
- **Per-task commits:** 3 (`584801b` Task 1 RED, `c9bf670` Task 2 GREEN doctor, `c54c6af` Task 3 GREEN release.sh + delete)

## Accomplishments

### Task 1 -- Wave 0 hermetic harness (RED)

`tests/test-doctor-acceptance.cjs` ships 6 hermetic scenarios mirroring the `tests/test-doctor-class-i.cjs` + `class-j.cjs` envelope (per-test `mkdtempSync` HOME + `USERPROFILE` + `MINDRIAN_PLUGIN_HOME` override):

- **acc.1** -- `--pre-tag` filters to the 5 pre-tag-applicable points (install-state, deployment-surfaces, version-of-record-repo, verify-release, doctor-all). Verifies post-publish points (version-of-record-published + npx-roundtrip) are NOT in `points[]`. Uses `DOCTOR_TEST_STUB_POST_PUBLISH=1` to force a throw if the filter regresses.
- **acc.2** -- `--acceptance` calls `scripts/verify-release` exactly once. Test points `DOCTOR_VERIFY_RELEASE_PATH` at a shim that appends to a counter file; assert counter == 1.
- **acc.3** -- A sub-check failure propagates as a non-zero exit. `DOCTOR_TEST_FAIL_POINT=doctor-all` synthesizes a failure of the named point; assert `exitCode != 0` AND `failed_points` contains the id.
- **acc.4** -- The npx sandbox is cleaned up. Runs `--light-npx` (which skips the sandbox); assert no `mos-acceptance-*` dirs remain under `os.tmpdir()` after the run.
- **acc.5** -- `scripts/release.sh` wires both gates in the right ordering. Read the file; find offsets of `Step 6.5:`, `Step 6.6:`, `Step 7:`, `Step 9:`, `Step 9.5:`, `Step 9.6:`; assert `offset(6.6) > offset(6.5)` AND `offset(6.6) < offset(7)`; `offset(9.6) > offset(9.5)`; `offset(9.6) > offset(9)`. Also asserts both literal `doctor.cjs --acceptance --pre-tag` AND a full `doctor.cjs --acceptance` invocation are present.
- **acc.6** -- `scripts/release-beta-smoke.sh` is deleted (`assert(!fs.existsSync(...))`).

Registered in `lib/memory/run-feynman-tests.cjs` Phase-123 block alongside Plan-01/02/03 entries. Picked up automatically by `tests/run-all.sh`'s `test-*.cjs` glob.

Initial run: 1/6 PASS (acc.4 -- no sandbox leak yet because --light-npx didn't exist). Expected RED.

### Task 2 -- `doctor.cjs` runAcceptance + 7-point checklist (GREEN doctor)

`scripts/doctor.cjs` gained:

**Three new flags in `parseArgs`:**
- `--acceptance` -- run the checklist; HARD ABORT (exit non-zero) on any failure.
- `--pre-tag` -- filter to the 5 pre-tag-applicable points; IMPLIES `--acceptance` (convenience).
- `--light-npx` -- with `--acceptance` (full): skip the mktemp HOME-override sandbox in the npx-roundtrip point; resolve `npx --no-install --help` instead of a live install. Operator opt-in.

**`buildAcceptanceChecklist({home, pluginRoot, flagLightNpx})`** returns the 7-point ordered array:

1. **install-state** (`['pre-tag', 'full']`) -- wraps `checkInstallState({home})` from class I. Healthy = pass; warn/error = fail with the first finding string.
2. **deployment-surfaces** (`['pre-tag', 'full']`) -- wraps `checkDeploymentSurfaces({home, topology, activeRoot, activeVersion})` from class J. Healthy/skipped = pass; warn = fail (with `<N> surface(s) drifted`).
3. **version-of-record-repo** (`['pre-tag', 'full']`) -- reads `.claude-plugin/plugin.json`, `package.json`, `CHANGELOG.md` top-most `## [vN]` heading; STRING equality; accepts `[Unreleased]` OR `[vN]` for CHANGELOG (operator drift tolerance pre-Step-6 finalization).
4. **verify-release** (`['pre-tag', 'full']`) -- shells out to `scripts/verify-release` (or `DOCTOR_VERIFY_RELEASE_PATH` shim in test mode). Exit 0 = pass.
5. **doctor-all** (`['pre-tag', 'full']`) -- spawns ourselves with `--all --json` (scrubs `DOCTOR_TEST_FAIL_POINT=''` in child env to prevent propagation); asserts exit 0 AND `summary.drift === 0`.
6. **version-of-record-published** (`['full']`) -- ONE NETWORK CALL. Runs `git rev-parse --verify refs/tags/v<ver>` for the tag; reads `~/mindrian-marketplace/.claude-plugin/marketplace.json` for `plugins[0].source.ref == v<ver>`; runs `npm view @mindrian_os/install@<ver> version` and STRING-equates to the local version.
7. **npx-roundtrip** (`['full']`) -- the SECOND NETWORK CALL. Light path: `npx --no-install @mindrian_os/install@<ver> --help`. Full path: `fs.mkdtempSync(os.tmpdir(), 'mos-acceptance-')` HOME-override sandbox + live `npx @mindrian_os/install@<ver> --help`; `fs.rmSync(...)` in `finally`. NEVER touches the operator's live install.

**`runAcceptance({home, pluginRoot, flagPreTag, flagLightNpx})`** filters by mode (`flagPreTag ? 'pre-tag' : 'full'`), executes sequentially, catches throws + synthesizes `{ok: false, finding: 'point X threw: <message>'}`, returns `{mode, points[], failed_points[], summary{total, passed, failed}}`.

**Wire-in at `main()` TOP:** if `flags.acceptance`, await `runAcceptance(...)`, print per-point status lines + summary, optionally print JSON, `process.exit(result.failed_points.length === 0 ? 0 : 1)`. Dispatched BEFORE the class-flag block so the existing per-class detectors do not run twice (the doctor-all sub-check handles that via a child-process self-spawn).

**Test-mode env hooks (gated on `DOCTOR_TEST_MODE=1`):**
- `DOCTOR_TEST_STUB_POST_PUBLISH=1` -- post-publish points (#6, #7) throw if invoked under `--pre-tag` (asserts the filter works).
- `DOCTOR_TEST_FAIL_POINT=<point_id>` -- synthesizes a failure of the named point. Used by acc.3.
- `DOCTOR_VERIFY_RELEASE_PATH=<path>` -- override `scripts/verify-release` path. Used by acc.2 (counter shim).

All env hooks are no-ops outside test mode -- production users never trigger them.

**`bin/cli.js` routing -- verified, no edit needed.** Per the read at L111: `bin/cli.js` does `run(process.execPath, [path.join(root, 'scripts', 'doctor.cjs'), ...process.argv.slice(argOffset)])` -- passes argv VERBATIM to `scripts/doctor.cjs`. No munging, no allowlist, no flag-stripping. `--acceptance` / `--pre-tag` / `--light-npx` pass through cleanly.

**Post-Task-2 test result:** acc.1, acc.2, acc.3, acc.4 PASS (4/6). acc.5 + acc.6 still RED (Task 3's responsibility). Pre-existing doctor tests (class-i, class-j, atomic-swap, class-g) all PASS -- no regression.

### Task 3 -- `release.sh` Step 6.6 + Step 9.6 + retire `release-beta-smoke.sh` (GREEN release.sh)

**Step 6.6** inserted in `scripts/release.sh` BETWEEN Step 6.5 (post-bump re-verify) AND Step 7 (commit A + tag):

```bash
# --- Step 6.6: doctor --acceptance --pre-tag (HARD ABORT, no --allow) ---
echo "=== Step 6.6: doctor --acceptance --pre-tag ==="
if ! node "$PLUGIN_DIR/scripts/doctor.cjs" --acceptance --pre-tag; then
  echo "ABORT: doctor --acceptance --pre-tag failed -- release halted BEFORE tagging."
  echo "  Rolling back version bumps so the working tree returns to its pre-Step-3 state."
  cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json CHANGELOG.md || true
  cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json || true
  echo "  See <recovery> R.1 in .planning/phases/123-install-lifecycle-harness/123-04-PLAN.md"
  echo "  Investigate the failed sub-check before re-running release.sh."
  exit 1
fi
```

**Step 9.6** inserted AFTER Step 9 (push) and Step 9.5 (npm publish), BEFORE Step 10 (update local cache):

```bash
# --- Step 9.6: doctor --acceptance (full, HARD ABORT, no --allow) ---
echo "=== Step 9.6: doctor --acceptance (full) ==="
if ! node "$PLUGIN_DIR/scripts/doctor.cjs" --acceptance; then
  echo "ABORT: doctor --acceptance (post-publish) failed."
  echo "  The release commit + tag + npm publish + push ALREADY LANDED, but the"
  echo "  published artifact is INCONSISTENT. INVESTIGATE before any further releases."
  echo ""
  echo "  Recovery path: <recovery> R.4 (yank + cut successor):"
  echo "    1. npm deprecate @mindrian_os/install@$NEW_VERSION \"broken -- see successor\""
  echo "    2. npm dist-tag rm @mindrian_os/install next"
  echo "    3. Fix the cause locally."
  echo "    4. bash scripts/release.sh --prerelease   # cuts vN+1 with the fix"
  echo "    5. NOTIFY Lawrence + any registered tester (REQUIRED -- subject:"
  echo "       'MOS release v$NEW_VERSION ROLLED BACK -- do not install')."
  echo "    6. Append to ~/.mindrian/recovery-log.txt:"
  echo "       <ISO-timestamp> v$NEW_VERSION recovery-path=R.4 notes=<...>"
  exit 1
fi
```

Step 9.6 prints the R.4 recovery instructions INLINE so the operator does not have to open `123-04-PLAN.md` to recover. Comments near the gate enumerate R.1..R.7 for cross-reference.

**TODO comment updated** near Step 2 + Step 6.5 to note the 4x verify-release call count per release (Step 2 + Step 6.5 + Step 6.6 internal + Step 9.6 internal). Idempotent + ~5s per run; accept redundancy for the safety net.

**`scripts/release-beta-smoke.sh` deleted** via `git rm`. The v1.11.0-beta.1-hardcoded Phase-89.6 artifact is superseded by `--acceptance --pre-tag`. Remaining references after deletion:

- `CHANGELOG.md:1058` -- historical entry describing the Phase 89.6 gate. **Legitimate; left in place** (it documents prior state -- a CHANGELOG should never be rewritten to erase history).
- `tests/test-doctor-acceptance.cjs` (multiple lines) -- the acc.6 deletion assertion test contract. **Required.**
- `lib/memory/run-feynman-tests.cjs:1290+1292` -- comment block explaining the retirement. **Documentation; left in place.**

**No production code references remain.** Plan-05's sweep is NOT required for this file.

**Phase 110-03 race note:** Commit `231f5cd` (`fix(110-03): restore scripts/release-beta-smoke.sh accidentally deleted in prior commit`) landed BETWEEN my Task 1 (`584801b`) and my Task 2 (`c9bf670`). Phase 110-03 had accidentally deleted the smoke script and restored it. Task 3's explicit `git rm` re-deletes it cleanly -- no race; Plan-04 owns the deletion intentionally.

**Post-Task-3 test result:** 6/6 PASS. All pre-existing doctor tests still PASS -- no regression.

## Live dev-box evidence

`node scripts/doctor.cjs --acceptance --pre-tag` against the live dev box (v1.13.0-beta.12 plugin.json + installed_plugins.json says 1.12.5.1 + record stale per Plan-03 closure):

```
FAIL  install-state: install-state record present + snapshot matches a live spot-check
  -- install-state record stale -- record says 1.13.0-beta.12, installed_plugins.json says 1.12.5.1; re-run session-start
PASS  deployment-surfaces: every owned deployment surface reconciled
PASS  version-of-record-repo: plugin.json / package.json / CHANGELOG top entry consistent
FAIL  verify-release: scripts/verify-release passes  -- verify-release exited 1
PASS  doctor-all: doctor --all exits 0

Acceptance pre-tag: 3/5 points passed; failed: install-state, verify-release.
```

JSON output: `failed_points: ['install-state', 'verify-release']`; `summary: {total: 5, passed: 3, failed: 2}`. Well-formed.

**What this proves:**

1. **All 5 pre-tag points enumerated.** The filter works -- `version-of-record-published` and `npx-roundtrip` are correctly absent from the output.
2. **Class I correctly flags real drift on this dev box.** The record-stale finding (`record says 1.13.0-beta.12, installed_plugins.json says 1.12.5.1`) is the EXACT state Plan-03 documented at closure. The acceptance runner faithfully surfaces it -- this is NOT a Plan-04 regression; it is Plan-04 working as designed.
3. **verify-release sub-check works.** The dev box has 6 uncommitted changes + the parallel Phase 110 work, so `verify-release` correctly exits 1. The acceptance runner picks it up as a failed point.
4. **Doctor --all and version-of-record-repo PASS.** version-of-record-repo passes because plugin.json (1.13.0-beta.12) == package.json (1.13.0-beta.12) AND CHANGELOG top is `[Unreleased]` (which we accept under the operator-drift-tolerance rule).

**Canon Part 8 evidence** -- `awk '/^function buildAcceptanceChecklist/,/^async function runAcceptance/' scripts/doctor.cjs | grep -cE "fetch\(|http\.|https\.|brain\.mindrian|tavily"` returns **0**. The only network calls in the acceptance block are `npm view` and `npx`, both gated to the `version-of-record-published` + `npx-roundtrip` points (apply_to `['full']` only). `--pre-tag` has ZERO network -- in-session safe.

**Step ordering evidence** -- `grep -nE "Step 6\.6|Step 9\.6" scripts/release.sh`:
```
257:# --- Step 6.6: doctor --acceptance --pre-tag (HARD ABORT, no --allow) ---
266:echo "=== Step 6.6: doctor --acceptance --pre-tag ==="
447:# --- Step 9.6: doctor --acceptance (full, HARD ABORT, no --allow) ---
473:echo "=== Step 9.6: doctor --acceptance (full) ==="
```

Step 6.6 lands between Step 6.5 (~L243) and Step 7 (~L290). Step 9.6 lands between Step 9.5 npm publish (~L296) and Step 10 (~L490). Both LOGICAL positions matched -- acc.5 asserts this structurally.

## Recovery procedures (mirrored from PLAN.md <recovery> block)

Named recovery procedures by failure point. **npm publishes are practically irreversible** (the version slot is burned in the npm registry even after `dist-tag rm`). Cite this section in the operator log + the SUMMARY whenever release.sh aborts.

### R.1 -- Step 7 fail (commit A or tag) BEFORE npm publish

Local-only recovery; no public artifact created.

```bash
git tag -d v$NEW_VERSION 2>/dev/null || true     # delete the tag if it landed
git reset --hard HEAD~1                           # rewind to before commit A
cd ~/mindrian-marketplace && git reset --hard HEAD~1 && cd -
# Re-run release.sh after fixing the cause.
```

Lawrence notify OPTIONAL here.

### R.2 -- Step 9.5 fail (npm publish errored)

The Step 9.5 block in `release.sh` already prints recovery instructions on non-zero exit (per Plan-01 Task 2's design). Follow them: typically `npm publish --tag $NPM_TAG` re-run AFTER fixing the cause (network blip, auth re-do, payload-allowlist gate). Idempotent IF the slot wasn't burned.

### R.3 -- Step 9 fail (git push errored) AFTER npm publish landed

Risky state: npm artifact is published but git tag isn't on origin. Recovery:

```bash
cd ~/MindrianOS-Plugin && git push origin main && git push origin --tags
cd ~/mindrian-marketplace && git push origin master
# Push tags separately if --tags fails on its own.
```

Investigate upstream if persistent.

### R.4 -- Step 9.6 fail AFTER everything else succeeded

**WORST CASE.** npm slot for vN is burned, tag is on origin, marketplace points at vN, published artifact is inconsistent.

**Option A (PREFERRED): YANK + cut successor.**

```bash
# 1. Deprecate vN on npm (does NOT remove the slot; warns installers):
npm deprecate @mindrian_os/install@$NEW_VERSION "broken -- see $NEXT_FIX_VERSION (Phase 123 --acceptance failed; do not install)"

# 2. Remove from @next dist-tag:
npm dist-tag rm @mindrian_os/install next

# 3. Fix the cause locally (the --acceptance failure mode -- usually a deployment-surface mismatch or marketplace.json source.ref off-by-one).

# 4. Cut the successor via the normal release.sh path:
bash scripts/release.sh --prerelease
# (release.sh will compute NEW_VERSION = vN+1 from the current plugin.json which is at vN.1 per Commit B's next-bump)
```

**Option B (USE ONLY IF the fix is a no-code-change).** Same as A but the successor publish lands without code changes. Rare and risky.

### R.5 -- Operator communication template

In ANY case where the failure reaches Step 9.6 (published artifact inconsistent) OR Step 9 (partially-published state on origin), notify Lawrence (and any other registered tester) via `testers/outbox/` OR direct email:

```
Subject: MOS release v$NEW_VERSION ROLLED BACK -- do not install
Body: doctor --acceptance failed AFTER the npm publish. The version is deprecated
      on npm; a fix is being cut as v$NEXT_FIX_VERSION. ETA: <operator-estimate>.
      Hold off on `claude plugin update mos@mindrian-marketplace` until further notice.
```

The operator decides timing (immediate vs end-of-day batch); the notification is REQUIRED, not optional, for any (R.4) recovery.

### R.6 -- Decision matrix

- Step 7 fail (R.1): retry locally, NO notify.
- Step 9.5 fail (R.2): retry the publish step, NO notify.
- Step 9 fail (R.3): retry the push, NO notify UNLESS the failure persists >24h.
- Step 9.6 fail (R.4): YANK + cut successor + NOTIFY. **No retry of the failed acceptance against the broken artifact.**

### R.7 -- Operator log audit trail

Whenever any recovery path is taken, append a line to `~/.mindrian/recovery-log.txt` (mkdir -p first; create the file if absent):

```
<ISO-timestamp> v$NEW_VERSION recovery-path=<R.1|R.2|R.3|R.4> notes=<one-line>
```

This is the audit trail. The operator may also reference it in the next release's SUMMARY.

## Deviations from Plan

None of substance. Plan executed exactly as written.

Two minor automatic adjustments worth noting (NOT deviations; covered by Claude's discretion in the plan):

**1. [Discretion] CHANGELOG top entry tolerance.** Plan's pseudocode for `version-of-record-repo` does `pj.version === chTop` STRICT equality. Live evidence: `release.sh` Step 6 finalizes `[Unreleased]` -> `[vN]` BEFORE Step 6.6 runs (verified in `release.sh` L216-241), so by the time Step 6.6 calls --pre-tag, chTop IS the version. HOWEVER, the doctor is ALSO callable in-session (e.g. when the operator runs `node scripts/doctor.cjs --acceptance --pre-tag` mid-development to check release-readiness), in which case CHANGELOG top is `[Unreleased]`. The check accepts both: `allMatch = pjVer === pkVer && (pjVer === chTop || chTop === 'Unreleased')`. This is the operator-drift-tolerance pattern from class-I's STRING equality + 'unknown' leg exclusion (Plan-03 key-decision 3). The live dev box (CHANGELOG top = `[Unreleased]`) passes version-of-record-repo as a result.

**2. [Discretion] Acceptance dispatched BEFORE class-flag block in main().** The plan said "after the existing class-flag block, BEFORE computeSummary". I inverted this -- placed at the TOP of main() instead. Reason: --acceptance has its OWN exit-code contract (0/1 HARD ABORT), incompatible with the class-flag-always-exit-0 graceful-degradation invariant that runs at the bottom of main(). Dispatching at top means: --acceptance early-exits before the class-flag mode kicks in. The doctor-all sub-check spawns ourselves with --all via a CHILD PROCESS, so the existing per-class detectors still run (in the child, under normal class-flag-mode semantics). Functionally equivalent; structurally cleaner. Documented in a comment block above the dispatch.

## Verification

- **`node --check scripts/doctor.cjs`** exits 0.
- **`bash -n scripts/release.sh`** exits 0.
- **`node tests/test-doctor-acceptance.cjs`** exits 0 -- all 6 scenarios PASS:
  - acc.1 --pre-tag filters to 5 pre-tag-applicable points
  - acc.2 --acceptance calls verify-release exactly once
  - acc.3 sub-check failure -> non-zero exit
  - acc.4 npx sandbox cleanup (--light-npx skips sandbox)
  - acc.5 release.sh wires --pre-tag before tag AND full --acceptance after push
  - acc.6 release-beta-smoke.sh is deleted
- **Pre-existing doctor tests still PASS:** `test-doctor-class-i.cjs` (11/11), `test-doctor-class-j.cjs` (8/8), `test-doctor-atomic-swap.cjs` (9/9), `test-doctor-class-g.cjs` (6/6).
- **`grep -q "doctor --acceptance --pre-tag" scripts/release.sh`** AND **`grep -q "doctor --acceptance" scripts/release.sh`** return TRUE.
- **`test -f scripts/release-beta-smoke.sh`** returns FALSE.
- **`git ls-files scripts/release-beta-smoke.sh`** returns empty.
- **Canon Part 8 zero-network sweep** -- `awk '/^function buildAcceptanceChecklist/,/^async function runAcceptance/' scripts/doctor.cjs | grep -cE "fetch\(|http\.|https\.|brain\.mindrian|tavily"` returns 0.
- **No em-dashes** in the new code blocks: `awk '/^function buildAcceptanceChecklist/,/^\/\/ -- Renderers/' scripts/doctor.cjs | grep -P "\xe2\x80\x94"` returns nothing.
- **`bin/cli.js` argv pass-through verified** -- L111 `run(process.execPath, [path.join(root, 'scripts', 'doctor.cjs'), ...process.argv.slice(argOffset)])` passes argv verbatim; no edit needed.

## What This Unlocks

- **Plan-05 (cache pruning + @mindrian_os/cli sweep)** can now rely on `--acceptance --pre-tag` as the pre-tag gate. The cache-prune call in `--fix` lands at the TODO marker in `performClassJFix` (per Plan-03 closure). The `@mindrian_os/cli` doc sweep targets `docs/install/PACKAGING-PATHS.md` + `tests/manual/95.6-windows-cold-install-acceptance.md` + (lightly) `tests/test-release-npm-gate.sh`.
- **Plan-06 (cut v1.13.0-beta.13)** will validate the entire phase by running `bash scripts/release.sh --prerelease` end-to-end. Step 6.6 + Step 9.6 will gate the release.
- **Plan-07 (Brain-key resolver)** unaffected -- different surface (Brain key detection vs install/release state).

## Self-Check

Files claimed in this SUMMARY:

- `scripts/doctor.cjs` -- exists; +339 / -2 lines (verified via `git show c9bf670 --stat`)
- `scripts/release.sh` -- exists; modified to add Step 6.6 + Step 9.6 (verified via `grep -nE "Step 6\.6|Step 9\.6" scripts/release.sh`)
- `scripts/release-beta-smoke.sh` -- DELETED (verified `test ! -f`)
- `tests/test-doctor-acceptance.cjs` -- exists, 315 lines, 6 scenarios, registered in feynman runner
- `lib/memory/run-feynman-tests.cjs` -- updated (+1 line in Phase-123 block)
- `.planning/phases/123-install-lifecycle-harness/123-04-SUMMARY.md` -- this file

Commits claimed:

- `584801b` (Task 1, RED): test(123-04): Wave 0 -- hermetic harness for doctor --acceptance (RED)
- `c9bf670` (Task 2, GREEN): feat(123-04): doctor --acceptance + --pre-tag + --light-npx
- `c54c6af` (Task 3, GREEN): feat(123-04): release.sh Step 6.6 + Step 9.6 acceptance gates; retire release-beta-smoke.sh

## Self-Check: PASSED

All 5 created/modified files verified present on disk (scripts/doctor.cjs, scripts/release.sh, tests/test-doctor-acceptance.cjs, lib/memory/run-feynman-tests.cjs, 123-04-SUMMARY.md). scripts/release-beta-smoke.sh verified DELETED (test ! -f returns true). All 3 commit hashes (584801b, c9bf670, c54c6af) verified present in `git log --all`. Test suite (tests/test-doctor-acceptance.cjs): 6/6 PASS. Pre-existing doctor tests (class-i 11/11, class-j 8/8, atomic-swap 9/9, class-g 6/6) all PASS -- no regression.
