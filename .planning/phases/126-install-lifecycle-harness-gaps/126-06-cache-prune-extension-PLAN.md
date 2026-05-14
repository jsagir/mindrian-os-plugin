---
phase: 126
slug: install-lifecycle-harness-gaps
plan: 06
title: Cache Prune Extension (Stale Backup Window)
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/cache-prune.cjs
  - tests/test-cache-prune-extended.cjs
  - tests/run-all-126.sh
autonomous: true
requirements_addressed: []
canon_parts:
  - Part 6 (dog-fooding: stale backup accumulation surfaces only via real long-running installs)
  - Part 7 (reuse: extends existing lib/core/cache-prune.cjs without forking)
beta_target: v1.13.0-beta.15
hotfix_discipline: true
gap_closure: false
must_haves:
  truths:
    - "doctor --fix prune step removes `mindrian-os.stale-<tag>-<timestamp>` backup directories older than 30 days (default)"
    - "Backup directories younger than 30 days are RETAINED"
    - "The 30-day window is configurable via env var MOS_CACHE_PRUNE_AGE_DAYS"
    - "The active version + N most-recent non-active versions (existing Phase 123 behavior) continue to be retained unchanged -- no regression"
    - "Prune is idempotent: re-running on a pruned tree produces no further removals"
  artifacts:
    - path: "lib/core/cache-prune.cjs"
      provides: "Extended pruner that ALSO removes stale backup dirs older than MOS_CACHE_PRUNE_AGE_DAYS (default 30)"
      contains: "MOS_CACHE_PRUNE_AGE_DAYS"
    - path: "tests/test-cache-prune-extended.cjs"
      provides: "Fixture covering: stale backup pruned, recent backup retained, env-var override honored, idempotency"
      min_lines: 100
  key_links:
    - from: "lib/core/cache-prune.cjs pruneMarketplaceCache"
      to: "process.env.MOS_CACHE_PRUNE_AGE_DAYS"
      via: "config read at top of function; integer parse with 30-day fallback"
      pattern: "MOS_CACHE_PRUNE_AGE_DAYS"
    - from: "lib/core/cache-prune.cjs"
      to: "fs.statSync mtime"
      via: "filter mindrian-os.stale-* dirs by mtimeMs vs (now - ageMs)"
      pattern: "mtimeMs"
---

<objective>
Phase 123 added cache-prune-on-version-change that retains active + N most-recent cache versions and removes the rest. The dogfood session (and the Phase 95.2 atomic-swap which creates `mindrian-os.stale-<tag>-<timestamp>` backup directories at each recovery) revealed a second accumulation surface: stale BACKUP directories. On long-running tester installs (Lawrence, Gary, etc.), each recovery leaves a backup that is never pruned. Over months, this fills ~/.claude/plugins/ with dozens of stale-XX dirs.

Purpose: prevent disk accumulation from Phase 95.2's atomic-swap backups. Default 30-day window leaves a safety net for inspection-after-the-fact (the 95.2 contract says backups are retained "indefinitely; after 24h the user can delete manually"). 30 days is the next operational threshold beyond user-driven cleanup.

Output: extended pruner that ALSO removes `mindrian-os.stale-*` backup dirs older than 30 days (configurable). Fixture coverage proves the behavior + idempotency + env-var override.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/126-install-lifecycle-harness-gaps/126-CONTEXT.md
@lib/core/cache-prune.cjs
@scripts/doctor.cjs
@tests/test-cache-prune.cjs

<interfaces>
<!-- Key contracts extracted from lib/core/cache-prune.cjs -->

Current pruner (lib/core/cache-prune.cjs):
```javascript
// Exports:
module.exports = { pruneMarketplaceCache };

// Reads:
//   ~/.claude/installed_plugins.json (active mos@mindrian-marketplace version)
//   ~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/ (cache dirs)
//
// Behavior (Phase 123):
//   - retain active version
//   - retain N most-recent non-active versions (default N=2) by mtime DESC
//   - remove rest
//
// Returns: { kept: [versions...], removed: [versions...], skipped: bool, reason?: string }
```

NEW surface to add: prune of `~/.claude/plugins/mindrian-os.stale-<tag>-<timestamp>` directories.

