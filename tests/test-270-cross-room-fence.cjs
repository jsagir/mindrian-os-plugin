#!/usr/bin/env node
'use strict';

/*
 * Phase 270-04 Task 1 -- Part 8 cross-room fence pin.
 *
 * The Phase 8 cross-room fence has exactly one sanctioned violation of the
 * "never open another room's db" rule: `rollupSubRooms` (lib/core/graph-
 * derivation.cjs) reads a child room's edges via a read-only, parameterized
 * `ATTACH DATABASE`. Two failure modes would breach it silently:
 *   (1) materializing a cross-room edge in the parent -- breaches
 *       lib/core/navigation/edges.cjs:45 ("Cross-room aggregation forbidden
 *       (Phase 8 cross-room fence)");
 *   (2) splicing a directory name into the ATTACH statement -- a known past
 *       bug and injection vector, recorded at
 *       lib/core/graph-derivation.cjs:452-457 (an apostrophe in a room
 *       directory name silently broke the statement and contributed
 *       nothing -- no error, just missing data).
 *
 * Legs 1-3 are GREEN today: they pin rollupSubRooms's existing, already-
 * correct behaviour as a no-regression baseline. Legs 4-5 are RED until
 * plan 270-10 (lib/core/icm-forest.cjs::findNearestSubRoomDecisions does
 * not exist yet).
 *
 * No em-dashes. CJS only. node:sqlite via the navigation chokepoint plus
 * the test-allow-listed room-db.cjs bootstrap (test-135/test-237
 * precedent), node:crypto for the sha, no new deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
// Tests are on the room-db.cjs substrate allow-list (test-135/test-237
// precedent): the fixture bootstraps room.db directly so the SCHEMA still
// comes from the real chokepoint's own initSchema, then every READ in the
// assertions below goes through navigation.openRoomDbForCaller /
// closeRoomDbForCaller, exactly as production code does.
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { ALLOWED_EDGE_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));

// Same array as tests/test-270-no-second-walker.cjs, declared locally (not
// required across test files) so each test stays independently runnable.
const OPERATOR_FILES = [
  'lib/core/icm-forest.cjs',
  'lib/mcp/tree-watcher.cjs',
  'lib/mcp/tools/context.cjs',
  'lib/mcp/tools/graph-reason.cjs',
  'lib/mcp/tools/identity.cjs',
  'lib/mcp/tools/dual-path.cjs',
];

function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
}

function readStrippedIfExists(rel) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return stripComments(fs.readFileSync(abs, 'utf8'));
}

// snapshotEdges(roomDir) -- opens through the SAME caller-owned chokepoint
// production code uses (navigation.openRoomDbForCaller / closeRoomDbForCaller),
// never a raw node:sqlite open, so a schema-init side effect on open can
// never look like an edges-table mutation this test wrongly blames on
// rollupSubRooms / findNearestSubRoomDecisions.
function snapshotEdges(roomDir) {
  const db = navigation.openRoomDbForCaller(roomDir);
  assert.ok(db, 'openRoomDbForCaller returned null for ' + roomDir + ' (room.db must already exist)');
  try {
    const rows = db.prepare('SELECT source, target, type, properties FROM edges ORDER BY source, target, type').all();
    const json = JSON.stringify(rows);
    return { sha256: crypto.createHash('sha256').update(json, 'utf8').digest('hex'), count: rows.length };
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function makeNestedFixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '270-fence-'));
  try {
    return buildNestedFixtureContents(home);
  } catch (e) {
    // A throw anywhere during fixture construction must not leak the temp
    // dir -- the caller has not received a fixture handle yet, so nothing
    // else would ever clean this up.
    cleanupDir(home);
    throw e;
  }
}

function buildNestedFixtureContents(home) {
  const parentDir = path.join(home, 'parent');
  // FIX (plan 270-10): the child/lab rooms must live as FILESYSTEM
  // subdirectories of the parent room, not as siblings under `home`.
  // rollupSubRooms resolves a NESTED_WITHIN child slug to a directory via
  // lib/core/graph-derivation.cjs::_childDirForSlug(parentRoomDir, slug),
  // which reads ONLY `fs.readdirSync(parentRoomDir)` -- an immediate
  // subdirectory scan of the PARENT's own directory, never `home`. A
  // sibling layout means _directChildSlugs correctly reads the
  // NESTED_WITHIN edges from the parent's own room.db, but
  // _childDirForSlug can never resolve either slug to a real directory
  // (parentDir has no non-hidden subdirectories at all), so
  // _readChildEdgesViaAttach is never reached and rollupSubRooms silently
  // contributes nothing -- not the Pitfall P6 splice failure this test
  // exists to catch, just a fixture laid out inconsistently with the
  // function's real, already-shipped contract. This mirrors
  // lib/core/icm-forest.cjs's own established convention (a registered
  // sub-room is a genuine filesystem child of its parent room directory,
  // icm-forest.cjs:316-323).
  const childDir = path.join(parentDir, 'child');
  const labDir = path.join(parentDir, "child's-lab");

  fs.mkdirSync(parentDir, { recursive: true });
  fs.mkdirSync(childDir, { recursive: true });
  fs.mkdirSync(labDir, { recursive: true });

  fs.writeFileSync(path.join(parentDir, '.room-root'), JSON.stringify({ slug: 'parent' }));
  fs.writeFileSync(path.join(childDir, '.room-root'), JSON.stringify({ slug: 'child' }));
  fs.writeFileSync(path.join(labDir, '.room-root'), JSON.stringify({ slug: 'childs-lab' }));

  // An allowed edge type picked by iteration -- never written as a literal.
  const anyAllowedType = ALLOWED_EDGE_TYPES.values().next().value;

  // insertNode(db, id, type) -- the nodes table carries several NOT NULL
  // provenance/bitemporal columns beyond (id, type, properties) (source_path,
  // created_by, review_status, created_at, last_seen_at). This fixture only
  // needs the row to exist for FK-adjacent readability; the exact provenance
  // values are inert fixture data, not something any leg here asserts on.
  const now = Date.now();
  function insertNode(db, id, type) {
    db.prepare(
      'INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, type, '{}', 'fixture:test-270-cross-room-fence', 'system', 'confirmed', now, now);
  }

  const parentDb = openRoomDb(parentDir);
  try {
    insertNode(parentDb, 'room:parent', 'room');
    insertNode(parentDb, 'claim:parent-1', 'claim');
    parentDb.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)")
      .run('room:child', 'room:parent', 'NESTED_WITHIN', '{}');
    parentDb.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)")
      .run('room:childs-lab', 'room:parent', 'NESTED_WITHIN', '{}');
  } finally {
    closeRoomDb(parentDb);
  }

  const childDb = openRoomDb(childDir);
  try {
    insertNode(childDb, 'room:child', 'room');
    insertNode(childDb, 'claim:child-1', 'claim');
    childDb.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)")
      .run('claim:child-1', 'room:child', anyAllowedType, '{}');
    childDb.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)")
      .run('room:child', 'claim:child-1', anyAllowedType, '{}');
  } finally {
    closeRoomDb(childDb);
  }

  const labDb = openRoomDb(labDir);
  try {
    insertNode(labDb, 'room:childs-lab', 'room');
    labDb.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)")
      .run('room:childs-lab', 'claim:lab-marker', anyAllowedType, '{}');
  } finally {
    closeRoomDb(labDb);
  }

  return { home, parentDir, childDir, labDir };
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-270-cross-room-fence');

const fixture = makeNestedFixture();

try {
  ok('source: no operator file splices a path into an ATTACH statement (Pitfall P6)', function () {
    const targets = OPERATOR_FILES.concat(['lib/core/graph-derivation.cjs']);
    const spliceOffenders = [];
    const quoteOffenders = [];
    for (const rel of targets) {
      const src = readStrippedIfExists(rel);
      if (src === null) continue;
      let idx = src.indexOf('ATTACH DATABASE');
      while (idx !== -1) {
        const after = src.slice(idx + 'ATTACH DATABASE'.length, idx + 'ATTACH DATABASE'.length + 40);
        const firstNonWs = after.trimStart().charAt(0);
        if (firstNonWs !== '?') {
          if (/^\s*['"]/.test(after)) quoteOffenders.push(rel);
          spliceOffenders.push(rel + ' (next token: ' + JSON.stringify(firstNonWs) + ')');
        }
        idx = src.indexOf('ATTACH DATABASE', idx + 1);
      }
      if (/ATTACH DATABASE\s*['"]/.test(src)) quoteOffenders.push(rel);
      if (/ATTACH DATABASE\s*.{0,20}\+/.test(src)) spliceOffenders.push(rel + ' (same-line concatenation)');
    }
    assert.equal(
      quoteOffenders.length,
      0,
      'ATTACH DATABASE spliced a quoted string instead of a bind parameter -- see the injection-vector ' +
        'comment at lib/core/graph-derivation.cjs:452-457: ' + quoteOffenders.join(', ')
    );
    assert.equal(
      spliceOffenders.length,
      0,
      'ATTACH DATABASE does not use a bare "?" bind parameter: ' + spliceOffenders.join(', ')
    );
  });

  ok('source: every cross-room ATTACH URI carries mode=ro', function () {
    const targets = OPERATOR_FILES.concat(['lib/core/graph-derivation.cjs']);
    const offenders = [];
    for (const rel of targets) {
      const src = readStrippedIfExists(rel);
      if (src === null) continue;
      let idx = src.indexOf('ATTACH DATABASE');
      while (idx !== -1) {
        const window = src.slice(idx, idx + 200);
        if (window.indexOf('?mode=ro') === -1) offenders.push(rel);
        idx = src.indexOf('ATTACH DATABASE', idx + 1);
      }
    }
    assert.equal(
      offenders.length,
      0,
      'an ATTACH DATABASE call is missing ?mode=ro within 200 chars -- see the reference idiom at ' +
        'lib/core/graph-derivation.cjs:452-457: ' + offenders.join(', ')
    );
  });

  ok('behaviour: rollupSubRooms leaves the parent edges table byte-identical (GREEN today, no-regression baseline)', function () {
    const before = snapshotEdges(fixture.parentDir);
    const { rollupSubRooms } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));
    const result = rollupSubRooms(fixture.parentDir);
    assert.ok(result && Array.isArray(result.edges), 'rollupSubRooms must return { edges: [] }');
    const after = snapshotEdges(fixture.parentDir);
    assert.equal(after.sha256, before.sha256, 'rollupSubRooms wrote to the parent edges table (Part 8 breach)');
    assert.equal(after.count, before.count, 'parent edges row count changed');
  });

  ok('behaviour: the operator\'s own cross-room read leaves the parent edges table byte-identical', function () {
    const beforeParent = snapshotEdges(fixture.parentDir);
    const beforeChild = snapshotEdges(fixture.childDir);
    const beforeLab = snapshotEdges(fixture.labDir);
    let forest;
    try {
      forest = require(path.join(REPO_ROOT, 'lib', 'core', 'icm-forest.cjs'));
    } catch (e) {
      throw new Error('operator core not created yet (plan 270-10) - RED by design. (' + (e && e.code ? e.code : 'module unavailable') + ')');
    }
    assert.equal(typeof forest.findNearestSubRoomDecisions, 'function', 'findNearestSubRoomDecisions must be exported (plan 270-10)');
    forest.findNearestSubRoomDecisions(fixture.parentDir, { maxResults: 10 });
    // A read-only ATTACH must not write EITHER side -- parent or child.
    const afterParent = snapshotEdges(fixture.parentDir);
    const afterChild = snapshotEdges(fixture.childDir);
    const afterLab = snapshotEdges(fixture.labDir);
    assert.equal(afterParent.sha256, beforeParent.sha256, "the operator's cross-room read wrote to the parent edges table");
    assert.equal(afterParent.count, beforeParent.count, 'parent edges row count changed');
    assert.equal(afterChild.sha256, beforeChild.sha256, "the operator's cross-room read wrote to the child edges table");
    assert.equal(afterChild.count, beforeChild.count, 'child edges row count changed');
    assert.equal(afterLab.sha256, beforeLab.sha256, "the operator's cross-room read wrote to the lab room's edges table");
    assert.equal(afterLab.count, beforeLab.count, "lab room edges row count changed");
  });

  ok('behaviour: an apostrophe in a room directory name does not silently drop that room', function () {
    let forest;
    try {
      forest = require(path.join(REPO_ROOT, 'lib', 'core', 'icm-forest.cjs'));
    } catch (e) {
      throw new Error('operator core not created yet (plan 270-10) - RED by design. (' + (e && e.code ? e.code : 'module unavailable') + ')');
    }
    // A string-spliced ATTACH breaks on the apostrophe and silently contributes
    // NOTHING, which is exactly how the original bug presented: no error, just
    // missing data. So this leg asserts PRESENCE of a childs-lab-traceable
    // record, never merely "it did not throw" -- that would be the exact
    // false-success shape this leg exists to close.
    const result = forest.findNearestSubRoomDecisions(fixture.parentDir, { maxResults: 10 });
    const asText = JSON.stringify(result);
    assert.ok(
      asText.indexOf('childs-lab') !== -1 || asText.indexOf("child's-lab") !== -1 || asText.indexOf('lab-marker') !== -1,
      "the apostrophe-bearing room (child's-lab) contributed no traceable record -- the exact silent-drop " +
        'failure mode Pitfall P6 records'
    );
  });
} finally {
  cleanupDir(fixture.home);
}

console.log('\nPASS test-270-cross-room-fence (' + n + ' assertions)');
