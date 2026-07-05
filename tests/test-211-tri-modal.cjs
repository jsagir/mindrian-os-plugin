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

// Placeholder; real hybrid tests are wired in Task 2. Defined here so the RED
// run for Task 1 exercises only Tests 1-5.
async function hybridTests() { /* Task 2 fills this in */ }

main();