From scripts/doctor.cjs line 295 (the backup-dir naming pattern):
```javascript
const backupDir = path.join(PLUGIN_HOME, `mindrian-os.stale-${backupTag}-${ts}`);
// where ts = '20260514-095548' (ISO compacted to 15 chars)
```

So backup directories live at `~/.claude/plugins/mindrian-os.stale-*` (sibling of mindrian-os/ install dir, NOT under cache/). This is a DIFFERENT location from the cache dirs the existing pruner walks. The new prune step is ADDITIVE -- walks PLUGIN_HOME directly for `mindrian-os.stale-*` dirs.

From scripts/doctor.cjs line ~2100 (the existing call site that invokes pruneMarketplaceCache during --fix):
```javascript
const { pruneMarketplaceCache } = require(path.join(__dirname, '..', 'lib', 'core', 'cache-prune.cjs'));
const r = pruneMarketplaceCache({ home });
```
The new behavior MUST be triggered from the same call site (no new --fix flag; just an extension to the existing pruner that doctor --fix already invokes).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create stale-backup prune fixture test</name>
  <files>tests/test-cache-prune-extended.cjs</files>
  <read_first>
    - lib/core/cache-prune.cjs (current pruner -- understand the existing kept/removed return shape + skip conditions)
    - tests/test-cache-prune.cjs (existing fixture pattern -- mktemp HOME + seed cache + invoke + assert)
    - scripts/doctor.cjs line 295 (the `mindrian-os.stale-<tag>-<timestamp>` naming pattern)
    - scripts/doctor.cjs line ~2100 (the existing call site invoking pruneMarketplaceCache)
  </read_first>
  <behavior>
    - Test 1 (stale backup is pruned): seed `~/.claude/plugins/mindrian-os.stale-1.10.10-20250101-120000/` (old timestamp; mtime set to 60 days ago via fs.utimes). Invoke pruner. Assert the dir is removed.
    - Test 2 (recent backup is retained): seed `~/.claude/plugins/mindrian-os.stale-1.13.0-beta.13-<recent-ts>/` with mtime set to 5 days ago. Invoke pruner. Assert the dir EXISTS after prune (not removed).
    - Test 3 (env-var override): set MOS_CACHE_PRUNE_AGE_DAYS=3, seed a backup with mtime 5 days ago. Invoke pruner. Assert the dir is REMOVED (because 5 > 3).
    - Test 4 (env-var override -- expand window): set MOS_CACHE_PRUNE_AGE_DAYS=90, seed a backup with mtime 60 days ago. Invoke pruner. Assert the dir EXISTS (because 60 < 90).
    - Test 5 (idempotency): seed 1 stale (60-day) + 1 recent (5-day). Invoke pruner twice. Assert second invocation removes nothing AND retains the recent backup. Final state matches first invocation's post-state.
    - Test 6 (no regression in cache prune): seed cache with active version 1.13.0-beta.14 + non-active beta.9 + non-active beta.13 + 1 stale backup + 1 recent backup. Invoke pruner. Assert: active version retained, N most-recent non-active retained per existing Phase 123 contract, stale backup removed, recent backup retained.
    - Test 7 (non-matching siblings preserved): seed `~/.claude/plugins/mindrian-os/` (active install -- never touch) and `~/.claude/plugins/some-other-plugin/` (sibling unrelated dir). Invoke pruner. Assert BOTH untouched (the prune pattern matches `mindrian-os.stale-*` literally, not `mindrian-os*` nor `*.stale-*`).
  </behavior>
  <action>
    Create `tests/test-cache-prune-extended.cjs`. Pattern:

    1. Helper `seedBackup(home, name, ageDays)`: creates `<home>/.claude/plugins/<name>/`, writes a stub `plugin.json` inside, then sets mtime to `Date.now() - ageDays * 86400000` via `fs.utimesSync(path, atime, mtime)`. Both atime + mtime must move (utimesSync requires both); use `new Date(Date.now() - ageDays * 86400000)` for both.

    2. Helper `seedActive(home, version)`: creates `<home>/.claude/installed_plugins.json` with the mos@mindrian-marketplace plugins map keyed to `version`. (Pattern lifted from tests/test-cache-prune.cjs.)

    3. Helper `seedCacheVersion(home, version)`: creates `<home>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/.claude-plugin/plugin.json` with the version embedded.

    4. Each sub-test: mktemp HOME (`fs.mkdtempSync(path.join(os.tmpdir(), 'cache-prune-ext-'))`), seed the required state, invoke pruner via `require('../lib/core/cache-prune.cjs').pruneMarketplaceCache({ home: tmpHome })`, assert directory presence/absence via `fs.existsSync`.

    5. Env-var tests (3, 4): set `process.env.MOS_CACHE_PRUNE_AGE_DAYS` before invocation, restore in finally.

    6. Cleanup in finally: `fs.rmSync(tmpHome, { recursive: true, force: true })`; restore process.env.HOME + restore MOS_CACHE_PRUNE_AGE_DAYS to prior value (delete the key if it was unset).

    7. Wire into tests/run-all-126.sh as a CJS suite entry.

    Settled in plan-phase: Open Question 1 (Wave 1 parallelism) -- this plan touches ONLY lib/core/cache-prune.cjs + a new test file. Zero overlap with Plans 01 (scripts/doctor.cjs renderer) and 02 (scripts/doctor.cjs cmpVersion helpers). True parallel-safe.

    Settled in plan-phase: Open Question 4 (env-var name + cadence) -- MOS_CACHE_PRUNE_AGE_DAYS as the env var (not .mos/config.json) per CONTEXT.md "Claude's discretion". Default 30 days. v2 may move to config; v1 is env-var-only.
  </action>
  <verify>
    <automated>node tests/test-cache-prune-extended.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-cache-prune-extended.cjs` runs to completion (test framework loads + invokes 7 sub-tests)
    - With the CURRENT (un-extended) pruner, Tests 1, 3, 6 FAIL RED (stale backups are NOT being pruned -- proving the test would catch the gap)
    - Tests 2, 4, 7 PASS GREEN with the current pruner (they assert NON-removal which is the current behavior anyway)
    - File compiles cleanly: `node -c tests/test-cache-prune-extended.cjs`
    - Wired in tests/run-all-126.sh
  </acceptance_criteria>
  <done>
    7-case test file exists. Tests 1/3/6 RED against current pruner, prove the gap. All 7 GREEN once Task 2 lands.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend lib/core/cache-prune.cjs with stale-backup prune step</name>
  <files>lib/core/cache-prune.cjs</files>
  <read_first>
    - tests/test-cache-prune-extended.cjs (the 7-case contract from Task 1)
    - lib/core/cache-prune.cjs (current pruneMarketplaceCache structure -- the function to extend)
    - scripts/doctor.cjs line 295 (backup naming pattern `mindrian-os.stale-<tag>-<timestamp>`)
    - scripts/doctor.cjs line ~2100 (current call site -- the contract of what pruneMarketplaceCache returns + how its result is consumed)
  </read_first>
  <behavior>
    - Test cases 1 through 7 from Task 1 ALL turn GREEN.
    - Existing Phase 123 pruner behavior unchanged: active version retained, N most-recent non-active retained, rest pruned.
    - Stale backup dirs at `<home>/.claude/plugins/mindrian-os.stale-*` older than MOS_CACHE_PRUNE_AGE_DAYS (default 30) are removed.
    - Recent backup dirs are retained.
    - Pattern match is LITERAL `mindrian-os.stale-` prefix; does NOT match `mindrian-os/` (the live install) or `some-other-plugin/` (unrelated siblings).
    - Idempotent: repeated invocation produces no further removals.
    - Return shape extension: existing `{ kept, removed, skipped, reason? }` extended with `removedBackups: [paths...]` so the doctor renderer can surface what was pruned. Existing consumers continue to read `kept` + `removed` without breakage.
    - Workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.
  </behavior>
  <action>
    Extend `pruneMarketplaceCache` (or add a sibling function `pruneStaleBackups` called from within it) in `lib/core/cache-prune.cjs`:

    1. At the top of pruneMarketplaceCache, read the age window:
       ```javascript
       const ageDaysRaw = process.env.MOS_CACHE_PRUNE_AGE_DAYS;
       const ageDays = (ageDaysRaw && /^\d+$/.test(ageDaysRaw)) ? parseInt(ageDaysRaw, 10) : 30;
       const cutoffMs = Date.now() - (ageDays * 86400000);
       ```

    2. After the existing cache-dir prune logic completes, walk `<home>/.claude/plugins/` for entries matching `/^mindrian-os\.stale-/`:
       ```javascript
       const pluginsDir = path.join(home, '.claude', 'plugins');
       const removedBackups = [];
       let entries = [];
       try {
         entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
       } catch (_) {
         // pluginsDir absent: nothing to prune. Continue with removedBackups empty.
       }
       for (const e of entries) {
         if (!e.isDirectory()) continue;
         if (!/^mindrian-os\.stale-/.test(e.name)) continue;
         const fullPath = path.join(pluginsDir, e.name);
         let mtimeMs;
         try {
           mtimeMs = fs.statSync(fullPath).mtimeMs;
         } catch (_) {
           continue; // stat failure: leave for inspection
         }
         if (mtimeMs >= cutoffMs) continue; // recent enough; retain
         try {
           fs.rmSync(fullPath, { recursive: true, force: true });
           removedBackups.push(fullPath);
         } catch (err) {
           // Best-effort: a failed removal does not abort the whole prune.
           // (Mirrors the existing pattern in pruneMarketplaceCache.)
         }
       }
       ```

    3. Extend the return shape:
       ```javascript
       return { kept: <existing>, removed: <existing>, removedBackups, skipped: false, reason: null, ageDays };
       ```
       Existing consumers in scripts/doctor.cjs line ~2100 read `r.removed.length` + `r.kept` -- those keys are unchanged.

    4. Optional: emit the new info via the renderer aggregator at scripts/doctor.cjs line ~2107 if the renderer surfaces a list of removed paths. (Scope: only if minimal-delta -- one log line. If renderer change exceeds 5 lines, defer to Plan 03's acceptance-gate self-coverage which already touches the doctor render path.)

    Preserve workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.
  </action>
  <verify>
    <automated>node tests/test-cache-prune-extended.cjs && bash tests/run-all-123.sh</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-cache-prune-extended.cjs` exits 0 (all 7 sub-tests GREEN)
    - `bash tests/run-all-123.sh` continues to pass (no regression in existing tests/test-cache-prune.cjs)
    - Live test: scaffold a 60-day-old backup at `<HOME>/.claude/plugins/mindrian-os.stale-1.10.10-20250101-120000/`, invoke `node scripts/doctor.cjs --fix --json`, observe `removedBackups` in output OR observe the directory is gone
    - `grep -c "MOS_CACHE_PRUNE_AGE_DAYS" lib/core/cache-prune.cjs` returns >= 1
    - `grep -c "mindrian-os\\.stale-" lib/core/cache-prune.cjs` returns >= 1
  </acceptance_criteria>
  <done>
    Pruner extended with stale-backup prune step. Default 30-day window. Env-var override honored. 7-case test GREEN. No regression in Phase 123 suite.
  </done>
