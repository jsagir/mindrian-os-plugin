'use strict';
// Phase 195-03 Task 2 -- born-wired sub-room birth (FCM-05).
//
// SEED-001's FIVE non-negotiable side-effects wire atomically or the whole birth
// fails CLOSED via a compensating rollback (no half-born orphan). Asserts:
//   (A) SUCCESS: all 5 side-effects present.
//       1. parent STATE.md has `[[<child>]]` under `## Sub-rooms`.
//       2. child STATE.md has `parent: [[<parent>]]` + `## Parent Room`.
//       3. NESTED_WITHIN edge in the child room.db (written inside the ACID block).
//       4. registry child entry has parent+depth+path; parent has children:[child].
//       5. wikilink cache invalidation recorded (side_effects.s5).
//       + 6/6 file complement synchronously (BRAIN.md present at birth).
//   (B) INDUCED FAILURE at STEP 2 (NESTED_WITHIN) -> NO folder, NO registry key,
//       NO db rows (fail-closed rollback).
//   (C) INDUCED FAILURE at a finalize side-effect -> full rollback (no orphan).
//
// SKIP-77 when node:sqlite is unavailable.
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('SKIP-77: node:sqlite unavailable -- skipping born-wired birth test\n');
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

function registry(home) {
  try { return JSON.parse(fs.readFileSync(path.join(home, '.rooms', 'registry.json'), 'utf8')); }
  catch (_e) { return null; }
}

function nestedWithinRows(roomDir, childSlug, parentSlug) {
  let db = null;
  try {
    db = roomDb.openRoomDb(roomDir);
    return db.prepare(
      "SELECT source FROM edges WHERE source=? AND target=? AND type='NESTED_WITHIN'"
    ).all('room:' + childSlug, 'room:' + parentSlug);
  } catch (_e) { return []; }
  finally { if (db) { try { db.close(); } catch (_e2) {} } }
}

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-bornwired-'));
const origHome = process.env.MINDRIAN_ROOMS_HOME;
process.env.MINDRIAN_ROOMS_HOME = tmpHome;

process.stdout.write('\n[test-195-born-wired-birth] FCM-05 born-wired sub-room birth\n');
process.stdout.write('  tmpHome: ' + tmpHome + '\n\n');

function birthParent(slug) {
  const dir = path.join(tmpHome, slug);
  const r = birthRoom({
    slug: slug,
    roomDir: dir,
    sessionId: 's-parent',
    ventureText: 'Parent venture ' + slug,
    approvedBy: 'test-user',
    vname: slug,
    vstage: 'Pre-Opportunity',
  });
  return { dir: dir, result: r };
}

