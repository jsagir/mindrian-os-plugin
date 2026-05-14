---
phase: 126
slug: install-lifecycle-harness-gaps
plan: 07
title: install-state.json Schema v2 + Migration
type: execute
wave: 2
depends_on: []
files_modified:
  - lib/core/install-state.cjs
  - scripts/session-start
  - tests/test-install-state-migration.cjs
  - tests/run-all-126.sh
autonomous: true
requirements_addressed: []
canon_parts:
  - Part 6 (dog-fooding: schema evolution surfaces only via shipped harness; v1 was shipped in beta.13)
  - Part 7 (reuse: extracts inline session-start write into a module; ADDITIVE migration only)
beta_target: v1.13.0-beta.15
hotfix_discipline: true
gap_closure: false
must_haves:
  truths:
    - "Session-start reads install-state.json. If absent: derives from scratch (existing Phase 123 behavior, unchanged)"
    - "If present + no schema_version field: treated as v1; migration runs additively (new fields get defaults; old fields preserved byte-identical); written back with schema_version: 2"
    - "If present + schema_version === 2: used as-is, no migration"
    - "If present + schema_version > 2 (future-version install-state file from a newer beta the user previously installed and then downgraded): warn + defer to /mos:doctor --fix; do NOT downgrade silently"
    - "Migration is additive only -- never destructive -- never removes a v1 field"
    - "Migration writes are atomic (write to .tmp + rename)"
    - "Phase 123 install-state.json existing tests continue to pass (no regression in the existing read/write path)"
  artifacts:
    - path: "lib/core/install-state.cjs"
      provides: "Extracted install-state module with v1->v2 migration logic + future-version detection"
      min_lines: 150
      exports: ["readInstallState", "writeInstallState", "migrateIfNeeded", "SCHEMA_VERSION"]
    - path: "tests/test-install-state-migration.cjs"
      provides: "4-path migration fixture (no-file, v1-no-schema, v2-current, v3-future)"
      min_lines: 120
    - path: "scripts/session-start"
      provides: "Calls lib/core/install-state.cjs migration before any other consumer reads install-state"
      contains: "install-state.cjs"
  key_links:
    - from: "scripts/session-start (the EARLY install-state block at lines 107-227)"
      to: "lib/core/install-state.cjs migrateIfNeeded()"
      via: "node -e require + invoke; migration runs BEFORE the existing _INSTALL_STATE_JSON write logic"
      pattern: "install-state\\.cjs"
    - from: "lib/core/install-state.cjs migrateIfNeeded"
      to: "fs.writeFileSync + fs.renameSync (atomic write)"
      via: "write to .tmp then rename; never overwrite in place"
      pattern: "renameSync"
---

<objective>
Phase 123 shipped install-state.json v1 with no `schema_version` field. Phase 126 likely adds fields (topology classification status, last_acceptance_run timestamp, renderer_contract_version per Plan 01, etc.). Existing beta.13/beta.14 installs must upgrade transparently when they pull beta.15.

Purpose: schema evolution must be additive + atomic + reversible. Phase 95.2's atomic-swap precedent says: never destroy state in place. Future-version detection prevents silent downgrades when a user installs newer beta then rolls back.

Output: extracted `lib/core/install-state.cjs` module with migration logic. Session-start invokes it BEFORE any other consumer reads install-state. 4-path fixture proves no-file / v1 / v2 / future-version paths.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/126-install-lifecycle-harness-gaps/126-CONTEXT.md
@scripts/session-start
@scripts/doctor.cjs
@data/deployment-surfaces.json
@tests/test-install-state-record.cjs

<interfaces>
<!-- Key contracts extracted from scripts/session-start lines 107-227 + scripts/doctor.cjs lines 1566+ -->

Current install-state.json shape (Phase 123, v1, NO schema_version field):
```json
{
  "active_root": "<absolute path>",
  "active_version": "<version>",
  "topology": "marketplace-cache | direct | legacy | dev-clone | not-found",
  "installed_at": "<ISO timestamp>",
  "snapshot": { ... }
}
```

Path: `$HOME/.mindrian/install-state.json` (canonical).

Current write logic (scripts/session-start lines 107-227 -- the EARLY install-state record block):
- The shell script writes via node -e blocks that READ + MUTATE + WRITE_JSON inline. It does NOT use a dedicated module.
- Plan 07 EXTRACTS this inline logic into lib/core/install-state.cjs and replaces the session-start node -e invocations with a require + call.

