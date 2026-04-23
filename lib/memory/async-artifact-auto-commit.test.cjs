#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-08 -- async artifact auto-commit throttle acceptance tests.
 *
 * Verifies the pure shouldThrottle + updateLedger + pruneOldEntries contract
 * for the auto-commit throttle module at lib/core/auto-commit-throttle.cjs.
 * The throttle module is consumed by the PostToolUse hook at
 * scripts/async-artifact-auto-commit.cjs, which handles fs I/O, stdin envelope
 * parsing, and the detached git spawn on the isolated data-room-autocommit
 * branch.
 *
 * Canon references:
 *   Part 4 Every Choice Is Graph Data -- auto-commits preserve the provenance
 *     trail of every artifact write; the filesystem IS the graph.
 *   Part 6 Product-as-Venture -- dog-fooding: our own rooms get auto-commits,
 *     same as user rooms.
 *   Part 8 Graph Boundary -- auto-commit happens in the LOCAL workspace's
 *     room git; never pushes anywhere. Pure throttle is LOCAL by construction.
 *
 * Test map (10 cases, one-to-one with the PLAN <behavior> block):
 *   1.  Empty ledger, shouldThrottle returns false
 *   2.  Ledger has entry for path, now - lastTs < 5000ms -> true (throttle)
 *   3.  Ledger has entry for path, now - lastTs >= 5000ms -> false (no throttle)
 *   4.  Ledger has entry for OTHER path; shouldThrottle for current path false
 *   5.  updateLedger returns NEW object with updated ts (immutability check)
 *   6.  pruneOldEntries drops entries older than 86400000ms (1 day)
 *   7.  pruneOldEntries keeps entries within 1 day
 *   8.  THROTTLE_WINDOW_MS exported constant equals 5000
 *   9.  Pure function: zero fs imports in throttle module
 *  10.  Ledger with 1000 entries + prune runs in < 5ms (performance sanity)
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const THROTTLE_PATH = path.join(REPO, 'lib/core/auto-commit-throttle.cjs');

// Defensive clear so repeated invocations reload fresh.
try { delete require.cache[require.resolve(THROTTLE_PATH)]; } catch (_) {}
const throttle = require(THROTTLE_PATH);

assert.equal(typeof throttle.shouldThrottle, 'function',
  'module must export shouldThrottle()');
assert.equal(typeof throttle.updateLedger, 'function',
  'module must export updateLedger()');
assert.equal(typeof throttle.pruneOldEntries, 'function',
  'module must export pruneOldEntries()');
assert.equal(typeof throttle.THROTTLE_WINDOW_MS, 'number',
  'module must export THROTTLE_WINDOW_MS as a number');

// ---------- Test 1: empty ledger -> no throttle ----------

(function test1EmptyLedger() {
  const ledger = {};
  const now = 1000000;
  const filePath = '/room/artifacts/a.md';
  const result = throttle.shouldThrottle(filePath, now, ledger);
  assert.equal(result, false,
    'empty ledger must not throttle');
  console.log('PASS test 1: empty ledger -> no throttle');
})();

// ---------- Test 2: recent entry -> throttle ----------

(function test2RecentEntry() {
  const filePath = '/room/artifacts/a.md';
  const now = 1000000;
  const ledger = { [filePath]: now - 1000 }; // 1s ago (< 5000ms)
  const result = throttle.shouldThrottle(filePath, now, ledger);
  assert.equal(result, true,
    'entry within 5000ms window must throttle');
  console.log('PASS test 2: recent entry -> throttle');
})();

// ---------- Test 3: stale entry -> no throttle ----------

(function test3StaleEntry() {
  const filePath = '/room/artifacts/a.md';
  const now = 1000000;
  const ledger = { [filePath]: now - 6000 }; // 6s ago (>= 5000ms)
  const result = throttle.shouldThrottle(filePath, now, ledger);
  assert.equal(result, false,
    'entry beyond 5000ms window must NOT throttle');
  // Exact boundary: now - 5000 is not throttled (>= is the un-throttle side).
  const boundary = { [filePath]: now - 5000 };
  assert.equal(throttle.shouldThrottle(filePath, now, boundary), false,
    'exactly 5000ms boundary must NOT throttle (>= 5000 -> allow)');
  console.log('PASS test 3: stale entry -> no throttle');
})();

// ---------- Test 4: per-path throttling ----------

(function test4PerPath() {
  const fileA = '/room/artifacts/a.md';
  const fileB = '/room/artifacts/b.md';
  const now = 1000000;
  const ledger = { [fileA]: now - 100 }; // A recently committed
  const result = throttle.shouldThrottle(fileB, now, ledger);
  assert.equal(result, false,
    'throttle must be per-path: fileA recent does not throttle fileB');
  console.log('PASS test 4: per-path throttling');
})();

// ---------- Test 5: updateLedger immutability ----------

