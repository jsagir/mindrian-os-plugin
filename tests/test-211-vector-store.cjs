'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * quick(260706-13z) offline contract tests for the D1 vector-store adapter.
 *
 * All tests run OFFLINE and DETERMINISTIC on an in-memory node:sqlite handle
 * built WITHOUT allowExtension, so the adapter always exercises the cjs-fallback
 * backend (the deterministic CI path). No model, no network, no real room.db.
 *
 * Covers:
 *   T1  ensureStore creates eureka_meta + the fallback table at the requested
 *       dim; insert/knn round-trip ranks the nearest vector first.
 *   T2  deleteVector removes exactly one row.
 *   T3  the dim-rebuild contract: ensureStore(16) then ensureStore(24) rebuilds
 *       empty at 24 and eureka_meta reads 24.
 *   T4  the re-embed-on-swap proof at the tri-modal level: indexNodes at 16-dim
 *       then 24-dim does not throw, vectorSearch works against the 24-dim space,
 *       and readMeta reports dim 24 + model 'stub'.
 *   T5  seam guard: tri-modal-index.cjs no longer owns the vec DDL (no float[
 *       table, no literal 384).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const vec = require('../lib/core/eureka/vector-store.cjs');
const tri = require('../lib/core/eureka/tri-modal-index.cjs');

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

// Plain in-memory handle -> forces the cjs-fallback backend.
function makeDb() {
  return new DatabaseSync(':memory:');
}

// Deterministic n-dim encoder: one-hot-ish vector from the text's char codes so
// the same text reproduces the same vector (cosine self-similarity 1).
function encoderOfDim(n) {
  return function encode(texts) {
    return texts.map(function (t) {
      const v = new Array(n).fill(0);
      const s = String(t);
      for (let i = 0; i < s.length; i += 1) v[s.charCodeAt(i) % n] += 1;
      let norm = Math.sqrt(v.reduce(function (a, x) { return a + x * x; }, 0));
      if (norm === 0) norm = 1;
      return v.map(function (x) { return x / norm; });
    });
  };
}

function makeNodesDb() {
  const db = makeDb();
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  ins.run('n1', 'Artifact', JSON.stringify({ title: 'circadian rhythm optimization' }));
  ins.run('n2', 'Artifact', JSON.stringify({ title: 'melatonin dosing protocol' }));
  ins.run('n3', 'Artifact', JSON.stringify({ title: 'manufacturing shift scheduling' }));
  return db;
}

async function main() {
  console.log('quick(260706-13z) vector-store adapter (offline, cjs-fallback)');

  // ----- T1: ensureStore + insert/knn round-trip -----
  await test('T1: ensureStore creates meta+fallback at dim; knn ranks nearest first', function () {
    const db = makeDb();
    const store = vec.ensureStore(db, 4);
    assert.strictEqual(store.backend, 'cjs-fallback', 'plain handle -> cjs-fallback');
    assert.strictEqual(store.dim, 4, 'store reports requested dim');
    // meta + fallback table exist
    assert.ok(vec._test.tableExists(db, 'eureka_meta'), 'eureka_meta created');
    assert.ok(vec._test.tableExists(db, 'eureka_vec_fallback'), 'fallback table created');
    assert.strictEqual(vec.readMeta(db).embedding_dim, 4, 'meta records dim 4');

    // three hand-built 4-dim vectors; query is closest to b.
    vec.insertVector(db, 'a', [1, 0, 0, 0]);
    vec.insertVector(db, 'b', [0, 1, 0, 0]);
    vec.insertVector(db, 'c', [0, 0, 1, 0]);
    const hits = vec.knnQuery(db, [0, 0.9, 0.1, 0], 3);
    assert.strictEqual(hits.length, 3, 'three hits');
    assert.strictEqual(hits[0].node_id, 'b', 'nearest (b) ranked first');
    for (let i = 1; i < hits.length; i += 1) {
      assert.ok(hits[i - 1].score >= hits[i].score, 'scores descending');
    }
    db.close();
  });

  // ----- T2: deleteVector removes exactly one row -----
  await test('T2: deleteVector removes exactly one row', function () {
    const db = makeDb();
    vec.ensureStore(db, 4);
    vec.insertVector(db, 'a', [1, 0, 0, 0]);
    vec.insertVector(db, 'b', [0, 1, 0, 0]);
    const before = db.prepare('SELECT count(*) c FROM eureka_vec_fallback').get().c;
    assert.strictEqual(before, 2, 'two rows before delete');
    vec.deleteVector(db, 'a');
    const after = db.prepare('SELECT count(*) c FROM eureka_vec_fallback').get().c;
    assert.strictEqual(after, 1, 'exactly one row removed');
    const remaining = db.prepare('SELECT node_id FROM eureka_vec_fallback').get().node_id;
    assert.strictEqual(remaining, 'b', 'the right row survived');
    db.close();
  });

  // ----- T3: the dim-rebuild contract -----
  await test('T3: ensureStore(16) then ensureStore(24) rebuilds empty at 24; meta reads 24', function () {
    const db = makeDb();
    vec.ensureStore(db, 16);
    vec.insertVector(db, 'x', new Array(16).fill(0.25));
    assert.strictEqual(db.prepare('SELECT count(*) c FROM eureka_vec_fallback').get().c, 1, 'one row at dim 16');
    assert.strictEqual(vec.readMeta(db).embedding_dim, 16, 'meta dim 16');

    const store = vec.ensureStore(db, 24);
    assert.strictEqual(store.dim, 24, 'store now reports 24');
    assert.strictEqual(vec.readMeta(db).embedding_dim, 24, 'meta rebuilt to 24');
    assert.strictEqual(
      db.prepare('SELECT count(*) c FROM eureka_vec_fallback').get().c, 0,
      'vec table rebuilt EMPTY at the new dim (re-embed, not migrate)'
    );
    db.close();
  });

  // ----- T4: re-embed-on-swap at the tri-modal level -----
  await test('T4: indexNodes 16-dim then 24-dim re-embeds; vectorSearch works, meta reads 24/stub', async function () {
    const db = makeNodesDb();
    const enc16 = encoderOfDim(16);
    const enc24 = encoderOfDim(24);

    const r1 = await tri.indexNodes(db, { encodeFn: enc16 });
    assert.strictEqual(r1.embedded, true, 'first index embedded');
    assert.strictEqual(vec.readMeta(db).embedding_dim, 16, 'meta dim 16 after first index');

    // swap to a 24-dim model: must not throw, must rebuild.
    const r2 = await tri.indexNodes(db, { encodeFn: enc24 });
    assert.strictEqual(r2.embedded, true, 'second index embedded');
    const meta = vec.readMeta(db);
    assert.strictEqual(meta.embedding_dim, 24, 'meta rebuilt to dim 24');
    assert.strictEqual(meta.embedding_model, 'stub', 'meta records the stub model (encodeFn provenance)');

    // vectorSearch against the 24-dim space returns the exact-vector node first.
    const n1 = db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get('n1');
    const n1Text = String(n1.type) + ' ' + tri.nodeText(n1);
    const queryVec = enc24([n1Text])[0];
    const hits = tri.vectorSearch(db, queryVec, 3);
    assert.ok(hits.length >= 1, 'hits returned against the 24-dim space');
    assert.strictEqual(hits[0].node_id, 'n1', 'exact-vector node ranks first at the new dim');
    db.close();
  });

  // ----- T5: seam guard (source-level) -----
  await test('T5: tri-modal-index.cjs no longer owns the vec DDL (no float[ table, no literal 384)', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'core', 'eureka', 'tri-modal-index.cjs'), 'utf8');
    assert.strictEqual(/float\[/.test(src), false, 'no float[ vec0 DDL in tri-modal-index');
    // strip comment lines, then assert no live 384 literal remains.
    const codeOnly = src.split('\n').filter(function (line) {
      return !/^\s*\*/.test(line) && !/^\s*\/\//.test(line);
    }).join('\n');
    assert.strictEqual(/\b384\b/.test(codeOnly), false, 'no live 384 literal in tri-modal-index code');
  });

  console.log('\nvector-store: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }
  process.exit(0);
}

main();
