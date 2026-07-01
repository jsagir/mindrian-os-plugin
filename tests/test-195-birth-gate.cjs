'use strict';
// Phase 195-03 Task 2 -- born-wired birth human-approval gate (FCM-06).
//
// Asserts:
//   (A) the gate fires BEFORE fs.mkdirSync (the child folder does NOT exist at
//       the moment the gate callback runs).
//   (B) Reject -> NO child folder is created, and the rejection is recorded as
//       graph data (a subroom_birth_rejected memory_event in the PARENT room.db).
//   (C) a MISSING gate decision on a sub-room birth fails closed (no folder;
//       no silent promotion of a section to a sub-room).
//   (D) Approve -> folder created (the positive control).
//
// SKIP-77 when node:sqlite is unavailable.
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('SKIP-77: node:sqlite unavailable -- skipping birth-gate test\n');
  process.exit(77);
}

const { birthRoom } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs'));
const roomDb = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let checks = 0;
let passed = 0;
function check(label, cond, detail) {
  checks++;
  if (cond) { passed++; process.stdout.write('  PASS: ' + label + '\n'); }
  else { process.stdout.write('  FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n'); }
}

function rejectionEvents(parentDir, childSlug) {
  let db = null;
  try {
    db = roomDb.openRoomDb(parentDir);
    return db.prepare(
      "SELECT id FROM nodes WHERE type='memory_event' " +
      "AND json_extract(properties,'$.event_type')='subroom_birth_rejected' " +
      "AND json_extract(properties,'$.rejected_slug')=?"
    ).all(childSlug);
  } catch (_e) { return []; }
  finally { if (db) { try { db.close(); } catch (_e2) {} } }
}

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-birthgate-'));
const origHome = process.env.MINDRIAN_ROOMS_HOME;
process.env.MINDRIAN_ROOMS_HOME = tmpHome;

process.stdout.write('\n[test-195-birth-gate] FCM-06 pre-mkdir human-approval gate\n\n');

function birthParent(slug) {
  const dir = path.join(tmpHome, slug);
  const r = birthRoom({
    slug: slug, roomDir: dir, approvedBy: 'test-user',
    ventureText: 'Parent ' + slug, vname: slug,
  });
  return { dir: dir, result: r };
}

try {
  const parent = birthParent('gate-parent');
  check('parent room born', parent.result && parent.result.ok);

  // ===== Section A: gate fires BEFORE mkdir =====
  process.stdout.write('Section A: gate fires BEFORE mkdir\n');
  const childA = 'gate-child-a';
  const childADir = path.join(tmpHome, childA);
  let existedAtGate = null;
  const rA = birthRoom({
    slug: childA, roomDir: childADir, approvedBy: 'test-user',
    parent: 'gate-parent', parentRoomDir: parent.dir, bornWired: true,
    birthGate: function (ctx) {
      // The child folder must NOT exist yet when the gate is consulted.
      existedAtGate = fs.existsSync(childADir);
      return { approved: true, canonical_verb: 'Approve' };
    },
    vname: childA,
  });
  check('gate callback observed NO folder yet (fires before mkdir)', existedAtGate === false,
    'existedAtGate=' + existedAtGate);
  check('A: approved birth succeeds', rA && rA.ok === true, JSON.stringify(rA));
  check('A: folder exists after approve', fs.existsSync(childADir));

  // ===== Section B: Reject -> no folder + rejection is graph data =====
  process.stdout.write('\nSection B: Reject -> no folder + rejection recorded\n');
  const childB = 'gate-child-b';
  const childBDir = path.join(tmpHome, childB);
  const rB = birthRoom({
    slug: childB, roomDir: childBDir, approvedBy: 'test-user',
    parent: 'gate-parent', parentRoomDir: parent.dir, bornWired: true,
    birthGate: { approved: false, canonical_verb: 'Reject', free_text: 'not ready for a sub-room' },
    vname: childB,
  });
  check('B: birth returns {ok:false, reason:birth_rejected}',
    rB && rB.ok === false && rB.reason === 'birth_rejected', JSON.stringify(rB));
  check('B: NO child folder created on Reject', !fs.existsSync(childBDir));
  check('B: rejection_recorded flag true', rB && rB.rejection_recorded === true);
  const rejEvents = rejectionEvents(parent.dir, childB);
  check('B: subroom_birth_rejected memory_event in PARENT room.db (rejection is graph data)',
    rejEvents.length >= 1, 'events=' + rejEvents.length);

  // ===== Section C: missing gate decision fails closed =====
  process.stdout.write('\nSection C: missing gate decision fails closed\n');
  const childC = 'gate-child-c';
  const childCDir = path.join(tmpHome, childC);
  const rC = birthRoom({
    slug: childC, roomDir: childCDir, approvedBy: 'test-user',
    parent: 'gate-parent', parentRoomDir: parent.dir, bornWired: true,
    // NO birthGate supplied -> Reject (no silent promotion).
    vname: childC,
  });
  check('C: missing gate -> {ok:false, reason:birth_rejected}',
    rC && rC.ok === false && rC.reason === 'birth_rejected', JSON.stringify(rC));
  check('C: NO folder created without an explicit approval', !fs.existsSync(childCDir));

} finally {
  if (origHome !== undefined) process.env.MINDRIAN_ROOMS_HOME = origHome;
  else delete process.env.MINDRIAN_ROOMS_HOME;
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
}

process.stdout.write('\n[test-195-birth-gate] ' + passed + '/' + checks + ' PASS\n');
process.exit(passed === checks ? 0 : 1);
