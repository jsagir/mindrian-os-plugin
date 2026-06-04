'use strict';
// Phase 139-03 Task 2 -- umbilical doctor module: marker parse + edge projection
// + integrity (orphan / removed-marker) + idempotency + dryRun.
//
// Hermetic (mkdtempSync): build a fake rooms-home with a `.rooms/registry.json`
// listing ONE real room (whose dir has a real `.mindrian/room.db` via the same
// openRoomDb chokepoint the module uses), and a SEPARATE non-room project dir
// holding a `.umbilical` marker pointing at that room.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'umbilical-module.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// --- fixture builders -------------------------------------------------------

function mkHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'umbilical-home-'));
}

// Create a real room (dir + .mindrian/room.db via the chokepoint) and register
// it in <home>/.rooms/registry.json. Returns the room abs_path.
function mkRoom(home, slug) {
  const roomDir = path.join(home, 'rooms', slug);
  fs.mkdirSync(roomDir, { recursive: true });
  const db = openRoomDb(roomDir); // creates .mindrian/room.db with full schema
  closeRoomDb(db);
  // registry
  const regDir = path.join(home, '.rooms');
  fs.mkdirSync(regDir, { recursive: true });
  const regPath = path.join(regDir, 'registry.json');
  let reg = { active: slug, rooms: [] };
  if (fs.existsSync(regPath)) reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  reg.rooms = reg.rooms || [];
  reg.rooms.push({ slug, abs_path: roomDir, status: 'active' });
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
  return roomDir;
}

// Create a non-room project dir with a `.umbilical` marker.
function mkProject(home, name, markerBody) {
  const projDir = path.join(home, 'projects', name);
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, '.umbilical'), markerBody);
  return projDir;
}

function countAffiliatedEdges(roomDir, source, slug) {
  const db = openRoomDb(roomDir);
  let n = 0;
  try {
    const row = db
      .prepare("SELECT COUNT(*) AS c FROM edges WHERE source = ? AND target = ? AND type = 'AFFILIATED_WITH'")
      .get(source, 'room:' + slug);
    n = row ? row.c : 0;
  } finally {
    closeRoomDb(db);
  }
  return n;
}

console.log('test-umbilical-module');

// --- (1) marker parse -------------------------------------------------------
check('marker parse: valid fields parsed; unknown relation flagged + skipped', () => {
  const home = mkHome();
  const ok = mkProject(home, 'code-repo', 'room: alpha\nrelation: code\nborn: 2026-06-04\nnote: lives in ~/dev\n');
  const p = mod.parseUmbilicalMarker(path.join(ok, '.umbilical'));
  assert.deepEqual(p.rooms, ['alpha']);
  assert.equal(p.relation, 'code');
  assert.equal(p.relationValid, true);
  assert.equal(p.born, '2026-06-04');
  assert.equal(p.note, 'lives in ~/dev');
  assert.equal(p.ok, true);

  const bad = mkProject(home, 'weird-repo', 'room: beta\nrelation: telepathy\n');
  const pb = mod.parseUmbilicalMarker(path.join(bad, '.umbilical'));
  assert.equal(pb.relation, 'telepathy');
  assert.equal(pb.relationValid, false, 'unknown relation must NOT be valid');
});

// --- (2) projection: exactly one edge, idempotent ---------------------------
check('fix projects EXACTLY ONE AFFILIATED_WITH edge into the target room.db (idempotent)', () => {
  const home = mkHome();
  const roomDir = mkRoom(home, 'alpha');
  const projDir = mkProject(home, 'code-repo', 'room: alpha\nrelation: code\nborn: 2026-06-04\nnote: secret local note\n');
  const ctx = { home, scanDirs: [path.join(home, 'projects')] };

  const r1 = mod.fix(ctx);
  assert.equal(r1.projected, 1, `expected 1 projected, got ${r1.projected} (${r1.detail})`);
  const src = 'project:' + path.basename(projDir);
  assert.equal(countAffiliatedEdges(roomDir, src, 'alpha'), 1);

  // re-run -> UPSERT -> STILL exactly one edge (idempotent).
  const r2 = mod.fix(ctx);
  assert.equal(r2.projected, 1, 'second fix still projects (UPSERT)');
  assert.equal(countAffiliatedEdges(roomDir, src, 'alpha'), 1, 'still exactly ONE edge after re-run');
});

// --- (3) orphan detection ---------------------------------------------------
check('orphan: unresolved room: -> orphan_cord finding; fix SUGGESTS, no marker/edge created', () => {
  const home = mkHome();
  mkRoom(home, 'alpha'); // a real room, but the marker points at "ghost"
  const projDir = mkProject(home, 'orphan-repo', 'room: ghost\nrelation: deck\nborn: 2026-06-04\n');
  const ctx = { home, scanDirs: [path.join(home, 'projects')] };

  const c = mod.check(ctx);
  const orphan = c.findings.find((f) => f.kind === 'orphan_cord' && f.room === 'ghost');
  assert.ok(orphan, 'expected an orphan_cord finding for ghost');

  const f = mod.fix(ctx);
  assert.ok(
    f.suggested.some((s) => s.room === 'ghost' && s.reason === 'orphan_cord'),
    'orphan must be SUGGESTED for human confirmation'
  );
  // never auto-creates a marker/cord: the marker body is unchanged + no new file.
  const markerBody = fs.readFileSync(path.join(projDir, '.umbilical'), 'utf8');
  assert.match(markerBody, /room:\s*ghost/);
  assert.equal(f.projected, 0, 'orphan must NOT be projected as an edge');
});

// --- (4) removed-marker detection ------------------------------------------
check('removed-marker: edge present but marker deleted -> check reports removed_marker', () => {
  const home = mkHome();
  const roomDir = mkRoom(home, 'alpha');
  const projDir = mkProject(home, 'code-repo', 'room: alpha\nrelation: code\nborn: 2026-06-04\n');
  const ctx = { home, scanDirs: [path.join(home, 'projects')] };
  // project the edge first
  mod.fix(ctx);
  const src = 'project:' + path.basename(projDir);
  assert.equal(countAffiliatedEdges(roomDir, src, 'alpha'), 1);
  // now DELETE the marker -> the cord<->marker bidirectionality is broken.
  fs.rmSync(path.join(projDir, '.umbilical'));
  const c = mod.check(ctx);
  const removed = c.findings.find((f) => f.kind === 'removed_marker' && f.source === src);
  assert.ok(removed, 'expected a removed_marker finding once the marker is gone');
});

// --- (5) dryRun -------------------------------------------------------------
check('dryRun: fix({dryRun:true}) writes ZERO edges', () => {
  const home = mkHome();
  const roomDir = mkRoom(home, 'alpha');
  const projDir = mkProject(home, 'code-repo', 'room: alpha\nrelation: code\nborn: 2026-06-04\n');
  const ctx = { home, scanDirs: [path.join(home, 'projects')], dryRun: true };
  const r = mod.fix(ctx);
  // report says it WOULD project, but nothing is written.
  const src = 'project:' + path.basename(projDir);
  assert.equal(countAffiliatedEdges(roomDir, src, 'alpha'), 0, 'dryRun must write zero edges');
  assert.ok(r.detail.includes('dry-run'));
});

console.log(`\nPASS (${pass}/5)`);
