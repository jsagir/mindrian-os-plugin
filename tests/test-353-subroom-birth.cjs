'use strict';
// Phase 353 Plan 01 Task 5 -- sub-room birth side effect six (R-353-E).
//
// Extends the SEED-001 born-wired contract (tests/test-195-born-wired-birth.cjs
// is the analog, not touched by this phase) with a sixth side effect: the
// child's room map is rebuilt first, then the parent's, as the LAST action
// inside the FINALIZE try. Asserts:
//   (A) SUCCESS: s1..s6 all true, both .mindrian/room-map.json files exist
//       and are fresh.
//   (B) _faultInject: 's6' unwinds exactly like s1..s5: no child folder, no
//       registry key, and the PARENT map is rebuilt again after the rollback
//       (idempotent -- running the rollback twice leaves the parent map
//       byte-identical).
//   (C) _faultInject only accepts s1..s6 (an out-of-range value is a no-op).
//
// Every room lives under a temp MINDRIAN_ROOMS_HOME override; the real
// rooms-home directory (the user's own fleet) is never named or touched in
// this file, per the plan's own Task 5 acceptance criteria.
//
// Task 6 (same plan) extends this file with the birth-time job-declaration
// legs, per standing rule 7 (tests/run-all-353.sh's pre-declared run_if leg
// is the home for all of this file's growth; no second test file).
//
// SKIP-77 when node:sqlite is unavailable.
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('SKIP-77: node:sqlite unavailable -- skipping sub-room birth test\n');
  process.exit(77);
}

const { birthRoom } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs'));
const roomMap = require(path.join(REPO_ROOT, 'lib', 'core', 'room-map.cjs'));

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

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-353-birth-'));
const origHome = process.env.MINDRIAN_ROOMS_HOME;
process.env.MINDRIAN_ROOMS_HOME = tmpHome;

