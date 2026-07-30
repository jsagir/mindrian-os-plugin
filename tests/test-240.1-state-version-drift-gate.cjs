#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 240.1 Plan 02 Task 1/2 -- the CTXL-01 must_catch / must_not_catch
 * probe table for lib/core/state-version.cjs::persistState, ported from the
 * tests/run-all-236.sh:185-241 mutation-proof idiom to a standing CJS test.
 *
 * WHAT THIS MEASURES. This file drives persistState() DIRECTLY against a
 * fixed synthetic rendered body (no scripts/compute-state spawn), so the
 * version-classification branches are isolated from the renderer. The
 * companion file tests/test-240.1-state-version-preserved.cjs drives the REAL
 * computeState() end to end; this file is the narrower unit-level probe table
 * for the four version classifications persistState must handle.
 *
 * MUTATION THAT TURNS THIS RED. Restoring the blind
 *   fs.writeFileSync(path.join(resolved, 'STATE.md'), result)
 * at lib/core/state-ops.cjs:44 does NOT turn this file red -- this file never
 * calls computeState(). This file turns red the moment
 * lib/core/state-version.cjs::persistState stops implementing one of the
 * four branches in install-state.cjs:184-231's shape (future -> refuse +
 * notify; current -> preserve byte-identically; absent/legacy -> stamp
 * forward; any throw -> { status: 'error' } and never propagate).
 *
 * NOTE ON WHAT DOES *NOT* TURN THIS RED (Pitfall 2). A green run here proves
 * the persistState() UNIT is correct. It proves NOTHING about whether any of
 * the six write sites in 240.1-RESEARCH.md Finding 1C actually CALL
 * persistState(). Plan 240.1-03's tests/test-240.1-hook-write-site.sh is the
 * integration-level antidote to that gap.
 *
 * Hermeticity (mandatory, Research Wave 0 Gaps): every scenario owns a
 * fs.mkdtempSync root under os.tmpdir(). CLAUDE_PLUGIN_DATA is redirected to
 * a scratch dir for the must_catch scenario so the violation JSONL sink never
 * touches a real $HOME/.mindrian/schema-violations.jsonl. Nothing under
 * ~/MindrianRooms/ is read or written by this file.
 *
 * Harness: the plain ok/fail/scenario pass-counter idiom from
 * tests/test-236-rebuild-preserves-journal.cjs. No jest, no vitest.
 * No em-dashes (CLAUDE.md hard rule); the two forbidden code points appear
 * nowhere in this file, not even as \u escapes, because this file never needs
 * to name them.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const stateVersion = require(path.join(REPO, 'lib', 'core', 'state-version.cjs'));
const frontmatterSchemas = require(path.join(REPO, 'lib', 'core', 'frontmatter-schemas.cjs'));

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

