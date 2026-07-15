'use strict';
/*
 * Phase 224-03 Task 2 -- resolver-fallback fix (Req 3).
 * ====================================================
 * Proves gsd-artifact-graph-hook.cjs::resolveRoomDir's fallback now rides the
 * Phase-194 canonical resolveWriteRoom instead of its own duplicated registry
 * read:
 *
 *   Test 1: a sentinel-less write path (no room env vars) resolves via the hook
 *     to EXACTLY resolveWriteRoom({filePath}).abs_path (byte-equal after
 *     path.resolve) -- one shared resolver, not two guessers.
 *   Test 2: a write path WITH a .room-root sentinel still resolves file-rooted
 *     first (leg 1 unchanged -- the Phase 169 GDH-01 contract survives).
 *   Test 3 (source assertion): the post-fix resolveRoomDir contains NO registry
 *     read -- comment-stripped grep for registry.json and reg.rooms returns
 *     nothing on executable lines (the SPEC Req 3 grep acceptance, verbatim), and
 *     resolveWriteRoom appears at least twice (require + call).
 *
 * No em-dashes (CLAUDE.md HARD RULE). CJS only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_PATH = path.join(REPO_ROOT, 'scripts', 'gsd-artifact-graph-hook.cjs');
const hook = require(HOOK_PATH);
const { resolveWriteRoom } = require(path.join(REPO_ROOT, 'lib', 'core', 'resolve-active-room.cjs'));

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

// Save + clear the room env vars so the tests exercise the registry fallback leg
// deterministically (behavior 1 requires NO env-var win).
const SAVED = {};
for (const k of ['CLAUDE_ROOM_DIR', 'CLAUDE_ACTIVE_ROOM', 'ROOM_DIR', 'MINDRIAN_ROOMS_ROOT', 'MINDRIAN_ROOMS_HOME']) {
  SAVED[k] = process.env[k];
}
function clearRoomEnv() {
  delete process.env.CLAUDE_ROOM_DIR;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  delete process.env.ROOM_DIR;
}
function restoreEnv() {
  for (const k of Object.keys(SAVED)) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
}

function main() {
  console.log('test-224-resolver-fallback (Req 3 canonical resolveWriteRoom)');

  // A tmp rooms root with a registry naming an active room.
  const roomsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-224-'));
  const activeSlug = 'active-room';
  const activeDir = path.join(roomsRoot, activeSlug);
  fs.mkdirSync(activeDir, { recursive: true });
  fs.mkdirSync(path.join(roomsRoot, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(roomsRoot, '.rooms', 'registry.json'),
    JSON.stringify({ active: activeSlug, rooms: { [activeSlug]: { abs_path: activeDir } } })
  );

  // Both the hook fallback AND resolveWriteRoom read the registry via the
  // MINDRIAN_ROOMS_HOME home default; point them both at the tmp root (also set
  // the legacy MINDRIAN_ROOMS_ROOT for good measure).
  clearRoomEnv();
  process.env.MINDRIAN_ROOMS_HOME = roomsRoot;
  process.env.MINDRIAN_ROOMS_ROOT = roomsRoot;

  // --- Test 1: sentinel-less path resolves via the shared resolver. ---
  const loosePath = path.join(roomsRoot, 'loose-note.md'); // no .room-root above it
  const viaHook = hook.resolveRoomDir(loosePath);
  const viaCanonical = resolveWriteRoom({ filePath: loosePath });
  check('resolveWriteRoom resolves the sentinel-less path to the active room',
    viaCanonical && typeof viaCanonical.abs_path === 'string' && viaCanonical.abs_path.length > 0);
  check('the hook fallback resolution equals resolveWriteRoom({filePath}).abs_path (one shared resolver)',
    path.resolve(viaHook) === path.resolve(viaCanonical.abs_path));

  // --- Test 2: a .room-root sentinel still wins file-rooted (leg 1 unchanged). ---
  const sentinelRoom = path.join(roomsRoot, 'sentineled');
  fs.mkdirSync(sentinelRoom, { recursive: true });
  fs.writeFileSync(path.join(sentinelRoom, '.room-root'), JSON.stringify({ slug: 'sentineled' }));
  const sentineledFile = path.join(sentinelRoom, 'note.md');
  const viaHook2 = hook.resolveRoomDir(sentineledFile);
  check('a sentinel-present path still resolves file-rooted (GDH-01 leg 1 survives)',
    path.resolve(viaHook2) === path.resolve(sentinelRoom));

  // --- Test 3: source assertion -- no registry read; resolveWriteRoom present. ---
  const src = fs.readFileSync(HOOK_PATH, 'utf8');
  const stripped = stripComments(src);
  check('no registry.json token remains on an executable line of the hook (Req 3 grep)',
    stripped.indexOf('registry.json') === -1);
  check('no reg.rooms token remains on an executable line of the hook (Req 3 grep)',
    stripped.indexOf('reg.rooms') === -1);
  const wrCount = (src.match(/resolveWriteRoom/g) || []).length;
  check('resolveWriteRoom appears at least twice (require + call)', wrCount >= 2);

  console.log(`\nPASS (${pass}/${pass})`);
}

try {
  main();
} finally {
  restoreEnv();
}
