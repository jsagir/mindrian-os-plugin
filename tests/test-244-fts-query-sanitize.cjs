'use strict';
/*
 * Phase 244-01 Task 3 -- tableExists promoted to a public export + the FTS
 * query path fenced (Pitfall-1 punctuation, forced-absent degrade, public
 * tableExists reachability).
 *
 * Pins the <behavior> block of 244-01-PLAN.md Task 3 verbatim:
 *   - require('tri-modal-index.cjs').tableExists is reachable WITHOUT ._test.
 *   - tableExists(db, 'eureka_fts') is false on a fresh DatabaseSync with
 *     only a nodes table, and true after openIndex(db) has run.
 *   - tableExists never throws on a closed, null, or non-db argument;
 *     returns false.
 *   - lexicalSearch(db, "what's the pricing? (early-stage)", 5) does not
 *     throw and returns an array (raw punctuated text reaching MATCH
 *     directly is a fts5 syntax error -- toFtsMatch exists to prevent it).
 *   - With MINDRIAN_FORCE_FTS_ABSENT=1 set and _test.resetFtsProbe()
 *     called, lexicalSearch returns [] and never throws, on a db that HAS
 *     the table and on one that does not.
 *   - A stopword-only query returns [] rather than throwing.
 *   - lexicalSearch returns [] on a db where FTS5 is available but
 *     eureka_fts does NOT exist, indistinguishable from a genuine zero-hit
 *     -- this is precisely why the public tableExists is required.
 *
 * Harness shape: PASS/FAIL/FAILURES, from tests/test-219-fts5-degrade.cjs:110-125.
 * Fixture shape: makeFixtureDb copied in shape from
 * tests/test-219-fts5-degrade.cjs:84-97 (plain DatabaseSync, fs.mkdtempSync,
 * a nodes table with two semantically separated clusters).
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE).
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

// Save the env seam at file start; restore at the end (mandatory).
const ENV_FORCED_AT_START = typeof process.env.MINDRIAN_FORCE_FTS_ABSENT === 'string'
  && process.env.MINDRIAN_FORCE_FTS_ABSENT !== '';

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

// ---------- Fixture db (the 219 idiom: two semantically separated clusters) ----------

const mkdtempDirs = [];

function makeFixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-244-fts-'));
  mkdtempDirs.push(dir);
  const dbPath = path.join(dir, 'room.db');
  const db = new DatabaseSync(dbPath); // NO allowExtension
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  ins.run('n1', 'Artifact', JSON.stringify({ title: 'the pricing strategy for early-stage ventures', section: 'business-model' }));
  ins.run('n2', 'Artifact', JSON.stringify({ title: 'seed round valuation methodology', section: 'business-model' }));
  ins.run('n3', 'Section', JSON.stringify({ name: 'business model', label: 'BUSINESS MODEL' }));
  ins.run('n4', 'Artifact', JSON.stringify({ title: 'manufacturing shift scheduling', section: 'operations' }));
  ins.run('n5', 'Artifact', JSON.stringify({ title: 'worker fatigue mitigation protocol', section: 'operations' }));
  ins.run('n6', 'Section', JSON.stringify({ name: 'operations', label: 'OPERATIONS' }));
  return { db: db, dir: dir, dbPath: dbPath };
}

function cleanupAll() {
  mkdtempDirs.forEach(function (dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  });
}

// ---------- Tiny test runner ----------

let PASS = 0;
let FAIL = 0;
const FAILURES = [];

function test(name, fn) {
  try {
    fn();
    PASS += 1;
    console.log('  PASS: ' + name);
  } catch (err) {
    FAIL += 1;
    FAILURES.push({ name: name, err: err });
    console.log('  FAIL: ' + name + ' -- ' + (err && err.message));
  }
}

function main() {
  console.log('Phase 244-01 FTS query sanitize (public tableExists + Pitfall-1 fence)');

  try {
    test('tableExists is a public export, reachable without ._test', function () {
      assert.strictEqual(typeof tri.tableExists, 'function', 'tableExists must be a public function export');
    });

    test('_test.tableExists alias is preserved, pointing at the same function', function () {
      assert.strictEqual(tri._test.tableExists, tri.tableExists, '_test.tableExists must be the SAME function reference');
    });

    let f = null;
    try {
      f = makeFixtureDb();

      test('tableExists(db, eureka_fts) is false on a fresh db with only nodes', function () {
        assert.strictEqual(tri.tableExists(f.db, 'eureka_fts'), false);
      });

      test('tableExists(db, eureka_fts) is true after openIndex(db) has run', function () {
        setForced(false);
        tri._test.resetFtsProbe();
        tri.openIndex(f.db);
        assert.strictEqual(tri.tableExists(f.db, 'eureka_fts'), true);
        restoreEnv();
        tri._test.resetFtsProbe();
      });

      test('tableExists never throws on a closed, null, or non-db argument; returns false', function () {
        assert.strictEqual(tri.tableExists(null, 'eureka_fts'), false, 'null db returns false, never throws');
        assert.strictEqual(tri.tableExists({}, 'eureka_fts'), false, 'a non-db object returns false, never throws');
        assert.strictEqual(tri.tableExists(undefined, 'eureka_fts'), false, 'undefined db returns false, never throws');

        const closed = makeFixtureDb();
        closed.db.close();
        assert.strictEqual(tri.tableExists(closed.db, 'eureka_fts'), false, 'a closed db returns false, never throws');
      });
    } finally {
      if (f) { try { f.db.close(); } catch (_e) { /* ignore */ } }
    }

    // ----- Pitfall 1: raw punctuated turn text must not throw -----
    let f2 = null;
    try {
      f2 = makeFixtureDb();
      setForced(false);
      tri._test.resetFtsProbe();
      tri.openIndex(f2.db);
      // Populate eureka_fts directly (bypassing the async indexNodes/embed
      // path, which this fence does not need) so lexicalSearch has rows to
      // rank against.
      const insFts = f2.db.prepare('INSERT INTO eureka_fts(node_id, text) VALUES (?, ?)');
      insFts.run('n1', 'the pricing strategy for early-stage ventures');
      insFts.run('n2', 'seed round valuation methodology');
      insFts.run('n4', 'manufacturing shift scheduling');
      insFts.run('n5', 'worker fatigue mitigation protocol');

      test('lexicalSearch does not throw on raw punctuated text and returns an array', function () {
        let result;
        assert.doesNotThrow(function () {
          result = tri.lexicalSearch(f2.db, "what's the pricing? (early-stage)", 5);
        }, 'raw punctuation must never throw fts5: syntax error');
        assert.ok(Array.isArray(result), 'lexicalSearch must return an array');
        assert.ok(result.length >= 1, 'the sanitized query should still match n1');
      });

      test('a stopword-only query returns [] rather than throwing', function () {
        let result;
        assert.doesNotThrow(function () {
          result = tri.lexicalSearch(f2.db, 'the a of', 5);
        });
        assert.deepStrictEqual(result, [], 'stopword-only query yields empty toFtsMatch, so lexicalSearch short-circuits to []');
      });

      test('_test.toFtsMatch sanitizes punctuation into a quoted OR expression', function () {
        const expr = tri._test.toFtsMatch("what's the pricing? (early-stage)");
        assert.strictEqual(typeof expr, 'string');
        assert.ok(expr.indexOf('"pricing"') !== -1, 'pricing token must survive sanitization, quoted');
        assert.ok(expr.indexOf("'") === -1, 'no raw apostrophe may reach the MATCH expression');
      });
    } finally {
      if (f2) { try { f2.db.close(); } catch (_e) { /* ignore */ } }
      restoreEnv();
      tri._test.resetFtsProbe();
    }

    // ----- Forced-absent degrade: lexicalSearch returns [] on a db WITH the table -----
    let f3 = null;
    try {
      f3 = makeFixtureDb();
      setForced(false);
      tri._test.resetFtsProbe();
      tri.openIndex(f3.db);
      const insFts3 = f3.db.prepare('INSERT INTO eureka_fts(node_id, text) VALUES (?, ?)');
      insFts3.run('n1', 'the pricing strategy for early-stage ventures');

      test('forced-absent: lexicalSearch returns [] and never throws on a db that HAS eureka_fts', function () {
        setForced(true);
        tri._test.resetFtsProbe(); // mandatory: ensureFtsAvailable memoizes per process
        let result;
        assert.doesNotThrow(function () {
          result = tri.lexicalSearch(f3.db, 'pricing', 5);
        });
        assert.deepStrictEqual(result, [], 'forced-absent contributes zero even though the table exists');
        restoreEnv();
        tri._test.resetFtsProbe();
      });
    } finally {
      if (f3) { try { f3.db.close(); } catch (_e) { /* ignore */ } }
      restoreEnv();
      tri._test.resetFtsProbe();
    }

    // ----- Forced-absent degrade: lexicalSearch returns [] on a db WITHOUT the table -----
    let f4 = null;
    try {
      f4 = makeFixtureDb(); // nodes table only; eureka_fts never created

      test('forced-absent: lexicalSearch returns [] and never throws on a db WITHOUT eureka_fts', function () {
        setForced(true);
        tri._test.resetFtsProbe();
        let result;
        assert.doesNotThrow(function () {
          result = tri.lexicalSearch(f4.db, 'pricing', 5);
        });
        assert.deepStrictEqual(result, [], 'forced-absent contributes zero when the table is also absent');
        restoreEnv();
        tri._test.resetFtsProbe();
      });
    } finally {
      if (f4) { try { f4.db.close(); } catch (_e) { /* ignore */ } }
      restoreEnv();
      tri._test.resetFtsProbe();
    }

    // ----- The indistinguishability fact: FTS5 available, table absent -----
    let f5 = null;
    try {
      f5 = makeFixtureDb(); // nodes table only; eureka_fts never created via openIndex

      test('lexicalSearch returns [] when FTS5 is available but eureka_fts does NOT exist (index_absent indistinguishable from zero_hits)', function () {
        setForced(false);
        tri._test.resetFtsProbe();
        assert.strictEqual(tri.tableExists(f5.db, 'eureka_fts'), false, 'precondition: table genuinely absent');
        let result;
        assert.doesNotThrow(function () {
          result = tri.lexicalSearch(f5.db, 'pricing', 5);
        });
        assert.deepStrictEqual(result, [], 'lexicalSearch swallows "no such table" into [] via its catch, same shape as a real zero-hit');
        // This is exactly why the public tableExists exists: a caller must
        // probe tableExists BEFORE calling lexicalSearch to distinguish
        // index_absent from a genuine zero-hit; lexicalSearch's return value
        // alone cannot tell the two apart.
      });
    } finally {
      if (f5) { try { f5.db.close(); } catch (_e) { /* ignore */ } }
      restoreEnv();
      tri._test.resetFtsProbe();
    }
  } finally {
    cleanupAll();
  }

  console.log('\nPhase 244-01 FTS query sanitize: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }
  process.exit(0);
}

main();
