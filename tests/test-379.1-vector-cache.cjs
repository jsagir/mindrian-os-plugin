#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: vector-cache.
 * Proves CPU379-01: one embedding per artifact per content hash, keyed (content_hash, model_id, dim),
 * supplied to scoreMeasured as opts.vectors (decisions D-379.1-04, D-379.1-06, D-379.1-07).
 * Plan 02 (this file's unit part): the lib/core/semantic-index/vector-cache.cjs contract.
 * Plan 04 adds the drain integration under the marker DRAIN_INTEGRATION_BELOW.
 * Hermetic: scrubVendorKey + installNetGuard first; attempts() === 0 last. No em-dashes.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const vc = require('../lib/core/semantic-index/vector-cache.cjs');

let pass = 0;
let fail = 0;
function t(label, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}

const EXPECT = { version: '1', model: 'm1', dim: 4 };

function threeRows() {
  return {
    'a/one': { hash: vc.contentHash('one'), model: 'm1', vector: [0.1, 0.2, 0.3, 0.4] },
    'a/two': { hash: vc.contentHash('two'), model: 'm1', vector: [1, 0, 0, 0] },
    'b/three': { hash: vc.contentHash('three'), model: 'm1', vector: [0.5, -0.5, 0.25, 0.125] },
  };
}

function main() {
  console.log('test-379.1-vector-cache (CPU379-01)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-vc-'));
  const file = path.join(tmp, '.mindrian', 'graph-derive-vectors.json');
  try {
    t('contentHash is the first 16 hex of sha256 over the exact text', () => {
      const want = crypto.createHash('sha256').update('the quick brown fox', 'utf8').digest('hex').slice(0, 16);
      assert.equal(vc.contentHash('the quick brown fox'), want);
      assert.match(vc.contentHash('x'), /^[0-9a-f]{16}$/);
      assert.notEqual(vc.contentHash('x'), vc.contentHash('x '));
    });

    t('save then load round-trips 3 rows (hit on model and dim)', () => {
      const ok = vc.save(file, threeRows(), 'm1', '1');
      assert.equal(ok, true, 'save returns true');
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.equal(raw.version, '1');
      assert.equal(raw.model, 'm1');
      assert.equal(typeof raw.updated_at, 'string');
      assert.deepEqual(Object.keys(raw.embeddings).sort(), ['a/one', 'a/two', 'b/three']);
      const res = vc.load(file, EXPECT);
      assert.equal(res.dropped, 0);
      assert.equal(Object.keys(res.cache).length, 3);
      assert.deepEqual(res.cache['a/one'].vector, [0.1, 0.2, 0.3, 0.4]);
      assert.deepEqual(Object.keys(res.cache['a/one']).sort(), vc._test.ROW_SCHEMA.slice().sort());
    });

    t('a row with model other is dropped and counted', () => {
      const rows = threeRows();
      rows['a/two'].model = 'other';
      vc.save(file, rows, 'm1', '1');
      const res = vc.load(file, EXPECT);
      assert.equal(res.dropped, 1);
      assert.equal(res.cache['a/two'], undefined);
      assert.equal(Object.keys(res.cache).length, 2);
    });

    t('a row with a 3-element vector when expect.dim is 4 is dropped', () => {
      const rows = threeRows();
      rows['b/three'].vector = [1, 2, 3];
      vc.save(file, rows, 'm1', '1');
      const res = vc.load(file, EXPECT);
      assert.equal(res.dropped, 1);
      assert.equal(res.cache['b/three'], undefined);
    });

    t('a row with NaN is dropped', () => {
      const rows = threeRows();
      rows['a/one'].vector = [NaN, 0, 0, 0];
      vc.save(file, rows, 'm1', '1');
      const res = vc.load(file, EXPECT);
      assert.equal(res.dropped, 1);
      assert.equal(res.cache['a/one'], undefined);
      assert.equal(Object.keys(res.cache).length, 2);
    });

    t('a version 2 file loads as {} with dropped 0', () => {
      vc.save(file, threeRows(), 'm1', '2');
      const res = vc.load(file, EXPECT);
      assert.deepEqual(res, { cache: {}, dropped: 0 });
    });

    t('prune removes the ids not in the live set and returns 1', () => {
      const rows = threeRows();
      const removed = vc.prune(rows, new Set(['a/one', 'a/two']));
      assert.equal(removed, 1);
      assert.deepEqual(Object.keys(rows).sort(), ['a/one', 'a/two']);
      const rows2 = threeRows();
      assert.equal(vc.prune(rows2, ['a/one', 'a/two', 'b/three']), 0);
    });

    t('scopeHash is order-independent and 16 hex', () => {
      const a = vc.scopeHash([{ id: 'x', hash: '1' }, { id: 'y', hash: '2' }]);
      const b = vc.scopeHash([{ id: 'y', hash: '2' }, { id: 'x', hash: '1' }]);
      assert.equal(a, b);
      assert.match(a, /^[0-9a-f]{16}$/);
      assert.notEqual(a, vc.scopeHash([{ id: 'x', hash: '1' }, { id: 'y', hash: '3' }]));
      const fromMap = vc.scopeHash({ y: { hash: '2' }, x: { hash: '1' } });
      assert.equal(fromMap, a);
    });

    t('save writes no .tmp leftover', () => {
      vc.save(file, threeRows(), 'm1', '1');
      const names = fs.readdirSync(path.dirname(file));
      assert.deepEqual(names.filter((n) => n.indexOf('.tmp') !== -1), []);
    });

    t('a corrupt JSON file loads as {} with dropped 0', () => {
      fs.writeFileSync(file, '{ not json', 'utf8');
      assert.deepEqual(vc.load(file, EXPECT), { cache: {}, dropped: 0 });
    });

    t('a missing file loads as {} and save to an unwritable path returns false', () => {
      assert.deepEqual(vc.load(path.join(tmp, 'nope.json'), EXPECT), { cache: {}, dropped: 0 });
      const blocked = path.join(file, 'child.json'); // file is not a directory
      assert.equal(vc.save(blocked, {}, 'm1', '1'), false);
    });

    t('SAVE_EVERY_BATCHES is exported and equals 8', () => {
      assert.equal(vc.SAVE_EVERY_BATCHES, 8);
    });

    // DRAIN_INTEGRATION_BELOW (Plan 04 adds the drain wiring assertions here)
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

main();
