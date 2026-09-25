#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 01 Task 2 (test-first) -- pins every behavior line of
 * tests/helpers/fixture-room-3551.cjs's buildDeltaRoom and
 * copy355FixtureRoom before the helper exists (RED), then against the
 * shipped helper (GREEN).
 *
 * hygiene-355 preamble runs BEFORE any repo require, per every 355/355.1
 * test's own discipline; attempts() === 0 is the LAST check.
 *
 * SKIP-77 when node:sqlite is unavailable (the experimental built-in every
 * room.db test in this repo gates on).
 *
 * Run: node tests/test-3551-fixture-room.cjs
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const path = require('node:path');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('SKIP-77: node:sqlite unavailable -- skipping fixture-room-3551 test\n');
  process.exit(77);
}

const fs = require('node:fs');

const navigation = require('../lib/core/navigation.cjs');
const resolveActiveRoom = require('../lib/core/resolve-active-room.cjs');

let checks = 0;
let passed = 0;
function check(label, cond, detail) {
  checks += 1;
  if (cond) {
    passed += 1;
    process.stdout.write('PASS: ' + label + '\n');
  } else {
    process.stdout.write('FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n');
  }
  return cond;
}

// readOnlyCount(roomDir, sql, ...params) -- opens the room's db through
// navigation's OWN read-only door (never a second chokepoint), runs one
// prepared SELECT, closes, returns the scalar. Mirrors the
// tests/test-219-harvest-sensor.cjs / tests/test-354-*.cjs idiom of reading
// back through a fresh handle rather than trusting a writer's own return
// value.
function readOnlyQuery(roomDir, sql, params) {
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  if (!db) throw new Error('readOnlyQuery: could not open ' + roomDir + ' read-only');
  try {
    const stmt = db.prepare(sql);
    return params ? stmt.all(...params) : stmt.all();
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

async function main() {
  // Load the helper INSIDE main() so a require-time throw (helper absent,
  // the RED state) is caught by the outer catch below and reported as a
  // clean FAIL rather than an uncaught crash -- the loud, unambiguous
  // "helper absent" signal RED is supposed to produce.
  let fixtureRoom3551;
  try {
    fixtureRoom3551 = require('./helpers/fixture-room-3551.cjs');
  } catch (e) {
    process.stdout.write('FAIL: require tests/helpers/fixture-room-3551.cjs -- ' + (e && e.message) + '\n');
    process.stdout.write('PASS: 0 FAIL: 1\n');
    process.exitCode = 1;
    return;
  }
  const { buildDeltaRoom, copy355FixtureRoom, SKIP_EXIT_CODE, MARKER_PREFIX } = fixtureRoom3551;

  check('SKIP_EXIT_CODE is 77', SKIP_EXIT_CODE === 77);
  check('MARKER_PREFIX is SECRET-3551-', MARKER_PREFIX === 'SECRET-3551-');

  // ---------------------------------------------------------------------
  // buildDeltaRoom('t') shape + room.db opens through the read-only door +
  // the registry file under roomsHome lists the room.
  // ---------------------------------------------------------------------
  const room = buildDeltaRoom('t');
  try {
    check('buildDeltaRoom returns root', typeof room.root === 'string' && room.root.length > 0);
    check('buildDeltaRoom returns roomsHome', typeof room.roomsHome === 'string' && room.roomsHome.length > 0);
    check('buildDeltaRoom returns roomDir', typeof room.roomDir === 'string' && room.roomDir.length > 0);
    check('buildDeltaRoom returns slug', typeof room.slug === 'string' && room.slug.length > 0);
    check('buildDeltaRoom returns cleanup fn', typeof room.cleanup === 'function');
    check('roomDir lives under roomsHome', room.roomDir.indexOf(room.roomsHome) === 0);

    const dbPath = path.join(room.roomDir, '.mindrian', 'room.db');
    check('room.db exists on disk', fs.existsSync(dbPath));

    const roDb = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    check('room.db opens through navigation read-only door', !!roDb);
    if (roDb) navigation.closeRoomDbForCaller(roDb);

    const registryPath = path.join(room.roomsHome, '.rooms', 'registry.json');
    check('registry.json exists under roomsHome', fs.existsSync(registryPath));
    let registry = null;
    try { registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')); } catch (_e) { registry = null; }
    check('registry.json lists the room slug', !!(registry && registry.rooms && registry.rooms[room.slug]));

    // -----------------------------------------------------------------
    // addClaims(5): exactly 5 claim nodes, marker in every text.
    // -----------------------------------------------------------------
    const claimIds = room.addClaims(5);
    check('addClaims(5) returns 5 ids', Array.isArray(claimIds) && claimIds.length === 5);
    const claimRows = readOnlyQuery(room.roomDir, "SELECT id, properties FROM nodes WHERE type = 'claim'");
    check('exactly 5 claim nodes readable through the read-only door', claimRows.length === 5,
      'got ' + claimRows.length);
    const allMarked = claimRows.every(function (row) {
      try {
        const props = JSON.parse(row.properties);
        return typeof props.text === 'string' && props.text.indexOf(MARKER_PREFIX) === 0;
      } catch (_e) {
        return false;
      }
    });
    check('every claim text carries the SECRET-3551- marker', allMarked);

    // -----------------------------------------------------------------
    // addContradicts(): two more claims, exactly one CONTRADICTS edge.
    // -----------------------------------------------------------------
    const contra = room.addContradicts();
    check('addContradicts returns idA/idB', typeof contra.idA === 'string' && typeof contra.idB === 'string');
    const claimRowsAfter = readOnlyQuery(room.roomDir, "SELECT id FROM nodes WHERE type = 'claim'");
    check('addContradicts added exactly 2 more claim nodes', claimRowsAfter.length === 7,
      'got ' + claimRowsAfter.length);
    const contradictsEdges = readOnlyQuery(room.roomDir,
      "SELECT source, target FROM edges WHERE type = 'CONTRADICTS' AND source = ? AND target = ?",
      [contra.idA, contra.idB]);
    check('exactly one CONTRADICTS edge between the two new claims', contradictsEdges.length === 1,
      'got ' + contradictsEdges.length);

    // -----------------------------------------------------------------
    // setStage('Design') / setStage(null).
    // -----------------------------------------------------------------
    room.setStage('Design');
    const stateMdAfterStage = fs.readFileSync(path.join(room.roomDir, 'STATE.md'), 'utf8');
    check("setStage('Design') writes venture_stage: Design",
      stateMdAfterStage.indexOf('venture_stage: Design') !== -1);
    room.setStage(null);
    const stateMdEmpty = fs.readFileSync(path.join(room.roomDir, 'STATE.md'), 'utf8');
    check('setStage(null) writes an empty STATE.md', stateMdEmpty === '');

    // -----------------------------------------------------------------
    // addChildRoom('child-a'): registry room with parent = this slug.
    // -----------------------------------------------------------------
    const child = room.addChildRoom('child-a');
    check('addChildRoom returns a slug', typeof child.slug === 'string' && child.slug.length > 0);
    check('addChildRoom creates the folder', fs.existsSync(child.roomDir));
    let registryAfterChild = null;
    try {
      registryAfterChild = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    } catch (_e) { registryAfterChild = null; }
    const childEntry = registryAfterChild && registryAfterChild.rooms && registryAfterChild.rooms[child.slug];
    check('registry lists the child room', !!childEntry);
    check('child registry entry parent is this room\'s slug', !!childEntry && childEntry.parent === room.slug);

    // -----------------------------------------------------------------
    // addArtifact(): one memory_artifact node.
    // -----------------------------------------------------------------
    const artifactId = room.addArtifact();
    check('addArtifact returns a node id', typeof artifactId === 'string' && artifactId.length > 0);
    const artifactRows = readOnlyQuery(room.roomDir,
      "SELECT id FROM nodes WHERE type = 'memory_artifact' AND id = ?", [artifactId]);
    check('exactly one memory_artifact node with that id', artifactRows.length === 1);

    // -----------------------------------------------------------------
    // bindSession('sess-1'): resolveSessionRoom resolves this room.
    // -----------------------------------------------------------------
    room.bindSession('sess-1');
    const resolved = resolveActiveRoom.resolveSessionRoom({ sessionId: 'sess-1', home: room.roomsHome });
    check('resolveSessionRoom resolves the bound room', !!resolved && resolved.slug === room.slug,
      JSON.stringify(resolved));

    // -----------------------------------------------------------------
    // copy355FixtureRoom.
    // -----------------------------------------------------------------
    const extendCopy = copy355FixtureRoom('room-extend');
    if (extendCopy === null) {
      process.stdout.write('SKIP: copy355FixtureRoom(room-extend) -- tests/fixtures/355-rooms/room-extend absent\n');
    } else {
      check('copy355FixtureRoom returns an existing path', fs.existsSync(extendCopy));
      try { fs.rmSync(path.dirname(extendCopy), { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    }
    const missingCopy = copy355FixtureRoom('does-not-exist-3551');
    check('copy355FixtureRoom returns null for a missing fixture', missingCopy === null);
  } finally {
    room.cleanup();
  }
  check('cleanup() removed the mkdtemp root', !fs.existsSync(room.root));

  // ---------------------------------------------------------------------
  // Static source sweep: no INSERT INTO, no .prepare(, no DatabaseSync on
  // an executable (non-comment) line of the helper itself.
  // ---------------------------------------------------------------------
  const helperPath = path.join(__dirname, 'helpers', 'fixture-room-3551.cjs');
  const nonComment = hygiene.nonCommentLines(helperPath).join('\n');
  const forbidden = /INSERT[ \t]+INTO|\.prepare\(|DatabaseSync/i;
  check('helper source carries no INSERT INTO / .prepare( / DatabaseSync', !forbidden.test(nonComment));

  check('no network attempts (installNetGuard)', netGuard.attempts() === 0);

  process.stdout.write('PASS: ' + passed + ' FAIL: ' + (checks - passed) + '\n');
  process.exitCode = (checks === passed) ? 0 : 1;
}

main().catch(function (e) {
  process.stdout.write('FATAL: ' + (e && e.stack || e) + '\n');
  process.exitCode = 1;
});
