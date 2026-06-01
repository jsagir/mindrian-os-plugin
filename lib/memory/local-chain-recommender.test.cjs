#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-02 Task 2 -- bin/local-chain-recommender.cjs tests.
 *
 * Registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] and appended to
 * tests/run-all-130.7.sh. Run: node lib/memory/local-chain-recommender.test.cjs
 *
 * The Tier-LOCAL recommender aggregates memory_event references BY correlation_id
 * (not by name) and resolves the IDENTICAL canonical the Brain-side
 * recommendCanonicalTargets produces -- the dual-graph join works by
 * construction (same lib/core/correlation.cjs chokepoint). It reaches room.db
 * ONLY through navigation.cjs and works Brain-down.
 *
 * Five behaviors (per 130.7-02-PLAN.md Task 2 <behavior>):
 *   1. aggregate-by-correlation_id -- two references sharing a correlation_id
 *      count as one logical target; the aggregate key set is correlation_ids.
 *   2. canonical agreement -- a (name, label) present locally resolves to the
 *      SAME correlation_id recommendCanonicalTargets produces (== computeCorrelationId).
 *   3. Tier-LOCAL / Brain-down -- returns canonical tuples from local aggregates
 *      alone when isAvailable() is false; never throws.
 *   4. chokepoint -- the module reaches room.db ONLY through navigation.cjs
 *      (no direct room-db.cjs / node:sqlite require) -- source-grep assertion.
 *   5. Tier-0 -- an absent room.db yields an empty result, not a crash.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LOCAL_RECOMMENDER_PATH = path.join(REPO_ROOT, 'bin', 'local-chain-recommender.cjs');

const localRec = require('../../bin/local-chain-recommender.cjs');
const brainRec = require('../brain/chain-recommender.cjs');
const correlation = require('../core/correlation.cjs');
const spineEvents = require('../core/navigation/spine-events.cjs');
const { openRoomDb, closeRoomDb } = require('../core/room-db.cjs');

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

function freshRoomDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p130.7-02-local-rec-'));
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

// Seed a suggestion_surfaced reference carrying correlation_id (the Task 3
// threading path) via the real spine helper -- so the local recommender reads
// exactly the references the production write path lands.
function seedReference(roomDir, canonicalName, primaryLabel, score) {
  return spineEvents.logSuggestionSurfaced(roomDir, {
    surface: 'suggest-next',
    commands: [{ command: 'mos:diagnose', score: score }],
    canonical_name: canonicalName,
    primary_label: primaryLabel,
    // Vary the dedupe_key so distinct seedings are not collapsed by the 60s TTL.
    dedupe_key: 'seed:' + canonicalName + ':' + primaryLabel + ':' + score + ':' + Math.random(),
  });
}

// ---------------------------------------------------------------------------
// 1. aggregate-by-correlation_id (not by name)
// ---------------------------------------------------------------------------
test('aggregates by correlation_id: two references sharing a correlation_id are one logical target', function () {
  const roomDir = freshRoomDir();
  // Two references for the SAME (name,label) -> same correlation_id -> ONE target.
  seedReference(roomDir, 'Beautiful Question Framework', 'Framework', 0.9);
  seedReference(roomDir, 'Beautiful Question Framework', 'Framework', 0.8);
  // A second distinct logical target.
  seedReference(roomDir, 'Domain Selection', 'Framework', 0.7);

  const out = localRec.recommendLocalCanonicalTargets({ roomDir: roomDir });
  assert.ok(Array.isArray(out), 'returns an array of tuples');
  const ids = out.map(function (t) { return t.correlation_id; });
  assert.strictEqual(new Set(ids).size, ids.length, 'aggregate keys are unique correlation_ids');
  const bq = out.filter(function (t) { return t.canonical_name === 'Beautiful Question Framework'; });
  assert.strictEqual(bq.length, 1, 'the two same-id references aggregate to ONE target');
  assert.strictEqual(out.length, 2, 'two distinct logical targets total');
  // tuple shape
  for (const t of out) {
    assert.deepStrictEqual(Object.keys(t).sort(), ['canonical_name', 'correlation_id', 'primary_label']);
  }
});

