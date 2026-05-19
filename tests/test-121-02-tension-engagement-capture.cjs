#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-02 Task 2 -- D-05 tension_engagement capture integration tests.
 *
 * Verifies lib/memory/pending-tension-store.cjs emits a tension_engagement
 * event through lib/core/telemetry/writer.cjs ONLY on user-initiated
 * resolutions (resolve / defer / ignore). Decay / drop transitions do NOT
 * emit (system-driven per Plan 121-02 spec).
 *
 * Test map (4 cases):
 *   1. markResolved(roomSlug, tid, 'RESOLVE') emits a tension_engagement
 *      with user_response='resolve' and all 5 ALLOWED_FIELDS preserved.
 *      TTR seconds is a non-negative integer.
 *   2. tension_type is normalized to one of {contradicts, converges,
 *      invalidates} for any input from Phase 116 VALID_TYPES set.
 *   3. context_hash is <= 16 characters (per ALLOWED_FIELDS).
 *   4. Decay-driven dropped transitions (via evaluateAndDecay 3-strikes)
 *      do NOT emit a tension_engagement event. Only user-initiated
 *      RESOLVE / LATER / SKIP through markResolved do.
 *
 * Hermetic: each test creates a tmpdir + HOME swap; cleans up via rmSync.
 * The Phase 116 pending-tension-store writes to ~/.mindrian/pending-tensions/
 * which lives under HOME so the swap isolates it.
 *
 * Em-dash HARD RULE: use "--" not U+2014.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..');
const STORE_PATH = path.join(REPO, 'lib/memory/pending-tension-store.cjs');
const WRITER_PATH = path.join(REPO, 'lib/core/telemetry/writer.cjs');

function mkTmpDir(prefix) {
  const base = path.join(
    os.tmpdir(),
    'mos-121-02-tens-' + prefix + '-' + process.pid + '-' + Date.now().toString(36)
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
  try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
  try { delete require.cache[require.resolve(STORE_PATH)]; } catch (_) {}
  try { return fn(); } finally {
    process.env.HOME = originalHome;
    try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
    try { delete require.cache[require.resolve(STORE_PATH)]; } catch (_) {}
  }
}
function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split('\n').filter(l => l.length > 0).map(l => JSON.parse(l));
}
function findEventsFile(tmpHome) {
  const dir = path.join(tmpHome, '.mindrian', 'telemetry', 'v1.13');
  if (!fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir).filter(n => /^events-\d{4}-W\d{2}\.jsonl$/.test(n));
  if (names.length === 0) return null;
  return path.join(dir, names[0]);
}

function seedTension(store, roomSlug, type) {
  // Compute id and append a 'queued' base entry.
  const tid = store.computeTensionId('src-' + Date.now(), 'tgt-' + Date.now(), type);
  const base = {
    tension_id: tid,
    type: type,
    state: 'queued',
    surfacing_count: 0,
    context_signature: { focus_node_id: 'fix-' + tid.slice(0, 8) },
    created_at: Date.now(),
  };
  const r = store.appendTension(roomSlug, base);
  assert.ok(r && r.ok, 'seed tension append must succeed: ' + JSON.stringify(r));
  return tid;
}

// ---------- Test 1: markResolved emits tension_engagement ----------