Current readers (scripts/doctor.cjs):
- Line 1580: `const recordPath = path.join(home, '.mindrian', 'install-state.json');`
- Line 1633: surfaces `install-state record absent` finding
- Line 1700+: emits class:'install-state' findings with various surface/action/ok fields

Schema v2 ADDITIVE fields (from CONTEXT.md Plan 07 + cross-plan needs):
- `schema_version: 2` (integer, sentinel)
- `topology_class: "healthy" | "marketplace-cache-only" | "missing" | "drifted"` (Plan 03 needs this; classification of the install topology beyond bare topology string)
- `last_acceptance_run: { timestamp: <ISO>, passed: <int>, failed: <int> } | null` (Plan 03 + Plan 05 write this on each --acceptance run)
- `renderer_contract_version: <string>` (Plan 01 sets this from commands/doctor.md Step 3 hash; future drift triggers a topology re-classification)

Migration rules (per CONTEXT.md D3, LOCKED):
- Additive only -- a v1 file becomes a v2 file by ADDING fields; never removing.
- Defaults: topology_class = derived from existing topology field (healthy iff topology === 'marketplace-cache' or 'direct'; missing iff 'not-found'; drifted otherwise); last_acceptance_run = null; renderer_contract_version = `unknown` (or null).
- Future-version: schema_version > 2 → warn + defer to /mos:doctor --fix. Do NOT downgrade silently. Do NOT touch the file. Return a "future-version" sentinel so callers can decide.
- Atomic write: write to `<path>.tmp`, fsync, then rename. Crash-safety.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create 4-path migration fixture test</name>
  <files>tests/test-install-state-migration.cjs</files>
  <read_first>
    - scripts/session-start lines 107-227 (current inline write logic that Plan 07 extracts)
    - scripts/doctor.cjs lines 1566-1800 (current readers of install-state)
    - tests/test-install-state-record.cjs (existing fixture pattern for install-state surface)
    - CONTEXT.md D3 (migration rules: additive-only, future-version-detection, atomic write)
  </read_first>
  <behavior>
    - Test 1 (no file): mktemp HOME with no $HOME/.mindrian/install-state.json. Call readInstallState. Assert returns null (or an object with status: 'absent'); migrateIfNeeded is a no-op; the file is NOT created by the migrator (creation is session-start's job, not the migrator's). Calling migrateIfNeeded with no file does nothing.
    - Test 2 (v1 file -- no schema_version): write a v1-shape install-state.json (active_root, active_version, topology, installed_at, snapshot; NO schema_version). Call migrateIfNeeded. Assert:
      - File now contains `schema_version: 2`
      - All v1 fields preserved byte-identical (active_root, active_version, topology, installed_at, snapshot values unchanged)
      - New fields added with correct defaults (topology_class derived from topology; last_acceptance_run === null; renderer_contract_version === <default>)
      - Atomic write: a `<path>.tmp` was NOT left dangling after success
      - Return value indicates `{ migrated: true, fromVersion: 1, toVersion: 2 }`
    - Test 3 (v2 file -- current schema): write a v2-shape install-state.json with schema_version: 2. Call migrateIfNeeded. Assert:
      - File unchanged (byte-identical before/after; compare via fs.readFileSync hash)
      - Return value indicates `{ migrated: false, currentVersion: 2 }`
      - No write to disk occurred (verify via mtime: capture mtime BEFORE call; compare AFTER -- must be equal)
    - Test 4 (future-version file): write an install-state.json with schema_version: 3 (simulated future). Call migrateIfNeeded. Assert:
      - File unchanged (byte-identical)
      - Return value indicates `{ migrated: false, futureVersion: true, currentVersion: 3, advice: 'run /mos:doctor --fix' }`
      - migrateIfNeeded did NOT downgrade
      - migrateIfNeeded did NOT raise an exception (graceful warn-and-defer)
    - Test 5 (atomic write crash recovery): write a v1 file. Inject a synthetic write failure (mock fs.renameSync or fs.writeFileSync to throw at the final rename step). Assert:
      - Original v1 file is UNCHANGED on disk
      - No partial v2 file at the target path
      - migrateIfNeeded raises or returns a structured error
      - A `<path>.tmp` may exist temporarily but does not corrupt the original
    - Test 6 (topology_class derivation): write 4 v1 files with topology = 'marketplace-cache' / 'direct' / 'not-found' / 'legacy'. Call migrateIfNeeded on each. Assert topology_class in the resulting v2 file = 'healthy' / 'healthy' / 'missing' / 'drifted' respectively.
  </behavior>
  <action>
    Create `tests/test-install-state-migration.cjs`. Use the mktemp HOME pattern from `tests/test-install-state-record.cjs`. Require lib/core/install-state.cjs (which Task 2 creates).

    Implementation skeleton:
    ```javascript
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { readInstallState, writeInstallState, migrateIfNeeded, SCHEMA_VERSION } = require('../lib/core/install-state.cjs');

    // ... 6 sub-tests as described in <behavior> ...
    ```

    Each sub-test:
    1. mktemp HOME via `fs.mkdtempSync(path.join(os.tmpdir(), 'install-state-mig-'))`
    2. Create `<home>/.mindrian/` via `fs.mkdirSync(... , { recursive: true })`
    3. (If applicable) write fixture state.json content via `fs.writeFileSync(path, JSON.stringify(fixture, null, 2))`
    4. Invoke migrateIfNeeded({ home: tmpHome })
    5. Read back via fs.readFileSync + JSON.parse, assert fields
    6. Cleanup: fs.rmSync(tmpHome, recursive)

    For Test 5 (atomic-write crash recovery): use `proxyquire` if available OR temporarily monkey-patch `require('fs').renameSync` to throw, then restore. Alternative: write a SIBLING write helper in lib/core/install-state.cjs that exposes a `_TEST_FORCE_FAIL` env var (per the MOS_TEST_FORCE_FAIL pattern in scripts/doctor.cjs lines 304-307).

    Wire into tests/run-all-126.sh as a CJS suite entry.

    Settled in plan-phase: Open Question 5 (schema_version as integer vs semver string) -- LOCKED as INTEGER (2) per CONTEXT.md D3 "Lean: integer (simpler, fewer comparison edge cases for additive-only migrations)". Test uses `=== 2` and `=== 3` as integer equality.

    Settled in plan-phase: Wave 2 head -- Plan 07 has no depends_on (it's the head of Wave 2). It MUST land before Plan 03 (which depends on Plan 07 reading the v2 last_acceptance_run field) and Plan 05 (which writes to v2 last_acceptance_run).
  </action>
  <verify>
    <automated>node tests/test-install-state-migration.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-install-state-migration.cjs` runs to completion (test framework loads + invokes 6 sub-tests)
    - Until Task 2 lands, the require of lib/core/install-state.cjs fails RED with `Cannot find module` -- expected (the test drives the module creation)
    - File compiles cleanly once lib/core/install-state.cjs exists: `node -c tests/test-install-state-migration.cjs`
    - Wired in tests/run-all-126.sh
  </acceptance_criteria>
  <done>
    6-case test file exists. RED until Task 2 + Task 3 land. All 6 GREEN after Tasks 2+3 complete.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create lib/core/install-state.cjs with migration logic</name>
  <files>lib/core/install-state.cjs</files>
  <read_first>
    - tests/test-install-state-migration.cjs (the 6-case contract from Task 1)
    - scripts/session-start lines 107-227 (the inline write logic to extract -- look for the node -e blocks that write to install-state.json)
    - scripts/doctor.cjs lines 1566-1800 (existing readers that this module must remain compatible with)
    - lib/core/active-plugin-root.cjs (Phase 123 resolver -- the pattern of a focused single-purpose lib/core/* module; mirror its export style)
    - CONTEXT.md D3 (migration rules, LOCKED)
  </read_first>
  <behavior>
    - Module exports: `readInstallState({ home }) → object | null`, `writeInstallState({ home, state }) → void` (atomic write), `migrateIfNeeded({ home }) → { migrated, fromVersion?, toVersion?, currentVersion?, futureVersion?, advice? }`, `SCHEMA_VERSION = 2` (constant).
    - readInstallState returns null when the file is absent (NOT throw).
    - readInstallState returns an object with all top-level fields when the file is present + parseable.
    - writeInstallState writes atomically: `<path>.tmp` + fsync + rename. Crashes between writeFileSync and rename leave the original file untouched.
    - migrateIfNeeded:
      - file absent → no-op, returns `{ migrated: false, fileAbsent: true }`
      - schema_version absent → treat as v1, derive defaults, write back with schema_version: 2, return `{ migrated: true, fromVersion: 1, toVersion: 2 }`
      - schema_version === 2 → no-op, returns `{ migrated: false, currentVersion: 2 }`
      - schema_version > 2 → no-op, returns `{ migrated: false, futureVersion: true, currentVersion: <n>, advice: 'run /mos:doctor --fix' }` AND emits a warning to stderr (single line, prefixed with `[install-state]`)
    - topology_class derivation rule (per the canonical 4-state taxonomy in CONTEXT.md D3 + Plan 03 needs):
      ```
      switch (state.topology):
        case 'marketplace-cache': topology_class = 'healthy'
        case 'direct':            topology_class = 'healthy'
        case 'not-found':         topology_class = 'missing'
        case 'legacy':            topology_class = 'drifted'
        case 'dev-clone':         topology_class = 'healthy'  // dev-clone is healthy by definition
        default:                  topology_class = 'drifted'  // unknown topology -> conservative
      ```
    - Default values for new v2 fields when migrating from v1:
      - schema_version: 2
      - topology_class: derived per above
      - last_acceptance_run: null
      - renderer_contract_version: 'unknown'
  </behavior>
  <action>
    Create `lib/core/install-state.cjs`. Style: CJS module, mirror lib/core/active-plugin-root.cjs export style. Pure Node.js, zero new dependencies.

    Skeleton:
    ```javascript
    /**
     * lib/core/install-state.cjs -- install-state.json read/write/migrate module.
     *
     * Extracts inline session-start logic; adds v1 -> v2 schema migration with
     * additive-only semantics + future-version detection + atomic write.
     *
     * Phase 126 Plan 07. Canon Part 7 (reuse: extracts inline session-start
     * write into a module; does not re-architect the write path).
     */
    const fs = require('fs');
    const path = require('path');

    const SCHEMA_VERSION = 2;
    const STATE_FILE_PATH_REL = path.join('.mindrian', 'install-state.json');

    function statePath(home) {
      return path.join(home, STATE_FILE_PATH_REL);
    }

    function readInstallState(opts) {
      const home = opts.home;
      const p = statePath(home);
      if (!fs.existsSync(p)) return null;
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch (err) {
        // Corrupt file: surface as null + let caller decide. (Mirrors doctor.cjs line 1633's "absent" finding.)
        return null;
      }
    }

    function writeInstallState(opts) {
      const home = opts.home;
      const state = opts.state;
      const p = statePath(home);
      const tmp = p + '.tmp';
      // Ensure parent dir exists.
      fs.mkdirSync(path.dirname(p), { recursive: true });
      // Atomic write: write to tmp, fsync (best-effort), rename.
      const fd = fs.openSync(tmp, 'w');
      try {
        fs.writeSync(fd, JSON.stringify(state, null, 2) + '\n');
        try { fs.fsyncSync(fd); } catch (_) { /* fsync not critical for tests */ }
      } finally {
        fs.closeSync(fd);
      }
      // Test injection point (mirrors scripts/doctor.cjs MOS_TEST_FORCE_FAIL pattern).
      if (process.env.MOS_TEST_FORCE_FAIL === 'rename') {
        // Leave .tmp on disk so the test can assert "original untouched".
        throw new Error('MOS_TEST_FORCE_FAIL=rename injection');
      }
      fs.renameSync(tmp, p);
    }

    function deriveTopologyClass(topology) {
      switch (topology) {
        case 'marketplace-cache': return 'healthy';
        case 'direct':            return 'healthy';
        case 'dev-clone':         return 'healthy';
        case 'not-found':         return 'missing';
        case 'legacy':            return 'drifted';
        default:                  return 'drifted';
      }
    }

    function migrateIfNeeded(opts) {
      const home = opts.home;
      const state = readInstallState({ home: home });
      if (!state) return { migrated: false, fileAbsent: true };
      if (typeof state.schema_version === 'undefined' || state.schema_version === null) {
        // v1 -> v2 migration (additive-only)
        const v2 = Object.assign({}, state, {
          schema_version: SCHEMA_VERSION,
          topology_class: deriveTopologyClass(state.topology),
          last_acceptance_run: null,
          renderer_contract_version: 'unknown',
        });
        writeInstallState({ home: home, state: v2 });
        return { migrated: true, fromVersion: 1, toVersion: SCHEMA_VERSION };
      }
      if (state.schema_version === SCHEMA_VERSION) {
        return { migrated: false, currentVersion: SCHEMA_VERSION };
      }
      if (state.schema_version > SCHEMA_VERSION) {
        // Future-version: warn + defer.
        process.stderr.write('[install-state] schema_version ' + state.schema_version + ' is newer than the plugin understands (' + SCHEMA_VERSION + '). Skipping migration; run /mos:doctor --fix.\n');
        return {
          migrated: false,
          futureVersion: true,
          currentVersion: state.schema_version,
          advice: 'run /mos:doctor --fix',
        };
      }
      // Unknown lower-than-expected schema_version (e.g., 0). Treat as v1.
      return migrateIfNeeded({ home: home, _coerceV1: true });
    }

    module.exports = {
      SCHEMA_VERSION,
      readInstallState,
      writeInstallState,
      migrateIfNeeded,
      deriveTopologyClass,
      _statePath: statePath, // test-only export
    };
    ```

    Verify with `node -c lib/core/install-state.cjs` after writing.

    Workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.
  </action>
  <verify>
    <automated>node -c lib/core/install-state.cjs && node tests/test-install-state-migration.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node -c lib/core/install-state.cjs` exits 0 (syntactically valid CJS)
    - `node tests/test-install-state-migration.cjs` exits 0 (all 6 sub-tests GREEN)
    - Module exports the 4 documented names (`readInstallState`, `writeInstallState`, `migrateIfNeeded`, `SCHEMA_VERSION`) at minimum (plus `deriveTopologyClass` for unit testability)
    - Migration is additive only (Test 2 verifies v1 fields preserved byte-identical)
    - Future-version detection emits stderr warning + returns advice (Test 4)
    - Atomic write proven by Test 5 (force-fail at rename leaves original untouched)
  </acceptance_criteria>
  <done>
    Module exists, compiles, passes all 6 fixture tests. Pure Node.js. Zero new deps.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire migration into scripts/session-start (BEFORE existing readers)</name>
  <files>scripts/session-start</files>
  <read_first>
    - scripts/session-start lines 107-227 (the EARLY install-state record block -- the integration point)
    - scripts/session-start lines 1259-1278 (the on-version-change manifest reconcile -- DOWNSTREAM of migration; do not touch)
    - lib/core/install-state.cjs (the module from Task 2)
    - CONTEXT.md D3 (migration runs BEFORE any other consumer reads install-state)
  </read_first>
  <behavior>
    - Session-start invokes migrateIfNeeded({ home }) BEFORE the existing EARLY install-state record block executes its inline read/write.
    - If the file is absent: migration is a no-op (returns fileAbsent); session-start's existing logic (which derives from scratch when absent) runs unchanged.
    - If the file is v1: migration runs; session-start's subsequent reads see the v2 shape (with schema_version + topology_class + last_acceptance_run + renderer_contract_version).
    - If the file is future-version: migration emits the warn-and-defer stderr line; session-start's existing logic continues (reads the file AS-IS without modification, since the migrator left it alone).
    - No regression: tests/test-install-state-record.cjs continues to pass.
    - The migration call is wrapped in error-handling such that any failure (file unreadable, write fail, etc.) does NOT crash session-start -- session-start continues with its existing fallback path.
  </behavior>
  <action>
    Locate the EARLY install-state record block in scripts/session-start (lines 107-227, marked with `# --- BEGIN install-state record (Phase 123, single writer, EARLY -- before Step A/B) ---`).

    BEFORE that block (at line 107 or earlier, but AFTER any HOME / paths derivation), insert a migration call. Implementation:

    ```bash
    # --- BEGIN Phase 126 Plan 07: install-state schema migration (BEFORE Phase 123 writer) ---
    # Migration is ADDITIVE only (D3 CONTEXT.md). v1 -> v2 adds schema_version + topology_class +
    # last_acceptance_run + renderer_contract_version. Future-version -> warn + defer; never downgrade.
    # Errors here NEVER crash session-start (the existing fallback path remains).
    if [ -f "$_PLUGIN_ROOT/lib/core/install-state.cjs" ]; then
      node -e "
        try {
          const m = require('$_PLUGIN_ROOT/lib/core/install-state.cjs');
          const r = m.migrateIfNeeded({ home: process.env.HOME });
          if (r.migrated) {
            process.stderr.write('[session-start] install-state migrated v' + r.fromVersion + ' -> v' + r.toVersion + '\n');
          } else if (r.futureVersion) {
            process.stderr.write('[session-start] install-state future-version detected (schema_version=' + r.currentVersion + '); deferring to /mos:doctor --fix\n');
          }
        } catch (e) {
          process.stderr.write('[session-start] install-state migration error: ' + e.message + ' (continuing with existing path)\n');
        }
      " 2>&1 || true
    fi
    # --- END Phase 126 Plan 07 ---
    ```

    Where `$_PLUGIN_ROOT` is the resolved active plugin root (Phase 123 substrate -- verify the variable name session-start already uses for this; if it uses a different variable, substitute accordingly. If no such variable exists, use `$(dirname "$(dirname "${BASH_SOURCE[0]}")")` since scripts/session-start lives at `<root>/scripts/session-start`).

    Place the insertion BEFORE line 107's `# --- BEGIN install-state record (Phase 123, single writer, EARLY -- before Step A/B) ---` marker. The migration MUST run before the inline write logic so the write sees a v2-shaped file (or a no-file path that the existing logic handles).

    No changes to lines 1259-1278 (the on-version-change manifest reconcile). That block runs LATER + reads the already-migrated file.

    Workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.
  </action>
  <verify>
    <automated>node tests/test-install-state-migration.cjs && bash tests/run-all-123.sh</automated>
  </verify>
  <acceptance_criteria>
    - `bash -n scripts/session-start` exits 0 (syntax-valid bash after edit)
    - `node tests/test-install-state-migration.cjs` exits 0 (Task 1's 6-case test passes)
    - `bash tests/run-all-123.sh` continues to pass (tests/test-install-state-record.cjs and tests/test-doctor-class-i.cjs both depend on session-start's install-state behavior)
    - Live test: scaffold a v1 install-state.json + run session-start; verify the file is now v2 (schema_version: 2 present)
    - Live test: scaffold a future-version install-state.json (schema_version: 99) + run session-start; verify the file is UNCHANGED + stderr emitted the deferral message
    - `grep -c "install-state.cjs" scripts/session-start` returns >= 1
  </acceptance_criteria>
  <done>
    session-start invokes migrateIfNeeded BEFORE existing read/write. Migration is transparent on v1 installs (Lawrence + Gary upgrade without manual --fix). Future-version detection works. No regression in Phase 123 suite.
  </done>
</task>

</tasks>

<verification>
- `node tests/test-install-state-migration.cjs` passes all 6 cases
- `bash tests/run-all-123.sh` passes (regression guard: test-install-state-record.cjs + test-doctor-class-i.cjs)
- `bash tests/run-all-126.sh` includes this test suite and passes
- Live smoke test on a v1 install-state.json: a session-start run promotes it to v2 (schema_version: 2 + topology_class + last_acceptance_run: null + renderer_contract_version: 'unknown')
- Live smoke test on a future-version file: untouched + stderr warning surfaces
- `lib/core/install-state.cjs` exists, is syntactically valid, exports the 4 documented names
</verification>

<success_criteria>
- All must_haves satisfied
- Plan 07 acceptance criteria from CONTEXT.md "Acceptance Criteria (Nyquist UAT)" block all pass:
  - tests/test-install-state-migration.cjs passes all 4 paths (no file, v1, v2, future)
  - Migration is additive only (never destructive)
  - Migration writes back with schema_version: 2
  - Future-version detection warns + defers to /mos:doctor --fix
  - Session-start integration: migration runs before any other consumer reads install-state.json
  - Existing Phase 123 tests for install-state.json continue to pass
- Schema_version is integer 2 (per Open Question 5 settlement)
- Atomic write proven by force-fail test
</success_criteria>

<output>
After completion, create `.planning/phases/126-install-lifecycle-harness-gaps/126-07-SUMMARY.md` covering:
- The extracted module + its 4-export surface
- The 4 migration paths (no-file, v1, v2, future-version)
- The additive-only invariant + atomic-write proof
- topology_class derivation rule (5-case switch)
- Reference forward to Plan 03 (acceptance-gate self-coverage) which writes to last_acceptance_run field
- Reference forward to Plan 04 (release pipeline) where renderer_contract_version may be set by Plan 01's fix
</output>
