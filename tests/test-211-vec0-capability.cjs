'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * quick(260706-5b7) offline contract for the vec0 capability probe (Blocker 2
 * of Phase 212).
 *
 * Backend selection is PROBE-BASED, never table-existence-based. A room.db
 * carrying a stale eureka_vec virtual table (persisted by a prior vec0-capable
 * run) must NOT poison the next process where vec0 is unregistered: the old
 * createVecTable short-circuited on tableExists(eureka_vec) and returned
 * 'sqlite-vec', then the first prepared statement naming eureka_vec threw
 * 'no such module: vec0' and killed indexing. The fix degrades to cjs-fallback.
 *
 * DETERMINISTIC POISON FIXTURE (plantStaleVec): the exact production poison is a
 * vec0 schema row present while the extension is NOT registered in this process.
 * We plant that row directly via PRAGMA writable_schema (verified on Node
 * v22.22.2: after planting, tableExists sees eureka_vec and ANY prepared
 * statement naming it throws 'no such module: vec0'). That makes the fixture a
 * TRIPWIRE: if any code path under test issues vec0 SQL, this test fails loudly,
 * so a GREEN run objectively proves the fallback path never touches eureka_vec.
 *
 * All tests are fully offline and deterministic: in-memory node:sqlite, no
 * model, no network, no real room.db. Every backend assertion goes through the
 * forced seam (opts._forceVec0Unavailable or env MINDRIAN_FORCE_NO_VEC0); we
 * assert NOTHING about un-forced real-probe outcomes because those are
 * environment-dependent (this machine loads vec0 on allowExtension handles; CI
 * or other platforms may not).
 */

const assert = require('node:assert');
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

// Plain in-memory handle (no allowExtension) -> a real probe would fail here.
function makeDb() {
  return new DatabaseSync(':memory:');
}

// plantStaleVec: plant the exact production poison -- a vec0 schema row without
// the extension registered. Three statements: enable writable_schema, INSERT the
// real vec0 DDL row into sqlite_master, reset. After this, tableExists sees
// eureka_vec and ANY query naming it throws 'no such module: vec0'.
function plantStaleVec(db, dim) {
  db.exec('PRAGMA writable_schema=ON');
  db.exec(
    "INSERT INTO sqlite_master(type,name,tbl_name,rootpage,sql) VALUES ("
    + "'table','eureka_vec','eureka_vec',0,"
    + "'CREATE VIRTUAL TABLE eureka_vec USING vec0(node_id TEXT, embedding float[" + dim + "])')"
  );
  db.exec('PRAGMA writable_schema=RESET');
}

