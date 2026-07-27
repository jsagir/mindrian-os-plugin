#!/usr/bin/env node
'use strict';

/**
 * Quick task 260728-051 -- sub-room ancestor widening for the write-scope guard.
 *
 * Root cause (live-reproduced 2026-07-28): `room_bind({room:"motj-ecosystem"})`
 * succeeds, but a Write into
 * `motj-ecosystem/sub-rooms/jonathan-contractor-motj/...` was blocked with
 * "This session is bound to [motj-ecosystem]" until a SECOND, separate
 * `room_bind({room:"jonathan-contractor-motj"})` call was made. The TARGET side
 * of the hook (targetRoomUnderRoot) is already nesting-aware via SEED-004's
 * `.room-root` walk-up; the SCOPE side (isRoomInWriteScope) was a flat SET
 * membership check with zero hierarchy awareness, even though the registry
 * already carries a `parent` field on every sub-room entry.
 *
 * This file pins BOTH halves of the fix:
 *   - UNIT section (Task 1): the 3-arg `isRoomInWriteScope(room, binding,
 *     ancestorChain)` contract, including every pre-existing early-return.
 *   - E2E section (Task 2): the full spawned `scripts/write-scope-check.cjs`
 *     hook over real fixture registries, proving parent-to-child widening,
 *     no over-widening, exact-match preservation, and fail-open degrades.
 *
 * Zero test frameworks. Node built-in assert only. CJS only. No em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SESSION_BINDING = path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs');
const sessionBinding = require(SESSION_BINDING);
const isRoomInWriteScope = sessionBinding.isRoomInWriteScope;

// ---------------------------------------------------------------------------
// Harness (same shape as scripts/83-scope-injection.test.cjs)
// ---------------------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// UNIT section (Task 1): the isRoomInWriteScope 3-arg contract.
// ---------------------------------------------------------------------------

test('unit 1: a room reachable via ancestorChain is in scope (the widening)', () => {
  const binding = { bound: ['motj-ecosystem'], primary: 'motj-ecosystem', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('jonathan-contractor-motj', binding, ['motj-ecosystem']),
    true,
    'a child whose parent is bound must be in write scope'
  );
});

test('unit 2: an unrelated ancestorChain does NOT widen scope', () => {
  const binding = { bound: ['motj-ecosystem'], primary: 'motj-ecosystem', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('some-other-room', binding, ['some-other-parent']),
    false,
    'no ancestor in the bound set means no widening (no sibling/unrelated leak)'
  );
});

test('unit 3: exact match wins before any ancestor lookup', () => {
  const binding = { bound: ['alpha', 'beta'], primary: 'alpha', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('alpha', binding, ['totally-unrelated']),
    true,
    'a directly bound room stays in scope regardless of ancestorChain contents'
  );
});

test('unit 4: the 2-arg call site is byte-for-byte backward compatible', () => {
  const binding = { bound: ['alpha', 'beta'], primary: 'alpha', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('alpha', binding), true, '2-arg in-set room still allowed'
  );
  assert.strictEqual(
    isRoomInWriteScope('gamma', binding), false, '2-arg off-bound room still blocked'
  );
});

test('unit 5: the __no_room__ sentinel bypass fires before ancestor logic', () => {
  const binding = { bound: ['alpha'], primary: 'alpha', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('__no_room__', binding, []),
    true,
    'the reserved dev-repo sentinel is always in scope'
  );
  assert.strictEqual(
    isRoomInWriteScope('__no_room__', binding, ['anything']),
    true,
    'ancestorChain contents never affect the sentinel bypass'
  );
});

test('unit 6: an unbound session still degrades to allow-all', () => {
  const binding = { bound: [], primary: null, sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('any-room', binding, []),
    true,
    'an empty bound set is the pre-194 allow-all path'
  );
  assert.strictEqual(
    isRoomInWriteScope('any-room', binding, ['whatever']),
    true,
    'ancestorChain never turns an unbound allow into a block'
  );
});

test('unit 7: a non-array ancestorChain degrades to no widening, never throws', () => {
  const binding = { bound: ['alpha'], primary: 'alpha', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('gamma', binding, 'alpha'),
    false,
    'a string ancestorChain must coerce to [] (no accidental substring widening)'
  );
  assert.strictEqual(
    isRoomInWriteScope('gamma', binding, null),
    false,
    'a null ancestorChain behaves exactly like an omitted one'
  );
  assert.strictEqual(
    isRoomInWriteScope('gamma', binding, { bound: ['alpha'] }),
    false,
    'an object ancestorChain must coerce to [] rather than throw'
  );
});

// ---------------------------------------------------------------------------
// E2E section (Task 2): the real spawned write-scope-check.cjs hook.
//
// scripts/write-scope-check.cjs has NO module.exports (it runs main() as a side
// effect on load via stdin), so spawning it is the ONLY way to exercise
// resolveAncestorChain and its wiring. Exit 0 = allow, exit 2 = block.
// The harness helpers below are cloned (not imported) from
// scripts/83-scope-injection.test.cjs, which is itself a standalone runner
// script rather than a requirable module.
// ---------------------------------------------------------------------------

const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const PLUGIN_ROOT = REPO_ROOT;
const WRITE_SCOPE_CHECK = path.join(PLUGIN_ROOT, 'scripts', 'write-scope-check.cjs');

const FIXTURES_ROOT = path.join(os.tmpdir(), '260728-051-fixtures');
fs.mkdirSync(FIXTURES_ROOT, { recursive: true });

function mkFixtureDir(label) {
  const dir = path.join(FIXTURES_ROOT, label + '-' + crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Build a MindrianRooms root with a registry.json at .rooms/registry.json.
function mkFixtureMindrianRoomsRoot(parent, opts) {
  const root = path.join(parent, 'MindrianRooms');
  fs.mkdirSync(root, { recursive: true });
  if (opts && opts.registry !== null) {
    fs.mkdirSync(path.join(root, '.rooms'), { recursive: true });
    const reg = opts && opts.registry ? opts.registry : { active: '', rooms: {} };
    fs.writeFileSync(
      path.join(root, '.rooms', 'registry.json'),
      JSON.stringify(reg, null, 2)
    );
  }
  return root;
}

// Create a nested room: the dir chain, a .room-root sentinel in the leaf (the
// registered room), and a ROOM.md. relPath is forward-slash relative to root.
function mkNestedRoom(root, relPath) {
  const dir = path.join(root, ...relPath.split('/'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.room-root'), '');
  fs.writeFileSync(path.join(dir, 'ROOM.md'), '# ' + relPath + '\n');
  return dir;
}

// Spawn the hook with an explicit session id. CLAUDE_CODE_SESSION_ID is set
// directly because resolveSessionId in write-scope-check.cjs reads it FIRST
// (before the payload's session_id field), so relying on the payload alone
// would silently read the HOST session's binding file.
function runWriteScopeCheck(root, targetFile, sessionId) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_ROOT: root,
    MINDRIAN_ROOMS_HOME: root,
    CLAUDE_CODE_SESSION_ID: sessionId
  });
  delete env.CLAUDE_SESSION_ID; // never inherit a real session binding
  const payload = JSON.stringify({
    session_id: sessionId,
    tool_name: 'Write',
    tool_input: { file_path: targetFile }
  });
  const res = spawnSync('node', [WRITE_SCOPE_CHECK], {
    env: env,
    input: payload,
    encoding: 'utf8',
    timeout: 10000
  });
  return res.status;
}

function bindSession(root, sessionId, bound) {
  sessionBinding.writeSessionBinding(
    sessionId,
    { bound: bound, primary: bound[0] || null, sticky: false },
    { home: root }
  );
}

const CHILD_REL = 'motj-ecosystem/sub-rooms/jonathan-contractor-motj';

test('e2e (a): a session bound to the PARENT may write into its registered sub-room', () => {
  const fx = mkFixtureDir('qt051-a');
  try {
    const root = mkFixtureMindrianRoomsRoot(fx, {
      registry: {
        active: 'motj-ecosystem',
        rooms: {
          'motj-ecosystem': { path: 'motj-ecosystem' },
          'jonathan-contractor-motj': { path: CHILD_REL, parent: 'motj-ecosystem' }
        }
      }
    });
    mkNestedRoom(root, 'motj-ecosystem');
    mkNestedRoom(root, CHILD_REL);
    const sessionId = 'qt051-a-session';
    bindSession(root, sessionId, ['motj-ecosystem']);
    const exit = runWriteScopeCheck(
      root, path.join(root, ...CHILD_REL.split('/'), 'notes.md'), sessionId
    );
    // Pre-fix this false-blocked (exit 2) until a SECOND room_bind was made.
    assert.strictEqual(
      exit, 0,
      'a write into a bound parent room own registered sub-room must ALLOW (exit 0)'
    );
  } finally {
    cleanup(fx);
  }
});

test('e2e (b): ancestor widening does NOT leak to an unrelated registered room', () => {
  const fx = mkFixtureDir('qt051-b');
  try {
    const root = mkFixtureMindrianRoomsRoot(fx, {
      registry: {
        active: 'motj-ecosystem',
        rooms: {
          'motj-ecosystem': { path: 'motj-ecosystem' },
          'jonathan-contractor-motj': { path: CHILD_REL, parent: 'motj-ecosystem' },
          'unrelated-venture': { path: 'unrelated-venture' }
        }
      }
    });
    mkNestedRoom(root, 'motj-ecosystem');
    mkNestedRoom(root, CHILD_REL);
    mkNestedRoom(root, 'unrelated-venture');
    const sessionId = 'qt051-b-session';
    bindSession(root, sessionId, ['motj-ecosystem']);
    const exit = runWriteScopeCheck(
      root, path.join(root, 'unrelated-venture', 'steal.md'), sessionId
    );
    assert.strictEqual(
      exit, 2,
      'a write into a room outside the bound tree must still BLOCK (exit 2)'
    );
  } finally {
    cleanup(fx);
  }
});

test('e2e (c): a session bound directly to the CHILD is unaffected (exact match)', () => {
  const fx = mkFixtureDir('qt051-c');
  try {
    const root = mkFixtureMindrianRoomsRoot(fx, {
      registry: {
        active: 'motj-ecosystem',
        rooms: {
          'motj-ecosystem': { path: 'motj-ecosystem' },
          'jonathan-contractor-motj': { path: CHILD_REL, parent: 'motj-ecosystem' }
        }
      }
    });
    mkNestedRoom(root, 'motj-ecosystem');
    mkNestedRoom(root, CHILD_REL);
    const sessionId = 'qt051-c-session';
    bindSession(root, sessionId, ['jonathan-contractor-motj']);
    const exit = runWriteScopeCheck(
      root, path.join(root, ...CHILD_REL.split('/'), 'notes.md'), sessionId
    );
    assert.strictEqual(
      exit, 0,
      'the pre-existing exact-match allow path must be untouched (exit 0)'
    );
  } finally {
    cleanup(fx);
  }
});

test('e2e (d1): a registry entry with NO parent field widens nothing and never crashes', () => {
  const fx = mkFixtureDir('qt051-d1');
  try {
    const root = mkFixtureMindrianRoomsRoot(fx, {
      registry: {
        active: 'motj-ecosystem',
        rooms: {
          'motj-ecosystem': { path: 'motj-ecosystem' },
          // Roughly half of real registry entries carry no parent field at all.
          'orphan-room': { path: 'orphan-room' }
        }
      }
    });
    mkNestedRoom(root, 'motj-ecosystem');
    mkNestedRoom(root, 'orphan-room');
    const sessionId = 'qt051-d1-session';
    bindSession(root, sessionId, ['motj-ecosystem']);
    const exit = runWriteScopeCheck(
      root, path.join(root, 'orphan-room', 'notes.md'), sessionId
    );
    assert.strictEqual(
      exit, 2,
      'a missing parent field degrades to zero widening and a clean BLOCK (exit 2)'
    );
  } finally {
    cleanup(fx);
  }
});

test('e2e (d2): a malformed registry.json still fails OPEN, no new crash surface', () => {
  const fx = mkFixtureDir('qt051-d2');
  try {
    const root = mkFixtureMindrianRoomsRoot(fx, {
      registry: { active: 'motj-ecosystem', rooms: {} }
    });
    mkNestedRoom(root, 'motj-ecosystem');
    // Corrupt the registry AFTER the room tree exists.
    fs.writeFileSync(path.join(root, '.rooms', 'registry.json'), '{not valid json');
    const sessionId = 'qt051-d2-session';
    bindSession(root, sessionId, ['some-other-room']);
    const exit = runWriteScopeCheck(
      root, path.join(root, 'motj-ecosystem', 'notes.md'), sessionId
    );
    // Pre-existing behavior: readActiveRoom returns null on malformed JSON and
    // the hook allows BEFORE the session-bound branch is ever reached.
    assert.strictEqual(
      exit, 0,
      'a totally corrupt registry must still fail OPEN (exit 0)'
    );
  } finally {
    cleanup(fx);
  }
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

(async function main() {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      process.stdout.write('  ok  ' + t.name + '\n');
      passed += 1;
    } catch (err) {
      process.stdout.write('  FAIL ' + t.name + '\n');
      process.stdout.write('       ' + (err && err.stack ? err.stack : String(err)) + '\n');
      failed += 1;
    }
  }
  process.stdout.write(
    '\n260728-051 sub-room ancestor write scope: ' + passed + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