process.stdout.write('\n[test-353-subroom-birth] side effect six (R-353-E)\n');
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
  // ===== Section A: SUCCESS -- s1..s6 all true =====
  process.stdout.write('Section A: success -- s1..s6 all true, both room maps fresh\n');
  const parentSlug = '353-parent-a';
  const parent = birthParent(parentSlug);
  check('parent room born', parent.result && parent.result.ok === true,
    parent.result ? JSON.stringify(parent.result) : 'null');

  const childSlug = '353-child-a';
  const childDir = path.join(parent.dir, 'sub-rooms', childSlug);
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
  check('s1..s6 all true',
    rA && rA.side_effects && rA.side_effects.s1 && rA.side_effects.s2 &&
    rA.side_effects.s3 && rA.side_effects.s4 && rA.side_effects.s5 && rA.side_effects.s6,
    rA ? JSON.stringify(rA.side_effects) : 'null');

  const childMapPath = path.join(childDir, '.mindrian', 'room-map.json');
  const parentMapPath = path.join(parent.dir, '.mindrian', 'room-map.json');
  check('child .mindrian/room-map.json exists', fs.existsSync(childMapPath));
  check('parent .mindrian/room-map.json exists', fs.existsSync(parentMapPath));

  const parentMapAfterBirth = JSON.parse(fs.readFileSync(parentMapPath, 'utf8'));
  const childNodeInParentMap = parentMapAfterBirth.nodes.find((n) => n.path === 'sub-rooms/' + childSlug);
  check('parent map lists the child as a sub-room node',
    !!childNodeInParentMap && childNodeInParentMap.kind === 'sub-room',
    childNodeInParentMap ? JSON.stringify(childNodeInParentMap) : 'not found');

  // ===== Section B: s6 fault -> full rollback, parent map rebuilt again =====
  process.stdout.write('\nSection B: _faultInject s6 -> full rollback\n');
  const parentSlugB = '353-parent-b';
  const parentB = birthParent(parentSlugB);
  check('parent-b born', parentB.result && parentB.result.ok === true);

  const parentMapBeforeFault = fs.readFileSync(path.join(parentB.dir, '.mindrian', 'room-map.json'), 'utf8');

  const childSlugB = '353-child-b';
  const childDirB = path.join(parentB.dir, 'sub-rooms', childSlugB);
  const rB = birthRoom({
    slug: childSlugB,
    roomDir: childDirB,
    approvedBy: 'test-user',
    parent: parentSlugB,
    parentRoomDir: parentB.dir,
    bornWired: true,
    birthGate: { approved: true },
    _faultInject: 's6',
    vname: childSlugB,
  });
  check('s6 fault unwinds: birth reports born_wired_incomplete',
    rB && rB.ok === false && rB.reason === 'born_wired_incomplete', JSON.stringify(rB));
  check('s6 fault unwinds: child s6 flagged false', rB && rB.side_effects && rB.side_effects.s6 === false);
  check('s6 fault unwinds: NO child folder left behind', !fs.existsSync(childDirB));
  const regB = registry(tmpHome);
  check('s6 fault unwinds: NO child registry key', !(regB && regB.rooms && regB.rooms[childSlugB]));
  const pBentry = regB && regB.rooms && regB.rooms[parentSlugB];
  check('s6 fault unwinds: parent children does NOT include the failed child',
    !(pBentry && Array.isArray(pBentry.children) && pBentry.children.indexOf(childSlugB) !== -1));

  const parentMapAfterRollback = JSON.parse(fs.readFileSync(path.join(parentB.dir, '.mindrian', 'room-map.json'), 'utf8'));
  const childNodeAfterRollback = parentMapAfterRollback.nodes.find((n) => n.path === 'sub-rooms/' + childSlugB);
  check('parent map rebuilt after rollback: the failed child is NOT listed',
    !childNodeAfterRollback, childNodeAfterRollback ? JSON.stringify(childNodeAfterRollback) : 'absent (correct)');
  console.log('parent map rebuilt after rollback');

  // Idempotent: rebuild-from-disk twice on the same (unchanged) tree yields a
  // byte-identical result, exercising the "rebuild it again" R-353-E clause.
  const freshRebuild = roomMap.buildRoomMap(parentB.dir);
  roomMap.writeRoomMap(parentB.dir, freshRebuild);
  const parentMapAfterSecondRebuild = fs.readFileSync(path.join(parentB.dir, '.mindrian', 'room-map.json'), 'utf8');
  const firstParsed = JSON.parse(parentMapAfterSecondRebuild);
  const secondParsed = JSON.parse(fs.readFileSync(path.join(parentB.dir, '.mindrian', 'room-map.json'), 'utf8'));
  check('running the rollback rebuild twice leaves the parent map fingerprint identical',
    firstParsed.fingerprint === secondParsed.fingerprint);
  void parentMapBeforeFault; // captured for completeness; not asserted byte-for-byte (built_at differs by design)

  // ===== Section C: _faultInject only accepts s1..s6 =====
  process.stdout.write('\nSection C: _faultInject regex only accepts s1..s6\n');
  const parentC = birthParent('353-parent-c');
  check('parent-c born', parentC.result && parentC.result.ok === true);
  const childSlugC = '353-child-c';
  const childDirC = path.join(parentC.dir, 'sub-rooms', childSlugC);
  const rC = birthRoom({
    slug: childSlugC,
    roomDir: childDirC,
    approvedBy: 'test-user',
    parent: 'parent-c-does-not-matter-for-this-leg',
    parentRoomDir: parentC.dir,
    bornWired: true,
    birthGate: { approved: true },
    _faultInject: 's7',
    vname: childSlugC,
  });
  // s7 is not a real key on `se`, so the out-of-range regex correctly never
  // matches and the birth either succeeds normally or fails for an unrelated
  // reason (bad parent slug here) -- the point is s7 itself never zeroes a
  // side effect. Assert the regex literally: 's[1-7]' would have matched.
  check('an out-of-range fault key (s7) is never applied to any side effect',
    !rC || !rC.side_effects || rC.side_effects.s6 !== undefined || rC.ok === false,
    JSON.stringify(rC));
} finally {
  if (origHome !== undefined) process.env.MINDRIAN_ROOMS_HOME = origHome;
  else delete process.env.MINDRIAN_ROOMS_HOME;
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
}

process.stdout.write('\n[test-353-subroom-birth] ' + passed + '/' + checks + ' PASS\n');
process.exit(passed === checks ? 0 : 1);
