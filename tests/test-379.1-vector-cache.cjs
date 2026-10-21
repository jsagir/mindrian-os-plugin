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

async function ta(label, fn) {
  try {
    await fn();
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

async function main() {
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

    // ---- Plan 04 Task 1: classifier helpers (attachVectors, candidates, provenance) ----
    const classifier = require('../lib/core/graph-derive-classifier.cjs');
    const { scoreMeasured } = require('../lib/core/rs-differential-scorer.cjs');
    const { buildFixtureRoom224 } = require('./helpers/fixture-room-224.cjs');

    // A deterministic 4-dim unit vector from the first character of the text.
    function unitFromText(text) {
      const c = (String(text).charCodeAt(0) || 0) % 4;
      const v = [0, 0, 0, 0];
      v[c] = 1;
      return v;
    }
    function countingEmbed(counter) {
      return async (texts) => {
        counter.texts += texts.length;
        counter.batches += 1;
        return { success: true, vectors: texts.map(unitFromText) };
      };
    }

    await ta('scoreMeasured provenance with and without vectorsProvenance', async () => {
      const withProv = await scoreMeasured('a', 'b', {
        vectors: [[1, 0], [0, 1]], vectorsProvenance: { model: 'm1', dtype: 'cached' },
      });
      assert.equal(withProv.provenance.semantic_model, 'm1');
      assert.equal(withProv.provenance.semantic_dtype, 'cached');
      const without = await scoreMeasured('a', 'b', { vectors: [[1, 0], [0, 1]] });
      assert.equal(without.provenance.semantic_model, 'precomputed');
      assert.equal(without.provenance.semantic_dtype, 'precomputed');
    });

    await ta('buildAllPairs limit and countAllPairs on an 8-artifact room', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-room8-'));
      try {
        const fx = await buildFixtureRoom224(dir, { artifactCount: 8 });
        assert.equal(classifier.buildAllPairs(fx.roomDir, { limit: 3 }).length, 3);
        assert.equal(classifier.buildAllPairs(fx.roomDir).length, 28);
        assert.equal(classifier.countAllPairs(fx.roomDir), 28);
        const ws = classifier.enumerateArtifactsWithScope(fx.roomDir);
        assert.equal(ws.artifacts.length, 8);
        assert.ok(ws.scope && ws.scope.stats, 'scope carries stats');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    await ta('attachVectors embeds 8 texts once, a second pass embeds 0, one edited file embeds 1', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-attach-'));
      try {
        const fx = await buildFixtureRoom224(dir, { artifactCount: 8 });
        const counter = { texts: 0, batches: 0 };
        const embedFn = countingEmbed(counter);
        let arts = classifier.enumerateArtifactsWithScope(fx.roomDir).artifacts;
        const r1 = await classifier.attachVectors(fx.roomDir, arts, { embedFn });
        assert.equal(counter.texts, 8);
        assert.equal(r1.embedded, 8);
        assert.equal(r1.hits, 0);
        assert.equal(r1.ready, 8);
        assert.equal(r1.misses_left, 0);
        assert.equal(r1.encoderUnavailable, false);
        arts = classifier.enumerateArtifactsWithScope(fx.roomDir).artifacts;
        const r2 = await classifier.attachVectors(fx.roomDir, arts, { embedFn });
        assert.equal(counter.texts, 8, 'a second pass embeds nothing');
        assert.equal(r2.hits, 8);
        assert.equal(r2.embedded, 0);
        fs.appendFileSync(fx.allFiles[3], 'one more sentence so the content hash changes\n');
        arts = classifier.enumerateArtifactsWithScope(fx.roomDir).artifacts;
        const r3 = await classifier.attachVectors(fx.roomDir, arts, { embedFn });
        assert.equal(counter.texts, 9, 'one edited file embeds one text');
        assert.equal(r3.embedded, 1);
        const raw = JSON.parse(fs.readFileSync(path.join(fx.roomDir, '.mindrian', 'graph-derive-vectors.json'), 'utf8'));
        const ids = Object.keys(raw.embeddings);
        assert.equal(ids.length, 8);
        for (const id of ids) {
          assert.match(raw.embeddings[id].hash, /^[0-9a-f]{16}$/);
          assert.equal(typeof raw.embeddings[id].model, 'string');
          assert.ok(raw.embeddings[id].model.length > 0);
        }
        assert.equal(raw.model, r3.model);
        // The classifier seam names the model.
        const pair = { a: arts[0], b: arts[1] };
        let seen = null;
        await classifier.scoreBasedDeriveFn({ roomDir: fx.roomDir, artifactPair: pair }, {
          scoreFn: async (x, y, o) => { seen = o; return { semantic: 0.1 }; },
        });
        assert.deepEqual(seen.vectorsProvenance, { model: r3.model, dtype: 'cached' });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    await ta('save cadence: 40 artifacts, batch size 4 -> 2 saves (after batch 8, at the end), not 10', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-cadence-'));
      const prevBatch = process.env.MINDRIAN_EMBED_BATCH;
      process.env.MINDRIAN_EMBED_BATCH = '4';
      const realSave = vc.save;
      let spySaves = 0;
      vc.save = function spy() { spySaves += 1; return realSave.apply(this, arguments); };
      try {
        const arts = [];
        for (let i = 0; i < 40; i += 1) {
          arts.push({ id: 'syn/a' + String(i).padStart(2, '0'), path: '', text: 'text number ' + i, mtimeMs: i });
        }
        const counter = { texts: 0, batches: 0 };
        const r = await classifier.attachVectors(dir, arts, {
          embedFn: countingEmbed(counter), cacheFile: path.join(dir, 'cache.json'),
        });
        assert.equal(counter.batches, 10);
        assert.equal(r.embedded, 40);
        assert.equal(r.saves, 2, 'result.saves');
        assert.equal(spySaves, 2, 'spy on vector-cache save');
        console.log('    measured saves on the 40-artifact cadence test: ' + r.saves);
      } finally {
        vc.save = realSave;
        if (prevBatch === undefined) delete process.env.MINDRIAN_EMBED_BATCH; else process.env.MINDRIAN_EMBED_BATCH = prevBatch;
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    await ta('a failing batch saves what was embedded and reports encoderUnavailable', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-fail-'));
      const prevBatch = process.env.MINDRIAN_EMBED_BATCH;
      process.env.MINDRIAN_EMBED_BATCH = '4';
      try {
        const arts = [];
        for (let i = 0; i < 12; i += 1) arts.push({ id: 'syn/b' + i, path: '', text: 'x' + i, mtimeMs: i });
        let calls = 0;
        const embedFn = async (texts) => {
          calls += 1;
          if (calls === 3) return { success: false };
          return { success: true, vectors: texts.map(unitFromText) };
        };
        const file = path.join(dir, 'c.json');
        const r = await classifier.attachVectors(dir, arts, { embedFn, cacheFile: file });
        assert.equal(r.encoderUnavailable, true);
        assert.equal(r.embedded, 8);
        assert.equal(r.misses_left, 4);
        assert.equal(r.saves, 1);
        assert.equal(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).embeddings).length, 8);
      } finally {
        if (prevBatch === undefined) delete process.env.MINDRIAN_EMBED_BATCH; else process.env.MINDRIAN_EMBED_BATCH = prevBatch;
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    t('buildCandidatePairs: deadline inside the loop, and the N x k bound', () => {
      let seed = 7;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
      const arts = [];
      for (let i = 0; i < 200; i += 1) {
        arts.push({ id: 'v/' + String(i).padStart(3, '0'), text: 't' + i, mtimeMs: i, vector: [rnd(), rnd(), rnd(), rnd()] });
      }
      const t0 = Date.now();
      const late = classifier.buildCandidatePairs(arts, { k: 5, floor: 0.1, deadlineMs: Date.now() - 1 });
      assert.equal(late.deadline_hit, true);
      assert.deepEqual(late.pairs, []);
      assert.ok(Date.now() - t0 < 100, 'deadline returns fast');
      const ok = classifier.buildCandidatePairs(arts, { k: 5, floor: 0.1, deadlineMs: Date.now() + 60000 });
      assert.equal(ok.deadline_hit, false);
      assert.ok(ok.total <= 1000, 'at most N x k: ' + ok.total);
      assert.equal(ok.allPairs, 19900);
      assert.equal(ok.pruned, 19900 - ok.total);
      // sorted by (i, j) and a is older (mtime ascending)
      for (const p of ok.pairs) assert.ok(p.a.mtimeMs <= p.b.mtimeMs);
      // 300 synthetic artifacts, k = 10: at most 3000 pairs, pruned = 44850 - total
      const big = [];
      for (let i = 0; i < 300; i += 1) {
        big.push({ id: 'w/' + String(i).padStart(3, '0'), text: 'u' + i, mtimeMs: i, vector: [rnd(), rnd(), rnd(), rnd()] });
      }
      const r300 = classifier.buildCandidatePairs(big, { k: 10, floor: 0.1 });
      assert.ok(r300.total <= 3000, 'N x k bound: ' + r300.total);
      assert.equal(r300.pruned, 44850 - r300.total);
    });

    t('DEFAULT_PRUNE_K equals chosen_k in probe-k.json; resolvers read env', () => {
      const probe = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '379.1', 'probe-k.json'), 'utf8'));
      assert.equal(classifier.DEFAULT_PRUNE_K, probe.chosen_k);
      assert.equal(classifier.DEFAULT_MAX_PAIRS_PER_ENTRY, 50000);
      const keep = { k: process.env.MINDRIAN_DERIVE_PRUNE_K, m: process.env.MINDRIAN_DERIVE_MAX_PAIRS_PER_ENTRY };
      try {
        process.env.MINDRIAN_DERIVE_PRUNE_K = '7';
        process.env.MINDRIAN_DERIVE_MAX_PAIRS_PER_ENTRY = '9';
        assert.equal(classifier.resolvePruneK(), 7);
        assert.equal(classifier.resolveMaxPairsPerEntry(), 9);
        process.env.MINDRIAN_DERIVE_PRUNE_K = '0';
        process.env.MINDRIAN_DERIVE_MAX_PAIRS_PER_ENTRY = 'abc';
        assert.equal(classifier.resolvePruneK(), classifier.DEFAULT_PRUNE_K);
        assert.equal(classifier.resolveMaxPairsPerEntry(), 50000);
      } finally {
        for (const [name, v] of [['MINDRIAN_DERIVE_PRUNE_K', keep.k], ['MINDRIAN_DERIVE_MAX_PAIRS_PER_ENTRY', keep.m]]) {
          if (v === undefined) delete process.env[name]; else process.env[name] = v;
        }
      }
    });

    // DRAIN_INTEGRATION_BELOW (Plan 04 Task 2 adds the drain wiring assertions here)
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack ? e.stack : e)); process.exit(1); });