// Deterministic n-dim encoder: a stable vector from the text's char codes so the
// same text reproduces the same vector (cosine self-similarity 1).
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
  console.log('quick(260706-5b7) vec0 capability probe (offline, stale-vec0 poison)');

  // ----- T1: a stale eureka_vec table cannot poison backend selection -----
  await test('T1: stale eureka_vec degrades to cjs-fallback (envelope shape preserved)', function () {
    vec._test.resetVecProbe();
    const db = makeDb();
    plantStaleVec(db, 8);
    assert.ok(vec._test.tableExists(db, 'eureka_vec'), 'stale eureka_vec is present');

    const store = vec.ensureStore(db, 8, { _forceVec0Unavailable: true });
    assert.strictEqual(store.backend, 'cjs-fallback', 'stale table does not select sqlite-vec');
    assert.strictEqual(store.dim, 8, 'envelope reports the requested dim');
    assert.ok(vec._test.tableExists(db, 'eureka_vec_fallback'), 'fallback table created');
    db.close();
  });

  // ----- T2: fallback queries succeed alongside the tripwire poison -----
  await test('T2: insert/knn/delete succeed on the fallback with the poison present (no throw)', function () {
    vec._test.resetVecProbe();
    const db = makeDb();
    plantStaleVec(db, 8);
    vec.ensureStore(db, 8, { _forceVec0Unavailable: true });

    // three deterministic 8-dim vectors; query is a near-copy of 'b'.
    const a = [1, 0, 0, 0, 0, 0, 0, 0];
    const b = [0, 1, 0, 0, 0, 0, 0, 0];
    const c = [0, 0, 1, 0, 0, 0, 0, 0];
    vec.insertVector(db, 'a', a);
    vec.insertVector(db, 'b', b);
    vec.insertVector(db, 'c', c);

    const hits = vec.knnQuery(db, [0, 0.95, 0.05, 0, 0, 0, 0, 0], 3);
    assert.strictEqual(hits.length, 3, 'three hits from the fallback scan');
    assert.strictEqual(hits[0].node_id, 'b', 'nearest (b) ranked first');
    for (let i = 1; i < hits.length; i += 1) {
      assert.ok(hits[i - 1].score >= hits[i].score, 'scores descending');
    }

    vec.deleteVector(db, 'a');
    const remaining = db.prepare('SELECT count(*) c FROM eureka_vec_fallback').get().c;
    assert.strictEqual(remaining, 2, 'deleteVector removed exactly one row');
    db.close();
  });

  // ----- T3: the probe verdict is computed at most once per process -----
  await test('T3: probe verdict cached once per process (computations === 1)', function () {
    vec._test.resetVecProbe();
    const db1 = makeDb();
    const db2 = makeDb();
    plantStaleVec(db1, 8);
    plantStaleVec(db2, 8);

    vec.ensureStore(db1, 8, { _forceVec0Unavailable: true });
    vec.ensureStore(db2, 8, { _forceVec0Unavailable: true });

    const probe = vec._test.vecProbe();
    assert.strictEqual(probe.computations, 1, 'verdict computed exactly once across two dbs');
    assert.ok(probe.verdict, 'verdict recorded');
    assert.strictEqual(probe.verdict.ok, false, 'verdict is a fail');
    assert.strictEqual(probe.verdict.detail, 'forced_unavailable', 'detail is forced_unavailable');
    db1.close();
    db2.close();
  });

  // ----- T4: end-to-end through tri-modal via the env seam -----
  await test('T4: indexNodes degrades to cjs-fallback offline (no such module: vec0 does not escape)', async function () {
    process.env.MINDRIAN_FORCE_NO_VEC0 = '1';
    vec._test.resetVecProbe();
    try {
      const db = makeNodesDb();
      plantStaleVec(db, 8);
      const enc = encoderOfDim(8);

      // The pre-fix code REJECTS here with 'no such module: vec0'; the fix must
      // resolve on the cjs-fallback backend.
      const r = await tri.indexNodes(db, { encodeFn: enc });
      assert.strictEqual(r.embedded, true, 'nodes embedded on the fallback');
      assert.strictEqual(r.vec_backend, 'cjs-fallback', 'backend degraded to cjs-fallback');

      const n1 = db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get('n1');
      const n1Text = String(n1.type) + ' ' + tri.nodeText(n1);
      const queryVec = enc([n1Text])[0];
      const hits = tri.vectorSearch(db, queryVec, 3);
      assert.ok(hits.length >= 1, 'vectorSearch returns a non-empty ranked list');
      assert.strictEqual(hits[0].node_id, 'n1', 'exact-vector node ranks first');
      db.close();
    } finally {
      // Later tests and the aggregator's other legs must NOT inherit the forced env.
      delete process.env.MINDRIAN_FORCE_NO_VEC0;
      vec._test.resetVecProbe();
    }
  });

  // ----- T5: defensive no-throw contract without ensureStore -----
  await test('T5: currentBackend null + insert/delete/knn no-op on a poisoned db with no store', function () {
    vec._test.resetVecProbe();
    const db = makeDb();
    plantStaleVec(db, 8); // ONLY the stale vec table; no fallback table, no ensureStore.

    // A forced-fail probe on this plain handle; the handle is never registered.
    const loaded = vec._test.ensureVecLoaded(db, { _forceVec0Unavailable: true });
    assert.strictEqual(loaded.ok, false, 'forced probe fails on the plain handle');

    // currentBackend is READ-ONLY and honest: eureka_vec is unregistered, no
    // fallback table exists -> null (a defensive no-op, not an escaped throw).
    assert.strictEqual(vec._test.currentBackend(db), null, 'currentBackend returns null');

    // insert/delete no-op (backend null) and knnQuery returns [] -- none throw
    // (the tripwire fixture guarantees any vec0 SQL would have thrown).
    vec.insertVector(db, 'x', [1, 0, 0, 0, 0, 0, 0, 0]);
    vec.deleteVector(db, 'x');
    const hits = vec.knnQuery(db, [1, 0, 0, 0, 0, 0, 0, 0], 3);
    assert.deepStrictEqual(hits, [], 'knnQuery returns [] with no fallback table');
    db.close();
  });

  console.log('\nvec0-capability: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }
  process.exit(0);
}

main();
