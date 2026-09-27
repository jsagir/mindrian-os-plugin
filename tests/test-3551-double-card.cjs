#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 10 Task 1 (RED) -- test-3551-double-card: pins Navigator
 * Ruling 5 (AMB-05, AMB-06): a filed artifact produces ONE card, not two.
 * SENS-13's stamped card wins; the Phase 117 card (the UserPromptSubmit
 * drain, and SENS-01 through deriveTurnSignals' first_material scan) stands
 * down while the ambient run for a material is in flight and stays down
 * for good once the ambient ledger stamps that material via a sens13 win.
 *
 * The one read-only helper both 117 surfaces call:
 * isMaterialHeldForStampedCard(roomDir, materialId, opts), in the SENS-21
 * module (lib/core/sensors/sensor-room-delta.cjs), replicating the ledger
 * relpath (the url-ingest sensor precedent) and never writing.
 *
 * Three sections:
 *   1. Unit legs against isMaterialHeldForStampedCard directly (fs-level
 *      fixtures, no drain/child spawn).
 *   2. The drain (scripts/auto-explore-drain.cjs), spawned for real with an
 *      isolated HOME so its own explored-materials-store ledger never
 *      leaks across legs.
 *   3. SENS-01: lib/core/insight-sensors.cjs's deriveTurnSignals first_material
 *      scan, called in-process.
 *
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). Bare node script, no
 * framework, exits non-zero on any assertion failure (assert throws).
 * House rule: hyphens only, no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

let sensorRoomDelta;
try {
  sensorRoomDelta = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-room-delta.cjs'));
} catch (_e) {
  sensorRoomDelta = null;
}
const guard = require(path.join(REPO_ROOT, 'scripts', 'scout-cadence-guard.cjs'));
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const agent = require(path.join(REPO_ROOT, 'lib', 'agents', 'auto-explore-agent.cjs'));

const DRAIN_PATH = path.join(REPO_ROOT, 'scripts', 'auto-explore-drain.cjs');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-double-card:');

assert.ok(sensorRoomDelta, 'lib/core/sensors/sensor-room-delta.cjs must exist and load (module missing)');
assert.strictEqual(typeof sensorRoomDelta.isMaterialHeldForStampedCard, 'function',
  'isMaterialHeldForStampedCard must be exported from lib/core/sensors/sensor-room-delta.cjs');
assert.strictEqual(typeof sensorRoomDelta.AMBIENT_LEDGER_RELPATH_REPLICA, 'string',
  'AMBIENT_LEDGER_RELPATH_REPLICA must be exported from lib/core/sensors/sensor-room-delta.cjs');

const DELTA_STATE_SCHEMA_VERSION = sensorRoomDelta.DELTA_STATE_SCHEMA_VERSION;
const DELTA_STATE_RELPATH = sensorRoomDelta.DELTA_STATE_RELPATH;
const isMaterialHeldForStampedCard = sensorRoomDelta.isMaterialHeldForStampedCard;

// ---------------------------------------------------------------------------
// Small local fixtures (no room.db needed -- these files are flat fs reads).
// ---------------------------------------------------------------------------
const cleanupDirs = [];
function mkRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-dc-' + label + '-'));
  cleanupDirs.push(root);
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  return roomDir;
}
function mkHome(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-dc-home-' + label + '-'));
  cleanupDirs.push(d);
  return d;
}
function cleanupAll() {
  for (const d of cleanupDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

function nowIso() { return new Date().toISOString(); }

// fullDeltaState(materialId, runState, overrides) -- the exact closed
// 10-key shape scripts/scout-cadence-guard.cjs's validateDeltaState requires.
function fullDeltaState(materialId, runState, overrides) {
  return Object.assign({
    schema_version: DELTA_STATE_SCHEMA_VERSION,
    evaluated_at: nowIso(),
    seam: 'material',
    classes: ['e'],
    delta_hash: 'a'.repeat(64),
    run_state: runState,
    material_id: materialId,
    opportunity_handle: null,
    surfaced_via: null,
    framing: null,
  }, overrides || {});
}

function writeValidDeltaState(roomDir, materialId, runState, overrides) {
  const res = guard.writeRoomDeltaState(roomDir, fullDeltaState(materialId, runState, overrides));
  assert.strictEqual(res.ok, true, 'writeRoomDeltaState must accept the fixture state: ' + JSON.stringify(res));
}

// fictionalWhitespace() -- one non-empty bucket so composeAutoExploreFinding
// yields a real finding (the tests/test-acpt-03-first-material-explore.cjs
// shape, copied not required).
function fictionalWhitespace() {
  return {
    gaps: [
      {
        density_score: 0.2,
        framework_chain: ['Domain Decomposition', 'Whitespace Map'],
        nearest_room_artifacts: [{ id: 'fict-node-ws-001', section: 'problem-definition' }],
      },
    ],
  };
}

// writeFinding(roomDir, materialId, sessionId) -- writes
// room/.mindrian/auto-explore-<materialId>.json in the exact shape
// scripts/auto-explore-fire.cjs writes: composeAutoExploreFinding's output,
// session_id stamped as a content field (Phase 237-06), atomic temp+rename.
function writeFinding(roomDir, materialId, sessionId) {
  const finding = agent.composeAutoExploreFinding({
    material_id: materialId,
    whitespace: fictionalWhitespace(),
    rs: {},
    analogy: {},
  });
  assert.ok(finding, 'composeAutoExploreFinding must produce a finding for the fixture whitespace input');
  finding.session_id = sessionId;
  const findingPath = path.join(roomDir, '.mindrian', 'auto-explore-' + materialId + '.json');
  const tmpPath = findingPath + '.tmp.' + process.pid;
  fs.writeFileSync(tmpPath, JSON.stringify(finding, null, 2), 'utf8');
  fs.renameSync(tmpPath, findingPath);
  return finding;
}

function runDrain(roomDir, homeDir) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOM_DIR: roomDir,
    HOME: homeDir,
    USERPROFILE: homeDir,
  });
  const res = spawnSync(process.execPath, [DRAIN_PATH], {
    env: env,
    input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', cwd: roomDir }),
    timeout: 15000,
  });
  assert.strictEqual(res.status, 0, 'the drain must always exit 0; stderr=' + String(res.stderr || ''));
  let out;
  try {
    out = JSON.parse((res.stdout || Buffer.alloc(0)).toString());
  } catch (e) {
    throw new Error('the drain must emit valid JSON on stdout: ' + e.message);
  }
  return out;
}

