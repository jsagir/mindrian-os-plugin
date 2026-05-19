#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-02 Task 1 -- D-04 selector_pick capture integration tests.
 *
 * Verifies that lib/hmi/selector-dispatcher.cjs emits a selector_pick event
 * through lib/core/telemetry/writer.cjs whenever the F-shape pick resolves.
 * Mirrors lib/core/telemetry/writer.test.cjs and lib/memory/query-efficiency-
 * telemetry.test.cjs scaffolding shape (numbered IIFE blocks, withHome
 * helper, tmpdir cleanup).
 *
 * Test map (4 cases):
 *   1. After pickShape({requestedShape:'F.1', emitTelemetry:true, payload:...})
 *      lands a successful pick, exactly ONE line lands in
 *      ~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl with event ===
 *      'selector_pick' and all 7 ALLOWED_FIELDS values preserved.
 *   2. schema_version === 1 (Number) in the persisted record.
 *   3. When the underlying telemetry.emit throws (forbidden pattern in
 *      verb_chosen field), the dispatch function still returns successfully
 *      -- non-blocking (try/catch swallow).
 *   4. room_slug_sha256 is a 64-char sha256 hex string (not raw slug).
 *
 * Hermetic: each test creates a tmpdir, points HOME there, exercises the
 * dispatcher, asserts the events-YYYY-WNN.jsonl row, tears down. NEVER
 * touches production telemetry.
 *
 * Em-dash HARD RULE: use "--" not U+2014.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const DISPATCHER_PATH = path.join(REPO, 'lib/hmi/selector-dispatcher.cjs');
const WRITER_PATH = path.join(REPO, 'lib/core/telemetry/writer.cjs');

function mkTmpDir(prefix) {
  const base = path.join(
    os.tmpdir(),
    'mos-121-02-selpick-' + prefix + '-' + process.pid + '-' + Date.now().toString(36)
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}
function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}
function withHome(tmp, fn) {
  const originalHome = process.env.HOME;
  process.env.HOME = tmp;
  // Clear require cache so writer.cjs re-reads HOME on next telemetryDir() call.
  try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
  try { delete require.cache[require.resolve(DISPATCHER_PATH)]; } catch (_) {}
  try { return fn(); } finally {
    process.env.HOME = originalHome;
    try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
    try { delete require.cache[require.resolve(DISPATCHER_PATH)]; } catch (_) {}
  }
}
function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split('\n').filter(l => l.length > 0).map(l => JSON.parse(l));
}
function sha256(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex');
}

// Find the unified events-YYYY-WNN.jsonl file under tmp HOME.
function findEventsFile(tmpHome) {
  const dir = path.join(tmpHome, '.mindrian', 'telemetry', 'v1.13');
  if (!fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir).filter(n => /^events-\d{4}-W\d{2}\.jsonl$/.test(n));
  if (names.length === 0) return null;
  return path.join(dir, names[0]);
}

// ---------- Test 1: dispatcher emit lands selector_pick row ----------

