#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-03 Task 2 -- room_receipt_written helper acceptance tests (D-09 surface 2).
 *
 * Verifies lib/core/room-receipt-emit.cjs::emitReceiptWritten routes through
 * writer.emit() (Canon Part 9 chokepoint) and produces well-formed
 * room_receipt_written rows that pass the Canon Part 8 emit-time validator.
 *
 * Test map (4 cases, one-to-one with PLAN <behavior>):
 *   1. emitReceiptWritten('my-room-slug', 'conv-abc-123') emits exactly 1
 *      line with event === 'room_receipt_written', room_slug_sha256 =
 *      sha256('my-room-slug'), conversation_id_hash = sha256('conv-abc-123')
 *      first-16-chars, generated_at_ts ISO-8601 timestamp.
 *   2. emitReceiptWritten with falsy args does NOT throw -- emits with
 *      empty-string-hashed values (defensive).
 *   3. Phase 119 receipt-write surface (room-auto-create.cjs) wire-in: the
 *      autoCreatePlaceholderRoom function imports and calls emitReceiptWritten
 *      so one event lands per receipt (grep-verified; no live spawn needed).
 *   4. 5 sequential receipts in the same week land in the SAME
 *      events-YYYY-WNN.jsonl (5 lines).
 *
 * Hermetic: per-test tmpdir + HOME swap. Mirrors writer.test.cjs scaffolding.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const HELPER_PATH = path.join(REPO, 'lib/core/room-receipt-emit.cjs');

// ---------- Fixture scaffolding ----------

function mkTmpHome(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-121-03-rr-' + prefix + '-'));
}

function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(function (l) { return l.length > 0; });
  return lines.map(function (l) { return JSON.parse(l); });
}

function listEventFiles(homeDir) {
  const v113 = path.join(homeDir, '.mindrian', 'telemetry', 'v1.13');
  if (!fs.existsSync(v113)) return [];
  return fs.readdirSync(v113).filter(function (f) { return /^events-\d{4}-W\d{2}\.jsonl$/.test(f); }).map(function (f) { return path.join(v113, f); });
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex');
}

let passed = 0;
let failed = 0;
function recordPass(name) { passed++; console.log('PASS: ' + name); }
function recordFail(name, e) { failed++; console.error('FAIL: ' + name + ' :: ' + (e && e.message ? e.message : e)); }

// Force a fresh require so HOME changes apply.
function freshRequireHelper() {
  try { delete require.cache[require.resolve(HELPER_PATH)]; } catch (_) {}
  return require(HELPER_PATH);
}

// ---------- Test 1: emitReceiptWritten produces well-formed row ----------

(function test1Wellformed() {
  const tmp = mkTmpHome('t1');
  const orig = process.env.HOME;
  process.env.HOME = tmp;
  try {
    const helper = freshRequireHelper();
    helper.emitReceiptWritten('my-room-slug', 'conv-abc-123');
    const files = listEventFiles(tmp);
    assert.equal(files.length, 1, 't1: exactly one ISO-week file');
    const events = readJsonl(files[0]);
    assert.equal(events.length, 1, 't1: exactly one event line');
    const e = events[0];
    assert.equal(e.event, 'room_receipt_written', 't1: event type');
    assert.equal(e.schema_version, 1, 't1: schema_version Number 1');
    assert.equal(e.room_slug_sha256, sha256('my-room-slug'), 't1: room_slug_sha256 matches sha256 of slug');
    assert.equal(e.conversation_id_hash, sha256('conv-abc-123').slice(0, 16), 't1: conversation_id_hash is first 16 hex of sha256');
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(e.generated_at_ts), 't1: generated_at_ts is ISO-8601-shaped');
    recordPass('t1: emitReceiptWritten produces well-formed row');
  } catch (e) {
    recordFail('t1: emitReceiptWritten produces well-formed row', e);
  } finally {
    process.env.HOME = orig;
    rmRf(tmp);
  }
})();

// ---------- Test 2: falsy args do not throw (defensive) ----------

(function test2FalsyArgs() {
  const tmp = mkTmpHome('t2');
  const orig = process.env.HOME;
  process.env.HOME = tmp;
  try {
    const helper = freshRequireHelper();
    // Three falsy permutations: undefined, null, ''. Each must NOT throw.
    helper.emitReceiptWritten(undefined, undefined);
    helper.emitReceiptWritten(null, null);
    helper.emitReceiptWritten('', '');
    const files = listEventFiles(tmp);
    assert.equal(files.length, 1, 't2: ISO-week file written');
    const events = readJsonl(files[0]);
    assert.equal(events.length, 3, 't2: three events landed without throwing');
    for (const e of events) {
      assert.equal(e.event, 'room_receipt_written', 't2: event type');
      // sha256('') is a stable 64-hex value -- empty input hash.
      assert.equal(e.room_slug_sha256, sha256(''), 't2: empty-string sha256 fallback');
    }
    recordPass('t2: falsy args do not throw; emit defensively with empty-string hashes');
  } catch (e) {
    recordFail('t2: falsy args do not throw', e);
  } finally {
    process.env.HOME = orig;
    rmRf(tmp);
  }
})();

// ---------- Test 3: Phase 119 wire-in is present in room-auto-create.cjs ----------

(function test3Phase119WireIn() {
  try {
    const autoCreatePath = path.join(REPO, 'lib/core/room-auto-create.cjs');
    const src = fs.readFileSync(autoCreatePath, 'utf8');
    assert.ok(/require\(['"]\.\/room-receipt-emit['"]\)/.test(src), 't3: room-auto-create.cjs requires room-receipt-emit module');
    assert.ok(/emitReceiptWritten/.test(src), 't3: room-auto-create.cjs invokes emitReceiptWritten');
    assert.ok(/Phase 121-03 D-09/.test(src), 't3: room-auto-create.cjs carries Phase 121-03 D-09 comment marker');
    recordPass('t3: Phase 119 receipt-write surface wired (room-auto-create.cjs)');
  } catch (e) {
    recordFail('t3: Phase 119 wire-in', e);
  }
})();

// ---------- Test 4: 5 sequential receipts land in same ISO-week file ----------

(function test4SameWeekAggregation() {
  const tmp = mkTmpHome('t4');
  const orig = process.env.HOME;
  process.env.HOME = tmp;
  try {
    const helper = freshRequireHelper();
    for (let i = 0; i < 5; i++) {
      helper.emitReceiptWritten('room-' + i, 'conv-' + i);
    }
    const files = listEventFiles(tmp);
    assert.equal(files.length, 1, 't4: exactly ONE ISO-week file');
    const events = readJsonl(files[0]);
    assert.equal(events.length, 5, 't4: 5 lines in the same file');
    for (let i = 0; i < 5; i++) {
      assert.equal(events[i].event, 'room_receipt_written', 't4: row ' + i + ' event type');
      assert.equal(events[i].room_slug_sha256, sha256('room-' + i), 't4: row ' + i + ' slug hash');
    }
    recordPass('t4: 5 sequential receipts aggregate to same ISO-week file');
  } catch (e) {
    recordFail('t4: 5 sequential receipts aggregate', e);
  } finally {
    process.env.HOME = orig;
    rmRf(tmp);
  }
})();

// ---------- Summary ----------

const total = passed + failed;
console.log('');
console.log(passed + '/' + total + ' tests passed');
if (failed > 0) process.exit(1);
process.exit(0);
