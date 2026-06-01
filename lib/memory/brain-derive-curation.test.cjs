#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-03 Task 2 -- brain-derive-curation.test.cjs
 * =======================================================
 * The three /mos:brain-derive curation surfaces:
 *   --review-anchors    (audit Q1: the REVIEW_REQUIRED queue digest)
 *   --orphan-census     (audit section 7: the per-label orphan count table)
 *   --cross-label-dups  (audit section 13: same-name-different-label collision
 *                        groups, a REPORTING surface that feeds Phase 132 dedup)
 *
 * Each is a STANDALONE mode (valid without a section token, like --all),
 * additive to the existing single/--all/--cross-room/--dry-run argv parser. The
 * existing derive modes stay byte-stable. Every handler runs read-only
 * methodology Cypher via brain-client.query, NEVER throws, and degrades to a
 * structured 'brain_offline' result when isAvailable() is false (Part 8 clean).
 *
 * Mocking mirrors brain-derive-command.test.cjs: install a mock brain-client in
 * require.cache (isAvailable + query) BEFORE requiring the dispatcher, and point
 * resolveActiveRoom at a tmp registry. No real Brain traffic ever fires.
 *
 * Run: node lib/memory/brain-derive-curation.test.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DISPATCHER_PATH = path.join(REPO_ROOT, 'scripts', 'brain-derive-command.cjs');

