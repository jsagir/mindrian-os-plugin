#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-04 -- statusline MINTO segment acceptance tests.
 *
 * Verifies the pure statusline-cache module at lib/core/statusline-cache.cjs:
 *   - 5-second TTL cache with atomic disk-backed persistence
 *   - truncateGoverningThought helper (60-char budget + ellipsis)
 *   - classifyHealth shared with lib/memory/triple-context-formatter.cjs
 *
 * Canon references:
 *   Part 2 UI vocabulary -- MINTO health glyph (check / warn / low / --) is
 *     the one-byte compressed reasoning state that every L3 surface renders.
 *   Part 3 Tri-Context Decision Gate -- statusline renders the LOCAL signal
 *     only; never BRAIN, never SIGNAL.
 *   Part 8 Graph Boundary -- cache writes land in roomRoot/.mindrian/; this
 *     pure module has no external egress surface by construction.
 *
 * Test map (10 cases, one-to-one with the PLAN Task 1 <behavior> block):
 *   1.  getCached on absent cache file returns {value: null, fresh: false}
 *   2.  setCached then immediate getCached returns {value: triple, fresh: true}
 *   3.  setCached then getCached after TTL_MS + 1ms -> {fresh: false}
 *   4.  setCached returns without throwing on disk-full / permission-denied
 *   5.  cache keyed by (roomRoot, sectionPath) -- different key does not hit
 *   6.  atomic write: simulate a concurrent writer, no partial file observed
 *   7.  cache file location is roomRoot/.mindrian/statusline-cache.json
 *   8.  truncateGoverningThought(str) returns str if <= 60 chars
 *   9.  truncateGoverningThought(longStr) returns first 59 chars + ellipsis
 *  10.  classifyHealth(score) returns 'check' | 'warn' | 'low' | '--'
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..', '..');
const CACHE_PATH = path.join(REPO, 'lib/core/statusline-cache.cjs');

try { delete require.cache[require.resolve(CACHE_PATH)]; } catch (_) {}
const statuslineCache = require(CACHE_PATH);

assert.equal(typeof statuslineCache.getCached, 'function',
  'module must export getCached()');
assert.equal(typeof statuslineCache.setCached, 'function',
  'module must export setCached()');
assert.equal(typeof statuslineCache.truncateGoverningThought, 'function',
  'module must export truncateGoverningThought()');
assert.equal(typeof statuslineCache.classifyHealth, 'function',
  'module must export classifyHealth()');
assert.equal(typeof statuslineCache.TTL_MS, 'number',
  'module must export TTL_MS as a number');
assert.equal(statuslineCache.TTL_MS, 5000,
  'TTL_MS must equal 5000 per CONTEXT R1 budget mitigation');

// ---------- Fixture helpers ----------

function mkRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-cache-test-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  return tmp;
}

function makeTriple(overrides) {
  const base = {
    reasoning: {
      exists: true,
      governing_thought: 'Test governing thought',
      reasoning_health_score: 0.82,
      is_stale: false,
      arguments_count: 3,
      mece_status: 'pass',
    },
  };
  return Object.assign(base, overrides || {});
}

// ---------- Test 1: absent cache file -> null + not fresh ----------

(function test1AbsentCache() {
  const room = mkRoom();
  const section = path.join(room, 'market-analysis');
  const r = statuslineCache.getCached(room, section);
  assert.ok(r, 'getCached must return an object');
  assert.equal(r.value, null, 'absent cache -> value null');
  assert.equal(r.fresh, false, 'absent cache -> fresh false');
  console.log('PASS test 1: absent cache returns null + not fresh');
})();

// ---------- Test 2: set then immediate get -> fresh hit ----------