function scenario(name, fn) {
  try {
    fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-2401-driftgate-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// A fixed synthetic rendered body, standing in for scripts/compute-state's
// stdout, WITHOUT any gsd_state_version / status / current_room line -- the
// exact shape the real renderer emits per 240.1-RESEARCH.md Finding 1B.
const SYNTHETIC_RENDERED = '---\n'
  + 'computed: 2026-01-01T00:00:00Z\n'
  + 'venture_stage: Pre-Opportunity\n'
  + 'total_entries: 0\n'
  + '---\n'
  + '# Data Room State\n'
  + '\n'
  + 'synthetic body for the drift-gate probe table\n';

function writeStateMd(roomDir, frontmatterLines) {
  fs.mkdirSync(roomDir, { recursive: true });
  const fm = ['---'].concat(frontmatterLines).concat(['---']).join('\n');
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    fm + '\n\n# State\n\n## Decisions\n\n(none yet)\n',
    'utf8'
  );
}

function readState(roomDir) {
  return fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
}

// ---------- must_catch: a NEWER version than the module understands ----------

function scenarioMustCatchFutureVersion() {
  const scratch = makeScratchDir('future');
  const roomDir = path.join(scratch, 'room');
  const dataDir = path.join(scratch, 'plugin-data');
  fs.mkdirSync(dataDir, { recursive: true });
  const priorEnv = process.env.CLAUDE_PLUGIN_DATA;
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  try {
    writeStateMd(roomDir, ['gsd_state_version: 2.0', 'status: active']);
    const before = readState(roomDir);

    const result = stateVersion.persistState(roomDir, SYNTHETIC_RENDERED);

    scenario('must_catch: a future gsd_state_version returns status version-mismatch', () => {
      assert.equal(result.status, 'version-mismatch');
      assert.equal(result.written, false);
      assert.equal(result.onDiskVersion, '2.0');
      assert.equal(result.moduleVersion, stateVersion.STATE_SCHEMA_VERSION);
    });

    scenario('must_catch: the file bytes are UNCHANGED, not merely a verdict returned', () => {
      const after = readState(roomDir);
      assert.equal(after, before, 'STATE.md was overwritten despite a future-version verdict');
    });

    scenario('must_catch: exactly one JSON line is appended to schema-violations.jsonl', () => {
      const logPath = path.join(dataDir, 'schema-violations.jsonl');
      assert.ok(fs.existsSync(logPath), 'schema-violations.jsonl was never written');
      const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
      assert.equal(lines.length, 1, 'expected exactly one violation line, got ' + lines.length);
      const entry = JSON.parse(lines[0]);
      assert.equal(entry.kind, 'state-version-mismatch');
      assert.equal(entry.onDiskVersion, '2.0');
      assert.equal(entry.moduleVersion, stateVersion.STATE_SCHEMA_VERSION);
      assert.ok(typeof entry.file === 'string' && entry.file.length > 0);
      assert.ok(typeof entry.timestamp === 'string' && entry.timestamp.length > 0);
    });
  } finally {
    if (priorEnv === undefined) delete process.env.CLAUDE_PLUGIN_DATA;
    else process.env.CLAUDE_PLUGIN_DATA = priorEnv;
    rmrf(scratch);
  }
}

// ---------- must_not_catch: SAME version proceeds and re-stamps byte-identically ----------

function scenarioMustNotCatchCurrentVersion() {
  const scratch = makeScratchDir('current');
  const roomDir = path.join(scratch, 'room');
  try {
    writeStateMd(roomDir, ['gsd_state_version: 1.0', 'status: active']);

    const result = stateVersion.persistState(roomDir, SYNTHETIC_RENDERED);

    scenario('must_not_catch: an equal gsd_state_version proceeds with status ok', () => {
      assert.equal(result.status, 'ok');
      assert.equal(result.classification, 'current');
      assert.equal(result.stamped, false);
    });

    scenario('must_not_catch: the re-emitted stamp is byte-identical (1.0 stays 1.0)', () => {
      const after = readState(roomDir);
      const m = after.match(/^gsd_state_version: (\S+)$/m);
      assert.ok(m, 'gsd_state_version line missing after a current-version write');
      assert.equal(m[1], '1.0');
      assert.ok(/^status: active$/m.test(after), 'status: active was not preserved');
      assert.ok(/^computed: /m.test(after), 'the new body did not land');
    });
  } finally {
    rmrf(scratch);
  }
}

// ---------- must_not_catch: no version key present proceeds and stamps forward ----------

function scenarioMustNotCatchNoVersionKey() {
  const scratch = makeScratchDir('novkey');
  const roomDir = path.join(scratch, 'room');
  try {
    writeStateMd(roomDir, ['status: active']);

    const result = stateVersion.persistState(roomDir, SYNTHETIC_RENDERED);

    scenario('must_not_catch: a STATE.md with no version key proceeds and stamps forward', () => {
      assert.equal(result.status, 'ok');
      assert.equal(result.classification, 'absent');
      assert.equal(result.stamped, true);
      const after = readState(roomDir);
      assert.ok(/^gsd_state_version: 1\.0$/m.test(after), 'stamp was not written forward');
      assert.ok(/^status: active$/m.test(after), 'pre-existing status was not preserved');
    });
  } finally {
    rmrf(scratch);
  }
}

// ---------- must_not_catch: STATE.md absent entirely is created carrying the stamp ----------

function scenarioMustNotCatchStateAbsent() {
  const scratch = makeScratchDir('absent');
  const roomDir = path.join(scratch, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  try {
    assert.ok(!fs.existsSync(path.join(roomDir, 'STATE.md')), 'precondition: STATE.md must not exist yet');

    const result = stateVersion.persistState(roomDir, SYNTHETIC_RENDERED);

    scenario('must_not_catch: an absent STATE.md is created carrying the stamp', () => {
      assert.equal(result.status, 'ok');
      assert.equal(result.classification, 'absent');
      assert.equal(result.stamped, true);
      const after = readState(roomDir);
      assert.ok(/^gsd_state_version: 1\.0$/m.test(after), 'the freshly created file does not carry the stamp');
    });
  } finally {
    rmrf(scratch);
  }
}

// ---------- must_not_catch: a non-numeric version value stamps forward, never throws ----------

function scenarioMustNotCatchNonNumericVersion() {
  const scratch = makeScratchDir('banana');
  const roomDir = path.join(scratch, 'room');
  try {
    writeStateMd(roomDir, ['gsd_state_version: banana', 'status: active']);

    let result;
    let threw = false;
    try {
      result = stateVersion.persistState(roomDir, SYNTHETIC_RENDERED);
    } catch (_e) {
      threw = true;
    }

    scenario('must_not_catch: a non-numeric version value never throws and stamps forward', () => {
      assert.equal(threw, false, 'persistState threw on a non-numeric version value');
      assert.equal(result.status, 'ok');
      assert.equal(result.classification, 'legacy');
      assert.equal(result.stamped, true);
      const after = readState(roomDir);
      assert.ok(/^gsd_state_version: 1\.0$/m.test(after), 'the safety-net coercion did not stamp forward');
    });
  } finally {
    rmrf(scratch);
  }
}

// ---------- CORRECTION B fence: current_room is never preserved ----------

function scenarioCorrectionBCurrentRoomNotPreserved() {
  const scratch = makeScratchDir('corrb');
  const roomDir = path.join(scratch, 'room');
  try {
    // A parked room whose prior STATE.md carries a stale current_room marker.
    // SYNTHETIC_RENDERED (mimicking compute-state on a NON-active room) does
    // not emit a current_room line, per scripts/compute-state:29-45.
    writeStateMd(roomDir, [
      'gsd_state_version: 1.0',
      'status: active',
      'current_room: stale-room',
    ]);

    const result = stateVersion.persistState(roomDir, SYNTHETIC_RENDERED);

    scenario('CORRECTION B: current_room is NOT preserved across a regeneration', () => {
      assert.equal(result.status, 'ok');
      const after = readState(roomDir);
      assert.ok(
        !/^current_room:/m.test(after),
        'current_room resurrected a stale active-room marker on a parked room'
      );
      // The two keys that ARE meant to survive still do.
      assert.ok(/^gsd_state_version: 1\.0$/m.test(after));
      assert.ok(/^status: active$/m.test(after));
    });

    scenario('CORRECTION B: PRESERVED_KEYS is exactly [gsd_state_version, status]', () => {
      assert.deepEqual(stateVersion.PRESERVED_KEYS.slice(), ['gsd_state_version', 'status']);
    });
  } finally {
    rmrf(scratch);
  }
}

// ---------- Never-throw fence: an unwritable path returns { status: 'error' } ----------

function scenarioNeverThrowOnUnwritablePath() {
  const scratch = makeScratchDir('unwritable');
  try {
    // A regular file standing where a directory is expected: any mkdirSync
    // under it must fail with ENOTDIR, never a silent success.
    const blockerFile = path.join(scratch, 'not-a-directory');
    fs.writeFileSync(blockerFile, 'i am a file, not a room directory', 'utf8');
    const roomDir = path.join(blockerFile, 'sub-room');

    let result;
    let threw = false;
    const priorWrite = process.stderr.write;
    let stderrLines = 0;
    process.stderr.write = function patched(chunk, ...rest) {
      stderrLines += 1;
      return priorWrite.call(process.stderr, chunk, ...rest);
    };
    try {
      result = stateVersion.persistState(roomDir, SYNTHETIC_RENDERED);
    } catch (_e) {
      threw = true;
    } finally {
      process.stderr.write = priorWrite;
    }

    scenario('never-throw: persistState against an unwritable path never throws', () => {
      assert.equal(threw, false, 'persistState threw instead of returning a typed error envelope');
      assert.equal(result.status, 'error');
      assert.ok(typeof result.message === 'string' && result.message.length > 0);
    });

    scenario('never-throw: at least one stderr line is written on the error path', () => {
      assert.ok(stderrLines >= 1, 'no stderr line was written on the error path (silent swallow)');
    });
  } finally {
    rmrf(scratch);
  }
}

// ---------- Schema fence: the four keys validate cleanly ----------

function scenarioFourKeysValidateCleanly() {
  scenario('schema fence: gsd_state_version, status, created_by, current_room all validate cleanly', () => {
    const result = frontmatterSchemas.validate('STATE.md', {
      gsd_state_version: '1.0',
      status: 'imported',
      created_by: 'phase-80-vault-import',
      current_room: 'some-active-room',
    });
    const unknownFields = result.violations
      .filter((v) => v.type === 'unknown')
      .map((v) => v.field);
    assert.deepEqual(
      unknownFields, [],
      'one or more of the four CTXL-01 keys is still unknown to the STATE.md schema: '
        + JSON.stringify(unknownFields)
    );
  });
}

// ---------- Runner ----------

process.stdout.write('\nPhase 240.1 Plan 02 Task 1/2: state-version-drift-gate (must_catch / must_not_catch)\n\n');

scenarioMustCatchFutureVersion();
scenarioMustNotCatchCurrentVersion();
scenarioMustNotCatchNoVersionKey();
scenarioMustNotCatchStateAbsent();
scenarioMustNotCatchNonNumericVersion();
scenarioCorrectionBCurrentRoomNotPreserved();
scenarioNeverThrowOnUnwritablePath();
scenarioFourKeysValidateCleanly();

process.stdout.write('\n  passed: ' + passed + '  failed: ' + failed + '\n\n');
if (failed > 0) {
  process.exit(1);
}
process.stdout.write('PASS test-240.1-state-version-drift-gate.cjs (13 scenarios)\n');
process.exit(0);
