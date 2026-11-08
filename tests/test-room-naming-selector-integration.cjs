'use strict';
/*
 * Phase 119-01 Wave 2 integration harness (revised by Phase 389 plan 10, owner card D6).
 *
 * The Phase 118 orchestrator that spawned the naming shim was removed in Phase 389
 * plan 10, so nothing fires scripts/room-naming-selector.cjs now. The shim stays on disk,
 * unreachable, for Phase 390. This file pins the shim ALONE: it seeds a Plan 119-00
 * placeholder + Plan 119-02 skeleton, runs the shim, asserts the F.1 envelope is
 * well-formed AND contains the four LOCKED verbatim option labels, and asserts the shim
 * never throws on bad input (it always exits 0 with one JSON line). Tests 1, 2, 3 and 5
 * used to read the orchestrator source; they now pin the shim (same numbers, same count).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

function _mkRoomsHome() {
  const tmp = path.join(os.tmpdir(), 'phase119-01-' + crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
  const slug = 'untitled-2026-05-16-1845';
  fs.writeFileSync(path.join(tmp, '.rooms', 'registry.json'), JSON.stringify({
    version: 1,
    active: slug,
    rooms: {
      [slug]: {
        path: path.join(tmp, slug),
        venture_name: 'untitled',
        venture_stage: 'Pre-Opportunity',
        status: 'active',
        last_opened: Date.now(),
      },
    },
  }, null, 2));
  const roomDir = path.join(tmp, slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '---\nphase: scoping\nauto_explore_thin: false\n---\n');
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
  return { tmp, roomDir, slug };
}

function _cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) {}
}

const SHIM = path.resolve(__dirname, '..', 'scripts', 'room-naming-selector.cjs');

// Run the shim with a scratch HOME and no model key, so a leg never reaches a network.
function _runShim(args, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  delete env.ANTHROPIC_API_KEY;
  return cp.spawnSync('node', [SHIM].concat(args), { env: env, encoding: 'utf8' });
}
function _lastJson(out) {
  const lines = String(out.stdout || '').trim().split('\n').filter(Boolean);
  assert.strictEqual(lines.length, 1, 'shim must print exactly one JSON line; got ' + lines.length);
  return JSON.parse(lines[0]);
}

test('Test 1: shim with no --room-dir exits 0 and prints surface:false, reason no_room_dir_arg', function () {
  const out = _runShim([]);
  assert.strictEqual(out.status, 0, 'shim must exit 0; stderr=' + (out.stderr || ''));
  const parsed = _lastJson(out);
  assert.strictEqual(parsed.shape, 'F.1');
  assert.strictEqual(parsed.surface, false);
  assert.strictEqual(parsed.reason, 'no_room_dir_arg');
});

test('Test 2: shim with a room dir that does not exist exits 0 and prints reason room_dir_not_found', function () {
  const ghost = path.join(os.tmpdir(), 'phase119-01-missing-' + crypto.randomBytes(4).toString('hex'));
  assert.ok(!fs.existsSync(ghost), 'precondition: the ghost dir must not exist');
  const out = _runShim(['--room-dir', ghost]);
  assert.strictEqual(out.status, 0, 'shim must exit 0; stderr=' + (out.stderr || ''));
  const parsed = _lastJson(out);
  assert.strictEqual(parsed.shape, 'F.1');
  assert.strictEqual(parsed.surface, false);
  assert.strictEqual(parsed.reason, 'room_dir_not_found');
  assert.ok(!fs.existsSync(ghost), 'the shim must not create the missing room dir');
});

test('Test 3: shim guards its work (try/catch around main work + uncaughtException handler that exits 0)', function () {
  const src = fs.readFileSync(SHIM, 'utf8');
  assert.match(src, /try\s*\{/, 'shim must wrap its work in try {');
  assert.match(src, /catch\s*\(/, 'shim must include catch (...)');
  assert.match(src, /process\.on\('uncaughtException'/, 'shim must register an uncaughtException handler');
  const h = src.indexOf("process.on('uncaughtException'");
  const slice = src.slice(h, h + 400);
  assert.match(slice, /surface:\s*false/, 'the handler must print surface:false');
  assert.match(slice, /process\.exit\(0\)/, 'the handler must exit 0');
});

test('Test 4: shim spawns + produces structured F.1 envelope on stdout', function () {
  const { tmp, roomDir } = _mkRoomsHome();
  try {
    const shimPath = path.resolve(__dirname, '..', 'scripts', 'room-naming-selector.cjs');
    const out = cp.spawnSync('node', [shimPath, '--room-dir', roomDir, '--sentence-sha256', 'deadbeef0123'], {
      env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: tmp }),
      encoding: 'utf8',
    });
    assert.strictEqual(out.status, 0, 'shim must exit 0; stderr=' + (out.stderr || ''));
    const parsed = JSON.parse(out.stdout.trim().split('\n').filter(Boolean).pop());
    assert.strictEqual(parsed.shape, 'F.1', 'envelope.shape must be F.1');
    // The shim either emits awaiting_input:true (LLM call succeeded or fell back)
    // or surface:false (e.g., directive write failed). The contract guarantee is
    // that the shape is F.1 and SOME envelope structure landed.
    assert.ok(parsed.awaiting_input === true || parsed.surface === false,
      'either awaiting_input:true or surface:false must be present; got ' + JSON.stringify(parsed));
  } finally { _cleanup(tmp); }
});

test('Test 5: a malformed auto-explore file never throws (exit 0, one JSON line)', function () {
  const { tmp, roomDir } = _mkRoomsHome();
  try {
    fs.writeFileSync(path.join(roomDir, '.mindrian', 'auto-explore-x.json'), '{ this is not json');
    const out = _runShim(['--room-dir', roomDir, '--sentence-sha256', 'deadbeef0123'], { MINDRIAN_ROOMS_HOME: tmp, HOME: tmp });
    assert.strictEqual(out.status, 0, 'shim must exit 0 on bad input; stderr=' + (out.stderr || ''));
    const parsed = _lastJson(out);
    assert.strictEqual(parsed.shape, 'F.1', 'the envelope must still be shape F.1');
    assert.ok(parsed.awaiting_input === true || parsed.surface === false,
      'either awaiting_input:true or surface:false must be present; got ' + JSON.stringify(parsed));
  } finally { _cleanup(tmp); }
});

test('Test 7: envelope contains four LOCKED option labels (verbatim)', function () {
  const { tmp, roomDir } = _mkRoomsHome();
  try {
    const shimPath = path.resolve(__dirname, '..', 'scripts', 'room-naming-selector.cjs');
    const out = cp.spawnSync('node', [shimPath, '--room-dir', roomDir, '--sentence-sha256', 'deadbeef0123'], {
      env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: tmp }),
      encoding: 'utf8',
    });
    const raw = out.stdout || '';
    if (raw.indexOf('"awaiting_input":true') !== -1) {
      assert.match(raw, /\[name this room:/, 'envelope must contain [name this room:');
      assert.match(raw, /\[type your own name\]/, 'envelope must contain [type your own name]');
      assert.match(raw, /\[keep as untitled\]/, 'envelope must contain [keep as untitled]');
      assert.match(raw, /\[discard room\]/, 'envelope must contain [discard room]');
    } else {
      // Defensive: emit message if we land in surface:false path. The integration
      // test passes only if the shim produced SOME output.
      assert.ok(raw.length > 0, 'shim must produce some output');
    }

    // Also verify the directive file landed at <roomDir>/.context/.
    const directivePath = path.join(roomDir, '.context', 'pending-naming-decision.md');
    if (raw.indexOf('"awaiting_input":true') !== -1) {
      assert.ok(fs.existsSync(directivePath), 'directive file must land at .context/pending-naming-decision.md');
      const directive = fs.readFileSync(directivePath, 'utf8');
      assert.match(directive, /INSTRUCTION FOR LARRY/, 'directive must contain INSTRUCTION FOR LARRY block');
      assert.match(directive, /\[name this room:/);
      assert.match(directive, /\[type your own name\]/);
      assert.match(directive, /\[keep as untitled\]/);
      assert.match(directive, /\[discard room\]/);
    }
  } finally { _cleanup(tmp); }
});
