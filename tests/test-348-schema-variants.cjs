'use strict';
/*
 * tests/test-348-schema-variants.cjs -- Phase 348-03 Task 3: the
 * bitemporal-close schema gate (SUPER-13). A legacy room returns a NAMED
 * reason instead of throwing; the refusal never opens a transaction and
 * never falls through to a plain status UPDATE (WD-348-7: fail CLOSED,
 * never degrade).
 *
 * Three schema shapes matter here, not two:
 *   wide   -- tests/helpers/fixture-room-348.cjs's own 'wide' variant: the
 *             full Phase 109 + Phase 160 16-column shape. The bitemporal
 *             close must succeed unchanged (the probe costs this path
 *             nothing).
 *   mid    -- a THIRD shape this file builds directly (not in fixture-
 *             room-348.cjs, out of this task's files_modified): the Phase
 *             109 tightened 12-column shape WITHOUT the four Phase 160
 *             bitemporal columns. It DOES carry review_status, so the
 *             pre-existing row lookup succeeds -- this is what proves the
 *             refusal does not fall through to the plain status UPDATE
 *             branch (a real, reachable branch on this exact shape).
 *   legacy -- tests/helpers/fixture-room-348.cjs's own 'legacy' variant:
 *             the bare id/type/properties shape, no review_status column at
 *             all. On THIS shape even the pre-existing row lookup
 *             (transitions.cjs's own SELECT id, review_status, type ...)
 *             throws "no such column: review_status" for EVERY transition,
 *             bitemporal or not -- a pre-existing, out-of-phase limitation
 *             the plan's own action text names explicitly ("a missing
 *             review_status column on a legacy room breaks every status
 *             write equally and predates this phase"). The schema probe
 *             this task adds runs BEFORE that row lookup, but ONLY when
 *             wantsBitemporalClose is true, so a bitemporal-close attempt on
 *             this shape gets the NAMED refusal instead of the raw SQLite
 *             throw, while a NON-bitemporal call on this same shape is
 *             completely UNTOUCHED by this task's edit and keeps throwing
 *             exactly as it did before -- proving the probe is scoped to
 *             the bitemporal branch alone, never the other two.
 *
 * House idiom: node:assert/strict, an `ok(desc, fn)` counter, fixtures from
 * tests/helpers/fixture-room-348.cjs (wide / legacy) plus this file's own
 * local mid-schema and pragma-throwing-wrapper builders, explicit close in
 * a finally, final line '>>> test-348-schema-variants.cjs: PASSED'.
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { promoteNodeStatus } = require('../lib/core/navigation/transitions.cjs');
const {
  buildSupersessionFixtureRoom,
  closeSupersessionFixtureRoom,
} = require('./helpers/fixture-room-348.cjs');

let n = 0;
function ok(desc, fn) {
  fn();
  n += 1;
  console.log('  ok ' + n + ' - ' + desc);
}

console.log('test-348-schema-variants (SUPER-13)');

// ---- The 'mid' shape: Phase 109 tightened, pre-Phase-160 (no bitemporal) --

const NODES_DDL_MID =
  'CREATE TABLE nodes (' +
  '  id TEXT PRIMARY KEY, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}', " +
  '  source_path TEXT NOT NULL, ' +
  "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
  '  confidence REAL, ' +
  "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
  "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
  '  created_at INTEGER NOT NULL, ' +
  '  last_seen_at INTEGER NOT NULL, ' +
  '  source_section TEXT, ' +
  '  confirmed_by TEXT, ' +
  '  confirmed_at INTEGER' +
  ')';

function buildMidFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-348-mid-'));
  const dbPath = path.join(tmpDir, 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec(NODES_DDL_MID);
  const nodeId = 'claim:348-mid:a';
  const now = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'claim', '{}', ?, 'system', 'confirmed', ?, ?)"
  ).run(nodeId, 'unknown:claim:' + nodeId, now, now);
  return { tmpDir, db, nodeId };
}

function closeMidFixture(fx) {
  try { fx.db.close(); } catch (_e) { /* best-effort */ }
  try { fs.rmSync(fx.tmpDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// ---- A db wrapper whose PRAGMA prepare throws, everything else delegates --

function wrapPragmaThrowing(realDb) {
  return {
    prepare: function (sql) {
      if (/PRAGMA\s+table_info/i.test(sql)) {
        throw new Error('simulated PRAGMA failure');
      }
      return realDb.prepare(sql);
    },
    exec: function (sql) { return realDb.exec(sql); },
  };
}

// ---- Assertion 1: legacy + bitemporal opts returns the named reason, no throw --

ok('a legacy-schema bitemporal-close attempt returns bitemporal_close_unsupported_schema, never throws', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'legacy' });
  try {
    let res;
    assert.doesNotThrow(function () {
      res = promoteNodeStatus(fx.db, fx.claimAId, 'confirmed', 'superseded', 'navigator', 't', { invalidatedAt: 1, validTo: 2 });
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'bitemporal_close_unsupported_schema');
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ---- Assertion 2: no dangling transaction after the refusal --------------

ok('the refusal leaves no transaction open: a fresh BEGIN/ROLLBACK round trip on the same handle succeeds', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'legacy' });
  try {
    promoteNodeStatus(fx.db, fx.claimAId, 'confirmed', 'superseded', 'navigator', 't', { invalidatedAt: 1, validTo: 2 });
    assert.doesNotThrow(function () {
      fx.db.exec('BEGIN');
      fx.db.exec('ROLLBACK');
    });
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ---- Assertion 3: nothing mutated, no memory_event row written -----------

ok('the refusal mutates nothing and writes no memory_event row', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'legacy' });
  try {
    const before = fx.db.prepare("SELECT COUNT(*) AS n FROM nodes").get().n;
    const evBefore = fx.db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n;
    promoteNodeStatus(fx.db, fx.claimAId, 'confirmed', 'superseded', 'navigator', 't', { invalidatedAt: 1, validTo: 2 });
    const after = fx.db.prepare("SELECT COUNT(*) AS n FROM nodes").get().n;
    const evAfter = fx.db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n;
    assert.equal(after, before, 'row count unchanged');
    assert.equal(evAfter, evBefore, 'no memory_event row written');
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ---- Assertion 4: the refusal does NOT fall through to the plain UPDATE --

ok('on a mid-schema (review_status present, no invalidated_at/valid_to) the node review_status is still confirmed after the refusal -- no fall-through to the plain status UPDATE', function () {
  const fx = buildMidFixture();
  try {
    const res = promoteNodeStatus(fx.db, fx.nodeId, 'confirmed', 'superseded', 'navigator', 't', { invalidatedAt: 1, validTo: 2 });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'bitemporal_close_unsupported_schema');
    const row = fx.db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(fx.nodeId);
    assert.equal(row.review_status, 'confirmed', 'the plain status UPDATE branch must never have run');
  } finally { closeMidFixture(fx); }
});

// ---- Assertion 5: the wide (migrated) path is unaffected ------------------

ok('on the wide (migrated) schema the bitemporal close still SUCCEEDS -- the probe costs the migrated path nothing', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const res = promoteNodeStatus(fx.db, fx.claimAId, 'confirmed', 'superseded', 'navigator', 't', { invalidatedAt: 1, validTo: 2 });
    assert.equal(res.ok, true, JSON.stringify(res));
    const row = fx.db.prepare('SELECT review_status, invalidated_at, valid_to FROM nodes WHERE id = ?').get(fx.claimAId);
    assert.equal(row.review_status, 'superseded');
    assert.equal(row.invalidated_at, 1);
    assert.equal(row.valid_to, 2);
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ---- Assertion 6: the probe runs ONLY on the bitemporal branch -----------

ok('a call with NO bitemporal opts on the legacy fixture is UNTOUCHED by this gate: it still throws the same pre-existing, out-of-phase "no such column: review_status" error, never the named bitemporal reason', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'legacy' });
  try {
    assert.throws(function () {
      promoteNodeStatus(fx.db, fx.claimAId, 'proposed', 'rejected', 'system', 't');
    }, /no such column: review_status/, 'the legacy row-lookup limitation predates this phase and is out of this gate\'s scope');
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ---- Assertion 7: a probe that itself throws fails CLOSED, never open ----

ok('a PRAGMA probe that itself throws yields the SAME named refusal, never an exception (fail closed, never open)', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const wrapped = wrapPragmaThrowing(fx.db);
    let res;
    assert.doesNotThrow(function () {
      res = promoteNodeStatus(wrapped, fx.claimAId, 'confirmed', 'superseded', 'navigator', 't', { invalidatedAt: 1, validTo: 2 });
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'bitemporal_close_unsupported_schema');
    // The underlying real node was never mutated (the probe fired before BEGIN).
    const row = fx.db.prepare('SELECT review_status, invalidated_at, valid_to FROM nodes WHERE id = ?').get(fx.claimAId);
    assert.equal(row.review_status, 'confirmed');
    assert.equal(row.invalidated_at, null);
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ---- Assertion 8: no module-level cache -- two different handles ---------

ok('the probe reads the CALLER-OWNED handle every time -- a legacy handle refuses even right after a wide handle succeeded (no module-level cache)', function () {
  const wideFx = buildSupersessionFixtureRoom({ variant: 'wide' });
  const legacyFx = buildSupersessionFixtureRoom({ variant: 'legacy' });
  try {
    const wideRes = promoteNodeStatus(wideFx.db, wideFx.claimAId, 'confirmed', 'superseded', 'navigator', 't', { invalidatedAt: 1, validTo: 2 });
    assert.equal(wideRes.ok, true, JSON.stringify(wideRes));
    const legacyRes = promoteNodeStatus(legacyFx.db, legacyFx.claimAId, 'confirmed', 'superseded', 'navigator', 't', { invalidatedAt: 1, validTo: 2 });
    assert.equal(legacyRes.ok, false);
    assert.equal(legacyRes.reason, 'bitemporal_close_unsupported_schema');
  } finally {
    closeSupersessionFixtureRoom(wideFx);
    closeSupersessionFixtureRoom(legacyFx);
  }
});

console.log('');
console.log(n + ' assertions passed');
console.log('>>> test-348-schema-variants.cjs: PASSED');
process.exit(0);