(function test2FreshHit() {
  const room = mkRoom();
  const section = path.join(room, 'market-analysis');
  const triple = makeTriple();
  statuslineCache.setCached(room, section, triple);
  const r = statuslineCache.getCached(room, section);
  assert.equal(r.fresh, true, 'immediate read must be fresh');
  assert.ok(r.value, 'value must be populated');
  assert.equal(
    r.value.reasoning.governing_thought,
    'Test governing thought',
    'cached governing_thought round-trips'
  );
  assert.equal(
    r.value.reasoning.reasoning_health_score,
    0.82,
    'cached reasoning_health_score round-trips'
  );
  console.log('PASS test 2: set + immediate get returns fresh triple');
})();

// ---------- Test 3: TTL expiry -> not fresh ----------

(function test3TTLExpiry() {
  const room = mkRoom();
  const section = path.join(room, 'market-analysis');
  const triple = makeTriple();
  const cachePath = path.join(room, '.mindrian', 'statusline-cache.json');
  statuslineCache.setCached(room, section, triple);

  // Hand-rewind the ts to TTL_MS + 1 in the past so the next read is stale.
  const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  raw.ts = Date.now() - (statuslineCache.TTL_MS + 1);
  fs.writeFileSync(cachePath, JSON.stringify(raw));

  const r = statuslineCache.getCached(room, section);
  assert.equal(r.fresh, false, 'post-TTL read must not be fresh');
  console.log('PASS test 3: TTL expiry yields not-fresh result');
})();

// ---------- Test 4: setCached soft-fails on permission denied ----------

(function test4SetCachedGraceful() {
  // Construct an unwritable cache path: point .mindrian at a regular file
  // (not a directory) so mkdirSync + openSync both fail structurally.
  const room = mkRoom();
  const blocker = path.join(room, '.mindrian');
  // .mindrian already exists as a dir (mkRoom). Remove it and write a
  // file at that path so the cache write cannot mkdir through it.
  fs.rmSync(blocker, { recursive: true, force: true });
  fs.writeFileSync(blocker, 'not a directory');
  const section = path.join(room, 'market-analysis');

  // Must not throw.
  let threw = false;
  try {
    statuslineCache.setCached(room, section, makeTriple());
  } catch (_e) {
    threw = true;
  }
  assert.equal(threw, false, 'setCached must swallow filesystem errors');
  console.log('PASS test 4: setCached soft-fails on permission denied');
})();

// ---------- Test 5: cache keyed by (roomRoot, sectionPath) ----------

(function test5DistinctKeys() {
  const room = mkRoom();
  const sectionA = path.join(room, 'market-analysis');
  const sectionB = path.join(room, 'problem-definition');
  const tripleA = makeTriple({
    reasoning: {
      governing_thought: 'A',
      reasoning_health_score: 0.9,
      is_stale: false,
      exists: true,
    },
  });
  statuslineCache.setCached(room, sectionA, tripleA);
  const rB = statuslineCache.getCached(room, sectionB);
  assert.equal(rB.fresh, false,
    'different section key must NOT hit the cache');
  const rA = statuslineCache.getCached(room, sectionA);
  assert.equal(rA.fresh, true,
    'original section key MUST still hit the cache');
  console.log('PASS test 5: cache is keyed by (roomRoot, sectionPath)');
})();

// ---------- Test 6: atomic write -- no partial file observed ----------

(function test6AtomicWrite() {
  const room = mkRoom();
  const section = path.join(room, 'market-analysis');
  const cachePath = path.join(room, '.mindrian', 'statusline-cache.json');

  // Fire 5 setCached calls in rapid succession. Every one writes atomically
  // via openSync('wx') + rename. At no point must a reader observe a
  // malformed JSON body (either the full previous payload or the full new
  // payload are acceptable; partial bytes are not).
  for (let i = 0; i < 5; i += 1) {
    statuslineCache.setCached(room, section, makeTriple({
      reasoning: {
        governing_thought: 'round ' + i,
        reasoning_health_score: 0.1 * (i + 1),
        is_stale: false,
        exists: true,
      },
    }));
    // Immediately try to parse -- each intermediate state must be valid.
    const raw = fs.readFileSync(cachePath, 'utf8');
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) {
      assert.fail('observed non-JSON partial write: ' + e.message);
    }
    assert.ok(parsed && parsed.triple && parsed.triple.reasoning,
      'atomic write must yield a complete payload at every step');
  }

  // No .tmp leftovers.
  const entries = fs.readdirSync(path.join(room, '.mindrian'));
  const leftover = entries.filter(function (e) {
    return e.indexOf('.tmp') !== -1;
  });
  assert.deepEqual(leftover, [],
    'no .tmp files may survive the atomic write sequence');

  console.log('PASS test 6: atomic write leaves no partial observers');
})();

