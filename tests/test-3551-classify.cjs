#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 03 Task 1 -- test-3551-classify: pins the pure
 * classifyRoomDelta(facts, watermarks, opts) classifier and computeDeltaHash
 * (lines) helper lib/core/sensors/sensor-room-delta.cjs exports (AMB-01).
 *
 * Bare node script, no framework, exits non-zero on any assertion failure.
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). House rule: hyphens only,
 * no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const assert = require('node:assert/strict');

let sensorFile;
try {
  sensorFile = require('../lib/core/sensors/sensor-room-delta.cjs');
} catch (_e) {
  sensorFile = null;
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-classify:');

assert.ok(sensorFile, 'lib/core/sensors/sensor-room-delta.cjs must exist and load (module missing)');
const { classifyRoomDelta, computeDeltaHash } = sensorFile;
assert.strictEqual(typeof classifyRoomDelta, 'function', 'classifyRoomDelta must be exported');
assert.strictEqual(typeof computeDeltaHash, 'function', 'computeDeltaHash must be exported');
ok('sensor-room-delta.cjs exports classifyRoomDelta and computeDeltaHash');

// ---------------------------------------------------------------------------
// classify: with watermarks {} (first evaluation) and facts claims count 5
// max_created_at 1000, artifacts null, contradicts_keys ['aaa...'],
// stage_hash 'bbb...', children ['ccc...']: classes === ['a'] (b, c, d need a
// prior watermark; a first evaluation sets their baseline only).
// ---------------------------------------------------------------------------
(function test_firstEvaluationOnlyClassA() {
  const facts = {
    claims: { count: 5, max_created_at: 1000 },
    artifacts: null,
    contradicts_keys: ['aaa000000000'],
    stage_hash: 'bbb000000000',
    children: ['ccc000000000'],
  };
  const result = classifyRoomDelta(facts, {}, {});
  assert.deepEqual(result.classes, ['a'], 'first evaluation (empty watermarks) must yield classes === [\'a\'] only');
  ok('first evaluation (watermarks {}) with claims.count 5 yields classes === [\'a\'] only (b/c/d need a prior watermark)');
})();

// ---------------------------------------------------------------------------
// classify: claims.count 4 with claimFloor 5 -> no class a; claims.count 5 ->
// class a; line 'a:1000'.
// ---------------------------------------------------------------------------
(function test_claimFloor() {
  const watermarks = { claims_created_at: 500 };
  const below = classifyRoomDelta(
    { claims: { count: 4, max_created_at: 1000 }, artifacts: null, contradicts_keys: [], stage_hash: null, children: [] },
    watermarks,
    { claimFloor: 5 }
  );
  assert.ok(below.classes.indexOf('a') === -1, 'claims.count 4 below claimFloor 5 must NOT yield class a');

  const atFloor = classifyRoomDelta(
    { claims: { count: 5, max_created_at: 1000 }, artifacts: null, contradicts_keys: [], stage_hash: null, children: [] },
    watermarks,
    { claimFloor: 5 }
  );
  assert.ok(atFloor.classes.indexOf('a') !== -1, 'claims.count 5 at claimFloor 5 must yield class a');
  assert.ok(atFloor.lines.indexOf('a:1000') !== -1, 'class a delta-fact line must be \'a:1000\' (the max_created_at)');
  ok('claims.count 4 (below claimFloor 5) yields no class a; claims.count 5 (at floor) yields class a with line \'a:1000\'');
})();

// ---------------------------------------------------------------------------
// classify: watermarks.contradicts_keys ['k1'] and facts ['k1','k2'] -> class
// b with line 'b:k2' only.
// ---------------------------------------------------------------------------
(function test_classB() {
  const result = classifyRoomDelta(
    { claims: { count: 0, max_created_at: null }, artifacts: null, contradicts_keys: ['k1', 'k2'], stage_hash: null, children: [] },
    { contradicts_keys: ['k1'] },
    {}
  );
  assert.ok(result.classes.indexOf('b') !== -1, 'a new CONTRADICTS key must yield class b');
  assert.deepEqual(result.lines.filter((l) => l.indexOf('b:') === 0), ['b:k2'], 'only the NEW key k2 gets a b: line, not the already-known k1');
  ok('watermarks.contradicts_keys [\'k1\'] vs facts [\'k1\',\'k2\'] yields class b with line \'b:k2\' only');
})();

// ---------------------------------------------------------------------------
// classify: watermarks.stage 's1' and facts stage_hash 's2' -> class c; facts
// stage_hash null -> no class c (unreadable STATE.md means no change).
// ---------------------------------------------------------------------------
(function test_classC() {
  const changed = classifyRoomDelta(
    { claims: { count: 0, max_created_at: null }, artifacts: null, contradicts_keys: [], stage_hash: 's2', children: [] },
    { stage: 's1' },
    {}
  );
  assert.ok(changed.classes.indexOf('c') !== -1, 'a stage_hash change from s1 to s2 must yield class c');

  const unreadable = classifyRoomDelta(
    { claims: { count: 0, max_created_at: null }, artifacts: null, contradicts_keys: [], stage_hash: null, children: [] },
    { stage: 's1' },
    {}
  );
  assert.ok(unreadable.classes.indexOf('c') === -1, 'stage_hash null (unreadable STATE.md) must NOT yield class c');
  ok('stage_hash change s1 -> s2 yields class c; stage_hash null (unreadable) yields no class c');
})();

// ---------------------------------------------------------------------------
// classify: watermarks.children ['c1'] and facts ['c1','c2'] -> class d with
// line 'd:c2'.
// ---------------------------------------------------------------------------
(function test_classD() {
  const result = classifyRoomDelta(
    { claims: { count: 0, max_created_at: null }, artifacts: null, contradicts_keys: [], stage_hash: null, children: ['c1', 'c2'] },
    { children: ['c1'] },
    {}
  );
  assert.ok(result.classes.indexOf('d') !== -1, 'a new sub-room key must yield class d');
  assert.ok(result.lines.indexOf('d:c2') !== -1, 'the new sub-room key gets a d: line');
  ok('watermarks.children [\'c1\'] vs facts [\'c1\',\'c2\'] yields class d with line \'d:c2\'');
})();

// ---------------------------------------------------------------------------
// classify: artifacts.count 1 -> class e; opts.materialId 'abc123ef' adds
// line 'e:m:abc123ef' and class e even when artifacts is null.
// ---------------------------------------------------------------------------
(function test_classE() {
  const viaArtifacts = classifyRoomDelta(
    { claims: { count: 0, max_created_at: null }, artifacts: { count: 1, max_created_at: 2000 }, contradicts_keys: [], stage_hash: null, children: [] },
    { artifacts_created_at: 100 },
    {}
  );
  assert.ok(viaArtifacts.classes.indexOf('e') !== -1, 'artifacts.count 1 must yield class e');

  const viaMaterialId = classifyRoomDelta(
    { claims: { count: 0, max_created_at: null }, artifacts: null, contradicts_keys: [], stage_hash: null, children: [] },
    {},
    { materialId: 'abc123ef' }
  );
  assert.ok(viaMaterialId.classes.indexOf('e') !== -1, 'opts.materialId must yield class e even when artifacts is null');
  assert.ok(viaMaterialId.lines.indexOf('e:m:abc123ef') !== -1, 'opts.materialId must add the line \'e:m:abc123ef\'');
  ok('artifacts.count 1 yields class e; opts.materialId adds class e + line \'e:m:abc123ef\' even when artifacts is null');
})();

// ---------------------------------------------------------------------------
// classify returns { changed, classes (sorted, unique), delta_hash (64 hex or
// null when unchanged), lines (sorted), next_watermarks } and next_watermarks
// carries every current fact, keeping the prior value where the fact is null.
// ---------------------------------------------------------------------------
(function test_returnShape() {
  const facts = {
    claims: { count: 5, max_created_at: 1000 },
    artifacts: { count: 1, max_created_at: 2000 },
    contradicts_keys: ['k2'],
    stage_hash: 's2',
    children: ['c2'],
  };
  const watermarks = {
    claims_created_at: 500,
    artifacts_created_at: 1000,
    contradicts_keys: ['k1'],
    stage: 's1',
    children: ['c1'],
  };
  const result = classifyRoomDelta(facts, watermarks, { claimFloor: 5 });

  for (const key of ['changed', 'classes', 'delta_hash', 'lines', 'next_watermarks']) {
    assert.ok(Object.prototype.hasOwnProperty.call(result, key), 'classifyRoomDelta result must carry key \'' + key + '\'');
  }
  assert.strictEqual(typeof result.changed, 'boolean', 'changed must be a boolean');
  assert.ok(Array.isArray(result.classes), 'classes must be an array');
  const sortedClasses = result.classes.slice().sort();
  assert.deepEqual(result.classes, sortedClasses, 'classes must be sorted');
  assert.deepEqual(result.classes, Array.from(new Set(result.classes)), 'classes must be unique');
  assert.ok(Array.isArray(result.lines), 'lines must be an array');
  const sortedLines = result.lines.slice().sort();
  assert.deepEqual(result.lines, sortedLines, 'lines must be sorted');
  if (result.classes.length > 0) {
    assert.match(result.delta_hash, /^[0-9a-f]{64}$/, 'delta_hash must be 64 lowercase hex chars when classes is non-empty');
  }

  assert.strictEqual(typeof result.next_watermarks, 'object', 'next_watermarks must be an object');
  for (const key of ['claims_created_at', 'artifacts_created_at', 'contradicts_keys', 'stage', 'children']) {
    assert.ok(Object.prototype.hasOwnProperty.call(result.next_watermarks, key), 'next_watermarks must carry key \'' + key + '\'');
  }
  assert.strictEqual(result.next_watermarks.claims_created_at, 1000, 'next_watermarks.claims_created_at must be the current fact');
  assert.strictEqual(result.next_watermarks.artifacts_created_at, 2000, 'next_watermarks.artifacts_created_at must be the current fact');
  assert.deepEqual(result.next_watermarks.stage, 's2', 'next_watermarks.stage must be the current fact');

  // Keeping the prior value where the fact is null.
  const nullFacts = {
    claims: { count: 0, max_created_at: null },
    artifacts: null,
    contradicts_keys: [],
    stage_hash: null,
    children: [],
  };
  const nullResult = classifyRoomDelta(nullFacts, watermarks, {});
  assert.strictEqual(nullResult.next_watermarks.claims_created_at, 500, 'a null max_created_at must keep the prior watermark');
  assert.strictEqual(nullResult.next_watermarks.stage, 's1', 'a null stage_hash must keep the prior watermark');
  ok('classifyRoomDelta returns the full { changed, classes, delta_hash, lines, next_watermarks } shape; next_watermarks keeps prior values on null facts');
})();

// ---------------------------------------------------------------------------
// classify: unchanged facts (same as watermarks, count below floor) -> a
// falsy changed and null delta_hash.
// ---------------------------------------------------------------------------
(function test_unchangedIsNull() {
  const watermarks = {
    claims_created_at: 1000,
    artifacts_created_at: 2000,
    contradicts_keys: ['k1'],
    stage: 's1',
    children: ['c1'],
  };
  const facts = {
    claims: { count: 0, max_created_at: 1000 },
    artifacts: { count: 0, max_created_at: 2000 },
    contradicts_keys: ['k1'],
    stage_hash: 's1',
    children: ['c1'],
  };
  const result = classifyRoomDelta(facts, watermarks, {});
  assert.strictEqual(result.classes.length, 0, 'unchanged facts against matching watermarks must yield zero classes');
  assert.strictEqual(result.changed, false, 'changed must be false when classes is empty');
  assert.strictEqual(result.delta_hash, null, 'delta_hash must be null when unchanged');
  ok('unchanged facts against matching watermarks yield changed === false and delta_hash === null');
})();

// ---------------------------------------------------------------------------
// computeDeltaHash(['b:x','a:1']) === computeDeltaHash(['a:1','b:x']); two
// classifications of the same facts give the same delta_hash; changing one
// fact changes it; the classifier source contains no Date.now, new Date or
// Math.random on an executable line.
// ---------------------------------------------------------------------------
(function test_hashOrderFree() {
  const h1 = computeDeltaHash(['b:x', 'a:1']);
  const h2 = computeDeltaHash(['a:1', 'b:x']);
  assert.strictEqual(h1, h2, 'computeDeltaHash must be order-free (sorted before hashing)');
  assert.match(h1, /^[0-9a-f]{64}$/, 'computeDeltaHash must return 64 lowercase hex chars');
  ok('computeDeltaHash(lines) is order-free: [\'b:x\',\'a:1\'] and [\'a:1\',\'b:x\'] hash identically');
})();

(function test_hashStableAndSensitive() {
  const facts = {
    claims: { count: 5, max_created_at: 1000 },
    artifacts: null,
    contradicts_keys: [],
    stage_hash: null,
    children: [],
  };
  const r1 = classifyRoomDelta(facts, {}, { claimFloor: 5 });
  const r2 = classifyRoomDelta(facts, {}, { claimFloor: 5 });
  assert.strictEqual(r1.delta_hash, r2.delta_hash, 'two classifications of the same facts must give the same delta_hash');

  const changedFacts = {
    claims: { count: 6, max_created_at: 1001 },
    artifacts: null,
    contradicts_keys: [],
    stage_hash: null,
    children: [],
  };
  const r3 = classifyRoomDelta(changedFacts, {}, { claimFloor: 5 });
  assert.notStrictEqual(r1.delta_hash, r3.delta_hash, 'changing one fact must change delta_hash');
  ok('classifying the same facts twice gives the same delta_hash; changing one fact changes it');
})();

(function test_noClockOrRandom() {
  const src = require('node:fs').readFileSync(require.resolve('../lib/core/sensors/sensor-room-delta.cjs'), 'utf8');
  const codeLines = hygiene.nonCommentLines(require.resolve('../lib/core/sensors/sensor-room-delta.cjs'));
  const forbidden = [/Date\.now\s*\(/, /new\s+Date\s*\(/, /Math\.random\s*\(/];
  for (const line of codeLines) {
    for (const rx of forbidden) {
      assert.equal(rx.test(line), false, 'sensor-room-delta.cjs must contain no ' + rx + ' on an executable (non-comment) line: ' + line);
    }
  }
  assert.ok(src.length > 0, 'sanity: source file is non-empty');
  ok('the classifier source contains no Date.now, new Date or Math.random on an executable line');
})();

console.log('');
console.log('PASS test-3551-classify.cjs (' + checks + ' checks)');

assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
netGuard.restore();
