'use strict';

/*
 * Phase 119-00 Wave 1 -- Task 3 fingerprint hook integration tests.
 *
 * 8 behavior tests per 119-00-PLAN.md Task 3:
 *   1. detectNoActiveRoom on empty registry -> true
 *   2. detectNoActiveRoom on parked-only registry -> true
 *   3. detectNoActiveRoom on active registry -> false
 *   4. fingerprint hook integration: no-active-room branch creates placeholder
 *   5. fingerprint hook integration: active-room branch is byte-identical pre-Phase-119
 *   6. fingerprint hook never blocks even when auto-create fails
 *   7. nudge CLI shim renders F.1 selector on threshold-met
 *   8. Canon Part 8 tri-surface fence: no Brain client in nudge shim
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const agent = require(path.join(REPO_ROOT, 'lib', 'agents', 'auto-explore-agent.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function freshHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'p119-int-' + crypto.randomBytes(2).toString('hex') + '-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* graceful */ }
}

// ---------- detectNoActiveRoom tests ----------

test('Test 1: detectNoActiveRoom on empty registry returns true', () => {
  const home = freshHome();
  try {
    assert.equal(agent.detectNoActiveRoom(home), true);
  } finally {
    cleanup(home);
  }
});

test('Test 2: detectNoActiveRoom on parked-only registry returns true', () => {
  const home = freshHome();
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      version: 1,
      active: '',
      rooms: { 'parked-room': { path: 'parked-room', status: 'parked' } },
    }));
    assert.equal(agent.detectNoActiveRoom(home), true);
  } finally {
    cleanup(home);
  }
});

test('Test 3: detectNoActiveRoom on active registry returns false', () => {
  const home = freshHome();
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      version: 1,
      active: 'acme-robotics',
      rooms: { 'acme-robotics': { path: 'acme-robotics', status: 'active' } },
    }));
    assert.equal(agent.detectNoActiveRoom(home), false);
  } finally {
    cleanup(home);
  }
});

// ---------- Fingerprint hook integration tests ----------

function runFingerprint(env, stdinObj) {
  const result = spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'auto-explore-fingerprint.cjs')], {
    input: JSON.stringify(stdinObj),
    env: Object.assign({}, process.env, env),
    cwd: REPO_ROOT,
    timeout: 10000,
  });
  return result;
}

test('Test 4: fingerprint hook -- no-active-room branch creates placeholder + reassigns roomDir', () => {
  const home = freshHome();
  const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p119-int-src-'));
  try {
    // Create a .room-root sentinel area + a sample material file.
    fs.writeFileSync(path.join(srcDir, '.room-root'), '');
    const filePath = path.join(srcDir, 'sample.md');
    fs.writeFileSync(filePath, '# Sample Material\n\nA real venture brief.');
    // Run fingerprint hook with MINDRIAN_ROOMS_HOME pointing at the empty home.
    const result = runFingerprint(
      { MINDRIAN_ROOMS_HOME: home },
      { tool_name: 'Write', tool_input: { file_path: filePath } }
    );
    assert.equal(result.status, 0, 'fingerprint hook should exit 0; stderr=' + (result.stderr ? result.stderr.toString().slice(0, 200) : ''));
    // Envelope: continue:true
    const envelope = JSON.parse(result.stdout.toString());
    assert.equal(envelope.continue, true);
    // Verify the auto-create branch fired: a placeholder room exists in home.
    const dirs = fs.readdirSync(home).filter((d) => d.startsWith('untitled-'));
    assert.equal(dirs.length >= 1, true, 'expected an untitled-* placeholder room in home; got: ' + dirs.join(','));
    // Verify the room_auto_created memory_event landed in that placeholder room's room.db.
    const placeholder = path.join(home, dirs[0]);
    const dbPath = path.join(placeholder, '.mindrian', 'room.db');
    assert.equal(fs.existsSync(dbPath), true, 'placeholder room.db missing');
    const db = openRoomDb(placeholder);
    try {
      const events = navigation.findRecentChanges(db, 0, { limit: 5, eventType: 'room_auto_created' });
      assert.equal(events.length >= 1, true, 'expected room_auto_created event in placeholder room.db');
      assert.equal(events[0].properties.placeholder_slug, dirs[0]);
    } finally {
      try { db.close(); } catch (_e) { /* graceful */ }
    }
  } finally {
    cleanup(home);
    cleanup(srcDir);
  }
});

