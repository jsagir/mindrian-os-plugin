'use strict';
// tests/test-227-mode-select-checkpoint.cjs -- Phase 227 Plan-01 Task 3
// (SPEC Requirement 1 acceptance).
//
// Hermetic regression proof for the two net-new pieces this plan builds:
// lib/core/mode-select-sidechannel.cjs (D-01/D-02) and
// lib/core/doctor/mode-select-checkpoint-module.cjs (D-04/D-05). Covers the
// silent-skip warn path, the normal-recording ok path, the turn-1
// false-positive guard, never-throw on a corrupt store, and the registry
// contract. No em-dashes anywhere (house rule).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

let n = 0;
function ok(description, fn) {
  fn();
  n += 1;
  console.log('  ok   ' + description);
}

console.log('test-227-mode-select-checkpoint');

const sidechannel = require(path.join(REPO, 'lib', 'core', 'mode-select-sidechannel.cjs'));
const checkpointModule = require(path.join(REPO, 'lib', 'core', 'doctor', 'mode-select-checkpoint-module.cjs'));

function scratchFilePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mode-select-checkpoint-test-'));
  return path.join(dir, 'store.json');
}

// ---------------------------------------------------------------------------
// (a) has_user_turn false returns ok regardless of record state (D-05, the
// turn-1 false-positive guard). A scratch filePath with zero records.
// ---------------------------------------------------------------------------
ok('(a) has_user_turn false returns ok regardless of record state (turn-1 guard)', function () {
  const filePath = scratchFilePath();
  const result = checkpointModule.check({
    has_user_turn: false,
    session_id: 'turn-1-session',
    filePath: filePath,
  });
  assert.equal(result.status, 'ok');
  assert.equal(typeof result.detail, 'string');
  assert.ok(result.detail.length > 0);
});

// ---------------------------------------------------------------------------
// (b) has_user_turn true with no lane-pick record written returns warn, and
// the detail string mentions a silent skip. The silent-skip acceptance case.
// ---------------------------------------------------------------------------
ok('(b) has_user_turn true with no recorded lane pick returns warn mentioning a silent skip', function () {
  const filePath = scratchFilePath();
  const result = checkpointModule.check({
    has_user_turn: true,
    session_id: 'no-record-session',
    filePath: filePath,
  });
  assert.equal(result.status, 'warn');
  assert.equal(typeof result.detail, 'string');
  assert.ok(result.detail.indexOf('silent skip') !== -1, 'detail must mention a silent skip');
});

// ---------------------------------------------------------------------------
// (c) has_user_turn true, after recordLanePick against the same scratch
// filePath, returns ok. The normal-recording acceptance case.
// ---------------------------------------------------------------------------
ok('(c) has_user_turn true with a recorded lane pick returns ok', function () {
  const filePath = scratchFilePath();
  sidechannel.recordLanePick({
    lane: 'card-fired',
    sessionId: 'recorded-session',
    filePath: filePath,
  });
  const result = checkpointModule.check({
    has_user_turn: true,
    session_id: 'recorded-session',
    filePath: filePath,
  });
  assert.equal(result.status, 'ok');
  assert.equal(typeof result.detail, 'string');
  assert.ok(result.detail.length > 0);
});

// ---------------------------------------------------------------------------
// (d) the module never throws when the scratch file contains invalid JSON
// text. Write a corrupt string first, then call check.
// ---------------------------------------------------------------------------
ok('(d) never throws on a corrupt store (invalid JSON text)', function () {
  const filePath = scratchFilePath();
  fs.writeFileSync(filePath, 'not-valid-json{{{', 'utf8');

  assert.doesNotThrow(function () {
    const result = checkpointModule.check({
      has_user_turn: true,
      session_id: 'corrupt-session',
      filePath: filePath,
    });
    assert.ok(result && (result.status === 'ok' || result.status === 'warn'));
  });

  // The sidechannel's own reader must also never throw on the same corrupt
  // file (direct proof of the module's own never-throw contract).
  assert.doesNotThrow(function () {
    const records = sidechannel.readLanePick('corrupt-session', { filePath: filePath });
    assert.ok(Array.isArray(records));
  });
});

// ---------------------------------------------------------------------------
// (e) the registry contract: data/doctor-modules.json carries the
// mode-select-checkpoint row with fix_supported false and cadence always,
// and the runner module exports no fix function, matching the two-way
// parity rule tests/test-doctor-module-contract-parity.cjs enforces.
// ---------------------------------------------------------------------------
ok('(e) the registry carries the mode-select-checkpoint row (cadence always, flag null, fix_supported false), and the runner exports check() only', function () {
  const registryPath = path.join(REPO, 'data', 'doctor-modules.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const modules = Array.isArray(registry.modules) ? registry.modules : [];
  const row = modules.find((m) => m && m.id === 'mode-select-checkpoint');

  assert.ok(row, 'data/doctor-modules.json must carry a mode-select-checkpoint row');
  assert.equal(row.cadence, 'always');
  assert.equal(row.flag, null);
  assert.equal(row.fix_supported, false);
  assert.equal(row.runner, 'lib/core/doctor/mode-select-checkpoint-module.cjs');

  const runnerPath = path.resolve(REPO, row.runner);
  assert.ok(fs.existsSync(runnerPath), 'runner file must exist');
  const runner = require(runnerPath);
  assert.equal(typeof runner.check, 'function');
  assert.equal(typeof runner.fix, 'undefined', 'fix_supported:false means no fix() export');
});

// ---------------------------------------------------------------------------
// Bonus coverage: recordLanePick's own missing-lane no-op and the
// sidechannel's five-member export block, so this plan's own artifact
// contract (min_lines / export list) is directly proven, not just implied.
// ---------------------------------------------------------------------------
ok('bonus: recordLanePick is a silent no-op on a missing/empty lane; sidechannel exports the five named members', function () {
  const filePath = scratchFilePath();
  sidechannel.recordLanePick({ lane: '', sessionId: 'noop-session', filePath: filePath });
  const records = sidechannel.readLanePick('noop-session', { filePath: filePath });
  assert.deepStrictEqual(records, []);

  const expected = ['recordLanePick', 'readLanePick', 'sideFilePath', 'TTL_MS', 'SIZE_CAP_BYTES', 'NO_SESSION_KEY'];
  for (const key of expected) {
    assert.ok(key in sidechannel, 'sidechannel must export ' + key);
  }
});

console.log('\nPASS test-227-mode-select-checkpoint (' + n + ' assertions)');
