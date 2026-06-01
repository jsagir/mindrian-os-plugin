'use strict';
/**
 * research-cache.test.cjs -- behavior suite for the shared TTL + source-keyed
 * on-disk research cache (Phase 130.5 Plan 02).
 *
 * Five behaviors (node:assert/strict, a tmp room dir via fs.mkdtempSync):
 *   1. hit within TTL   -- putCached then getCached returns the same results.
 *   2. miss (never written) -- getCached returns null for an unseen key.
 *   3. miss past TTL    -- an entry older than ttlMs is treated as a miss.
 *   4. shared key       -- cacheKey is stable across case/whitespace/punctuation
 *                          and namespaced by source, so /mos:research and
 *                          rs-discovery-engine resolve the SAME path.
 *   5. atomic write     -- no temp/partial file remains after putCached and the
 *                          final file parses as valid JSON.
 *
 * Deterministic TTL: tests inject opts.now (a clock seam) and opts.ttlMs so
 * no wall-clock sleep is needed. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cache = require('./research-cache.cjs');

function tmpRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'research-cache-test-'));
}

let passed = 0;
function ok(label) {
  passed += 1;
  console.log('  ok -', label);
}

// --- Test 1: hit within TTL ------------------------------------------------
(function test1HitWithinTtl() {
  const room = tmpRoom();
  const results = [
    { id: 'W1', title: 'Quantum coherence in avian magnetoreception', source: 'openalex' },
    { id: 'W2', title: 'Radical pair mechanism', source: 'openalex' },
  ];
  const t0 = Date.parse('2026-06-01T00:00:00Z');
  cache.putCached(room, 'openalex', 'quantum biology', results, { now: t0 });
  const got = cache.getCached(room, 'openalex', 'quantum biology', {
    now: t0 + 60 * 1000, // one minute later, well within TTL
  });
  assert.deepEqual(got, results, 'getCached within TTL returns the stored results');
  ok('Test 1: repeat (source, query) within TTL is a hit (no re-fetch)');
})();

// --- Test 2: miss (never written) ------------------------------------------
(function test2MissUnseen() {
  const room = tmpRoom();
  const got = cache.getCached(room, 'arxiv', 'never written query');
  assert.equal(got, null, 'getCached for an unwritten (source, query) is null');
  ok('Test 2: a (source, query) never written returns null (miss)');
})();

// --- Test 3: miss past TTL -------------------------------------------------
(function test3MissPastTtl() {
  const room = tmpRoom();
  const results = [{ id: 'W9', title: 'Stale paper' }];
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  cache.putCached(room, 'pubmed', 'crispr base editing', results, { now: t0 });
  // Read with a tiny ttlMs override and a now far past the TTL window.
  const got = cache.getCached(room, 'pubmed', 'crispr base editing', {
    now: t0 + 10 * 1000, // 10s later
    ttlMs: 1000, // 1s TTL -> entry is past TTL
  });
  assert.equal(got, null, 'a past-TTL entry is a miss so the caller re-fetches');
  // And confirm the same entry within a generous TTL is still a hit (proves it
  // is the TTL, not a write failure, that produced the miss).
  const fresh = cache.getCached(room, 'pubmed', 'crispr base editing', {
    now: t0 + 10 * 1000,
    ttlMs: 60 * 1000,
  });
  assert.deepEqual(fresh, results, 'within a generous TTL the same entry is a hit');
  ok('Test 3: an expired (past-TTL) entry is treated as a miss');
})();

// --- Test 4: shared key (stable across case/whitespace/punctuation) --------
(function test4SharedKey() {
  const a = cache.cacheKey('OpenAlex', 'Quantum  Biology!');
  const b = cache.cacheKey('openalex', 'quantum biology');
  assert.equal(a, b, 'cacheKey is stable across case/whitespace/punctuation');
  assert.ok(/openalex/.test(a), 'cacheKey is namespaced by source');
  // No path separators or traversal sequences survive normalization.
  assert.ok(!/[\\/]/.test(a), 'cacheKey contains no path separators');
  assert.ok(!a.includes('..'), 'cacheKey contains no parent-dir traversal');
  // Different sources for the same query must NOT collide.
  const arx = cache.cacheKey('arxiv', 'quantum biology');
  assert.notEqual(arx, b, 'different sources produce different keys (source-namespaced)');

  // The shared-path invariant: two callers with the same logical (source, query)
  // resolve the SAME on-disk path -- a write by one is read by the other.
  const room = tmpRoom();
  const results = [{ id: 'W42', title: 'Shared path proof' }];
  const t0 = Date.parse('2026-06-01T00:00:00Z');
  // /mos:research writes with messy casing/spacing/punctuation ...
  cache.putCached(room, 'OpenAlex', 'Quantum  Biology!', results, { now: t0 });
  // ... rs-discovery-engine reads with the normalized form and hits.
  const got = cache.getCached(room, 'openalex', 'quantum biology', { now: t0 });
  assert.deepEqual(got, results, 'a write by one surface is read by the other (shared path)');
  ok('Test 4: cacheKey stable + source-namespaced -> /mos:research and rs-discovery-engine share the path');
})();

// --- Test 5: atomic write (no leftover temp, valid JSON) -------------------
(function test5AtomicWrite() {
  const room = tmpRoom();
  const results = [{ id: 'W7', title: 'Atomic write proof' }];
  const p = cache.putCached(room, 'tavily', 'reverse salients hughes', results);
  assert.ok(typeof p === 'string' && p.length > 0, 'putCached returns the final path');
  assert.ok(fs.existsSync(p), 'the final cache file exists');

  const cacheDir = path.dirname(p);
  const entries = fs.readdirSync(cacheDir);
  // Exactly one file -- the final entry; no temp/partial sibling remains.
  const temps = entries.filter((n) => n.includes('.tmp') || n.startsWith('.'));
  assert.equal(temps.length, 0, 'no temp/partial file remains after putCached');
  assert.equal(entries.length, 1, 'only the final entry file is present');

  // The final file parses as valid JSON (no half-write window).
  const raw = fs.readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw); // throws if not valid JSON
  assert.deepEqual(parsed.results, results, 'the parsed entry carries the results');
  assert.equal(parsed.source, 'tavily', 'the entry records its source');
  assert.ok(parsed.query_key && parsed.fetched_at, 'the entry carries query_key + fetched_at');
  ok('Test 5: write is atomic -- no leftover temp, final file is valid JSON');
})();

console.log('\nresearch-cache.test.cjs: ' + passed + '/5 behaviors passed');
if (passed !== 5) {
  console.error('FAIL: expected 5 passing behaviors');
  process.exit(1);
}