test('Test 5: fingerprint hook -- active-room branch is byte-identical pre-Phase-119 path (no auto-create)', () => {
  const home = freshHome();
  const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p119-int-src2-'));
  try {
    // Pre-seed an active room.
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      version: 1,
      active: 'acme',
      rooms: { acme: { path: 'acme', status: 'active' } },
    }));
    // Material file in a sentinel area (NOT in $ROOMS_HOME/acme).
    fs.writeFileSync(path.join(srcDir, '.room-root'), '');
    const filePath = path.join(srcDir, 'sample.md');
    fs.writeFileSync(filePath, '# Another Sample');
    // Run hook.
    const result = runFingerprint(
      { MINDRIAN_ROOMS_HOME: home },
      { tool_name: 'Write', tool_input: { file_path: filePath } }
    );
    assert.equal(result.status, 0);
    const envelope = JSON.parse(result.stdout.toString());
    assert.equal(envelope.continue, true);
    // Verify NO untitled-* room was created.
    const dirs = fs.readdirSync(home).filter((d) => d.startsWith('untitled-'));
    assert.equal(dirs.length, 0, 'no auto-create when active room exists; got: ' + dirs.join(','));
  } finally {
    cleanup(home);
    cleanup(srcDir);
  }
});

test('Test 6: fingerprint hook never blocks even with read-only ROOMS_HOME', { skip: process.platform === 'win32' }, () => {
  const home = freshHome();
  const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p119-int-src3-'));
  try {
    // Make rooms-home read-only AFTER ensuring it exists, so auto-create fails.
    fs.chmodSync(home, 0o555);
    fs.writeFileSync(path.join(srcDir, '.room-root'), '');
    const filePath = path.join(srcDir, 'sample.md');
    fs.writeFileSync(filePath, '# Material');
    const result = runFingerprint(
      { MINDRIAN_ROOMS_HOME: home },
      { tool_name: 'Write', tool_input: { file_path: filePath } }
    );
    assert.equal(result.status, 0, 'hook MUST still exit 0 even when auto-create fails');
    const envelope = JSON.parse(result.stdout.toString());
    assert.equal(envelope.continue, true);
  } finally {
    try { fs.chmodSync(home, 0o755); } catch (_e) { /* graceful */ }
    cleanup(home);
    cleanup(srcDir);
  }
});

// ---------- Nudge shim tests ----------

function runNudge(args) {
  return spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'room-auto-create-nudge.cjs'), ...args], {
    cwd: REPO_ROOT,
    timeout: 10000,
  });
}

test('Test 7: nudge CLI shim renders F.1 envelope for non-existent room (surface=false)', () => {
  const result = runNudge(['--room-dir', '/tmp/p119-nonexistent-' + Date.now()]);
  assert.equal(result.status, 0);
  const envelope = JSON.parse(result.stdout.toString());
  assert.equal(envelope.shape, 'F.1');
  assert.equal(envelope.surface, false);
  assert.equal(envelope.reason, 'no_room_db');
});

test('Test 7b: nudge CLI shim renders F.1 envelope when threshold met (surface=true)', () => {
  const home = freshHome();
  try {
    // Seed a room with 3 venture_classified=true f_selector_decision events.
    fs.mkdirSync(path.join(home, '.mindrian'), { recursive: true });
    const db = openRoomDb(home);
    try {
      for (let i = 0; i < 3; i++) {
        navigation.logMemoryEvent(db, 'f_selector_decision', {
          venture_classified: true,
          classification_source: 'haiku-4-5',
          source_path: 'test:nudge-shim',
          created_by: 'system',
        });
      }
    } finally {
      try { db.close(); } catch (_e) { /* graceful */ }
    }
    const result = runNudge(['--room-dir', home]);
    assert.equal(result.status, 0);
    const envelope = JSON.parse(result.stdout.toString());
    assert.equal(envelope.shape, 'F.1');
    assert.equal(envelope.surface, true);
    assert.equal(envelope.turn_count, 3);
    assert.equal(envelope.threshold, 3);
    assert.ok(envelope.rendered, 'rendered F.1 selector must be present');
  } finally {
    cleanup(home);
  }
});

test('Test 8: Canon Part 8 tri-surface fence -- no Brain client require in nudge shim', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'room-auto-create-nudge.cjs'), 'utf8');
  assert.equal(/require\([^)]*brain-client/.test(src), false, 'brain-client require detected');
  assert.equal(/require\([^)]*mcp-server-brain/.test(src), false, 'mcp-server-brain require detected');
  assert.equal(/brain\.mindrian/.test(src), false, 'brain.mindrian reference detected');
  assert.equal(/fetch\(/.test(src), false, 'fetch reference detected');
  // Tri-polar acknowledgment in the module header (CLAUDE.md HARD RULE).
  assert.match(src, /tri-polar|CLI.*Desktop.*Cowork|three surfaces/);
  // Em-dash HARD RULE
  assert.equal(src.indexOf(String.fromCharCode(0x2014)), -1, 'em-dash present');
});