const TMP_ROOTS = [];
function makeTmpRoot(tag) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-derive-cur-' + tag + '-'));
  TMP_ROOTS.push(r);
  return r;
}
process.on('exit', function () {
  for (const r of TMP_ROOTS) {
    try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

function writeFile(p, body) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

// Build a tmp MindrianRooms dir with a registry.json pointing to one active room.
function buildFixtureRooms() {
  const roomsRoot = makeTmpRoot('rooms');
  const roomSlug = 'fixture-room';
  const roomPath = path.join(roomsRoot, roomSlug);
  fs.mkdirSync(roomPath, { recursive: true });
  writeFile(path.join(roomPath, 'ROOM.md'), '---\nname: "' + roomSlug + '"\nkind: room\n---\n');
  const rooms = {};
  rooms[roomSlug] = { path: roomSlug, venture_name: roomSlug, status: 'active' };
  writeFile(path.join(roomsRoot, '.rooms', 'registry.json'),
    JSON.stringify({ version: 2, root: roomsRoot, active: roomSlug, rooms: rooms }, null, 2));
  return { roomsRoot: roomsRoot, roomPath: roomPath, roomSlug: roomSlug };
}

// Install a mock brain-client and (fresh) require the dispatcher. queryFn(cypher,
// params) returns the rows for each curation query; isAvailable toggles offline.
function loadDispatcherWithMocks(opts) {
  opts = opts || {};
  const audit = { query_calls: [], isAvailable_calls: 0 };
  const bcPath = require.resolve('../core/brain-client.cjs');
  delete require.cache[bcPath];
  require.cache[bcPath] = {
    id: bcPath, filename: bcPath, loaded: true,
    exports: {
      isAvailable: function () {
        audit.isAvailable_calls += 1;
        return opts.isAvailable === undefined ? true : opts.isAvailable;
      },
      query: async function (cypher, params) {
        audit.query_calls.push({ cypher: cypher, params: params || {} });
        if (typeof opts.queryFn === 'function') return opts.queryFn(cypher, params);
        return { records: [] };
      },
      schema: async function () { return { brain_graph_version: 1 }; },
      search: async function () { return { matches: [] }; },
    },
  };
  // Keep brain-derivation real-but-cheap (curation modes never call deriveSection).
  const dispPath = require.resolve('../../scripts/brain-derive-command.cjs');
  delete require.cache[dispPath];
  const dispatcher = require('../../scripts/brain-derive-command.cjs');
  return { dispatcher: dispatcher, audit: audit };
}

function resetModuleCache() {
  for (const modPath of [require.resolve('../core/brain-client.cjs')]) {
    delete require.cache[modPath];
  }
  try { delete require.cache[require.resolve('../../scripts/brain-derive-command.cjs')]; }
  catch (_e) { /* may not exist during RED */ }
}

let passed = 0;
async function test(name, fn) {
  resetModuleCache();
  await fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

(async function () {

  // -------------------------------------------------------------------------
  // Test 1: argv recognizes the three flags as standalone modes (no section).
  // -------------------------------------------------------------------------
  await test('Test 1: parseArgv recognizes --review-anchors / --orphan-census / --cross-label-dups standalone', function () {
    const { dispatcher } = loadDispatcherWithMocks({});
    const a1 = dispatcher.parseArgv(['node', DISPATCHER_PATH, '--review-anchors']);
    assert.strictEqual(a1.reviewAnchors, true, '--review-anchors sets reviewAnchors');
    assert.strictEqual(a1.section, null, 'standalone (no section token required)');

    const a2 = dispatcher.parseArgv(['node', DISPATCHER_PATH, '--orphan-census']);
    assert.strictEqual(a2.orphanCensus, true, '--orphan-census sets orphanCensus');

    const a3 = dispatcher.parseArgv(['node', DISPATCHER_PATH, '--cross-label-dups']);
    assert.strictEqual(a3.crossLabelDups, true, '--cross-label-dups sets crossLabelDups');

    // The three are mutually exclusive with each other (combining is an error).
    const a4 = dispatcher.parseArgv(['node', DISPATCHER_PATH, '--review-anchors', '--orphan-census']);
    assert.strictEqual(a4.reviewAnchors && a4.orphanCensus, true, 'both flags parse (main() rejects the combination)');
  });

  // -------------------------------------------------------------------------
  // Test 2: review-anchors output (Q1 REVIEW_REQUIRED count + sample list).
  // -------------------------------------------------------------------------
  await test('Test 2: --review-anchors produces a REVIEW_REQUIRED digest (count + sample)', async function () {
    const { roomsRoot } = buildFixtureRooms();
    const { dispatcher, audit } = loadDispatcherWithMocks({
      queryFn: async function () {
        return { records: [
          { name: 'HEART Framework' }, { name: 'Ackoff Pyramid' }, { name: 'Mullins Model' },
        ] };
      },
    });
    const res = await dispatcher.dispatch({ reviewAnchors: true, _rooms_root_override: roomsRoot });
    assert.strictEqual(res.exit_code, 0, 'review-anchors exits 0');
    assert.strictEqual(res.summary.mode, 'review-anchors', 'summary carries the mode');
    assert.strictEqual(res.summary.review_required_count, 3, 'count is surfaced');
    assert.ok(Array.isArray(res.summary.sample) && res.summary.sample.length === 3, 'sample list surfaced');
    assert.ok(res.summary.sample.indexOf('HEART Framework') !== -1, 'sample carries the node names');
    // Read-only Cypher only.
    assert.ok(audit.query_calls.length >= 1, 'a read-only query fired');
    assert.ok(!/\b(SET|MERGE|DELETE|DETACH|CREATE)\b/.test(audit.query_calls[0].cypher), 'no write verb in the Cypher');
  });

  // -------------------------------------------------------------------------
  // Test 3: orphan-census output (per-label orphan count table, section 7).
  // -------------------------------------------------------------------------
  await test('Test 3: --orphan-census produces a per-label orphan count table', async function () {
    const { roomsRoot } = buildFixtureRooms();
    const { dispatcher } = loadDispatcherWithMocks({
      queryFn: async function () {
        return { records: [
          { label: 'Concept', orphans: 1441 },
          { label: 'Product', orphans: 953 },
          { label: 'Framework', orphans: 7 },
        ] };
      },
    });
    const res = await dispatcher.dispatch({ orphanCensus: true, _rooms_root_override: roomsRoot });
    assert.strictEqual(res.exit_code, 0, 'orphan-census exits 0');
    assert.strictEqual(res.summary.mode, 'orphan-census', 'summary carries the mode');
    assert.ok(Array.isArray(res.summary.label_orphans), 'a per-label table is surfaced');
    assert.strictEqual(res.summary.label_orphans.length, 3, 'three label rows');
    const concept = res.summary.label_orphans.find(function (r) { return r.label === 'Concept'; });
    assert.ok(concept && concept.orphans === 1441, 'Concept orphan count surfaced');
    assert.strictEqual(res.summary.total_orphans, 1441 + 953 + 7, 'total orphan mass summed');
  });

  // -------------------------------------------------------------------------
  // Test 4: cross-label-dups output (same-name-different-label groups, sec 13).
  // -------------------------------------------------------------------------
  await test('Test 4: --cross-label-dups produces same-name-different-label collision groups', async function () {
    const { roomsRoot } = buildFixtureRooms();
    const { dispatcher } = loadDispatcherWithMocks({
      queryFn: async function () {
        return { records: [
          { name: 'HEART Framework', labels: ['Framework', 'Product'] },
          { name: 'Jobs-to-be-Done', labels: ['Framework', 'Product', 'DictionaryTerm'] },
        ] };
      },
    });
    const res = await dispatcher.dispatch({ crossLabelDups: true, _rooms_root_override: roomsRoot });
    assert.strictEqual(res.exit_code, 0, 'cross-label-dups exits 0');
    assert.strictEqual(res.summary.mode, 'cross-label-dups', 'summary carries the mode');
    assert.ok(Array.isArray(res.summary.dup_groups), 'collision groups surfaced');
    assert.strictEqual(res.summary.dup_groups.length, 2, 'two dup groups');
    const heart = res.summary.dup_groups.find(function (g) { return g.canonical_name === 'HEART Framework'; });
    assert.ok(heart, 'HEART group present');
    assert.ok(Array.isArray(heart.variant_labels) && heart.variant_labels.indexOf('Product') !== -1,
      'each group lists its variant labels');
    // It is a REPORTING surface -- it never fails a build.
    assert.notStrictEqual(res.exit_code, 1, 'a reporting surface never hard-fails');
  });

  // -------------------------------------------------------------------------
  // Test 5: degrade Brain-offline + Part 8 read-only methodology-only.
  // -------------------------------------------------------------------------
  await test('Test 5: each mode degrades brain_offline (never throws) and is read-only methodology-only', async function () {
    const { roomsRoot } = buildFixtureRooms();
    for (const flag of ['reviewAnchors', 'orphanCensus', 'crossLabelDups']) {
      const { dispatcher } = loadDispatcherWithMocks({ isAvailable: false });
      const args = { _rooms_root_override: roomsRoot };
      args[flag] = true;
      const res = await dispatcher.dispatch(args);
      assert.strictEqual(res.exit_code, 0, flag + ' soft-fails Brain-offline (exit 0)');
      assert.strictEqual(res.summary.brain_offline_from_start, true, flag + ' marks brain_offline');
    }
    // Source-level Part 8: the curation handlers add no write Cypher.
    const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
    // The curation Cypher constants are read-only aggregates. Assert no new write
    // verb appears in the curation section by checking the whole file carries no
    // write-Cypher (the existing dispatcher already had none).
    assert.ok(!/cypher[^\n]*\b(SET|MERGE|DELETE|DETACH)\b/i.test(src),
      'no write Cypher in any curation handler');
    assert.ok(/review-anchors|reviewAnchors/.test(src), 'review-anchors wired in source');
    assert.ok(/orphan-census|orphanCensus/.test(src), 'orphan-census wired in source');
    assert.ok(/cross-label-dups|crossLabelDups/.test(src), 'cross-label-dups wired in source');
  });

  process.stdout.write('\nbrain-derive-curation.test.cjs: ' + passed + ' assertion groups PASSED\n');
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('\nbrain-derive-curation.test.cjs FAILED: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
