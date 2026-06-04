'use strict';
// Phase 139-03 Task 2 -- the Canon Part 8 audit for the umbilical module.
//
// Three independent assertions:
//   (A) source-grep tripwire: umbilical-module.cjs has ZERO matches for the
//       forbidden network/egress token set (no Brain egress, no fetch/http).
//       Mirrors the Phase 90 5-tripwire forbidden-substring floor + the
//       resolve-umbilical-target.cjs egress tripwire.
//   (B) projection audit: after fix(), the projected edge's properties JSON
//       contains ONLY enum/scalar fields (relation, born) and does NOT contain
//       the marker's freeform `note:` text (no user content on the edge).
//   (C) cross-room audit: the edge landed in the TARGET room's room.db ONLY;
//       NO edge was written into any OTHER registered room's db (no raw
//       cross-room edge -- Part 8 forbids it).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'umbilical-module.cjs');
const mod = require(MODULE_PATH);
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-umbilical-part8-audit');

// --- (A) source-grep egress tripwire ---------------------------------------
check('source has ZERO Brain-egress / network tokens', () => {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  // The forbidden-substring floor. We scan the EXECUTABLE intent, not prose:
  // the words "Brain" / "egress" appear in this module's doc comments by design
  // (it DOCUMENTS the Part 8 boundary), so the tripwire targets the call-shaped
  // tokens that would actually move bytes off-box.
  const forbidden = [
    /\bfetch\s*\(/i,
    /\bhttps?:\/\//i,
    /\bonrender\b/i,
    /\btavily\b/i,
    /require\(['"][^'"]*brain[^'"]*['"]\)/i, // requiring a brain client
    /\bXMLHttpRequest\b/,
    /\bnode:https?\b/,
    /require\(['"]node:https?['"]\)/,
  ];
  for (const rx of forbidden) {
    assert.equal(rx.test(src), false, `forbidden egress token matched: ${rx}`);
  }
});

// --- shared fixture for (B) + (C) ------------------------------------------
function buildFixture(extraRoomSlugs) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'umbilical-p8-'));
  const regDir = path.join(home, '.rooms');
  fs.mkdirSync(regDir, { recursive: true });
  const rooms = {};
  function addRoom(slug) {
    const roomDir = path.join(home, 'rooms', slug);
    fs.mkdirSync(roomDir, { recursive: true });
    closeRoomDb(openRoomDb(roomDir));
    rooms[slug] = roomDir;
  }
  addRoom('alpha'); // the TARGET
  for (const s of extraRoomSlugs || []) addRoom(s);
  const regRooms = Object.keys(rooms).map((slug) => ({ slug, abs_path: rooms[slug], status: 'active' }));
  fs.writeFileSync(path.join(regDir, 'registry.json'), JSON.stringify({ active: 'alpha', rooms: regRooms }, null, 2));

  // project with a marker pointing ONLY at alpha, carrying a SECRET note.
  const projDir = path.join(home, 'projects', 'code-repo');
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(
    path.join(projDir, '.umbilical'),
    'room: alpha\nrelation: code\nborn: 2026-06-04\nnote: TOP-SECRET-NOTE-must-never-leak\n'
  );
  return { home, rooms, projDir };
}

function readEdgeProps(roomDir, source, slug) {
  const db = openRoomDb(roomDir);
  try {
    const row = db
      .prepare("SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'AFFILIATED_WITH'")
      .get(source, 'room:' + slug);
    return row ? row.properties : null;
  } finally {
    closeRoomDb(db);
  }
}

function countAllAffiliated(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'AFFILIATED_WITH'").get();
    return row ? row.c : 0;
  } finally {
    closeRoomDb(db);
  }
}

// --- (B) projection audit: ENUM-only props, no note: -----------------------
check('projected edge properties are ENUM-only (relation, born) -- no note: text', () => {
  const { home, rooms, projDir } = buildFixture();
  mod.fix({ home, scanDirs: [path.join(home, 'projects')] });
  const src = 'project:' + path.basename(projDir);
  const propsJson = readEdgeProps(rooms.alpha, src, 'alpha');
  assert.ok(propsJson, 'expected the projected edge to exist');
  const props = JSON.parse(propsJson);
  // ONLY the enum/scalar fields are present.
  assert.deepEqual(Object.keys(props).sort(), ['born', 'relation']);
  assert.equal(props.relation, 'code');
  assert.equal(props.born, '2026-06-04');
  // the freeform note text is NOWHERE in the serialized edge.
  assert.equal(/TOP-SECRET-NOTE/.test(propsJson), false, 'note: text leaked onto the edge');
  assert.equal('note' in props, false, 'note key must not be on the edge');
});

// --- (C) cross-room audit: target room ONLY --------------------------------
check('edge lands in the TARGET room.db ONLY -- no other room received an edge', () => {
  const { home, rooms, projDir } = buildFixture(['beta', 'gamma']);
  mod.fix({ home, scanDirs: [path.join(home, 'projects')] });
  const src = 'project:' + path.basename(projDir);
  // alpha (target) has exactly one.
  assert.equal(countAllAffiliated(rooms.alpha), 1, 'target room must have exactly one AFFILIATED_WITH edge');
  assert.ok(readEdgeProps(rooms.alpha, src, 'alpha'), 'target edge present');
  // beta + gamma (other registered rooms) have ZERO -- no raw cross-room edge.
  assert.equal(countAllAffiliated(rooms.beta), 0, 'beta room.db must have NO AFFILIATED_WITH edge');
  assert.equal(countAllAffiliated(rooms.gamma), 0, 'gamma room.db must have NO AFFILIATED_WITH edge');
});

console.log(`\nPASS (${pass}/3)`);