(function test1EmitLandsRow() {
  const tmp = mkTmpDir('t1');
  try {
    withHome(tmp, () => {
      const dispatcher = require(DISPATCHER_PATH);
      const result = dispatcher.pickShape({
        requestedShape: 'F.1',
        roomDir: '/tmp/fixture-room-t1',
        operator: 'COCREATE',
        tier: 2,
        payload: {
          emitTelemetry: true,
          rankerConfidence: 0.73,
          recommendedRendered: true,
          verb_chosen: 'Run Methodology',
        },
      });
      assert.equal(result && result.shape, 'F.1', 'pickShape must resolve F.1; got ' + JSON.stringify(result && result.shape));
      const filePath = findEventsFile(tmp);
      assert.ok(filePath, 'events-YYYY-WNN.jsonl must be created');
      const rows = readJsonl(filePath).filter(r => r.event === 'selector_pick');
      assert.equal(rows.length, 1, 'exactly 1 selector_pick row; got ' + rows.length);
      const r = rows[0];
      assert.equal(r.sub_shape, 'F.1');
      assert.equal(typeof r.mode, 'string');
      assert.equal(typeof r.ranker_confidence, 'number');
      assert.equal(typeof r.recommended_rendered, 'boolean');
      assert.equal(typeof r.options_count, 'number');
      assert.equal(typeof r.room_slug_sha256, 'string');
      assert.equal(typeof r.verb_chosen, 'string');
    });
    console.log('PASS test 1: dispatcher emits selector_pick row with all 7 ALLOWED_FIELDS');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 2: schema_version === 1 (Number) ----------

(function test2SchemaVersion() {
  const tmp = mkTmpDir('t2');
  try {
    withHome(tmp, () => {
      const dispatcher = require(DISPATCHER_PATH);
      dispatcher.pickShape({
        requestedShape: 'F.1',
        roomDir: '/tmp/fixture-room-t2',
        tier: 2,
        payload: { emitTelemetry: true, verb_chosen: 'Reformulate' },
      });
      const filePath = findEventsFile(tmp);
      assert.ok(filePath, 'events file must exist');
      const rows = readJsonl(filePath).filter(r => r.event === 'selector_pick');
      assert.ok(rows.length >= 1, 'at least 1 selector_pick row');
      assert.equal(rows[0].schema_version, 1, 'schema_version must be 1');
      assert.equal(typeof rows[0].schema_version, 'number', 'schema_version must be Number');
    });
    console.log('PASS test 2: schema_version is Number 1');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 3: telemetry.emit throwing does NOT crash dispatcher ----------

(function test3NonBlocking() {
  const tmp = mkTmpDir('t3');
  try {
    withHome(tmp, () => {
      const dispatcher = require(DISPATCHER_PATH);
      // Force a Canon Part 8 forbidden pattern in verb_chosen: a Cypher fragment.
      // The dispatcher's wire-in must wrap telemetry.emit in try/catch so this
      // does NOT throw -- the F.1 result must still come back successfully.
      let result;
      assert.doesNotThrow(() => {
        result = dispatcher.pickShape({
          requestedShape: 'F.1',
          roomDir: '/tmp/fixture-room-t3',
          tier: 2,
          payload: {
            emitTelemetry: true,
            verb_chosen: 'MATCH (n:F) RETURN n', // Cypher; validator rejects
          },
        });
      }, 'dispatcher must not throw when telemetry emit fails');
      assert.equal(result && result.shape, 'F.1', 'pickShape must still resolve F.1');
    });
    console.log('PASS test 3: telemetry emit failure does NOT crash dispatcher');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 4: room_slug_sha256 is a 64-char hex sha256 ----------

(function test4Sha256Shape() {
  const tmp = mkTmpDir('t4');
  try {
    withHome(tmp, () => {
      const dispatcher = require(DISPATCHER_PATH);
      const roomDir = '/tmp/some-fixture-room-name';
      dispatcher.pickShape({
        requestedShape: 'F.1',
        roomDir: roomDir,
        tier: 2,
        payload: { emitTelemetry: true, verb_chosen: 'Synthesize' },
      });
      const filePath = findEventsFile(tmp);
      const rows = readJsonl(filePath).filter(r => r.event === 'selector_pick');
      assert.ok(rows.length >= 1, 'expect at least 1 selector_pick row');
      const r = rows[0];
      assert.equal(r.room_slug_sha256.length, 64,
        'room_slug_sha256 must be 64 hex chars; got length ' + r.room_slug_sha256.length);
      assert.ok(/^[0-9a-f]{64}$/.test(r.room_slug_sha256),
        'room_slug_sha256 must match /^[0-9a-f]{64}$/');
      // It must NOT be the raw slug.
      assert.notEqual(r.room_slug_sha256, 'some-fixture-room-name',
        'room_slug_sha256 must not be the raw slug');
      // It MUST be sha256(basename of roomDir) OR sha256 of full slug -- accept either.
      const expectedBasename = sha256(path.basename(roomDir));
      const expectedFull = sha256(roomDir);
      assert.ok(
        r.room_slug_sha256 === expectedBasename || r.room_slug_sha256 === expectedFull,
        'room_slug_sha256 must be sha256(basename(roomDir)) or sha256(roomDir)'
      );
    });
    console.log('PASS test 4: room_slug_sha256 is 64-hex sha256 (not raw slug)');
  } finally {
    rmRf(tmp);
  }
})();

console.log('\ntest-121-02-selector-pick-capture.cjs: 4/4 tests passed');
