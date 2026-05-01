#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 100-03 -- per-room JTBD state I/O validation suite.
 *
 * 9 assertion classes covering the dimensions called out in the plan:
 *   1. Round-trip: setCurrent then getCurrent returns the same fields.
 *   2. Atomic write: no `.tmp.` orphans after concurrent writes;
 *      tmp file does not persist after rename.
 *   3. History bounded: 60 transitions -> history.length === 50,
 *      oldest 10 dropped (FIFO).
 *   4. 24h staleness: state with entered_at 25h ago -> isStale() true.
 *   5. Manual override expires_at: setCurrent(manual:true) sets
 *      expires_at = entered_at + 24h.
 *   6. Manual block on auto: within manual override window an auto
 *      setCurrent appends history with trigger 'auto_blocked_by_manual'
 *      but does NOT change current.
 *   7. Per-room isolation: two tmpdirs, two distinct JTBDs, zero
 *      leakage between them.
 *   8. Graceful error: read non-existent dir returns null without throw;
 *      corrupt JSON returns null + stderr log.
 *   9. Canon Part 8 source-level audit: read lib/hmi/jtbd-state.cjs
 *      bytes; assert zero matches against /brain|aura|pinecone|mcp/i
 *      substring (defense-in-depth across the HMI layer).
 *
 * IIFE harness pattern, mirrors tests/test-cascade-side-channel.cjs.
 * Cleanup of tmpdirs in finally on every assertion.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const STATE_MODULE = path.join(REPO, 'lib', 'hmi', 'jtbd-state.cjs');
const state = require(STATE_MODULE);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

