'use strict';

/*
 * lib/core/install-state.cjs -- install-state.json read / write / migrate
 * module.
 *
 * Extracts the inline session-start read+write+derive logic into a focused
 * single-purpose module; adds the v1 -> v2 schema migration with additive-only
 * semantics + future-version detection + atomic-write crash safety.
 *
 * Phase 126 Plan 07. Canon Part 6 (dog-fooding: schema evolution surfaces only
 * via shipped harness -- v1 was shipped in v1.13.0-beta.13). Canon Part 7
 * (reuse: extracts inline session-start write into a module; does NOT
 * re-architect the write path).
 *
 * The wire shape evolves through a single integer sentinel (`schema_version`).
 * Per CONTEXT.md D3 (LOCKED): integer not semver string (simpler comparison
 * for additive-only migrations). Per Open Question 5 settlement: `===` integer
 * equality is the comparison.
 *
 * The v1 -> v2 additive-only mapping (CONTEXT.md D3 + Plan 07 must_haves):
 *
 *   v1 file (Phase 123, NO schema_version):
 *     {
 *       active_root, active_version, topology, installed_at,
 *       snapshot, surfaces?, resolved_at?, ...
 *     }
 *
 *   v2 file (Phase 126):
 *     v1-fields-preserved-byte-identical +
 *     {
 *       schema_version: 2,
 *       topology_class: derived from topology (see deriveTopologyClass below),
 *       last_acceptance_run: null,                  // Plan 03 + Plan 05 fill this
 *       renderer_contract_version: 'unknown'        // Plan 01 sets this
 *     }
 *
 * Future-version detection: schema_version > 2 -> warn on stderr + DEFER to
 * /mos:doctor --fix. Do NOT downgrade. Do NOT touch the file. Return a typed
 * sentinel so callers can decide.
 *
 * Atomic write: write to `<path>.tmp`, fsync, rename. A crash between write
 * and rename leaves the original file untouched. The MOS_TEST_FORCE_FAIL=rename
 * env-var hook mirrors scripts/doctor.cjs lines ~304-307 -- it injects a throw
 * at the rename moment so the crash-recovery contract is testable.
 *
 * Canon Part 8: this module reads + writes LOCAL files only ($HOME/.mindrian/).
 * Zero network calls. Zero Brain queries. Zero side-channel to remote services.
 */

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = 2;
const STATE_FILE_PATH_REL = path.join('.mindrian', 'install-state.json');

function statePath(home) {
  return path.join(home, STATE_FILE_PATH_REL);
}

/**
 * readInstallState({ home }) -> object | null
 *
 * Returns the parsed JSON object, or null when the file is absent OR
 * unparseable. Never throws -- the goal is a robust read for downstream
 * consumers (doctor, session-start, the migrator itself). A corrupt file is
 * surfaced as null so the caller can decide whether to derive-from-scratch
 * (session-start's existing behavior) or surface a finding (doctor class I).
 */
function readInstallState(opts) {
  const home = (opts && opts.home) || '';
  if (!home) return null;
  const p = statePath(home);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    // Corrupt file -> null (mirrors doctor.cjs's class-I "absent" finding).
    return null;
  }
}

/**
 * writeInstallState({ home, state }) -> void
 *
 * Atomic write: $HOME/.mindrian/install-state.json.tmp -> fsync -> rename.
 *
 * The MOS_TEST_FORCE_FAIL=rename env injection mirrors the doctor.cjs
 * pattern -- if set, throws AFTER the .tmp write but BEFORE the rename so
 * tests can verify the original file is left untouched.
 *
 * Test-only side note: when MOS_TEST_FORCE_FAIL=rename, the .tmp file is left
 * on disk; the rename never happens; the original target is untouched. A
 * subsequent successful call will overwrite the .tmp via openSync('w') so
 * stale .tmp files are not a long-term hazard.
 */
function writeInstallState(opts) {
  const home = opts.home;
  const state = opts.state;
  const p = statePath(home);
  const tmp = p + '.tmp';
  // Ensure parent dir exists. Idempotent.
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // Atomic write: write to tmp, fsync (best-effort), rename.
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(state, null, 2) + '\n');
    try { fs.fsyncSync(fd); } catch (_) { /* fsync best-effort -- some FS lack support */ }
  } finally {
    fs.closeSync(fd);
  }
  // Test injection point (mirrors scripts/doctor.cjs MOS_TEST_FORCE_FAIL).
  // Throw AFTER the .tmp write so the original target is byte-identical.
  if (process.env.MOS_TEST_FORCE_FAIL === 'rename') {
    throw new Error('MOS_TEST_FORCE_FAIL=rename injection (test-only)');
  }
  fs.renameSync(tmp, p);
}

