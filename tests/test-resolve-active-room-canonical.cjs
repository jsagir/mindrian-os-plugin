#!/usr/bin/env node
'use strict';

/*
 * Phase 127.3 Plan 00 Wave-0 -- lib/core/resolve-active-room.cjs hermetic test.
 *
 * Twelve scenarios cover the single-resolver contract:
 *
 *   rar.1   current shape (active + Object rooms with `path`)         -> {slug, abs_path}
 *   rar.2   legacy shape (active_room + Array rooms w/ slug+abs_path) -> {slug, abs_path}
 *   rar.3   mixed shape (active + Array rooms w/ slug field)          -> tolerates
 *   rar.4   mixed shape (active_room + Object rooms)                  -> tolerates
 *   rar.5   CLAUDE_ACTIVE_ROOM env override beats registry            -> env wins
 *   rar.6   empty registry returns null (no throw)
 *   rar.7   missing registry.json returns null (no throw)
 *   rar.8   entry sealed:true returns null
 *   rar.9   entry status:'archived' returns null
 *   rar.10  nonexistent abs_path returns null (existsSync gate)
 *   rar.11  Canon Part 8 source-grep tripwire -- zero network markers in resolver
 *   rar.12  Canon Part 9 source-grep tripwire -- zero graph-chokepoint markers
 *
 * Hermetic envelope: scope-local override of process.env.MINDRIAN_ROOMS_HOME,
 * process.env.CLAUDE_ACTIVE_ROOM, process.env.HOME (+USERPROFILE for Windows
 * parity), and a per-scenario mkdtempSync home + try/finally rmTmp cleanup.
 * Mirrors tests/test-resolve-brain-key.cjs's makeTmpHome + withEnv +
 * freshResolver pattern.
 *
 * Registered in tests/run-all-127.3.sh (Plan 06) and surfaced via the Feynman
 * runner block in lib/memory/run-feynman-tests.cjs (registration deferred to
 * Plan 06 per the wave-protocol).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const RESOLVER = path.join(REPO_ROOT, 'lib', 'core', 'resolve-active-room.cjs');

let passCount = 0;
let failCount = 0;
function pass(name) { passCount += 1; console.log('PASS: ' + name); }
function failTest(name, err) {
  failCount += 1;
  console.log('FAIL: ' + name + '\n    ' + (err && err.message || err));
}

function makeTmpHome(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), '127-3-rar-' + suffix + '-'));
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Hermetic envelope: snapshot+override env, return a restore fn. Always
// restore the actual prior values (delete if absent before, restore if set).
function withEnv(overrides, fn) {
  const snapshot = {};
  const keys = Object.keys(overrides);
  for (const k of keys) {
    snapshot[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    return fn();
  } finally {
    for (const k of keys) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  }
}

// Fresh-require the resolver per scenario so module-state never leaks
// between tests (the resolver is stateless today, but the discipline keeps
// future state-add changes safe).
function freshResolver() {
  delete require.cache[require.resolve(RESOLVER)];
  return require(RESOLVER);
}

// rar.1 -- current shape: active + Object rooms with `path` field.
(function rar1() {
  const name = 'rar.1 current shape (active + Object rooms)';
  const home = makeTmpHome('1');
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    fs.mkdirSync(path.join(home, 'test-room'), { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      version: 1,
      active: 'test-room',
      rooms: { 'test-room': { path: 'test-room', status: 'active' } },
    }));
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.ok(r, 'resolver returned non-null');
      assert.strictEqual(r.slug, 'test-room', 'slug');
      assert.strictEqual(r.abs_path, path.join(home, 'test-room'), 'abs_path resolved to <home>/<path>');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rar.2 -- legacy shape: active_room + Array rooms with slug+abs_path.
(function rar2() {
  const name = 'rar.2 legacy shape (active_room + Array rooms)';
  const home = makeTmpHome('2');
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    const roomDir = path.join(home, 'legacy-room');
    fs.mkdirSync(roomDir, { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      active_room: 'legacy-room',
      rooms: [{ slug: 'legacy-room', abs_path: roomDir, status: 'active' }],
    }));
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.ok(r, 'resolver returned non-null');
      assert.strictEqual(r.slug, 'legacy-room', 'slug');
      assert.strictEqual(r.abs_path, roomDir, 'abs_path from entry.abs_path');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rar.3 -- mixed: active (current) + Array rooms (legacy form).
(function rar3() {
  const name = 'rar.3 mixed shape (active + Array rooms)';
  const home = makeTmpHome('3');
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    const roomDir = path.join(home, 'mixed-3');
    fs.mkdirSync(roomDir, { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      active: 'mixed-3',
      rooms: [{ slug: 'mixed-3', abs_path: roomDir }],
    }));
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.ok(r, 'resolver returned non-null');
      assert.strictEqual(r.slug, 'mixed-3', 'slug');
      assert.strictEqual(r.abs_path, roomDir, 'abs_path resolved');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rar.4 -- mixed: active_room (legacy) + Object rooms (current form).
(function rar4() {
  const name = 'rar.4 mixed shape (active_room + Object rooms)';
  const home = makeTmpHome('4');
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    fs.mkdirSync(path.join(home, 'mixed-4'), { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      active_room: 'mixed-4',
      rooms: { 'mixed-4': { path: 'mixed-4', status: 'active' } },
    }));
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.ok(r, 'resolver returned non-null');
      assert.strictEqual(r.slug, 'mixed-4', 'slug');
      assert.strictEqual(r.abs_path, path.join(home, 'mixed-4'), 'abs_path composed from home + path');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rar.5 -- CLAUDE_ACTIVE_ROOM env override beats registry.
(function rar5() {
  const name = 'rar.5 CLAUDE_ACTIVE_ROOM env override beats registry';
  const home = makeTmpHome('5');
  const envDir = makeTmpHome('5env');
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    fs.mkdirSync(path.join(home, 'registry-room'), { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      active: 'registry-room',
      rooms: { 'registry-room': { path: 'registry-room', status: 'active' } },
    }));
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: envDir, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.ok(r, 'resolver returned non-null');
      assert.strictEqual(r.abs_path, envDir, 'env override wins');
      assert.strictEqual(r.slug, path.basename(envDir), 'slug derived from env basename');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); rmTmp(envDir); }
})();

// rar.6 -- empty registry returns null (no throw).
(function rar6() {
  const name = 'rar.6 empty registry returns null';
  const home = makeTmpHome('6');
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), '{}');
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.strictEqual(r, null, 'empty registry -> null');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rar.7 -- missing registry.json returns null (no throw).
(function rar7() {
  const name = 'rar.7 missing registry.json returns null';
  const home = makeTmpHome('7');
  try {
    // Deliberately do NOT create .rooms/ or registry.json.
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.strictEqual(r, null, 'missing registry -> null');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rar.8 -- entry sealed:true returns null.
(function rar8() {
  const name = 'rar.8 entry sealed:true returns null';
  const home = makeTmpHome('8');
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    fs.mkdirSync(path.join(home, 'sealed-room'), { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      active: 'sealed-room',
      rooms: { 'sealed-room': { path: 'sealed-room', sealed: true } },
    }));
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.strictEqual(r, null, 'sealed:true -> null');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rar.9 -- entry status:'archived' returns null.
(function rar9() {
  const name = 'rar.9 entry status:archived returns null';
  const home = makeTmpHome('9');
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    fs.mkdirSync(path.join(home, 'archived-room'), { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      active: 'archived-room',
      rooms: { 'archived-room': { path: 'archived-room', status: 'archived' } },
    }));
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.strictEqual(r, null, 'status:archived -> null');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rar.10 -- entry's abs_path points at a nonexistent directory.
(function rar10() {
  const name = 'rar.10 nonexistent abs_path returns null (existsSync gate)';
  const home = makeTmpHome('10');
  try {
    fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
    // Deliberately do NOT mkdir the room directory.
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
      active: 'ghost-room',
      rooms: { 'ghost-room': { abs_path: path.join(home, 'this-directory-was-deleted') } },
    }));
    withEnv({ MINDRIAN_ROOMS_HOME: home, CLAUDE_ACTIVE_ROOM: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveActiveRoom } = freshResolver();
      const r = resolveActiveRoom();
      assert.strictEqual(r, null, 'nonexistent dir -> null');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rar.11 -- Canon Part 8 source-grep tripwire. Zero network markers in resolver source.
(function rar11() {
  const name = 'rar.11 Canon Part 8 source-grep (no network markers)';
  try {
    const body = fs.readFileSync(RESOLVER, 'utf8');
    const FORBIDDEN = [
      "require('http')",
      'require("http")',
      "require('https')",
      'require("https")',
      'fetch(',
      'XMLHttpRequest',
      'brain.mindrian',
      'onrender.com',
      'tavily',
    ];
    for (const f of FORBIDDEN) {
      assert.ok(!body.includes(f), 'forbidden Canon Part 8 token in resolver source: ' + f);
    }
    pass(name);
  } catch (e) { failTest(name, e); }
})();

// rar.12 -- Canon Part 9 source-grep tripwire. Zero graph-chokepoint markers
// in resolver source. The resolver is strictly UPSTREAM of the graph layer:
// it answers "which room is active?" using registry.json on disk; the graph
// chokepoint answers "what does the graph say?" using room.db. Mixing the
// two would violate the Phase 109 chokepoint contract.
(function rar12() {
  const name = 'rar.12 Canon Part 9 source-grep (no graph-chokepoint markers)';
  try {
    const body = fs.readFileSync(RESOLVER, 'utf8');
    const FORBIDDEN_CANON_9 = [
      'room.db',
      'better-sqlite3',
      'sqlite3',
      './room-db',
      'navigation.cjs',
    ];
    for (const f of FORBIDDEN_CANON_9) {
      assert.ok(!body.includes(f), 'forbidden Canon Part 9 token in resolver source: ' + f);
    }
    pass(name);
  } catch (e) { failTest(name, e); }
})();

console.log('');
console.log('---');
console.log(passCount + '/' + (passCount + failCount) + ' green');
process.exit(failCount === 0 ? 0 : 1);
