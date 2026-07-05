'use strict';
/*
 * Phase 211-02 offline contract tests for the tri-modal room index.
 *
 * All tests run OFFLINE and DETERMINISTIC:
 *   - a temp fixture db (tmp dir, minimal nodes table, 6 fixture nodes across
 *     2 domains + 1 unparseable-props node) is created per test group;
 *   - a deterministic stub encoder (opts.encodeFn) replaces the real model, so
 *     NO model download and NO network egress ever happens;
 *   - the plain test handle is constructed WITHOUT allowExtension, so the vector
 *     leg always exercises the CJS cosine FALLBACK path (Test 5 asserts this).
 *
 * This file NEVER touches any real room/.mindrian/room.db.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const tri = require('../lib/core/eureka/tri-modal-index.cjs');
// hybrid-retrieve is required lazily inside hybridTests (Task 2) so the Task 1
// suite runs before that module exists.

// ---------- Deterministic stub encoder (offline, no model) ----------
//
// Maps each text to a fixed-length 16-dim vector by char-bucket counting, then
// L2-normalizes. Same text -> same vector, so the query vector for a node can be
// reproduced exactly and cosine self-similarity is 1 (Test 3 anchor).

function stubEncode(texts) {
  return texts.map(function (t) {
    const v = new Array(16).fill(0);
    const s = String(t);
    for (let i = 0; i < s.length; i += 1) {
      v[s.charCodeAt(i) % 16] += 1;
    }
    let norm = Math.sqrt(v.reduce(function (a, x) { return a + x * x; }, 0));
    if (norm === 0) norm = 1;
    return v.map(function (x) { return x / norm; });
  });
}

// ---------- Fixture db ----------

function makeFixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-211-'));
  const dbPath = path.join(dir, 'room.db');
  const db = new DatabaseSync(dbPath); // NO allowExtension -> forces cjs-fallback
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  // domain "sleep-science"
  ins.run('n1', 'Artifact', JSON.stringify({ title: 'circadian rhythm optimization', section: 'sleep-science' }));
  ins.run('n2', 'Artifact', JSON.stringify({ title: 'melatonin dosing protocol', section: 'sleep-science' }));
  ins.run('n3', 'Section', JSON.stringify({ name: 'sleep science', label: 'SLEEP SCIENCE' }));
  // domain "manufacturing"
  ins.run('n4', 'Artifact', JSON.stringify({ title: 'manufacturing shift scheduling', section: 'operations' }));
  ins.run('n5', 'Artifact', JSON.stringify({ title: 'worker fatigue mitigation', section: 'operations' }));
  ins.run('n6', 'Section', JSON.stringify({ name: 'operations', label: 'OPERATIONS' }));
  // unparseable / empty props -> must be skipped, never crash indexNodes
  ins.run('n7', 'Artifact', 'not-json-at-all');
  ins.run('n8', 'Artifact', JSON.stringify({ section: 'operations' })); // no name/text/title
  return { db: db, dir: dir, dbPath: dbPath };
}

function cleanup(fixture) {
  try { fixture.db.close(); } catch (_) { /* ignore */ }
  try { fs.rmSync(fixture.dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// ---------- Tiny test runner ----------

let PASS = 0;
let FAIL = 0;
const FAILURES = [];

async function test(name, fn) {
  try {
    await fn();
    PASS += 1;
    console.log('  PASS: ' + name);
  } catch (err) {
    FAIL += 1;
    FAILURES.push({ name: name, err: err });
    console.log('  FAIL: ' + name + ' -- ' + (err && err.message));
  }
}

async function main() {
  console.log('Phase 211-02 tri-modal + hybrid retrieve (offline)');

  // ----- Test 4 (nodeText) : pure text, defensive parse -----
  await test('Test 4: nodeText extracts core text, skips unparseable', function () {
    assert.strictEqual(tri.nodeText({ type: 'domain', properties: '{"name":"cmd:grade"}' }), 'cmd:grade');
    assert.strictEqual(tri.nodeText({ type: 'Artifact', properties: 'not-json' }), '');
    assert.strictEqual(tri.nodeText({ type: 'Artifact', properties: '{"section":"x"}' }), '');
    assert.strictEqual(tri.nodeText({ type: 'Artifact', properties: '{"title":"Lean Canvas"}' }), 'Lean Canvas');
    assert.strictEqual(tri.nodeText(null), '');
  });

  // ----- Test 1 (indexNodes idempotent) -----
  await test('Test 1: indexNodes populates one row per non-empty node, idempotent', async function () {
    const f = makeFixtureDb();
    try {
      const r1 = await tri.indexNodes(f.db, { encodeFn: stubEncode });
      assert.strictEqual(r1.indexed, 6, 'should index 6 non-empty-text nodes (n7/n8 skipped)');
      const ftsCount1 = f.db.prepare('SELECT count(*) c FROM eureka_fts').get().c;
      const vecCount1 = f.db.prepare('SELECT count(*) c FROM eureka_vec_fallback').get().c;
      assert.strictEqual(ftsCount1, 6, 'fts rows');
      assert.strictEqual(vecCount1, 6, 'vec fallback rows');
      // run again -> no duplication
      await tri.indexNodes(f.db, { encodeFn: stubEncode });
      const ftsCount2 = f.db.prepare('SELECT count(*) c FROM eureka_fts').get().c;
      const vecCount2 = f.db.prepare('SELECT count(*) c FROM eureka_vec_fallback').get().c;
      assert.strictEqual(ftsCount2, 6, 'fts rows still 6 after reindex');
      assert.strictEqual(vecCount2, 6, 'vec rows still 6 after reindex');
    } finally {
      cleanup(f);
    }
  });

  // ----- Test 2 (lexicalSearch bm25 + stopword-only) -----
  await test('Test 2: lexicalSearch ranks the token holder first; stopword-only -> []', async function () {
    const f = makeFixtureDb();
    try {
      await tri.indexNodes(f.db, { encodeFn: stubEncode });
      const hits = tri.lexicalSearch(f.db, 'circadian', 5);
      assert.ok(hits.length >= 1, 'at least one hit for circadian');
      assert.strictEqual(hits[0].node_id, 'n1', 'circadian node ranked first');
      const none = tri.lexicalSearch(f.db, 'the of and', 5);
      assert.deepStrictEqual(none, [], 'stopword-only query returns []');
      // raw punctuation must never throw
      const punct = tri.lexicalSearch(f.db, '"; DROP TABLE nodes; --', 5);
      assert.ok(Array.isArray(punct), 'punctuation query returns an array, no throw');
    } finally {
      cleanup(f);
    }
  });

  // ----- Test 3 (vectorSearch cosine on FALLBACK path) -----
  await test('Test 3: vectorSearch ranks by cosine desc on the cjs-fallback path', async function () {
    const f = makeFixtureDb();
    try {
      await tri.indexNodes(f.db, { encodeFn: stubEncode });
      // reproduce n4's indexed vector exactly: indexed text = type + ' ' + nodeText
      const n4 = f.db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get('n4');
      const n4Text = String(n4.type) + ' ' + tri.nodeText(n4);
      const queryVec = stubEncode([n4Text])[0];
      const hits = tri.vectorSearch(f.db, queryVec, 5);
      assert.ok(hits.length >= 1, 'vector hits returned');
      assert.strictEqual(hits[0].node_id, 'n4', 'exact-vector node ranks first');
      // descending score order
      for (let i = 1; i < hits.length; i += 1) {
        assert.ok(hits[i - 1].score >= hits[i].score, 'scores descending');
      }
    } finally {
      cleanup(f);
    }
  });

  // ----- Test 5 (backend reporting: cjs-fallback on a plain handle) -----
  await test('Test 5: openIndex reports cjs-fallback when the handle cannot load sqlite-vec', async function () {
    const f = makeFixtureDb();
    try {
      const info = tri.openIndex(f.db);
      assert.strictEqual(info.vec_backend, 'cjs-fallback', 'plain handle degrades to cjs cosine');
      // fallback table exists, primary vec table does not
      const hasFallback = f.db.prepare("SELECT name FROM sqlite_master WHERE name='eureka_vec_fallback'").get();
      assert.ok(hasFallback, 'fallback table created');
    } finally {
      cleanup(f);
    }
  });

  // ===== Task 2 tests (hybrid retrieve) appended below =====
  await hybridTests({ makeFixtureDb: makeFixtureDb, cleanup: cleanup, stubEncode: stubEncode, test: test, tri: tri });

  console.log('\nTri-modal: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }
  process.exit(0);
}

// Task 2: hybrid retrieve (RRF fusion + FlashRank-model rerank). Requires
// hybrid-retrieve lazily so Task 1 can run before that module exists.
async function hybridTests(ctx) {
  const hybrid = require('../lib/core/eureka/hybrid-retrieve.cjs');
  const { makeFixtureDb, cleanup, stubEncode, test, tri } = ctx;

  // ----- Test 6: rrfFuse ranking + exact formula + env clamp -----
  await test('Test 6: rrfFuse ranks the shared doc first, exact 1/(k+rank) formula, env clamp', function () {
    const fused = hybrid.rrfFuse([[{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]], 25);
    assert.strictEqual(fused[0].node_id, 'b', 'b (in both lists) ranks first');
    const expectedB = 1 / (25 + 2) + 1 / (25 + 1);
    assert.ok(Math.abs(fused[0].rrf_score - expectedB) < 1e-9, 'exact RRF score for b');
    const a = fused.find(function (r) { return r.node_id === 'a'; });
    assert.ok(Math.abs(a.rrf_score - 1 / (25 + 1)) < 1e-9, 'exact RRF score for a');
    // env clamp: invalid EUREKA_RRF_K falls back to 25
    const prev = process.env.EUREKA_RRF_K;
    process.env.EUREKA_RRF_K = 'not-a-number';
    assert.strictEqual(hybrid._test.resolveRrfK(), 25, 'invalid env clamps to 25');
    process.env.EUREKA_RRF_K = '40';
    assert.strictEqual(hybrid._test.resolveRrfK(), 40, 'valid env honored');
    if (prev === undefined) { delete process.env.EUREKA_RRF_K; } else { process.env.EUREKA_RRF_K = prev; }
  });

  // ----- Test 7: hybridRetrieve fuses both legs; degrades to lexical-only -----
  await test('Test 7: hybridRetrieve fuses lexical+vector; encoder-unavailable -> lexical-only warning', async function () {
    const f = makeFixtureDb();
    try {
      await tri.indexNodes(f.db, { encodeFn: stubEncode });
      const out = await hybrid.hybridRetrieve(f.db, 'circadian', { encodeFn: stubEncode, k: 3 });
      assert.ok(Array.isArray(out.results) && out.results.length >= 1, 'fused results returned');
      out.results.forEach(function (r) {
        assert.ok(typeof r.node_id === 'string', 'result has node_id');
        assert.ok(typeof r.rrf_score === 'number', 'result has rrf_score');
        assert.ok(Array.isArray(r.sources), 'result has sources array');
      });
      const n1 = out.results.find(function (r) { return r.node_id === 'n1'; });
      assert.ok(n1, 'n1 (the circadian node) is in the fused set');
      assert.ok(n1.sources.indexOf('lexical') !== -1 && n1.sources.indexOf('vector') !== -1,
        'n1 fused from both legs');
      assert.ok(!out.warning, 'no warning when both legs live');

      // degrade: encoder unavailable -> lexical-only, warning, never throws
      const deg = await hybrid.hybridRetrieve(f.db, 'circadian', { _forceUnavailable: true, k: 3 });
      assert.strictEqual(deg.warning, 'vector_leg_unavailable', 'degradation warning set');
      assert.ok(Array.isArray(deg.results) && deg.results.length >= 1, 'lexical results still returned');
      deg.results.forEach(function (r) {
        assert.deepStrictEqual(r.sources, ['lexical'], 'degraded results are lexical-only');
      });
    } finally {
      cleanup(f);
    }
  });

  // ----- Test 8: rerank reorders by stub; unavailable -> unchanged + warning -----
  await test('Test 8: rerank reorders by rerankFn; model-unavailable returns input order with warning', async function () {
    const candidates = [
      { node_id: 'x', text: 'a distant unrelated candidate' },
      { node_id: 'y', text: 'the exact relevant answer' },
    ];
    const stubRerank = function (query, cands) {
      return cands.map(function (c) { return c.text.indexOf('relevant') !== -1 ? 0.95 : 0.05; });
    };
    const ranked = await hybrid.rerank('the relevant question', candidates, { rerankFn: stubRerank });
    assert.strictEqual(ranked.results[0].node_id, 'y', 'higher-scored candidate first');
    assert.ok(typeof ranked.results[0].rerank_score === 'number', 'rerank_score attached');
    assert.ok(!ranked.warning, 'no warning on the injection path');

    // no rerankFn + transformers not installed -> unchanged order + warning
    const un = await hybrid.rerank('q', candidates, {});
    assert.strictEqual(un.warning, 'rerank_unavailable', 'rerank_unavailable warning');
    assert.strictEqual(un.results[0].node_id, 'x', 'input order preserved on failure');
    assert.strictEqual(un.results[1].node_id, 'y', 'input order preserved on failure');
  });
}

main();