</task>

</tasks>

<verification>
- `node tests/test-cache-prune-extended.cjs` passes all 7 cases
- `bash tests/run-all-123.sh` passes (regression guard)
- `bash tests/run-all-126.sh` includes this test suite and passes
- Live test in dev workspace: a 30+ day backup is pruned; a recent backup is retained
- MOS_CACHE_PRUNE_AGE_DAYS env-var documented (covered by Plan 04 release-process doc OR captured in a comment block in lib/core/cache-prune.cjs)
</verification>

<success_criteria>
- All must_haves satisfied
- Plan 06 acceptance criteria from CONTEXT.md "Acceptance Criteria (Nyquist UAT)" block all pass:
  - tests/test-cache-prune-extended.cjs passes
  - Stale backup dirs older than 30 days are pruned
  - Recent backup dirs (< 30 days) are retained
  - Window is configurable via env var (MOS_CACHE_PRUNE_AGE_DAYS)
- No regression in upstream test runners
- Return shape stays backward-compatible with existing scripts/doctor.cjs consumer
</success_criteria>

<output>
After completion, create `.planning/phases/126-install-lifecycle-harness-gaps/126-06-SUMMARY.md` covering:
- The stale-backup accumulation surface that surfaced + closed
- The new env-var contract (MOS_CACHE_PRUNE_AGE_DAYS) -- default 30, future may move to config
- The pattern-match safety (literal `mindrian-os.stale-` prefix; does NOT match live install)
- Reference forward to Plan 03 (acceptance-gate self-coverage) which adds an acceptance check for this prune behavior
</output>