(function test1MarkResolvedEmits() {
  const tmp = mkTmpDir('t1');
  try {
    withHome(tmp, () => {
      const store = require(STORE_PATH);
      const roomSlug = 'fixture-room-t1';
      const tid = seedTension(store, roomSlug, 'contradiction');
      // Surface once so surfacing_count > 0 (and last_surfaced_at is set,
      // which is what the TTR derivation reads).
      store.markSurfaced(roomSlug, tid);
      // Sleep ~10ms so TTR > 0 (we only assert non-negative integer).
      const target = Date.now() + 10;
      while (Date.now() < target) {}
      const r = store.markResolved(roomSlug, tid, 'RESOLVE');
      assert.ok(r && r.ok, 'markResolved must succeed: ' + JSON.stringify(r));
      const filePath = findEventsFile(tmp);
      assert.ok(filePath, 'events-YYYY-WNN.jsonl must be created');
      const rows = readJsonl(filePath).filter(x => x.event === 'tension_engagement');
      assert.equal(rows.length, 1, 'exactly 1 tension_engagement row; got ' + rows.length);
      const e = rows[0];
      assert.equal(e.user_response, 'resolve', 'RESOLVE must normalize to resolve');
      assert.ok(typeof e.tension_type === 'string', 'tension_type must be string');
      assert.ok(Number.isInteger(e.ttr_seconds) && e.ttr_seconds >= 0,
        'ttr_seconds must be non-negative integer; got ' + e.ttr_seconds);
      assert.equal(e.room_slug_sha256.length, 64, 'room_slug_sha256 must be 64-hex');
      assert.ok(typeof e.context_hash === 'string', 'context_hash must be string');
    });
    console.log('PASS test 1: markResolved emits tension_engagement with user_response=resolve');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 2: tension_type normalized to one of {contradicts, converges, invalidates} ----------

(function test2TypeNormalization() {
  const tmp = mkTmpDir('t2');
  const valid = new Set(['contradicts', 'converges', 'invalidates']);
  const samples = ['contradiction', 'convergence', 'stale_decision', 'open_question'];
  try {
    withHome(tmp, () => {
      const store = require(STORE_PATH);
      const roomSlug = 'fixture-room-t2';
      for (const ttype of samples) {
        const tid = seedTension(store, roomSlug, ttype);
        store.markSurfaced(roomSlug, tid);
        const r = store.markResolved(roomSlug, tid, 'LATER');
        assert.ok(r && r.ok, 'markResolved must succeed for ' + ttype);
      }
      const filePath = findEventsFile(tmp);
      const rows = readJsonl(filePath).filter(x => x.event === 'tension_engagement');
      assert.equal(rows.length, samples.length,
        'must have ' + samples.length + ' tension_engagement rows; got ' + rows.length);
      for (const r of rows) {
        assert.ok(valid.has(r.tension_type),
          'tension_type must be one of {contradicts,converges,invalidates}; got ' + r.tension_type);
      }
    });
    console.log('PASS test 2: tension_type normalized to {contradicts,converges,invalidates}');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 3: context_hash <= 16 chars ----------

(function test3ContextHashCap() {
  const tmp = mkTmpDir('t3');
  try {
    withHome(tmp, () => {
      const store = require(STORE_PATH);
      const roomSlug = 'fixture-room-t3';
      const tid = seedTension(store, roomSlug, 'convergence');
      store.markSurfaced(roomSlug, tid);
      const r = store.markResolved(roomSlug, tid, 'SKIP');
      assert.ok(r && r.ok, 'markResolved must succeed: ' + JSON.stringify(r));
      const filePath = findEventsFile(tmp);
      const rows = readJsonl(filePath).filter(x => x.event === 'tension_engagement');
      assert.equal(rows.length, 1);
      assert.ok(rows[0].context_hash.length <= 16,
        'context_hash must be <= 16 chars; got ' + rows[0].context_hash.length);
      assert.equal(rows[0].user_response, 'ignore', 'SKIP must normalize to ignore');
    });
    console.log('PASS test 3: context_hash is <= 16 chars; SKIP normalizes to ignore');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 4: decay-driven dropped transitions do NOT emit ----------

(function test4DecayDoesNotEmit() {
  const tmp = mkTmpDir('t4');
  try {
    withHome(tmp, () => {
      const store = require(STORE_PATH);
      const roomSlug = 'fixture-room-t4';
      const tid = seedTension(store, roomSlug, 'contradiction');
      // Surface 3 times so surfacing_count >= 3 (triggers decay).
      store.markSurfaced(roomSlug, tid);
      store.markSurfaced(roomSlug, tid);
      store.markSurfaced(roomSlug, tid);
      // evaluateAndDecay should drop it.
      const decay = store.evaluateAndDecay(roomSlug);
      assert.ok(Array.isArray(decay.droppedTensionIds) && decay.droppedTensionIds.length === 1,
        '3-strikes decay must drop exactly 1; got ' + JSON.stringify(decay));
      const filePath = findEventsFile(tmp);
      const rows = filePath ? readJsonl(filePath).filter(x => x.event === 'tension_engagement') : [];
      assert.equal(rows.length, 0,
        'decay-driven transition must NOT emit tension_engagement; got ' + rows.length + ' rows');
    });
    console.log('PASS test 4: decay-driven dropped transitions do NOT emit tension_engagement');
  } finally {
    rmRf(tmp);
  }
})();

console.log('\ntest-121-02-tension-engagement-capture.cjs: 4/4 tests passed');