try {
  // ===== Section A: SUCCESS -- all 5 side-effects =====
  process.stdout.write('Section A: success -- all 5 side-effects + 6/6 complement\n');
  const parentSlug = 'acme-parent-a';
  const parent = birthParent(parentSlug);
  check('parent room born', parent.result && parent.result.ok === true,
    parent.result ? JSON.stringify(parent.result) : 'null');

  const childSlug = 'acme-child-a';
  const childDir = path.join(tmpHome, childSlug);
  const rA = birthRoom({
    slug: childSlug,
    roomDir: childDir,
    sessionId: 's-child',
    ventureText: 'Child venture',
    approvedBy: 'test-user',
    parent: parentSlug,
    parentRoomDir: parent.dir,
    bornWired: true,
    birthGate: { approved: true, canonical_verb: 'Approve' },
    vname: childSlug,
  });

  check('born-wired child returns {ok:true, born_wired:true}',
    rA && rA.ok === true && rA.born_wired === true, JSON.stringify(rA));
  check('all 5 side_effects flagged true',
    rA && rA.side_effects && rA.side_effects.s1 && rA.side_effects.s2 &&
    rA.side_effects.s3 && rA.side_effects.s4 && rA.side_effects.s5,
    rA ? JSON.stringify(rA.side_effects) : 'null');

  // side-effect 1: parent STATE.md
  const parentState = fs.existsSync(path.join(parent.dir, 'STATE.md'))
    ? fs.readFileSync(path.join(parent.dir, 'STATE.md'), 'utf8') : '';
  check('SE1: parent STATE.md has ## Sub-rooms + [[child]]',
    parentState.indexOf('## Sub-rooms') !== -1 && parentState.indexOf('[[' + childSlug + ']]') !== -1);

  // side-effect 2: child STATE.md
  const childState = fs.existsSync(path.join(childDir, 'STATE.md'))
    ? fs.readFileSync(path.join(childDir, 'STATE.md'), 'utf8') : '';
  check('SE2: child STATE.md has parent frontmatter + ## Parent Room',
    /parent\s*:/.test(childState) && childState.indexOf('[[' + parentSlug + ']]') !== -1 &&
    childState.indexOf('## Parent Room') !== -1, childState.slice(0, 160));

  // side-effect 3: NESTED_WITHIN edge in child room.db
  const nw = nestedWithinRows(childDir, childSlug, parentSlug);
  check('SE3: NESTED_WITHIN edge present in child room.db (written in ACID block)', nw.length >= 1);

  // side-effect 4: registry lineage
  const reg = registry(tmpHome);
  const childEntry = reg && reg.rooms && reg.rooms[childSlug];
  const parentEntry = reg && reg.rooms && reg.rooms[parentSlug];
  check('SE4: child registry entry has parent',
    childEntry && childEntry.parent === parentSlug, JSON.stringify(childEntry));
  check('SE4: child registry entry has depth',
    childEntry && typeof childEntry.depth !== 'undefined');
  check('SE4: child registry entry has path',
    childEntry && typeof childEntry.path === 'string' && childEntry.path.length > 0);
  check('SE4: parent registry entry children includes child',
    parentEntry && Array.isArray(parentEntry.children) && parentEntry.children.indexOf(childSlug) !== -1,
    parentEntry ? JSON.stringify(parentEntry.children) : 'null');

  // 6/6 complement: BRAIN.md present at birth.
  check('6/6 complement: BRAIN.md seeded at birth', fs.existsSync(path.join(childDir, 'BRAIN.md')));
  check('6/6 complement: USER.md present', fs.existsSync(path.join(childDir, 'USER.md')));
  check('6/6 complement: STATE.md present', fs.existsSync(path.join(childDir, 'STATE.md')));
  check('6/6 complement: MINTO.md present', fs.existsSync(path.join(childDir, 'MINTO.md')));

  // ===== Section B: induced STEP-2 failure -> fail-closed rollback =====
  process.stdout.write('\nSection B: induced STEP-2 (NESTED_WITHIN) failure -> no orphan\n');
  const pB = birthParent('acme-parent-b');
  check('parent-b born', pB.result && pB.result.ok);
  const childB = 'acme-child-b';
  const childBDir = path.join(tmpHome, childB);
  const rB = birthRoom({
    slug: childB, roomDir: childBDir, approvedBy: 'test-user',
    parent: 'acme-parent-b', parentRoomDir: pB.dir, bornWired: true,
    birthGate: { approved: true }, _faultInject: 'step2', vname: childB,
  });
  check('B: birth fails closed', rB && rB.ok === false, JSON.stringify(rB));
  check('B: NO child folder left behind', !fs.existsSync(childBDir));
  const regB = registry(tmpHome);
  check('B: NO child registry key', !(regB && regB.rooms && regB.rooms[childB]));
  const pBentry = regB && regB.rooms && regB.rooms['acme-parent-b'];
  check('B: parent children does NOT include the failed child',
    !(pBentry && Array.isArray(pBentry.children) && pBentry.children.indexOf(childB) !== -1));

  // ===== Section C: induced finalize side-effect failure -> full rollback =====
  process.stdout.write('\nSection C: induced finalize side-effect failure -> full rollback\n');
  const pC = birthParent('acme-parent-c');
  check('parent-c born', pC.result && pC.result.ok);
  const childC = 'acme-child-c';
  const childCDir = path.join(tmpHome, childC);
  const rC = birthRoom({
    slug: childC, roomDir: childCDir, approvedBy: 'test-user',
    parent: 'acme-parent-c', parentRoomDir: pC.dir, bornWired: true,
    birthGate: { approved: true }, _faultInject: 's4', vname: childC,
  });
  check('C: birth reports born_wired_incomplete', rC && rC.ok === false && rC.reason === 'born_wired_incomplete',
    JSON.stringify(rC));
  check('C: NO child folder left behind', !fs.existsSync(childCDir));
  const regC = registry(tmpHome);
  check('C: NO child registry key', !(regC && regC.rooms && regC.rooms[childC]));

} finally {
  if (origHome !== undefined) process.env.MINDRIAN_ROOMS_HOME = origHome;
  else delete process.env.MINDRIAN_ROOMS_HOME;
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
}

process.stdout.write('\n[test-195-born-wired-birth] ' + passed + '/' + checks + ' PASS\n');
process.exit(passed === checks ? 0 : 1);
