---
phase: 123-install-lifecycle-harness
plan: 03
subsystem: infra
tags: [doctor, install-state, deployment-surfaces, topology, version-of-record, bug-7, legacy-migration, dev-clone-safety, canon-part-8, install-lifecycle]

# Dependency graph
requires:
  - phase: 123-install-lifecycle-harness
    plan: 02
    provides: "lib/core/active-plugin-root.cjs topology field on every return path; classifyTopology() exported. data/deployment-surfaces.json static manifest. scripts/session-start single-writer of ~/.mindrian/install-state.json + ~/.mindrian-last-version (Pitfall-7 fixed)."
  - phase: 95.1-mos-doctor-drift-detection-and-self-heal
    provides: "scripts/doctor.cjs drift-class roster A-G + per-class --fix pattern + performRecoveryAtomic + safeRename (the backup-before-mutate template Plan-03 reuses)."
  - phase: 95.6-install-cache-windows-hardening-and-skill-loop-resilience
    provides: "scripts/doctor.cjs class H (checkInstallIncomplete) at L1119+ -- the existing class H roster slot that forced Plan-03 to renumber its new classes to I + J per RESEARCH Pitfall 3."
  - phase: 108-graph-memory-schema-reconciliation
    provides: "scripts/install-pre-commit.sh -- the dev-clone pre-commit-hook installer reused by class J --fix when the dev-clone-pre-commit-hook surface needs re-installation."
provides:
  - "scripts/doctor.cjs class I (install-state + topology + 6-way version-of-record consistency) -- HARNESS-123-07. Reads ~/.mindrian/install-state.json; live spot-check vs installed_plugins.json (D-05); topology classification per D-11 (Bug 7 fix: marketplace-cache topology is HEALTHY, not drift); 6-way version-of-record equality across IP/AV/SR/LV/PB via STRING equality (tolerates non-semver 1.12.5.1)."
  - "scripts/doctor.cjs class J (deployment-surface manifest reconciliation) -- HARNESS-123-08. Walks data/deployment-surfaces.json; per-surface marker / exact-value / observed-only checks with topology_scope=='dev-clone' carve-out + reconcile=='never' self-exclusion. Desktop/Cowork carve-out via lib/statusline/surface-detect.cjs."
  - "scripts/doctor.cjs aggressive --fix per D-13 -- HARNESS-123-09. Auto-recovers: missing record (spawn session-start), drifted ~/.mindrian-last-version (rewrite), legacy-clone migration (backup-verify-remove with the dev-clone safety belt + dirty/unpushed refuse), conservative installed_plugins.json repair. Flag-only: topology=='not-found', vanished PATH-bin, statusline-renders-wrong-version."
  - "Schema extension to data/deployment-surfaces.json: optional path_within_file (dot-path) field on a surface entry tells the check_kind=='exact-value' reader to JSON-parse `path` and compare the value at path_within_file rather than substring-matching the whole file. The settings-statusline-command surface now carries `path_within_file: 'statusLine.command'` -- closes the live-dev-box whole-file-comparison bug. Documented in data/ROOM.md."
  - "tests/test-doctor-class-i.cjs (11 hermetic scenarios) + tests/test-doctor-class-j.cjs (8 hermetic scenarios) -- HARNESS-123-10. Mirrors the makeTmpHome + runDoctor + MINDRIAN_PLUGIN_HOME pattern from tests/test-doctor-class-g.cjs and tests/test-doctor-atomic-swap.cjs."
