'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-01 (resolveRoomRoot).
//
// IFACE (169-01 shared_iface_contract): lib/core/room-root.cjs
//   resolveRoomRoot(filePath) -> roomDir|''  -- walk up from filePath to the
//   nearest ancestor dir containing the `.room-root` FILE sentinel; '' when no
//   sentinel is found. Also exports findRoomRootSentinels() -> ['.room-root'].
//
// This is a RED-by-require stub: the module does not exist yet (it ships in
// Plan 02). It asserts the SUB-ROOM resolution: a file inside a sub-room that
// carries its OWN `.room-root` resolves to the SUB-ROOM dir, NOT the parent,
// even while the registry active room points at the parent (GDH-01 the core
// fractal-resolution contract). No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
// RED until Plan 02 ships lib/core/room-root.cjs.
const { resolveRoomRoot, findRoomRootSentinels } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'room-root.cjs')
);

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-room-root-resolver (GDH-01)');

// Build a temp parent room with a `.room-root`, and a child sub-room under it
// that carries its OWN `.room-root`, with an artifact file inside the sub-room.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rrr-169-'));
const parent = path.join(tmp, 'motj-ecosystem');
const child = path.join(parent, 'b2-journey');
fs.mkdirSync(child, { recursive: true });
fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'motj-ecosystem' }));
fs.writeFileSync(path.join(child, '.room-root'), JSON.stringify({ slug: 'b2-journey', parent: 'motj-ecosystem' }));
const artifact = path.join(child, 'interview.md');
fs.writeFileSync(artifact, '# interview\n');

// Simulate the registry active room being the PARENT.
process.env.MINDRIAN_ACTIVE_ROOM = parent;

check('findRoomRootSentinels returns the shipped sentinel set', () => {
  const sentinels = findRoomRootSentinels();
  assert.ok(Array.isArray(sentinels), 'findRoomRootSentinels must return an array');
  assert.ok(sentinels.includes('.room-root'), 'sentinel set must include .room-root');
});

check('resolveRoomRoot returns the SUB-ROOM dir for a file inside the sub-room', () => {
  const resolved = resolveRoomRoot(artifact);
  assert.equal(path.resolve(resolved), path.resolve(child),
    'a file inside the sub-room must resolve to the sub-room .room-root dir, not the parent');
});

check('resolveRoomRoot returns the PARENT dir for a file directly under the parent', () => {
  const parentArtifact = path.join(parent, 'top.md');
  fs.writeFileSync(parentArtifact, '# top\n');
  const resolved = resolveRoomRoot(parentArtifact);
  assert.equal(path.resolve(resolved), path.resolve(parent));
});

check('resolveRoomRoot returns empty string when no sentinel is found', () => {
  const orphan = fs.mkdtempSync(path.join(os.tmpdir(), 'rrr-orphan-'));
  const f = path.join(orphan, 'loose.md');
  fs.writeFileSync(f, 'x');
  assert.equal(resolveRoomRoot(f), '', 'no sentinel anywhere up the tree must return empty string');
});

console.log(`\nPASS (${pass}/4)`);