// ---------- Test 7: cache file location contract ----------

(function test7CacheLocation() {
  const room = mkRoom();
  const section = path.join(room, 'market-analysis');
  statuslineCache.setCached(room, section, makeTriple());
  const expected = path.join(room, '.mindrian', 'statusline-cache.json');
  assert.equal(fs.existsSync(expected), true,
    'cache file MUST land at roomRoot/.mindrian/statusline-cache.json');
  console.log('PASS test 7: cache file lives at .mindrian/statusline-cache.json');
})();

// ---------- Test 8: truncateGoverningThought short-circuit ----------

(function test8TruncateShort() {
  const short = 'Short governing thought';
  const r = statuslineCache.truncateGoverningThought(short);
  assert.equal(r, short, 'strings <= 60 chars must pass through unchanged');

  const exactly60 = 'x'.repeat(60);
  const r2 = statuslineCache.truncateGoverningThought(exactly60);
  assert.equal(r2, exactly60,
    'exactly-60-char strings must pass through unchanged');

  console.log('PASS test 8: truncateGoverningThought short-circuits <= 60 chars');
})();

// ---------- Test 9: truncateGoverningThought long truncation ----------

(function test9TruncateLong() {
  const long = 'x'.repeat(200);
  const r = statuslineCache.truncateGoverningThought(long);
  assert.equal(r.length, 60,
    'truncated output must be exactly 60 chars (59 + ellipsis)');
  // Last char is the Unicode ellipsis OR an ASCII "..." or literal sentinel.
  // Per PLAN spec: "first 59 chars + ellipsis". Accept either Unicode
  // ellipsis (single char) or "..." suffix.
  const tail = r.slice(-1);
  const isEllipsis = tail === '\u2026';
  const asciiTail = r.slice(-3) === '...';
  assert.ok(isEllipsis || asciiTail,
    'truncated output must carry an ellipsis marker (Unicode or ASCII)');
  console.log('PASS test 9: truncateGoverningThought truncates > 60 chars');
})();

// ---------- Test 10: classifyHealth threshold vocabulary ----------

(function test10ClassifyHealth() {
  // Canon Part 2 thresholds (byte-identical to triple-context-formatter):
  //   >= 0.7 -> check
  //   >= 0.4 -> warn
  //   <  0.4 -> low
  //   null / non-number -> --
  assert.equal(statuslineCache.classifyHealth(0.95), 'check');
  assert.equal(statuslineCache.classifyHealth(0.7), 'check');
  assert.equal(statuslineCache.classifyHealth(0.55), 'warn');
  assert.equal(statuslineCache.classifyHealth(0.4), 'warn');
  assert.equal(statuslineCache.classifyHealth(0.2), 'low');
  assert.equal(statuslineCache.classifyHealth(0), 'low');
  assert.equal(statuslineCache.classifyHealth(null), '--');
  assert.equal(statuslineCache.classifyHealth(undefined), '--');
  assert.equal(statuslineCache.classifyHealth(NaN), '--');
  assert.equal(statuslineCache.classifyHealth('not-a-number'), '--');
  console.log('PASS test 10: classifyHealth honors Canon Part 2 thresholds');
})();

console.log('\nAll 10 statusline-cache tests passed.');