try {
  // =========================================================================
  // SECTION 1 -- isMaterialHeldForStampedCard: direct, fs-level legs.
  // =========================================================================

  (function test_falseWithNoLedgerNoDeltaState() {
    const room = mkRoom('none');
    assert.strictEqual(isMaterialHeldForStampedCard(room, 'ab12cd34ef56'), false,
      'no ledger and no delta state -> false');
    ok('isMaterialHeldForStampedCard is false with no ledger and no delta state');
  })();

  (function test_trueWhenFreshRunningOrStarted() {
    for (const runState of ['started', 'running']) {
      const room = mkRoom('fresh-' + runState);
      writeValidDeltaState(room, 'ab12cd34ef56', runState);
      assert.strictEqual(isMaterialHeldForStampedCard(room, 'ab12cd34ef56'), true,
        'a fresh delta state with run_state \'' + runState + '\' and a matching material_id -> true');
    }
    ok('a fresh delta state naming the material with run_state started/running -> true');
  })();

  (function test_falseWhenCompletedSurfacedViaNone() {
    const room = mkRoom('completed-none');
    writeValidDeltaState(room, 'ab12cd34ef56', 'completed', { surfaced_via: 'none' });
    assert.strictEqual(isMaterialHeldForStampedCard(room, 'ab12cd34ef56'), false,
      'run_state completed with surfaced_via none -> false (not held)');
    ok('a delta state completed with surfaced_via none -> false');
  })();

  (function test_trueWhenLedgerStampedRegardlessOfDeltaStateAge() {
    const room = mkRoom('stamped');
    const rec = guard.recordAmbientRun(room, { deltaHash: 'b'.repeat(64), surfacedVia: 'sens13', materialId: 'ab12cd34ef56' });
    assert.strictEqual(rec.recorded, true, 'recordAmbientRun must record the fixture ledger: ' + JSON.stringify(rec));
    assert.ok(Array.isArray(rec.ledger.stamped_materials) && rec.ledger.stamped_materials.indexOf('ab12cd34ef56') !== -1,
      'sanity: the ledger must actually list the material in stamped_materials');
    // No delta-state file at all in this room -- the ledger branch alone
    // must hold the card, independent of delta-state age/absence.
    assert.strictEqual(fs.existsSync(path.join(room, DELTA_STATE_RELPATH)), false,
      'sanity: no delta-state file exists in this room');
    assert.strictEqual(isMaterialHeldForStampedCard(room, 'ab12cd34ef56'), true,
      'the ledger stamped_materials list alone (no delta state at all) -> true');
    ok('a ledger listing the material in stamped_materials holds the card regardless of delta-state age/absence');
  })();

  (function test_falseForDifferentMaterialId() {
    const room = mkRoom('other-material');
    writeValidDeltaState(room, 'ab12cd34ef56', 'running');
    assert.strictEqual(isMaterialHeldForStampedCard(room, 'ff00ff00ff00'), false,
      'a running delta state naming a DIFFERENT material_id -> false for this materialId');
    ok('a held state for one material_id does not hold a different material_id');
  })();

  (function test_falseForMalformedId() {
    const room = mkRoom('malformed');
    writeValidDeltaState(room, 'ab12cd34ef56', 'running');
    for (const bad of ['zz', 'AB12CD34EF56', 'not-hex!!', '', 'abc']) {
      assert.strictEqual(isMaterialHeldForStampedCard(room, bad), false,
        'a malformed materialId (' + JSON.stringify(bad) + ') -> false, never throws');
    }
    ok('a malformed (non-hex, too-short, empty) materialId always returns false');
  })();

  (function test_corruptLedgerFailsClosedButFreshRunningStillHolds() {
    // Corrupt ledger alone (no delta state at all) -> the stamped-list
    // branch fails CLOSED to false -- the card must SHOW, never hidden by
    // a bad file.
    const roomCorruptOnly = mkRoom('corrupt-only');
    const ledgerPath = path.join(roomCorruptOnly, '.mindrian', 'ambient-run-ledger.json');
    fs.writeFileSync(ledgerPath, '{not json', 'utf8');
    assert.strictEqual(isMaterialHeldForStampedCard(roomCorruptOnly, 'ab12cd34ef56'), false,
      'a corrupt ledger with no delta state -> false (the card shows; never hide a card on a bad file)');

    // Corrupt ledger PLUS a fresh running delta state for the same material
    // -> still true (the delta-state branch does not depend on ledger health).
    const roomBoth = mkRoom('corrupt-plus-running');
    fs.writeFileSync(path.join(roomBoth, '.mindrian', 'ambient-run-ledger.json'), '{not json', 'utf8');
    writeValidDeltaState(roomBoth, 'ab12cd34ef56', 'running');
    assert.strictEqual(isMaterialHeldForStampedCard(roomBoth, 'ab12cd34ef56'), true,
      'a corrupt ledger must not suppress a fresh running delta-state hold');
    ok('a corrupt ledger fails closed to false for the stamped-list branch alone, while a fresh running delta state still returns true');
  })();

  (function test_writesNoFileAndIsSync() {
    const room = mkRoom('write-spy');
    writeValidDeltaState(room, 'ab12cd34ef56', 'running');
    const dir = path.join(room, '.mindrian');
    const before = fs.readdirSync(dir).sort();
    const result = isMaterialHeldForStampedCard(room, 'ab12cd34ef56');
    const after = fs.readdirSync(dir).sort();
    assert.deepEqual(before, after, 'isMaterialHeldForStampedCard must write NO file (read-only)');
    assert.strictEqual(typeof result, 'boolean', 'isMaterialHeldForStampedCard must return a plain boolean synchronously (never a Promise)');
    assert.doesNotThrow(() => isMaterialHeldForStampedCard(null, null), 'must never throw on null args');
    assert.doesNotThrow(() => isMaterialHeldForStampedCard(undefined, undefined), 'must never throw on undefined args');
    assert.doesNotThrow(() => isMaterialHeldForStampedCard('/nonexistent/dir/xyz', 'ab12cd34ef56'), 'must never throw on a nonexistent roomDir');
    ok('isMaterialHeldForStampedCard writes no file, is sync, and never throws');
  })();

  (function test_relpathDriftPin() {
    assert.strictEqual(sensorRoomDelta.AMBIENT_LEDGER_RELPATH_REPLICA, guard.AMBIENT_LEDGER_RELPATH,
      'AMBIENT_LEDGER_RELPATH_REPLICA must equal scout-cadence-guard\'s AMBIENT_LEDGER_RELPATH (drift pin)');
    ok('AMBIENT_LEDGER_RELPATH_REPLICA equals scout-cadence-guard.AMBIENT_LEDGER_RELPATH');
  })();

  // =========================================================================
  // SECTION 2 -- the drain (scripts/auto-explore-drain.cjs), spawned for real.
  // =========================================================================

  (function test_drainDefersWhileRunningThenFiresThenStandsDownForGood() {
    const materialId = 'ab12cd34ef56';
    const room = mkRoom('drain-leg');
    const home1 = mkHome('drain-leg-1');

    // (a) A fresh owned finding + a running delta state for this id -> the
    // drain must produce NO auto-explore directive this turn.
    writeFinding(room, materialId, 'sess-1');
    writeValidDeltaState(room, materialId, 'running');
    const out1 = runDrain(room, home1);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(out1, 'hookSpecificOutput'), false,
      'while the ambient run is in flight (running), the drain must defer (no hookSpecificOutput)');
    ok('the drain defers (no directive) while a running delta state holds the material');

    // (b) Once run_state becomes completed with surfaced_via none, the SAME
    // finding (never consumed while held) surfaces exactly as before.
    writeValidDeltaState(room, materialId, 'completed', { surfaced_via: 'none' });
    const out2 = runDrain(room, home1);
    assert.ok(out2.hookSpecificOutput && typeof out2.hookSpecificOutput.additionalContext === 'string',
      'once the ambient run completed with surfaced_via none, the drain must produce the directive');
    assert.match(out2.hookSpecificOutput.additionalContext, /PENDING AUTO-EXPLORE FINDING/,
      'the produced directive is the standard Phase 117 auto-explore directive');
    ok('the drain produces the directive once run_state is completed with surfaced_via none (unheld)');

    // (c) Once the ambient ledger lists this material in stamped_materials
    // (a sens13 win), the 117 card stands down for good -- proven with a
    // FRESH finding file and a FRESH isolated HOME (so the prior "already
    // surfaced" bookkeeping from (b) cannot itself explain the silence;
    // only the stamped-list hold can).
    const rec = guard.recordAmbientRun(room, { deltaHash: 'c'.repeat(64), surfacedVia: 'sens13', materialId: materialId });
    assert.strictEqual(rec.recorded, true, 'recordAmbientRun must stamp the material: ' + JSON.stringify(rec));
    writeFinding(room, materialId, 'sess-2');
    const home2 = mkHome('drain-leg-2');
    const out3 = runDrain(room, home2);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(out3, 'hookSpecificOutput'), false,
      'once stamped_materials lists the id, the 117 card must never surface again, even with a fresh finding file and a fresh store');
    ok('the drain never produces the directive again once the ambient ledger stamps the material (surfaced_via sens13)');
  })();

  (function test_drainDifferentMaterialUnaffected() {
    const heldMaterial = 'aa11bb22cc33';
    const otherMaterial = 'ff00ff00ff00';
    const room = mkRoom('drain-cross');
    const home = mkHome('drain-cross');

    writeFinding(room, heldMaterial, 'sess-x');
    writeFinding(room, otherMaterial, 'sess-x');
    writeValidDeltaState(room, heldMaterial, 'running');

    const out = runDrain(room, home);
    assert.ok(out.hookSpecificOutput && typeof out.hookSpecificOutput.additionalContext === 'string',
      'a different material\'s finding must surface normally even while a SIBLING material is held in the same room');
    ok('a held material never blocks a different material\'s finding in the same room');
  })();

  // =========================================================================
  // SECTION 3 -- SENS-01: deriveTurnSignals' first_material scan.
  // =========================================================================

  (function test_sens01DeferredThenFires() {
    const materialId = 'ab12cd34ef56';
    const room = mkRoom('sens01');
    const sessionId = 'sess-sens01';

    writeFinding(room, materialId, sessionId);
    writeValidDeltaState(room, materialId, 'running');
    const heldSignals = sensors.deriveTurnSignals({ roomDir: room }, sessionId);
    assert.strictEqual(heldSignals.indexOf('first_material'), -1,
      'deriveTurnSignals must NOT include first_material while the material is held (running)');
    ok('deriveTurnSignals omits first_material while the material is held');

    writeValidDeltaState(room, materialId, 'completed', { surfaced_via: 'none' });
    const unheldSignals = sensors.deriveTurnSignals({ roomDir: room }, sessionId);
    assert.ok(unheldSignals.indexOf('first_material') !== -1,
      'deriveTurnSignals must include first_material once the run completed with surfaced_via none');
    ok('deriveTurnSignals includes first_material once the run completed with surfaced_via none');

    const reach = sensors.sensorFirstMaterial({ signals: unheldSignals }, { problem_type: 'undefined' }, { roomDir: room });
    assert.ok(reach && reach.reach_id === 'context_block', 'sensorFirstMaterial must fire as before once first_material is present');
    ok('sensorFirstMaterial fires as before once first_material reappears');
  })();

  (function test_sens01DifferentMaterialUnaffected() {
    const heldMaterial = 'aa11bb22cc33';
    const otherMaterial = 'ff00ff00ff00';
    const room = mkRoom('sens01-cross');
    const sessionId = 'sess-sens01-cross';

    // Only the OTHER material has a fresh marker file; the held material's
    // delta state names a material with NO marker file of its own -- proves
    // the scan is not globally suppressed by an unrelated held material.
    writeFinding(room, otherMaterial, sessionId);
    writeValidDeltaState(room, heldMaterial, 'running');

    const signals = sensors.deriveTurnSignals({ roomDir: room }, sessionId);
    assert.ok(signals.indexOf('first_material') !== -1,
      'a different material\'s marker file must still surface first_material while a SIBLING material is held');
    ok('deriveTurnSignals: a held material never suppresses a different material\'s marker');
  })();
} finally {
  cleanupAll();
}

console.log('');
console.log('PASS test-3551-double-card.cjs (' + checks + ' checks)');

assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
netGuard.restore();