// ---------------------------------------------------------------------------
// 2. canonical agreement -- local id == Brain-side id == computeCorrelationId
// ---------------------------------------------------------------------------
test('canonical agreement: local correlation_id equals the Brain-side recommendCanonicalTargets value', function () {
  const roomDir = freshRoomDir();
  seedReference(roomDir, 'Beautiful Question Framework', 'Framework', 0.9);

  const local = localRec.recommendLocalCanonicalTargets({ roomDir: roomDir });
  const localBq = local.find(function (t) { return t.canonical_name === 'Beautiful Question Framework'; });
  assert.ok(localBq, 'local target present');

  const expectedId = correlation.computeCorrelationId('Beautiful Question Framework', 'Framework');
  assert.strictEqual(localBq.correlation_id, expectedId, 'local id == computeCorrelationId');

  // And it matches what the Brain-side recommender produces for the same canonical.
  const labelIndexMod = require('../core/correlation-label-index.cjs');
  const indexBody = labelIndexMod.serializeLabelIndex([
    { canonical_name: 'Beautiful Question Framework', primary_label: 'Framework', edge_degree: 8 },
  ]);
  const brain = brainRec.recommendCanonicalTargets({
    currentFramework: 'Beautiful Question Framework',
    roomState: { brainSections: { correlation_labels: indexBody } },
  });
  const brainBq = brain.find(function (t) { return t.canonical_name === 'Beautiful Question Framework'; });
  assert.ok(brainBq, 'brain target present');
  assert.strictEqual(localBq.correlation_id, brainBq.correlation_id, 'dual-graph join holds by construction');
});

// ---------------------------------------------------------------------------
// 3. Tier-LOCAL / Brain-down
// ---------------------------------------------------------------------------
test('Tier-LOCAL: returns canonical tuples from local aggregates with Brain down; never throws', function () {
  const brainClient = require('../core/brain-client.cjs');
  const orig = brainClient.isAvailable;
  const roomDir = freshRoomDir();
  seedReference(roomDir, 'Domain Selection', 'Framework', 0.7);
  try {
    brainClient.isAvailable = function () { return false; };
    const out = localRec.recommendLocalCanonicalTargets({ roomDir: roomDir });
    assert.ok(Array.isArray(out) && out.length >= 1, 'returns local tuples with Brain down');
    assert.notStrictEqual(out, null);
    const ds = out.find(function (t) { return t.canonical_name === 'Domain Selection'; });
    assert.ok(ds, 'local-only target present');
    assert.strictEqual(ds.correlation_id, correlation.computeCorrelationId('Domain Selection', 'Framework'));
  } finally {
    brainClient.isAvailable = orig;
  }
});

// ---------------------------------------------------------------------------
// 4. chokepoint -- room.db reached ONLY through navigation.cjs
// ---------------------------------------------------------------------------
test('chokepoint: no direct room-db.cjs / node:sqlite require; reaches room.db only via navigation.cjs', function () {
  const src = fs.readFileSync(LOCAL_RECOMMENDER_PATH, 'utf8');
  assert.ok(!/require\(\s*['"][^'"]*room-db['"]\s*\)/.test(src), 'no direct room-db.cjs require');
  assert.ok(!/require\(\s*['"](?:node:sqlite|better-sqlite3)['"]\s*\)/.test(src), 'no direct sqlite require');
  assert.ok(/navigation/.test(src), 'reaches room.db through navigation.cjs');
  assert.ok(/correlation_id/.test(src), 'aggregate key is correlation_id');
});

// ---------------------------------------------------------------------------
// 5. Tier-0 -- absent room.db -> empty result, not a crash
// ---------------------------------------------------------------------------
test('Tier-0: an absent room.db yields an empty result, not a crash', function () {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p130.7-02-tier0-'));
  // No room.db materialized in this dir.
  const out = localRec.recommendLocalCanonicalTargets({ roomDir: emptyDir });
  assert.ok(Array.isArray(out), 'returns an array');
  assert.strictEqual(out.length, 0, 'empty when there is no room.db');

  // Missing / bad roomDir also degrades to [].
  assert.deepStrictEqual(localRec.recommendLocalCanonicalTargets({}), []);
  assert.deepStrictEqual(localRec.recommendLocalCanonicalTargets(), []);
});

process.stdout.write('\nlocal-chain-recommender.test.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