/**
 * deriveTopologyClass(topology) -> 'healthy' | 'missing' | 'drifted'
 *
 * Canonical 4-state taxonomy from CONTEXT.md D3 + Plan 03 needs.
 *
 * Mapping (see PLAN.md Task 2 behavior block):
 *   marketplace-cache -> healthy   (Claude Code's standard install path)
 *   direct            -> healthy   (npx round-trip install -- @mindrian_os/install)
 *   dev-clone         -> healthy   (developer machine -- a clone with a remote)
 *   not-found         -> missing   (resolver returned null root)
 *   legacy            -> drifted   (the legacy hand-clone path -- pre-Phase 123)
 *   <unknown>         -> drifted   (conservative default for any new topology
 *                                   introduced after this module's release)
 */
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

/**
 * migrateIfNeeded({ home }) -> {
 *   migrated: boolean,
 *   // present in v1 -> v2 path:
 *   fromVersion?: 1, toVersion?: 2,
 *   // present in v2 path:
 *   currentVersion?: 2,
 *   // present in future-version path:
 *   futureVersion?: true, currentVersion?: number, advice?: string,
 *   // present in no-file path:
 *   fileAbsent?: true,
 * }
 *
 * Behavior matrix:
 *
 *   File absent
 *     -> { migrated:false, fileAbsent:true }
 *     -> Do NOT create the file (creation is session-start's job).
 *
 *   File present + no schema_version (or schema_version absent/null)
 *     -> Treat as v1. Run additive migration. Write back. Return
 *        { migrated:true, fromVersion:1, toVersion:2 }.
 *
 *   File present + schema_version === 2
 *     -> No-op. Return { migrated:false, currentVersion:2 }.
 *
 *   File present + schema_version > 2 (a future-version file)
 *     -> Emit stderr warn. Do NOT touch the file. Return
 *        { migrated:false, futureVersion:true, currentVersion:<n>,
 *          advice:'run /mos:doctor --fix' }.
 *
 *   File present + schema_version < 2 (unexpected lower-than-v1, e.g. 0)
 *     -> Treat as v1 (coerce). Same outcome as the v1 path.
 *
 *   File present + corrupt JSON
 *     -> readInstallState returned null -> indistinguishable from absent at
 *        this layer -> { migrated:false, fileAbsent:true }. doctor class I
 *        is the surface that catches corrupt-but-present and offers --fix.
 */
function migrateIfNeeded(opts) {
  const home = opts.home;
  const state = readInstallState({ home });
  if (!state) return { migrated: false, fileAbsent: true };

  const sv = state.schema_version;
  if (typeof sv === 'undefined' || sv === null) {
    // v1 (or unmarked) -> v2 additive migration.
    return _runV1ToV2({ home, state });
  }
  if (sv === SCHEMA_VERSION) {
    return { migrated: false, currentVersion: SCHEMA_VERSION };
  }
  if (typeof sv === 'number' && sv > SCHEMA_VERSION) {
    // Future-version: warn + defer. Do NOT downgrade. Do NOT touch the file.
    process.stderr.write(
      '[install-state] schema_version ' + sv + ' is newer than the plugin understands (' +
      SCHEMA_VERSION + '). Skipping migration; run /mos:doctor --fix.\n'
    );
    return {
      migrated: false,
      futureVersion: true,
      currentVersion: sv,
      advice: 'run /mos:doctor --fix',
    };
  }
  // Unexpected lower-than-v1 (e.g. schema_version: 0 or a non-number) -- coerce
  // to v1 and run the additive migration. This is a safety net; not expected
  // to fire in practice.
  return _runV1ToV2({ home, state });
}

// Internal: perform the v1 -> v2 additive migration + write.
function _runV1ToV2(opts) {
  const home = opts.home;
  const state = opts.state;
  // Object.assign preserves v1 fields byte-identically; new fields are
  // appended last (since v2's schema_version is the sentinel, the order
  // could be reshuffled but additive-on-top is the simplest invariant).
  const v2 = Object.assign({}, state, {
    schema_version: SCHEMA_VERSION,
    topology_class: deriveTopologyClass(state.topology),
    last_acceptance_run: null,
    renderer_contract_version: 'unknown',
  });
  writeInstallState({ home, state: v2 });
  return { migrated: true, fromVersion: 1, toVersion: SCHEMA_VERSION };
}

module.exports = {
  SCHEMA_VERSION,
  readInstallState,
  writeInstallState,
  migrateIfNeeded,
  deriveTopologyClass,
  // Test-only helpers (intentionally exported with leading underscore so
  // consumers do not depend on them and grep can spot test surface usage).
  _statePath: statePath,
};
