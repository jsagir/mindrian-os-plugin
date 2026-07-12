'use strict';
/*
 * Phase 219-02 Task 1 -- FTS5 capability probe + bi-modal degrade (REQ-7 unblocker).
 *
 * LIVE FIELD FINDING (2026-07-13): the navigator's Windows machine ships a
 * node:sqlite build WITHOUT the FTS5 extension; the unconditional
 * CREATE VIRTUAL TABLE eureka_fts USING fts5 at tri-modal index open crashed
 * the eureka runner with "no such module: fts5". This test pins the fix
 * contract (the vec0 capability-probe discipline, quick 260706-5b7):
 *
 *   Test 1: probe forced absent (MINDRIAN_FORCE_FTS_ABSENT=1) -> index
 *           creation completes without throwing and SKIPS the eureka_fts DDL.
 *   Test 2: forced-absent retrieval is BI-MODAL: the vector leg contributes,
 *           the graph (nodes/edges substrate) stays intact and queryable, the
 *           lexical leg contributes ZERO; provenance reads
 *           fts_backend 'absent (bi-modal degrade)'.
 *   Test 3: probe-available default path is byte-identical tri-modal behavior
 *           with fts_backend 'fts5'. (When the WHOLE FILE runs under
 *           MINDRIAN_FORCE_FTS_ABSENT=1 this leg asserts the absent path stays
 *           consistent end to end instead -- the acceptance criterion that the
 *           file exits 0 under forced absence too.)
 *   Test 4: the probe itself NEVER throws -- a throwing CREATE VIRTUAL TABLE
 *           is caught and cached as { ok:false, detail }, computed at most
 *           once per process.
 *
 * All tests run OFFLINE and DETERMINISTIC: temp fixture db, deterministic stub
 * encoder (no model download, no network), plain handle (vector leg exercises
 * the CJS cosine fallback). This file NEVER touches any real room.db.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

// Hermeticity: flip transformers.js allowRemoteModels=false so nothing here
// can reach the network when run standalone.
require('./eureka-offline-preload.cjs');

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const tri = require('../lib/core/eureka/tri-modal-index.cjs');
const hybrid = require('../lib/core/eureka/hybrid-retrieve.cjs');

// Whether the OUTER invocation forced the probe absent (the acceptance
// criterion runs this whole file once bare and once under the env seam).
const ENV_FORCED_AT_START = typeof process.env.MINDRIAN_FORCE_FTS_ABSENT === 'string'
  && process.env.MINDRIAN_FORCE_FTS_ABSENT !== '';

const DEGRADE = 'absent (bi-modal degrade)';

// ---------- env seam helpers (save / set / restore per test) ----------

function setForced(on) {
  if (on) {
    process.env.MINDRIAN_FORCE_FTS_ABSENT = '1';
  } else {
    delete process.env.MINDRIAN_FORCE_FTS_ABSENT;
  }
}

function restoreEnv() {
  setForced(ENV_FORCED_AT_START);
}

// ---------- Deterministic stub encoder (offline, no model) ----------

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

// ---------- Fixture db (the 211 idiom: plain handle -> cjs-fallback vectors) ----------

function makeFixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-219-fts-'));
  const dbPath = path.join(dir, 'room.db');
  const db = new DatabaseSync(dbPath); // NO allowExtension -> cjs cosine fallback
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  ins.run('n1', 'Artifact', JSON.stringify({ title: 'circadian rhythm optimization', section: 'sleep-science' }));
  ins.run('n2', 'Artifact', JSON.stringify({ title: 'melatonin dosing protocol', section: 'sleep-science' }));
  ins.run('n3', 'Section', JSON.stringify({ name: 'sleep science', label: 'SLEEP SCIENCE' }));
  ins.run('n4', 'Artifact', JSON.stringify({ title: 'manufacturing shift scheduling', section: 'operations' }));
  ins.run('n5', 'Artifact', JSON.stringify({ title: 'worker fatigue mitigation', section: 'operations' }));
  ins.run('n6', 'Section', JSON.stringify({ name: 'operations', label: 'OPERATIONS' }));
  return { db: db, dir: dir, dbPath: dbPath };
}

function cleanup(fixture) {
  try { fixture.db.close(); } catch (_) { /* ignore */ }
  try { fs.rmSync(fixture.dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function hasTable(db, name) {
  const r = db.prepare('SELECT name FROM sqlite_master WHERE name = ?').get(name);
  return !!r;
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
  console.log('Phase 219-02 FTS5 capability probe + bi-modal degrade (offline)'
    + (ENV_FORCED_AT_START ? ' [outer env: forced absent]' : ''));

  // ----- Test 1: forced absent -> index creation completes, DDL skipped -----
  await test('Test 1: forced-absent openIndex/indexNodes never throw and skip the eureka_fts DDL', async function () {
    setForced(true);
    tri._test.resetFtsProbe();
    const f = makeFixtureDb();
    try {
      const info = tri.openIndex(f.db); // MUST NOT throw
      assert.strictEqual(info.fts_backend, DEGRADE, 'openIndex reports the degrade provenance');
      assert.ok(typeof info.vec_backend === 'string', 'vec_backend contract preserved');
      assert.strictEqual(hasTable(f.db, 'eureka_fts'), false, 'eureka_fts DDL skipped when absent');

      const r = await tri.indexNodes(f.db, { encodeFn: stubEncode }); // MUST NOT throw
      assert.strictEqual(r.indexed, 6, 'all 6 non-empty nodes still indexed (vector leg)');
      assert.strictEqual(r.fts_backend, DEGRADE, 'indexNodes reports the degrade provenance');
      assert.strictEqual(hasTable(f.db, 'eureka_fts'), false, 'still no eureka_fts after indexNodes');
      const vecCount = f.db.prepare('SELECT count(*) c FROM eureka_vec_fallback').get().c;
      assert.strictEqual(vecCount, 6, 'vector leg fully populated despite fts absence');
    } finally {
      cleanup(f);
      restoreEnv();
    }
  });

  // ----- Test 2: forced-absent retrieval is bi-modal (vector + graph; lexical zero) -----
  await test('Test 2: forced-absent retrieval degrades bi-modal with honest provenance', async function () {
    setForced(true);
    tri._test.resetFtsProbe();
    const f = makeFixtureDb();
    try {
      await tri.indexNodes(f.db, { encodeFn: stubEncode });

      // Lexical leg contributes ZERO.
      const lex = tri.lexicalSearch(f.db, 'circadian', 5);
      assert.deepStrictEqual(lex, [], 'lexical leg returns [] when fts is absent');

      // Vector leg contributes (reproduce n4's indexed vector exactly).
      const n4 = f.db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get('n4');
      const n4Text = String(n4.type) + ' ' + tri.nodeText(n4);
      const queryVec = stubEncode([n4Text])[0];
      const vhits = tri.vectorSearch(f.db, queryVec, 5);
      assert.ok(vhits.length >= 1, 'vector leg returns hits');
      assert.strictEqual(vhits[0].node_id, 'n4', 'vector leg ranks the exact-vector node first');

      // Graph leg (the structural substrate) stays intact and queryable.
      const nodeCount = f.db.prepare('SELECT count(*) c FROM nodes').get().c;
      assert.strictEqual(nodeCount, 6, 'graph substrate untouched by the degrade');

      // Fused retrieval: results flow, every source is the vector leg only.
      const out = await hybrid.hybridRetrieve(f.db, 'circadian rhythm optimization', { encodeFn: stubEncode, k: 3 });
      assert.ok(Array.isArray(out.results) && out.results.length >= 1, 'fused results still returned');
      out.results.forEach(function (r) {
        assert.deepStrictEqual(r.sources, ['vector'], 'every fused result is vector-sourced (lexical zero)');
      });

      // Honest provenance on the index open.
      const info = tri.openIndex(f.db);
      assert.strictEqual(info.fts_backend, DEGRADE, 'provenance string reads exactly: ' + DEGRADE);
    } finally {
      cleanup(f);
      restoreEnv();
    }
  });

  // ----- Test 3: default path (probe available) is unchanged tri-modal -----
  if (ENV_FORCED_AT_START) {
    await test('Test 3 (forced-absent variant): absent path is consistent end to end', async function () {
      tri._test.resetFtsProbe();
      const f = makeFixtureDb();
      try {
        const info = tri.openIndex(f.db);
        assert.strictEqual(info.fts_backend, DEGRADE, 'forced run stays honestly degraded');
        const r = await tri.indexNodes(f.db, { encodeFn: stubEncode });
        assert.strictEqual(r.fts_backend, DEGRADE, 'indexNodes provenance consistent');
        assert.deepStrictEqual(tri.lexicalSearch(f.db, 'circadian', 5), [], 'lexical stays empty');
      } finally {
        cleanup(f);
      }
    });
  } else {
    await test('Test 3: default path is byte-identical tri-modal with fts_backend fts5', async function () {
      setForced(false);
      tri._test.resetFtsProbe();
      const f = makeFixtureDb();
      try {
        const info = tri.openIndex(f.db);
        assert.strictEqual(info.fts_backend, 'fts5', 'probe-available path reports fts5');
        assert.ok(typeof info.vec_backend === 'string', 'vec_backend contract preserved');
        assert.strictEqual(hasTable(f.db, 'eureka_fts'), true, 'eureka_fts created as before');

        const r = await tri.indexNodes(f.db, { encodeFn: stubEncode });
        assert.strictEqual(r.indexed, 6, '6 nodes indexed');
        assert.strictEqual(r.fts_backend, 'fts5', 'indexNodes provenance reads fts5');
        const ftsCount = f.db.prepare('SELECT count(*) c FROM eureka_fts').get().c;
        assert.strictEqual(ftsCount, 6, 'lexical rows populated exactly as before');

        const hits = tri.lexicalSearch(f.db, 'circadian', 5);
        assert.ok(hits.length >= 1, 'lexical leg live');
        assert.strictEqual(hits[0].node_id, 'n1', 'bm25 ranking unchanged');
      } finally {
        cleanup(f);
        restoreEnv();
      }
    });
  }

  // ----- Test 4: the probe never throws; a throwing DDL is caught + cached -----
  await test('Test 4: a throwing CREATE VIRTUAL TABLE is caught and cached as { ok:false, detail }', function () {
    setForced(false); // the probe body must be reached, not the env short-circuit
    tri._test.resetFtsProbe();
    try {
      const throwingFactory = function () {
        return {
          exec: function () { throw new Error('no such module: fts5'); },
          close: function () { /* noop */ },
        };
      };
      let verdict = null;
      assert.doesNotThrow(function () {
        verdict = tri.ensureFtsAvailable({ _probeFactory: throwingFactory });
      }, 'the probe NEVER throws');
      assert.strictEqual(verdict.ok, false, 'verdict is ok:false');
      assert.ok(/fts5/.test(String(verdict.detail)), 'detail carries the underlying message');
      assert.strictEqual(tri._test.ftsProbe().computations, 1, 'verdict computed exactly once');

      // Cached: a second call (no factory) returns the cached fail, no re-probe.
      const again = tri.ensureFtsAvailable();
      assert.strictEqual(again.ok, false, 'cached fail verdict returned');
      assert.strictEqual(tri._test.ftsProbe().computations, 1, 'no second computation');
    } finally {
      tri._test.resetFtsProbe();
      restoreEnv();
    }
  });

  console.log('\nFTS5 degrade: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }
  process.exit(0);
}

main();
