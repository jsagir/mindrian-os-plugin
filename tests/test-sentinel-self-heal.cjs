'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-08/09 (detectUnsentineledArtifactFolder + healRoom).
//
// IFACE (169-01 shared_iface_contract): lib/core/graph-self-heal.cjs
//   detectUnsentineledArtifactFolder(roomDir) -> [{folder, artifactCount}]
//     finds artifact-bearing folders UNDER a room that lack their OWN
//     `.room-root` sentinel (reuse the room-root walk-up + the
//     heal-command.cjs:909-921 sub-rooms-container precedent).
//   healRoom({folder, parentRoomDir, slug, approvedBy, runTimeline}) ->
//     {ok, roomDir, lineageEdge, ...}
//     on APPROVE (approvedBy required): (1) INVOKES room-birth.cjs birthRoom
//     threading approvedBy for full SEED-001 wiring (ROOM.md + STATE.md + MINTO.md
//     + per-section FEYNMAN.md + own room.db); (2) registers in
//     `.rooms/registry.json` with parent=<parent-slug> AND adds a `parent` field
//     to the `.room-root` sentinel JSON; (3) writes the NESTED_WITHIN typed edge
//     room:<child> -> room:<parent> via navigation.writeEdge; (4) invokes
//     timeline-runner.refreshAll(roomDir); (5) returns. Without approvedBy,
//     healRoom REFUSES (no silent write).
//
// RED-by-require until Plan 07 ships graph-self-heal.cjs. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
// RED until Plan 07 ships graph-self-heal.cjs.
const { detectUnsentineledArtifactFolder, healRoom } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'graph-self-heal.cjs')
);

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-sentinel-self-heal (GDH-08/09)');

// Build a parent room with a `.room-root` and a child folder holding 2 artifacts
// but NO `.room-root`.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'selfheal-169-'));
const parent = path.join(tmp, 'parent-room');
const child = path.join(parent, 'b2-journey');
fs.mkdirSync(child, { recursive: true });
fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'parent-room' }));
fs.writeFileSync(path.join(child, 'one.md'), '# one\n');
fs.writeFileSync(path.join(child, 'two.md'), '# two\n');

check('detectUnsentineledArtifactFolder finds the sentinel-less child folder', () => {
  const found = detectUnsentineledArtifactFolder(parent);
  assert.ok(Array.isArray(found), 'detect must return an array');
  const hit = found.find(f => /b2-journey/.test(f.folder));
  assert.ok(hit, 'the sentinel-less artifact folder must be detected');
  assert.ok(hit.artifactCount >= 2, 'the detected folder reports its artifact count');
});

check('healRoom WITHOUT approvedBy REFUSES (no silent room creation)', () => {
  const res = healRoom({ folder: child, parentRoomDir: parent, slug: 'b2-journey', runTimeline: false });
  assert.equal(res.ok, false, 'healRoom must refuse without approvedBy');
  assert.ok(/no_approval/.test(String(res.reason || '')), 'the refusal reason names the missing approval');
  // and no .room-root was written.
  assert.ok(!fs.existsSync(path.join(child, '.room-root')),
    'a refused heal must NOT write a .room-root sentinel');
});

check('healRoom WITH approvedBy writes .room-root + bootstraps room.db + birthRoom wiring', () => {
  const res = healRoom({ folder: child, parentRoomDir: parent, slug: 'b2-journey', approvedBy: 'tester', runTimeline: false });
  assert.equal(res.ok, true, `healRoom must succeed with approvedBy, got ${JSON.stringify(res)}`);
  assert.ok(fs.existsSync(path.join(child, '.room-root')), 'the child gains its own .room-root sentinel');
  assert.ok(fs.existsSync(path.join(child, '.mindrian', 'room.db')), 'the child gains its own room.db');
  // birthRoom full SEED-001 wiring.
  assert.ok(fs.existsSync(path.join(child, 'ROOM.md')), 'birthRoom reuse writes ROOM.md');
  assert.ok(fs.existsSync(path.join(child, 'STATE.md')), 'birthRoom reuse writes STATE.md');
  assert.ok(fs.existsSync(path.join(child, 'MINTO.md')), 'birthRoom reuse writes MINTO.md');
});

check('the heal registers the child with parent=<parent-slug> + the sentinel carries a parent field', () => {
  const sentinel = JSON.parse(fs.readFileSync(path.join(child, '.room-root'), 'utf8'));
  assert.equal(sentinel.parent, 'parent-room', 'the .room-root sentinel JSON must carry the parent field');
  const registryPath = path.join(parent, '.rooms', 'registry.json');
  assert.ok(fs.existsSync(registryPath), 'the parent registry must exist after the heal');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const registered = JSON.stringify(registry);
  assert.ok(/b2-journey/.test(registered), 'the child must be registered');
  assert.ok(/parent-room/.test(registered), 'the registry entry must record the parent');
});

console.log(`\nPASS (${pass}/4)`);