function makeTmpRoom(label) {
  const base = path.join(
    os.tmpdir(),
    'phase-100-03-' + label + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function statePath(roomDir) {
  return path.join(roomDir, '.mindrian', 'jtbd-state.json');
}

// ---------- Class 1: round-trip ----------

(function class1_roundTrip() {
  const label = 'class 1: round-trip setCurrent -> getCurrent identity';
  const room = makeTmpRoom('roundtrip');
  try {
    state.setCurrent(room, {
      jtbd: 'find-bottleneck',
      confidence: 0.82,
      evidence: ['tokens:2', 'operator:METHODOLOGY', 'recency:1'],
      trigger: 'user_message',
    });
    const cur = state.getCurrent(room);
    assert.equal(cur.jtbd, 'find-bottleneck', label + ': jtbd round-trip');
    assert.equal(cur.confidence, 0.82, label + ': confidence round-trip');
    assert.deepEqual(cur.evidence,
      ['tokens:2', 'operator:METHODOLOGY', 'recency:1'],
      label + ': evidence round-trip');
    assert.equal(cur.expires_at, null, label + ': auto write -> expires_at null');
    assert.ok(cur.entered_at && typeof cur.entered_at === 'string',
      label + ': entered_at populated');
    // ISO-8601 sanity
    assert.ok(!Number.isNaN(Date.parse(cur.entered_at)),
      label + ': entered_at is ISO-8601 parseable');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(room);
  }
})();

// ---------- Class 2: atomic write -- no tmp orphans ----------

(function class2_atomicWrite() {
  const label = 'class 2: atomic write leaves no tmp orphans across many writes';
  const room = makeTmpRoom('atomic');
  try {
    for (let i = 0; i < 25; i += 1) {
      state.setCurrent(room, {
        jtbd: i % 2 === 0 ? 'find-bottleneck' : 'prepare-pitch',
        confidence: 0.5 + (i % 10) / 100,
        evidence: ['iter:' + i],
        trigger: 'user_message',
      });
    }
    const dir = path.join(room, '.mindrian');
    const entries = fs.readdirSync(dir);
    const orphans = entries.filter((n) => n.startsWith('.jtbd-state.json.tmp.'));
    assert.equal(orphans.length, 0,
      label + ': expected 0 tmp orphans, found ' + orphans.length + ': ' + orphans.join(','));
    // Final write must be present and parseable.
    const final = JSON.parse(fs.readFileSync(statePath(room), 'utf8'));
    assert.equal(final.version, 1, label + ': final version is 1');
    assert.ok(final.current && final.current.jtbd, label + ': final current present');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(room);
  }
})();

// ---------- Class 3: history bounded at 50 ----------

(function class3_historyBounded() {
  const label = 'class 3: history bounded at 50, oldest 10 dropped (60 writes)';
  const room = makeTmpRoom('history');
  try {
    for (let i = 0; i < 60; i += 1) {
      state.setCurrent(room, {
        jtbd: 'find-bottleneck',
        confidence: 0.7,
        evidence: ['n:' + i],
        trigger: 'user_message',
      });
    }
    const h = state.history(room, 100);
    assert.equal(h.length, 50,
      label + ': expected 50 entries, got ' + h.length);
    // Drop-oldest FIFO: the first remaining row's evidence should
    // reflect i=10 (entries 0..9 dropped).
    assert.deepEqual(h[0].evidence, ['n:10'],
      label + ': oldest remaining row should be iteration 10');
    assert.deepEqual(h[h.length - 1].evidence, ['n:59'],
      label + ': newest row should be iteration 59');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(room);
  }
})();

// ---------- Class 4: 24h staleness ----------

(function class4_staleness24h() {
  const label = 'class 4: 24h staleness (entered_at 25h ago -> isStale true)';
  const room = makeTmpRoom('stale');
  try {
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    const enteredMs = Date.now() - 25 * 60 * 60 * 1000;
    const stale = {
      version: 1,
      current: {
        jtbd: 'find-bottleneck',
        confidence: 0.7,
        entered_at: new Date(enteredMs).toISOString(),
        evidence: [],
        expires_at: null,
      },
      history: [],
    };
    fs.writeFileSync(statePath(room), JSON.stringify(stale, null, 2), 'utf8');

    assert.equal(state.isStale(room), true,
      label + ': 25h-old entered_at must be stale');
    // Fresh write resets the clock.
    state.setCurrent(room, {
      jtbd: 'prepare-pitch', confidence: 0.7, evidence: [], trigger: 'user_message',
    });
    assert.equal(state.isStale(room), false,
      label + ': fresh write must NOT be stale');
    // No state file at all -> isStale true.
    const empty = makeTmpRoom('stale-empty');
    try {
      assert.equal(state.isStale(empty), true,
        label + ': missing state file must be stale');
    } finally {
      rmrf(empty);
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(room);
  }
})();

// ---------- Class 5: manual override expires_at = entered_at + 24h ----------

(function class5_manualExpires() {
  const label = 'class 5: manual override sets expires_at = entered_at + 24h';
  const room = makeTmpRoom('manual-expires');
  try {
    const beforeMs = Date.now();
    state.setCurrent(room, {
      jtbd: 'validate-idea',
      confidence: 1.0,
      evidence: ['user-pick'],
      trigger: 'manual',
      manual: true,
    });
    const afterMs = Date.now();
    const cur = state.getCurrent(room);
    assert.equal(cur.jtbd, 'validate-idea', label + ': manual jtbd round-trip');
    assert.ok(cur.expires_at, label + ': expires_at must be set on manual write');
    const enteredMs = Date.parse(cur.entered_at);
    const expiresMs = Date.parse(cur.expires_at);
    const dh = (expiresMs - enteredMs) / (60 * 60 * 1000);
    assert.ok(Math.abs(dh - 24) < 0.01,
      label + ': expires_at - entered_at must equal 24h, got ' + dh + 'h');
    // entered_at within the test window (sanity).
    assert.ok(enteredMs >= beforeMs && enteredMs <= afterMs,
      label + ': entered_at must fall inside the test window');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(room);
  }
})();

// ---------- Class 6: manual block on auto write ----------

(function class6_manualBlocksAuto() {
  const label = 'class 6: manual override blocks subsequent auto write (no current change, history row appended)';
  const room = makeTmpRoom('manual-block');
  try {
    state.setCurrent(room, {
      jtbd: 'prepare-pitch',
      confidence: 1.0,
      evidence: ['user-pick'],
      trigger: 'manual',
      manual: true,
    });
    const before = state.getCurrent(room);
    assert.equal(before.jtbd, 'prepare-pitch', label + ': manual write landed');

    // Auto write with a different JTBD must NOT change current.
    state.setCurrent(room, {
      jtbd: 'find-bottleneck',
      confidence: 0.85,
      evidence: ['tokens:2'],
      trigger: 'user_message',
      manual: false,
    });
    const after = state.getCurrent(room);
    assert.equal(after.jtbd, 'prepare-pitch',
      label + ': auto write must NOT change current under manual override');
    // History must contain a blocked row.
    const h = state.history(room, 50);
    const blocked = h.filter((row) => row.trigger === 'auto_blocked_by_manual');
    assert.equal(blocked.length, 1,
      label + ': exactly one auto_blocked_by_manual row, found ' + blocked.length);
    assert.equal(blocked[0].to, 'find-bottleneck',
      label + ': blocked row records the would-be target');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(room);
  }
})();

// ---------- Class 7: per-room isolation ----------

(function class7_perRoomIsolation() {
  const label = 'class 7: per-room isolation (two rooms, zero leakage)';
  const roomA = makeTmpRoom('iso-a');
  const roomB = makeTmpRoom('iso-b');
  try {
    state.setCurrent(roomA, {
      jtbd: 'prepare-pitch', confidence: 0.9, evidence: ['A'], trigger: 'user_message',
    });
    state.setCurrent(roomB, {
      jtbd: 'audit-room', confidence: 0.7, evidence: ['B'], trigger: 'user_message',
    });
    const a = state.getCurrent(roomA);
    const b = state.getCurrent(roomB);
    assert.equal(a.jtbd, 'prepare-pitch', label + ': room A holds prepare-pitch');
    assert.equal(b.jtbd, 'audit-room', label + ': room B holds audit-room');
    assert.notEqual(a.jtbd, b.jtbd, label + ': rooms must hold distinct JTBDs');
    // History is also per-room: history(A) carries only A's evidence.
    const ha = state.history(roomA, 50);
    const hb = state.history(roomB, 50);
    const aHasB = ha.some((row) => Array.isArray(row.evidence) && row.evidence.includes('B'));
    const bHasA = hb.some((row) => Array.isArray(row.evidence) && row.evidence.includes('A'));
    assert.equal(aHasB, false, label + ': room A history must NOT contain room B evidence');
    assert.equal(bHasA, false, label + ': room B history must NOT contain room A evidence');
    // Path-level boundary: each room's state file is INSIDE its own dir.
    assert.ok(fs.existsSync(statePath(roomA)), label + ': room A state file exists');
    assert.ok(fs.existsSync(statePath(roomB)), label + ': room B state file exists');
    assert.notEqual(statePath(roomA), statePath(roomB),
      label + ': state paths must differ across rooms');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(roomA);
    rmrf(roomB);
  }
})();

// ---------- Class 8: graceful error handling ----------

(function class8_gracefulErrors() {
  const label = 'class 8: graceful errors (missing dir + corrupt JSON return null without throw)';
  const room = makeTmpRoom('graceful');
  try {
    // 8a: getCurrent on a brand-new room returns null.
    const nullCur = state.getCurrent(room);
    assert.equal(nullCur, null, label + ': missing state file returns null');
    const nullHistory = state.history(room, 20);
    assert.deepEqual(nullHistory, [], label + ': missing state -> empty history');
    assert.equal(state.isStale(room), true, label + ': missing state -> stale');

    // 8b: corrupt JSON. Silence stderr by capturing it during this slice.
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    fs.writeFileSync(statePath(room), '{ this is not json', 'utf8');
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = function (_buf) { return true; };
    try {
      const corruptCur = state.getCurrent(room);
      assert.equal(corruptCur, null, label + ': corrupt JSON returns null');
    } finally {
      process.stderr.write = origWrite;
    }

    // 8c: setCurrent with bad opts logs and returns without throw.
    const origWrite2 = process.stderr.write.bind(process.stderr);
    process.stderr.write = function (_buf) { return true; };
    try {
      state.setCurrent(room, null);
      state.setCurrent(room, {});
      state.setCurrent(room, { jtbd: '' });
    } finally {
      process.stderr.write = origWrite2;
    }
    // No throw reaching this line == passing.
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(room);
  }
})();

// ---------- Class 9: Canon Part 8 source-level audit ----------

(function class9_canonPart8() {
  const label = 'class 9: Canon Part 8 source audit (zero forbidden tokens in state module)';
  try {
    const src = fs.readFileSync(STATE_MODULE, 'utf8');
    const forbidden = ['brain', 'aura', 'pinecone', 'mcp'];
    for (const tok of forbidden) {
      const re = new RegExp(tok, 'i');
      const match = src.match(re);
      assert.equal(match, null,
        label + ': forbidden token "' + tok + '" found at offset ' +
          (match && match.index) + ' in lib/hmi/jtbd-state.cjs');
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'jtbd-state I/O suite: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