(function test5Immutability() {
  const filePath = '/room/artifacts/a.md';
  const now = 1234567;
  const original = { '/other.md': 500 };
  const originalSnapshot = JSON.stringify(original);
  const next = throttle.updateLedger(filePath, now, original);
  // Original unchanged
  assert.equal(JSON.stringify(original), originalSnapshot,
    'updateLedger must not mutate the input ledger');
  // Returned object has the new entry
  assert.equal(next[filePath], now,
    'returned ledger must carry the updated timestamp');
  // Returned object preserves other entries
  assert.equal(next['/other.md'], 500,
    'returned ledger must preserve pre-existing entries');
  // Distinct object references
  assert.notEqual(next, original,
    'updateLedger must return a NEW object reference');
  console.log('PASS test 5: updateLedger immutability');
})();

// ---------- Test 6: pruneOldEntries drops entries > 1 day ----------

(function test6PruneDrops() {
  const ONE_DAY_MS = 86400000;
  const now = 10 * ONE_DAY_MS; // arbitrary "now"
  const stale = now - (ONE_DAY_MS + 1); // just over 1 day
  const ledger = {
    '/stale1.md': stale,
    '/stale2.md': now - (ONE_DAY_MS * 2),
  };
  const pruned = throttle.pruneOldEntries(ledger, now);
  assert.equal(pruned['/stale1.md'], undefined,
    'entry older than 1 day must be pruned');
  assert.equal(pruned['/stale2.md'], undefined,
    'entry much older than 1 day must be pruned');
  console.log('PASS test 6: pruneOldEntries drops old entries');
})();

// ---------- Test 7: pruneOldEntries keeps entries within 1 day ----------

(function test7PruneKeeps() {
  const ONE_DAY_MS = 86400000;
  const now = 10 * ONE_DAY_MS;
  const recent = now - 1000; // 1s ago
  const mid = now - (ONE_DAY_MS - 1000); // just under 1 day
  const ledger = {
    '/recent.md': recent,
    '/mid.md': mid,
  };
  const pruned = throttle.pruneOldEntries(ledger, now);
  assert.equal(pruned['/recent.md'], recent,
    'recent entry must survive prune');
  assert.equal(pruned['/mid.md'], mid,
    'entry within 1 day must survive prune');
  console.log('PASS test 7: pruneOldEntries keeps recent entries');
})();

// ---------- Test 8: THROTTLE_WINDOW_MS constant is 5000 ----------

(function test8ConstantValue() {
  assert.equal(throttle.THROTTLE_WINDOW_MS, 5000,
    'THROTTLE_WINDOW_MS must equal 5000 per PLAN spec');
  console.log('PASS test 8: THROTTLE_WINDOW_MS === 5000');
})();

// ---------- Test 9: pure -- zero fs imports in throttle module ----------

(function test9Pure() {
  const src = fs.readFileSync(THROTTLE_PATH, 'utf8');
  // Reject any require of node:fs or fs
  const fsRequireRegex = /require\s*\(\s*['"](?:node:)?fs['"]/;
  assert.equal(fsRequireRegex.test(src), false,
    'throttle module must NOT require fs (it is a pure function)');
  // Also reject http / https / child_process for good measure (pure is pure).
  const forbiddenRegex = /require\s*\(\s*['"](?:node:)?(?:http|https|child_process|net)['"]/;
  assert.equal(forbiddenRegex.test(src), false,
    'throttle module must NOT require http/https/child_process/net');
  console.log('PASS test 9: pure -- no fs/net imports');
})();

// ---------- Test 10: prune 1000 entries in < 5ms ----------

(function test10Performance() {
  const ONE_DAY_MS = 86400000;
  const now = 10 * ONE_DAY_MS;
  const ledger = {};
  for (let i = 0; i < 1000; i++) {
    // Half stale, half fresh.
    const ts = (i % 2 === 0) ? now - (ONE_DAY_MS * 2) : now - 1000;
    ledger['/f' + i + '.md'] = ts;
  }
  const start = process.hrtime.bigint();
  const pruned = throttle.pruneOldEntries(ledger, now);
  const endNs = process.hrtime.bigint();
  const elapsedMs = Number(endNs - start) / 1e6;
  // Sanity: half the entries remain.
  const keptCount = Object.keys(pruned).length;
  assert.equal(keptCount, 500,
    'half of the 1000 entries must survive (odd indices are fresh)');
  // Performance budget -- 5ms is generous for a 1000-entry O(n) scan on
  // any modern CI runner. Keep it tight but tolerant.
  assert.ok(elapsedMs < 5,
    'pruneOldEntries on 1000 entries must complete in < 5ms (was ' +
    elapsedMs.toFixed(3) + 'ms)');
  console.log('PASS test 10: prune 1000 entries in ' +
    elapsedMs.toFixed(3) + 'ms');
})();

console.log('\nasync-artifact-auto-commit: 10/10 tests passed');