affects: [123-04, 123-05, 123-06, 123-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drift-class registration via report.checks[<name>]: class I + class J join classes A-H using the same shape ({status, finding|findings, recoverable, ...}) so computeSummary walks them agnostically and --json output stays byte-stable. The class-flag invariant (--install-state -> exit always 0 unless an explicit --fix attempt failed) is preserved."
    - "Aggressive --fix under hard guardrails: every legacy-touching op is backup-before-mutate + idempotent + NEVER touches the active root + NEVER touches a dev-clone. The dev-clone test is belt-and-suspenders (MINDRIAN_OS_ROOT env check AND git origin remote URL match against /mindrian-os-plugin/i) -- per RESEARCH Pitfall 4 (the live dev box's legacy clone has its origin pointed at mindrian-agno-backend.git, so the structural origin-URL check alone would mis-classify it). The dirty/unpushed refuse uses real `git status --porcelain` + `git log @{u}..HEAD` via child_process.spawnSync."
    - "Manifest path expansion at READ time (D-07): the manifest stores literal $HOME / <active_root> / <dev_clone_root> tokens; the reader expands $HOME via os.homedir() AND substitutes <active_root> from resolveActivePluginRoot() AND skips <dev_clone_root> surfaces on non-dev-clone boxes. The schema extension `path_within_file` (dot-path) is honored by the exact-value reader before substring matching."
    - "Class-A carve-out under --install-state: when --install-state is active, class A's `--fix` (performRecoveryAtomic) is suppressed so class I owns the legacy-migration semantics. Without this carve-out, class A would migrate the legacy dir AHEAD of class I's dev-clone safety belt + dirty-legacy refuse contract -- the test i.4 (dirty legacy -> --fix REFUSES) caught this exact regression during Wave 0."
    - "Bug 7 reinterpretation lives in main(): when class A install-cache reports status:'missing' AND class I topology=='marketplace-cache', class A's finding is downgraded to status:'ok' with a note. report.drift.detected resets so the exit-code chain does not report drift. Existing class A on a legacy-topology box still surfaces drift; only the marketplace-cache case is reinterpreted."

key-files:
  created:
    - "tests/test-doctor-class-i.cjs (411 lines, 11 hermetic scenarios)"
    - "tests/test-doctor-class-j.cjs (303 lines, 8 hermetic scenarios)"
    - ".planning/phases/123-install-lifecycle-harness/123-03-SUMMARY.md (this file)"
  modified:
    - "scripts/doctor.cjs (+869 / -5 lines: imports + resolveActivePluginRoot wire-in at line 39; --install-state flag in parseArgs + usage text; class-flag invariant extended in main(); class A --fix carve-out under --install-state; the ~750-line class I + class J + their --fix helpers block at lines 1313..2072; the class I + class J dispatch in main() including the Bug 7 reinterpretation; INSTALL_DIR constant preserved for existing class A)"
    - "data/deployment-surfaces.json (+1 field: path_within_file: 'statusLine.command' on the settings-statusline-command surface entry; remediation prose extended to mention the Plan-03 schema extension)"
    - "data/ROOM.md (schema row extended: optional path_within_file field documented; live-dev-box bug it closes mentioned; canon_parts widened; Phase 123 plans 02+03 bound)"
    - "lib/memory/run-feynman-tests.cjs (+2 lines: test-doctor-class-i.cjs + test-doctor-class-j.cjs registered in the Phase-123 block alongside Plans 01+02 entries)"

key-decisions:
  - "Renumber to class I + class J (NOT H + I per CONTEXT D-12 / RESEARCH Pitfall 3): the codebase already has a class H (checkInstallIncomplete -- install-incomplete: missing statusLine block / halted .install-receipt.json -- shipped tests test-doctor-class-h*.cjs). Renumbering the new classes is the smaller refactor."
  - "ONE new flag --install-state activates BOTH classes (mirroring how --statusline-visibility activates two checks). --all activates them too. Keeps the flag surface minimal."
  - "STRING equality for version-of-record comparisons (NEVER semver.valid / semver.eq): the dev box's installed_plugins.json carries version=1.12.5.1 (a 4-component non-semver string). semver.valid('1.12.5.1') returns null; the comparison must tolerate it. collectVersionOfRecord returns 'unknown' for any leg the reader can't determine; computeVersionDivergences excludes 'unknown' legs from the pairwise compare so a missing leg is silent, not a false positive."
  - "Bug 7 reinterpretation is a downgrade, NOT a removal: class A's check still runs (its 'missing' finding is informational on a marketplace-cache box, and remains a real drift finding on a legacy-topology box). Removing class A would lose the legacy-clone-present detection that class I depends on alongside marketplace-cache."
  - "Class A --fix is suppressed only when --install-state is set (NOT unconditionally). Existing /mos:doctor --fix (no class flag) preserves the Phase 95.2 atomic-swap semantics byte-for-byte. The carve-out is opt-in via the new flag."
  - "Schema extension `path_within_file` is forward-compatible: existing surfaces without the field still substring-match the whole file. Only the settings-statusline-command surface uses it today, but the manifest stays the source of truth for future JSON-path-extracted comparisons (the natural place to add settings.json `hooks` validation later)."
  - "Legacy-migration tarball backup uses `tar -czf ~/.mindrian/backups/legacy-<ISO>.tar.gz` (system tar -- mirroring scripts/install.sh's existing pattern). cp+rmSync was rejected because tar produces a single auditable artifact with timestamps preserved."
  - "Conservative installed_plugins.json repair: only when the entry's installPath points at a missing dir AND a healthy marketplace-cache install exists. Repoints to the newest valid marketplace-cache dir (NOT a wholesale rewrite). Backs up first to ~/.mindrian/backups/installed_plugins.json.<ISO>.bak. Notes that Claude Code needs a restart. ABSENT-mos-entry-while-cache-present case deferred -- the dev-box state doesn't exhibit it; will land if a Wave-2 tester surfaces it."

patterns-established:
  - "Same-surface drift class registration via report.checks: existing classes A-H + new I + J read/write report.checks[<name>] with the same {status, findings|finding, recoverable} shape so computeSummary, --json, and class-flag invariants are all 100% agnostic to which class produced a row."
  - "Hermetic doctor test envelope reuse: tests/test-doctor-class-i.cjs and tests/test-doctor-class-j.cjs literally adopt the makeTmpHome (mkdtempSync .claude/plugins/ tree) + runDoctor (spawnSync with HOME + USERPROFILE + MINDRIAN_PLUGIN_HOME + MINDRIAN_STATUSLINE_SURFACE=CLI overrides) pattern from tests/test-doctor-class-g.cjs and tests/test-doctor-atomic-swap.cjs -- new doctor classes drop into the same harness."
  - "Recovery-record uniform shape: every --fix op (class A's performRecoveryAtomic + class I's record-write/legacy-migration/installed_plugins.json repair + class J's surface re-stamp) pushes onto report.recovered AND, for class I/J ops, onto report.recoveries[]. Each entry carries {class|tool, surface|action, ok|status, backup_path?, detail|reason?}. Forward-compat: Plan-4's --acceptance can walk one array to confirm 'everything recovered'."
  - "Manifest schema additive extension: `path_within_file` is opt-in (absent on 5 of 6 surfaces; present only on settings-statusline-command). The reader's check_kind=='exact-value' branch tries path_within_file first, falls back to whole-file substring match. New surfaces with JSON-path-extracted comparisons add one field without touching the 5 existing surfaces' shapes."

requirements-completed: [HARNESS-123-07, HARNESS-123-08, HARNESS-123-09, HARNESS-123-10]

# Metrics
duration: 14m
completed: 2026-05-13
---

# Phase 123 Plan 03: install-lifecycle-harness Summary

**`scripts/doctor.cjs` becomes the contract checker. Class I (install-state + topology + 6-way version-of-record consistency, string equality tolerates the 4-component non-semver 1.12.5.1) + Class J (deployment-surface manifest reconciliation with the new `path_within_file` JSON-path extraction that closes the live-dev-box settings.json whole-file-comparison bug) + aggressive `--fix` under hard guardrails (legacy migration with backup-verify-remove + dev-clone safety belt + dirty/unpushed refuse, conservative installed_plugins.json repair, never touches a dev-clone) + the Bug-7 reinterpretation (marketplace-cache topology with no legacy dir is HEALTHY, not drift) all land under one new `--install-state` flag.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-13 (immediately after Plan 123-02 landed at 9383bf6)
- **Completed:** 2026-05-13
- **Tasks:** 2 (RED tests, then GREEN implementation)
- **Files modified:** 6 (3 created, 3 modified)
- **Per-task commits:** 2 (`819c0fc` RED, `b70e7d9` GREEN)

## Accomplishments

### Class I -- install-state + topology + 6-way version-of-record consistency (HARNESS-123-07)

`scripts/doctor.cjs` gained a new `checkInstallState({home})` function that:

1. **Reads the snapshot.** `~/.mindrian/install-state.json` is parsed; absent or unparseable → `{id: 'record-absent', status: 'warn', recoverable: true}` finding ("install-state record absent -- run session-start (or doctor --fix)"). Per D-02, doctor never hard-errors on a missing record -- diagnosing a broken install IS its job.

2. **Live spot-check (D-05).** Re-resolves via `resolveActivePluginRoot()`, then compares `record.active_version` to the live `installed_plugins.json` entry version. STRING equality. Divergence → `{id: 'record-stale', recoverable: false}` finding ("install-state record stale -- record says X, installed_plugins.json says Y; re-run session-start"). NOT "install drift" -- this is a record-freshness signal, not an install-state signal.

3. **Topology classification (D-11, BUG 7 fix).** Reads `topology` from the record OR the live resolver. Each of `marketplace-cache | dev-clone | legacy | not-found` is VALID. Only `not-found` is drift on its own (flag-only -- "reinstall the plugin"). A `legacy` topology alongside a healthy marketplace-cache install IS flagged as a migration candidate (`recoverable: true`). The most-common live case -- topology=='marketplace-cache' with a separate legacy dir at `~/.claude/plugins/mindrian-os/` (Bug 7's symptom) -- is also flagged as a migration candidate. **Bug 7 dies:** a marketplace-cache install with NO legacy dir is HEALTHY, period.

4. **6-way version-of-record equality.** Compares 5 legs in `collectVersionOfRecord`:
   - **IP** -- `installed_plugins.json` entry.version (live)
   - **AV** -- record.active_version (snapshot)
   - **SR** -- record.statusline_renders_version (snapshot; "unknown" defaults handled)
   - **LV** -- `~/.mindrian-last-version` file content (live)
   - **PB** -- record.path_bin_version OR live `$PATH` probe (live)
   
   `computeVersionDivergences` does pairwise STRING equality and excludes any "unknown" leg. Each disagreement becomes a `vor-<from>-vs-<to>` finding. Recoverable iff the LV leg is involved (and PB is not -- PATH is owned by Claude Code, flag-only).

5. **Returns** `{status, topology, record, record_present, versions, findings[], resolver, recoverable}` -- the shape `computeSummary` and `--json` walk.

### Class I `--fix` -- aggressive recovery under hard guardrails (HARNESS-123-09)

`performClassIFix(check, {home})`:

- **`record-absent` -> spawn session-start.** `bash $PLUGIN_ROOT/scripts/session-start` (with `SESSION_START_NODE_PREFLIGHT_SKIP=1` to keep the hermetic harness fast). Records `{surface: 'record', action: 'session-start-write', ok: <recorded>, exit_code}` in `report.recoveries`.

- **`vor-*-vs-LV` -> rewrite `~/.mindrian-last-version`** to the value of the OTHER leg. Idempotent.

- **`topology` (legacy or marketplace-cache + alongside-legacy) -> migrate legacy clone:**
  1. **Dev-clone safety belt** (`isLegacyDevClone`): MINDRIAN_OS_ROOT pointing at the dir OR `git -C <legacy> remote get-url origin` matching `/mindrian-os-plugin/i` -> ABORT migration (`action: 'skipped'`, reason: 'origin remote points at mindrian-os-plugin OR MINDRIAN_OS_ROOT is set -- treating as a dev clone, NOT migrating').
  2. **Dirty/unpushed refuse** (`legacyDirtyOrUnpushed`): `git status --porcelain` non-empty OR `git log @{u}..HEAD --oneline` non-empty OR no-upstream-set (conservative) -> ABORT (`action: 'skipped'`, reason: dirty/uncommitted/unpushed/no-upstream).
  3. **Confirm healthy marketplace-cache** (`detectMarketplaceCacheInstall`): if no valid marketplace-cache install exists alongside, ABORT (no fallback to migrate to).
  4. **Tar + verify:** `mkdir -p ~/.mindrian/backups/`; `tar -czf legacy-<ISO>.tar.gz -C <dirname> <basename>`; verify the tarball exists + non-empty.
  5. **Remove:** `fs.rmSync(legacyDir, { recursive: true, force: true })`.
  6. Records `{surface: 'legacy-clone', action: 'migrated', backup_path, ok: true, note}`.

- **Conservative `installed_plugins.json` repair:** When the entry's installPath points at a missing dir AND a valid marketplace-cache install exists, back up to `~/.mindrian/backups/installed_plugins.json.<ISO>.bak` + repoint the entry at the newest valid marketplace-cache dir. Notes that Claude Code needs a restart. NOT a wholesale rewrite -- only mutates the affected entry.

- **Flag-only (no `--fix` action):** topology=='not-found' (reinstall the plugin); PATH-bin entry vanished (restart Claude Code); statusline_renders_version mismatch (recoverable:false because re-stamping the symptom masks an active-plugin-root.cjs bug).

### Class A carve-out under `--install-state`

When `--install-state` is set, class A's `--fix` (`performRecoveryAtomic`) is suppressed. Class I owns the legacy-migration semantics under that flag. Without this carve-out, class A would migrate the legacy dir AHEAD of class I's dev-clone safety belt + dirty-legacy refuse contract -- the test i.4 (dirty legacy -> --fix REFUSES) caught this exact regression during Wave 0. Existing `/mos:doctor --fix` (no class flag) preserves Phase 95.2 atomic-swap semantics byte-for-byte.

### Bug 7 reinterpretation in main()

When class A install-cache reports `status: 'missing'` AND class I topology=='marketplace-cache', class A's finding is downgraded to `{status: 'ok', note: 'legacy clone path expected absent on a marketplace-cache install (Bug 7 fix)', bug7_fix: true}` and `report.drift.detected` is reset. Existing class A on a `legacy`-topology box still surfaces drift; only the marketplace-cache case is reinterpreted.

### Class J -- deployment-surface manifest reconciliation (HARNESS-123-08)

`checkDeploymentSurfaces({home, topology, activeRoot, activeVersion})`:

- **Desktop / Cowork carve-out** via `lib/statusline/surface-detect.cjs` (or the `CLAUDE_DESKTOP=1` fallback) -> `status: 'skipped'`.
- **Reads `$PLUGIN_ROOT/data/deployment-surfaces.json`.** For each surface:
  - `topology_scope=='dev-clone'` AND topology != `dev-clone` -> `status: 'skipped'`.
  - `reconcile=='never'` (the install-state-record self-entry) -> observed-only, `ok: null`, NEVER `ok: false`.
  - **Expand path tokens** at read time: `$HOME` -> `os.homedir()`; `<active_root>` -> resolver root; `<dev_clone_root>` -> resolver root on dev-clone, else skip.
  - **`check_kind: 'marker'`** -> substring presence of `expected` in the file's content. Missing -> `ok: false`.
  - **`check_kind: 'exact-value'`** -> if the surface has `path_within_file` (schema extension), JSON-parse the file + read the dot-path + STRING-equal to substituted `expected`. Otherwise substring-match the whole file. **The substitution expands `$HOME` in BOTH the path AND the expected value** so the canonical `bash "$HOME/.claude/statusline-mos"` compares like-for-like against the deployed `bash "/home/user/.claude/statusline-mos"`.
  - **`check_kind: 'observed-only'`** -> presence/absence, `ok: null` always.

Returns `{status: healthy | warn | skipped, surfaces: [{...}], recoverable: <some owned surface is ok:false>}`.

### Class J `--fix`

`performClassJFix(check, {home, activeVersion})` walks `ok:false` `owner: 'session-start'` surfaces and re-stamps each:
- **statusline-dispatch-shim** -> copy `scripts/statusline-mos-dispatch` to `<HOME>/.claude/statusline-mos`, chmod 755 (with the `MINDRIAN-STATUSLINE-DISPATCH` marker preserved).
- **settings-statusline-command** -> JSON-merge rewrite at `statusLine.command` (does NOT clobber unrelated keys; mkdir -p the parent dir).
- **mindrian-last-version** -> write `activeVersion` to `<HOME>/.mindrian-last-version`.
- **dev-clone-pre-commit-hook** -> spawn `bash scripts/install-pre-commit.sh` from the dev-clone root.

Forward-compat TODO for Plan-5: an unconditional cache-prune call.

### Schema extension -- `path_within_file`

`data/deployment-surfaces.json` got one new optional field: `path_within_file` (dot-path). On the `settings-statusline-command` surface:

```json
{
  "id": "settings-statusline-command",
  "path": "$HOME/.claude/settings.json",
  "path_within_file": "statusLine.command",
  "owner": "session-start",
  "topology_scope": "all",
  "check_kind": "exact-value",
  "expected": "bash \"$HOME/.claude/statusline-mos\"",
  ...
}
```

The class-J reader sees `path_within_file`, JSON-parses settings.json, walks `statusLine.command`, and STRING-equates the value against the `$HOME`-substituted expected. **Closes the live-dev-box bug** where the whole-file comparison was producing `ok: false` against a fully healthy settings.json. The fix lands in this plan because class J is its consumer; `data/ROOM.md` documents the schema extension.

### Test fixtures (HARNESS-123-10)

- **`tests/test-doctor-class-i.cjs`** -- 11 scenarios:
  - i.1 absent record -> warn + recoverable
  - i.2 wrong LV -> drift + `--fix` rewrites
  - i.3 legacy + marketplace-cache -> migration via `--fix`
  - i.4 dirty legacy -> `--fix` REFUSES (legacy dir remains)
  - i.5 MINDRIAN_OS_ROOT dev-clone -> NEVER touched by `--fix`
  - i.6 4-component non-semver 1.12.5.1 -> no crash, exit != 3
  - i.7 clean install -> 6-way VoR green
  - i.8 LV divergence -> drift
  - i.9 missing record + `--fix` -> records session-start-write recovery
  - i.10 record stale (spot-check disagrees) -> re-run session-start finding
  - i.11 marketplace-cache topology -> healthy, no drift (BUG 7)

- **`tests/test-doctor-class-j.cjs`** -- 8 scenarios:
  - j.1 all 6 surfaces healthy -> status: 'healthy'
  - j.2 missing dispatch marker -> drift + `--fix` re-stamps
  - j.3 wrong settings.json statusLine.command (via path_within_file) -> drift + `--fix` rewrites
  - j.4 wrong LV -> drift + `--fix` rewrites
  - j.5 dev-clone-pre-commit-hook on marketplace-cache box -> SKIPPED
  - j.6 dev-clone-pre-commit-hook on dev-clone box -> CHECKED
  - j.7 install-state-record self-entry excluded from its own check (ok:null)
  - j.8 plugin-bin-path-entry observed-only -- NEVER stamped

Both registered in `lib/memory/run-feynman-tests.cjs` Phase-123 block alongside Plan-01's `test-release-bump-algebra.cjs` + Plan-02's `test-install-state-record.cjs`. Picked up automatically by `tests/run-all.sh`'s `test-*.cjs` glob.

## Live dev-box evidence

After Plan-03 lands on this dev box (which has the live `1.13.0-beta.12` install + the legacy `~/.claude/plugins/mindrian-os/` clone + `installed_plugins.json` version `1.12.5.1`), `node scripts/doctor.cjs --install-state --json` reports:

```
install-state.status: warn
install-state.topology: marketplace-cache
install-state.recoverable: True
install-state.findings:
  - record-stale : install-state record stale -- record says 1.13.0-beta.12, installed_plugins.json says 1.12.5.1; re-run session-start
  - topology : legacy clone present at /home/jsagi/.claude/plugins/mindrian-os alongside marketplace-cache install -- migration candidate (run with --fix to backup-then-remove)
  - vor-IP-vs-AV : version-of-record divergence: IP=1.12.5.1 vs AV=1.13.0-beta.12
  - vor-IP-vs-LV : version-of-record divergence: IP=1.12.5.1 vs LV=1.13.0-beta.12
  - vor-AV-vs-PB : version-of-record divergence: AV=1.13.0-beta.12 vs PB=1.12.5.1

deployment-surfaces.status: healthy
deployment-surfaces.recoverable: False
  - statusline-dispatch-shim kind=marker ok=True
  - settings-statusline-command kind=exact-value ok=True observed=bash "/home/jsagi/.claude/statusline-mos"
  - mindrian-last-version kind=exact-value ok=True observed=1.13.0-beta.12
  - install-state-record kind=observed-only ok=None
  - plugin-bin-path-entry kind=observed-only ok=None
  - dev-clone-pre-commit-hook kind=marker ok=None
```

What this proves:
- **BUG 7 dies on this box:** `topology=='marketplace-cache'` is reported as a VALID topology; the legacy dir alongside is correctly flagged as a migration candidate (NOT as drift in the install-state itself).
- **`path_within_file` extraction works on live data:** settings-statusline-command surface now reports `ok: True` with `observed = 'bash "/home/jsagi/.claude/statusline-mos"'`. Before Plan-03 the whole-file comparison reported `ok: false` against the same healthy settings.json (the live install-state record's surfaces[] from Plan-02 still shows the stale `ok: false` -- a fresh session-start run on this box will refresh that snapshot).
- **String equality + non-semver tolerance:** the dev box's `1.12.5.1` (4-component) is compared against `1.13.0-beta.12` cleanly, no crash, no semver.valid() null-pointer.
- **Class I correctly flags real drift:** the record_stale + legacy-alongside + VoR-IP-vs-AV (1.12.5.1 vs 1.13.0-beta.12) divergences are the actual install-state drift on this dev box (the staleness is a known side-effect of Phase 110 + Phase 123 parallel-wave activity on `main`; a fresh `session-start` would update the record).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Class A `--fix` carve-out under `--install-state`**

- **Found during:** Task 2, running Wave-0 test i.4 (dirty legacy -> --fix REFUSES).
- **Issue:** Test i.4 failed with "legacy dir remains -- --fix refused: false !== true". Trace showed `legacyDirtyOrUnpushed` returning `dirty:false` (with `git status --porcelain` exit 128 + stderr "fatal: not a git repository") because class A's `performRecoveryAtomic` had ALREADY migrated the legacy dir to `mindrian-os.stale-0.0.0-<ts>/` BEFORE class I ran. Class A's drift detector saw the cache install (1.13.0-beta.13) vs the stale legacy (0.0.0) and fired its own atomic swap.
- **Fix:** Suppress class A's `--fix` when `flags.installState` is set. Class I owns legacy-migration semantics under that flag (with the dev-clone safety belt + dirty-legacy refuse contract that class A doesn't have). Existing `/mos:doctor --fix` (no class flag) preserves Phase 95.2 atomic-swap semantics byte-for-byte -- the carve-out is opt-in via the new flag.
- **Files modified:** `scripts/doctor.cjs` (one-line guard added to the existing class-A `--fix` dispatch at L2298).
- **Commit:** `b70e7d9` (folded into the Task 2 GREEN commit).

**2. [Rule 1 - Bug] `$HOME` expansion in `expected` literal**

- **Found during:** Task 2, running Wave-0 test j.1 (all surfaces healthy).
- **Issue:** Test j.1 failed with "expected healthy; got warn". The settings-statusline-command surface compared `expected='bash "$HOME/.claude/statusline-mos"'` (with the literal `$HOME` token) against `observed='bash "/tmp/dbg-j1/.claude/statusline-mos"'` (the expanded path). The whole-file substring match found `bash "$HOME/.claude/statusline-mos"` NOT in the JSON; `path_within_file` extraction found the expanded path NOT equal to the literal-tokened expected.
- **Fix:** Extended `substituteExpected(expected, activeVersion, home)` to ALSO replace `$HOME` with `home` in the expected literal. Class J compares like-for-like.
- **Files modified:** `scripts/doctor.cjs` (signature + body of `substituteExpected`).
- **Commit:** `b70e7d9` (folded into the Task 2 GREEN commit).

No other deviations -- the plan executed as written. The two auto-fixes above (Rule 1 -- bug) were caught by the Wave-0 RED tests written in Task 1, exactly the TDD contract the plan specified ("the executor implements function-by-function in the order given and runs `tests/test-doctor-class-i.cjs` + `tests/test-doctor-class-j.cjs` after each function group to feedback-sample").

## Verification

- **`node --check scripts/doctor.cjs`** exits 0.
- **`node tests/test-doctor-class-i.cjs`** exits 0 -- all 11 scenarios PASS.
- **`node tests/test-doctor-class-j.cjs`** exits 0 -- all 8 scenarios PASS.
- **All pre-existing doctor tests still PASS:** `tests/test-doctor-class-g.cjs` (6/6), `tests/test-doctor-class-h.cjs` (3/3), `tests/test-doctor-class-h-fix.cjs` (3/3), `tests/test-doctor-atomic-swap.cjs` (9/9), `tests/test-install-state-record.cjs` (6/6).
- **`node scripts/doctor.cjs --install-state --json`** on this dev box parses as JSON, has `checks['install-state']` AND `checks['deployment-surfaces']`, exits 0 (class-flag invariant).
- **Canon Part 8 (zero network):** `awk '/checkInstallState|checkDeploymentSurfaces|performClassIFix|performClassJFix|legacyDirtyOrUnpushed|isLegacyDevClone|detectMarketplaceCacheInstall|.../,/^}$/' scripts/doctor.cjs | grep -E "fetch\(|http\.|https\.|curl|brain\.mindrian|tavily"` returns 0.
- **No em-dashes** in the new block (lines 1313..2072): `grep -nP "\xe2\x80\x94"` returns nothing.
- **Acceptance criteria greps all PASS:** `resolveActivePluginRoot`, `checkInstallState`, `checkDeploymentSurfaces`, `--install-state`, `legacyDirtyOrUnpushed`, `MINDRIAN_OS_ROOT|mindrian-os-plugin`, `CLAUDE_DESKTOP`, `INSTALL_DIR` (preserved).

## What This Unlocks

- **Plan-04 (`mindrian-os doctor --acceptance`)** can wrap class I + class J as part of its 5-point contract. Points 1 + 2 of the contract (record present + snapshot matches live spot-check; every owned surface reconciled) ARE class I + class J.
- **Plan-05 (cache pruning)** has its hook: `performClassJFix` carries a `TODO Plan-5: unconditional cache prune call lands here` marker at the bottom.
- **Plan-06 (cut v1.13.0-beta.13)** will validate via the now-working `--install-state` + (after Plan-04 lands) `--acceptance` flags on a real Windows box.
- **Plan-07 (Brain-key resolver)** is unaffected -- different surface (Brain key detection vs install state).

## Self-Check

Files claimed in this Summary:

- `scripts/doctor.cjs` ✓ exists (+869 lines)
- `data/deployment-surfaces.json` ✓ exists (path_within_file added)
- `data/ROOM.md` ✓ exists (schema row updated)
- `tests/test-doctor-class-i.cjs` ✓ exists (411 lines, registered in feynman runner)
- `tests/test-doctor-class-j.cjs` ✓ exists (303 lines, registered in feynman runner)
- `lib/memory/run-feynman-tests.cjs` ✓ updated (2 new test-file entries in Phase-123 block)

Commits claimed:

- `819c0fc` ✓ (Task 1, RED): test(123-03): Wave 0 -- hermetic fixtures for doctor class I + class J (RED)
- `b70e7d9` ✓ (Task 2, GREEN): feat(123-03): doctor class I + class J + --install-state + aggressive --fix (GREEN)

## Self-Check: PASSED
