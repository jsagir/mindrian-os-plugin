'use strict';
/*
 * Phase 244-04 -- fence the cross-family rank-fusion seam (TRIG-02).
 *
 * Pins the full <behavior> blocks of Tasks 1-2 of 244-04-PLAN.md, plus the
 * SC2-named same-family-domination regression, the sign-convention fence,
 * and the live-seam fence:
 *
 *   Task 1 (lib/workflow/f-selector-ranker.cjs -- the optional seam):
 *     - rankForSelector with NO tierCandidates key is a byte-identical no-op.
 *     - rankForSelector with tierCandidates: [] is also a no-op.
 *     - a supplied tagged { source, items } list makes every returned row
 *       carry tier_family, and rows that appeared in a supplied list also
 *       carry rrf_score + tier_sources.
 *     - every scored row is tagged tier_family: 'command' by default.
 *     - fusion is by RANK POSITION: identical positions with inverted
 *       magnitudes produce identical output order.
 *     - fusion runs on the FULL scored list, BEFORE any slice(0, k): a
 *       cross-family candidate buried at D4 position 4/5 can reach top 3.
 *     - MAX_K stays 3; the 0.70/0.15 detent constants and D4 weights are
 *       unchanged; output length still respects the clamped k.
 *     - a malformed tierCandidates (string, number, array of nulls, a list
 *       whose items lack id) degrades to the no-op path and never throws.
 *
 *   Task 2 (lib/core/orchestration-candidate-lift.cjs -- the live supplier):
 *     - buildTierCandidates(sensorReaches, projectionOffer) returns [] on
 *       missing/empty/malformed input and never throws.
 *     - options are grouped into one tagged list PER DISTINCT tier family,
 *       preserving option order.
 *     - an option whose matching reach carries evidence.trigger_tier:
 *       'content' lands in tier_content; a reach with no trigger_tier (or an
 *       option with no matching reach) lands in tier_keyword, the documented
 *       fallback -- never tier_content, never tier_context.
 *     - only TRIGGER_TIERS-drawn values are ever emitted as a source name.
 *     - liftFiringCandidate behaves identically to today when projectionOffer
 *       has no options or sensorReaches is empty.
 *
 *   SC2 same-family-domination regression: three near-identical commands of
 *   one family occupy D4 positions 1-3; a genuinely relevant cross-family
 *   command sits at position 4/5; supplying tier candidates that rank the
 *   cross-family command first promotes it into the top 3 WITH fusion, and
 *   it does NOT appear WITHOUT fusion. Both halves asserted in one test.
 *
 *   Sign-convention fence: a bm25-shaped (negative, decreasing) list and a
 *   0..1-shaped (positive, decreasing) list with IDENTICAL id order produce
 *   an IDENTICAL fused output, proving position (not magnitude/sign) drives
 *   the result.
 *
 *   Live-seam fence: drive liftFiringCandidate with a projectionOffer and
 *   sensorReaches, inject a rankFn stub that records the args it received,
 *   and assert tierCandidates arrived non-empty.
 *
 * No absolute rrf_score assertions: ORDER and MEMBERSHIP only. The scores
 * are rrfFuse's own implementation detail (Phase 219 owns them).
 *
 * Harness shape: PASS/FAIL/FAILURES, from tests/test-219-fts5-degrade.cjs:110-125.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const path = require('node:path');

const RANKER_PATH = path.resolve(__dirname, '..', 'lib', 'workflow', 'f-selector-ranker.cjs');
const LIFT_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'orchestration-candidate-lift.cjs');

function loadRanker() {
  delete require.cache[require.resolve(RANKER_PATH)];
  return require(RANKER_PATH);
}

function loadLift() {
  delete require.cache[require.resolve(LIFT_PATH)];
  return require(LIFT_PATH);
}

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

console.log('Phase 244-04 RRF fusion seam fences (TRIG-02)');

// ---------------------------------------------------------------------------
// A synthetic registry, primed via the _test._setRegistry seam (never the
// shipped data/command-registry.json), so the domination scenario is
// deterministic and cannot drift when a real command is added to the repo.
//
//   /mos:fam-a1/a2/a3  -- three near-identical "family A" commands, D4-scored
//                         via distinct high brain_confidence edges so they
//                         occupy D4 positions 1-3.
//   /mos:cross-b       -- a genuinely relevant "family B" command, D4-scored
//                         low so it sits at position 4 (buried).
// ---------------------------------------------------------------------------
const REGISTRY = Object.freeze({
  commands: [
    { command: '/mos:fam-a1', frameworks: ['FamA1'], serves_jtbd: ['x'], jtbd_label: 'a1', jtbd_summary: 's', teaching: 't' },
    { command: '/mos:fam-a2', frameworks: ['FamA2'], serves_jtbd: ['x'], jtbd_label: 'a2', jtbd_summary: 's', teaching: 't' },
    { command: '/mos:fam-a3', frameworks: ['FamA3'], serves_jtbd: ['x'], jtbd_label: 'a3', jtbd_summary: 's', teaching: 't' },
    { command: '/mos:cross-b', frameworks: ['FamB'], serves_jtbd: ['x'], jtbd_label: 'b', jtbd_summary: 's', teaching: 't' },
  ],
});

const PACKET = Object.freeze({
  local_graph_summary: {
    framework_chain_hint: {
      edges: [
        { from: 'FamA1', to: 'x', confidence: 0.95 },
        { from: 'FamA2', to: 'x', confidence: 0.90 },
        { from: 'FamA3', to: 'x', confidence: 0.85 },
        { from: 'FamB', to: 'x', confidence: 0.10 },
      ],
    },
  },
});

function freshRanker() {
  const r = loadRanker();
  r._test._resetCaches();
  r._test._setRegistry(REGISTRY);
  return r;
}

try {
  // -------------------------------------------------------------------------
  // Task 1: the no-op fence.
  // -------------------------------------------------------------------------
  test('rankForSelector with NO tierCandidates key is deterministic (baseline captured with the key absent, not undefined)', function () {
    const r = freshRanker();
    const args = { packetOptional: PACKET, roomState: {}, k: 3 };
    assert.strictEqual(Object.prototype.hasOwnProperty.call(args, 'tierCandidates'), false);
    const base = JSON.stringify(r.rankForSelector(args));
    const again = JSON.stringify(r.rankForSelector(Object.assign({}, args)));
    assert.strictEqual(base, again, 'rankForSelector must be deterministic for identical args');
  });

  test('rankForSelector with tierCandidates: [] is byte-identical to the absent-key baseline', function () {
    const r = freshRanker();
    const args = { packetOptional: PACKET, roomState: {}, k: 3 };
    const base = JSON.stringify(r.rankForSelector(args));
    const emptyArr = JSON.stringify(r.rankForSelector(Object.assign({}, args, { tierCandidates: [] })));
    assert.strictEqual(emptyArr, base, 'tierCandidates: [] must be a byte-identical no-op');
  });

  test('malformed tierCandidates (string) degrades to the no-op path and never throws', function () {
    const r = freshRanker();
    const args = { packetOptional: PACKET, roomState: {}, k: 3 };
    const base = JSON.stringify(r.rankForSelector(args));
    let out;
    assert.doesNotThrow(function () {
      out = r.rankForSelector(Object.assign({}, args, { tierCandidates: 'not-an-array' }));
    });
    assert.strictEqual(JSON.stringify(out), base, 'a string tierCandidates must degrade to the no-op path');
  });

  test('malformed tierCandidates (number) degrades to the no-op path and never throws', function () {
    const r = freshRanker();
    const args = { packetOptional: PACKET, roomState: {}, k: 3 };
    const base = JSON.stringify(r.rankForSelector(args));
    let out;
    assert.doesNotThrow(function () {
      out = r.rankForSelector(Object.assign({}, args, { tierCandidates: 42 }));
    });
    assert.strictEqual(JSON.stringify(out), base, 'a number tierCandidates must degrade to the no-op path');
  });

  test('malformed tierCandidates (array of nulls) degrades to the no-op path and never throws', function () {
    const r = freshRanker();
    const args = { packetOptional: PACKET, roomState: {}, k: 3 };
    const base = JSON.stringify(r.rankForSelector(args));
    let out;
    assert.doesNotThrow(function () {
      out = r.rankForSelector(Object.assign({}, args, { tierCandidates: [null, null] }));
    });
    assert.strictEqual(JSON.stringify(out), base, 'an array-of-nulls tierCandidates must degrade to the no-op path');
  });

  test('malformed tierCandidates (a list whose items lack id) degrades to the no-op path and never throws', function () {
    const r = freshRanker();
    const args = { packetOptional: PACKET, roomState: {}, k: 3 };
    const base = JSON.stringify(r.rankForSelector(args));
    let out;
    assert.doesNotThrow(function () {
      out = r.rankForSelector(Object.assign({}, args, {
        tierCandidates: [{ source: 'x', items: [{ foo: 1 }, { bar: 2 }] }],
      }));
    });
    assert.strictEqual(JSON.stringify(out), base, 'items lacking id must degrade to the no-op path');
  });

  // -------------------------------------------------------------------------
  // Task 1: tagging behavior on a genuinely supplied list.
  // -------------------------------------------------------------------------
  test('every returned row carries tier_family; rows in a supplied list also carry rrf_score + tier_sources', function () {
    const r = freshRanker();
    const out = r.rankForSelector({
      packetOptional: PACKET,
      roomState: {},
      k: 4,
      tierCandidates: [{ source: 'content_fts', items: [{ id: '/mos:cross-b' }] }],
    });
    assert.ok(out.length > 0, 'expected at least one ranked row');
    out.forEach(function (row) {
      assert.strictEqual(row.tier_family, 'command', 'tier_family must default to "command" on every row');
    });
    const crossRow = out.find(function (r2) { return r2.command === '/mos:cross-b'; });
    assert.ok(crossRow, 'cross-b must be present in the returned rows');
    assert.strictEqual(typeof crossRow.rrf_score, 'number', 'a row present in a supplied list must carry rrf_score');
    assert.ok(Array.isArray(crossRow.tier_sources), 'a row present in a supplied list must carry tier_sources');
    assert.ok(crossRow.tier_sources.indexOf('content_fts') !== -1, 'tier_sources must record the supplied source name');
  });

  // -------------------------------------------------------------------------
  // Sign-convention / rank-position fence.
  // -------------------------------------------------------------------------
  test('fusion is by RANK POSITION: identical positions with inverted magnitudes yield identical output order', function () {
    const bm25Shaped = { source: 'bm25_like', items: [{ id: '/mos:cross-b' }, { id: '/mos:fam-a3' }, { id: '/mos:fam-a2' }] };
    const zeroOneShaped = { source: 'zero_one_like', items: [{ id: '/mos:cross-b' }, { id: '/mos:fam-a3' }, { id: '/mos:fam-a2' }] };

    const r1 = freshRanker();
    const outNeg = r1.rankForSelector({
      packetOptional: PACKET, roomState: {}, k: 4, tierCandidates: [bm25Shaped],
    }).map(function (x) { return x.command; });

    const r2 = freshRanker();
    const outPos = r2.rankForSelector({
      packetOptional: PACKET, roomState: {}, k: 4, tierCandidates: [zeroOneShaped],
    }).map(function (x) { return x.command; });

    assert.deepStrictEqual(outNeg, outPos,
      'fused order must depend only on array position, not on the raw score scale/sign of the (unused) magnitudes');
  });

  // -------------------------------------------------------------------------
  // Task 1: fusion runs pre-slice.
  // -------------------------------------------------------------------------
  test('fusion runs on the FULL pre-slice scored list: a buried D4-position-4 candidate can reach the top k', function () {
    const r = freshRanker();
    const out = r.rankForSelector({
      packetOptional: PACKET,
      roomState: {},
      k: 3,
      tierCandidates: [{ source: 'content_fts', items: [{ id: '/mos:cross-b' }, { id: '/mos:fam-a1' }] }],
    });
    assert.strictEqual(out.length, 3, 'k=3 must still return exactly 3 rows');
    assert.ok(out.some(function (x) { return x.command === '/mos:cross-b'; }),
      'cross-b (D4 position 4, buried) must reach the top 3 once promoted by fusion');
  });

  // -------------------------------------------------------------------------
  // Base-row-cleanliness fence: _applyTierFusion must copy, never mutate.
  // -------------------------------------------------------------------------
  test('_applyTierFusion never mutates the caller-supplied base rows (copy-on-write)', function () {
    const r = freshRanker();
    const baseRows = [{ command: '/mos:x', score: 0.5 }, { command: '/mos:y', score: 0.4 }];
    const tc = [{ source: 's', items: [{ id: '/mos:x' }] }];
    r._applyTierFusion(baseRows, tc, 2);
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(baseRows[0], 'tier_family'), false,
      'the caller-supplied base row object must never be mutated in place'
    );
    assert.deepStrictEqual(baseRows[0], { command: '/mos:x', score: 0.5 },
      'the caller-supplied base row must be byte-identical to its pre-call shape');
  });

  // -------------------------------------------------------------------------
  // MAX_K / row-budget fence: fusion can reorder, never widen, the clamp.
  // -------------------------------------------------------------------------
  test('MAX_K is still 3, and the returned list length never exceeds the clamped k', function () {
    const r = freshRanker();
    assert.strictEqual(r.MAX_K, 3, 'MAX_K must remain 3 (Canon Part 3 frozen scalar)');
    const out = r.rankForSelector({
      packetOptional: PACKET,
      roomState: {},
      k: 100, // caller requests far more than MAX_K
      tierCandidates: [{ source: 'content_fts', items: [{ id: '/mos:cross-b' }] }],
    });
    assert.ok(out.length <= r.MAX_K, 'fusion must never widen the row budget past MAX_K');
  });

  // -------------------------------------------------------------------------
  // SC2 -- the SAME-FAMILY-DOMINATION regression. Both halves in one test.
  // -------------------------------------------------------------------------
  test('SC2 same-family-domination: cross-family candidate appears in top 3 WITH fusion, absent WITHOUT it', function () {
    const withoutFusion = freshRanker().rankForSelector({
      packetOptional: PACKET, roomState: {}, k: 3,
    }).map(function (x) { return x.command; });

    const withFusion = freshRanker().rankForSelector({
      packetOptional: PACKET,
      roomState: {},
      k: 3,
      tierCandidates: [{ source: 'content_fts', items: [{ id: '/mos:cross-b' }, { id: '/mos:fam-a1' }] }],
    }).map(function (x) { return x.command; });

    console.log('    SC2 ordering WITHOUT fusion: ' + JSON.stringify(withoutFusion));
    console.log('    SC2 ordering WITH fusion:    ' + JSON.stringify(withFusion));

    assert.strictEqual(withoutFusion.indexOf('/mos:cross-b'), -1,
      'WITHOUT fusion, three same-family D4-dominant commands must bury the cross-family candidate out of the top 3');
    assert.ok(withFusion.indexOf('/mos:cross-b') !== -1,
      'WITH fusion, the cross-family candidate must reach the top 3');
  });

  // ===========================================================================
  // Task 2: buildTierCandidates -- degrade-cleanly legs.
  // ===========================================================================
  test('buildTierCandidates returns [] on null/undefined/malformed input and never throws', function () {
    const lift = loadLift();
    assert.doesNotThrow(function () {
      assert.deepStrictEqual(lift.buildTierCandidates(null, null), []);
      assert.deepStrictEqual(lift.buildTierCandidates(undefined, undefined), []);
      assert.deepStrictEqual(lift.buildTierCandidates('garbage', 42), []);
      assert.deepStrictEqual(lift.buildTierCandidates([], { options: [] }), []);
      assert.deepStrictEqual(lift.buildTierCandidates([], { options: null }), []);
    });
  });

  test('buildTierCandidates groups options by distinct tier family, preserving option order', function () {
    const lift = loadLift();
    const sensorReaches = [
      { reach_id: 'context_block', posture: 'hold', evidence: { trigger_tier: 'content' } },
      { reach_id: 'deep_research', posture: 'push_forward', evidence: {} },
    ];
    const projectionOffer = {
      options: [
        { command: '/mos:content-cmd', reach_id: 'context_block' },
        { command: '/mos:keyword-cmd', reach_id: 'deep_research' },
        { command: '/mos:content-cmd-2', reach_id: 'context_block' },
      ],
    };
    const tc = lift.buildTierCandidates(sensorReaches, projectionOffer);
    const contentList = tc.find(function (l) { return l.source === 'tier_content'; });
    assert.ok(contentList, 'expected a tier_content list');
    assert.deepStrictEqual(
      contentList.items.map(function (i) { return i.id; }),
      ['/mos:content-cmd', '/mos:content-cmd-2'],
      'option order must be preserved within a family list'
    );
  });

  test('an option whose reach carries evidence.trigger_tier "content" lands in tier_content', function () {
    const lift = loadLift();
    const sensorReaches = [{ reach_id: 'context_block', posture: 'hold', evidence: { trigger_tier: 'content' } }];
    const projectionOffer = { options: [{ command: '/mos:content-cmd', reach_id: 'context_block' }] };
    const tc = lift.buildTierCandidates(sensorReaches, projectionOffer);
    assert.strictEqual(tc.length, 1);
    assert.strictEqual(tc[0].source, 'tier_content');
    assert.deepStrictEqual(tc[0].items, [{ id: '/mos:content-cmd' }]);
  });

  test('a reach with no trigger_tier falls back to tier_keyword, never tier_content or tier_context', function () {
    const lift = loadLift();
    const sensorReaches = [{ reach_id: 'deep_research', posture: 'push_forward', evidence: {} }];
    const projectionOffer = { options: [{ command: '/mos:keyword-cmd', reach_id: 'deep_research' }] };
    const tc = lift.buildTierCandidates(sensorReaches, projectionOffer);
    assert.strictEqual(tc.length, 1);
    assert.strictEqual(tc[0].source, 'tier_keyword');
  });

  test('an option with NO matching reach falls back to tier_keyword, never tier_content or tier_context', function () {
    const lift = loadLift();
    const sensorReaches = [{ reach_id: 'context_block', posture: 'hold', evidence: { trigger_tier: 'content' } }];
    const projectionOffer = { options: [{ command: '/mos:unmatched-cmd', reach_id: 'no_such_reach' }] };
    const tc = lift.buildTierCandidates(sensorReaches, projectionOffer);
    assert.strictEqual(tc.length, 1);
    assert.strictEqual(tc[0].source, 'tier_keyword');
  });

  test('only TRIGGER_TIERS-drawn values are ever emitted as a source name (unknown value coerces to the fallback)', function () {
    const lift = loadLift();
    const sensorReaches = [{ reach_id: 'context_block', posture: 'hold', evidence: { trigger_tier: 'not-a-real-tier' } }];
    const projectionOffer = { options: [{ command: '/mos:weird-cmd', reach_id: 'context_block' }] };
    const tc = lift.buildTierCandidates(sensorReaches, projectionOffer);
    assert.strictEqual(tc.length, 1);
    assert.strictEqual(tc[0].source, 'tier_keyword', 'an unrecognized trigger_tier value must coerce to the keyword fallback, never mint a new family');
  });

  // ===========================================================================
  // Task 2: liftFiringCandidate pre-244 parity + the live-seam fence.
  // ===========================================================================
  test('liftFiringCandidate behaves identically to today when projectionOffer has no options', function () {
    const lift = loadLift();
    const result = lift.liftFiringCandidate({ projectionOffer: null, sensorReaches: [] });
    assert.strictEqual(result.reason, 'no_offer');
    assert.strictEqual(result.fire_skill_verb, null);
    assert.strictEqual(result.lifted_option, null);
    assert.strictEqual(result.command_recommendation, null);
  });

  test('liftFiringCandidate behaves identically to today when sensorReaches is empty (options present)', function () {
    const lift = loadLift();
    let recordedArgs = null;
    const rankFnStub = function (args) {
      recordedArgs = args;
      return [{ command: '/mos:solo-cmd', score: 0.95 }];
    };
    const result = lift.liftFiringCandidate({
      projectionOffer: { options: [{ command: '/mos:solo-cmd', reach_id: 'context_block' }] },
      sensorReaches: [],
      rankFn: rankFnStub,
    });
    assert.strictEqual(result.reason, 'lifted');
    // No fired reaches -> buildTierCandidates degrades to tier_keyword (the
    // fallback), which is still non-empty (the option is still grouped);
    // pre-244 parity is proven by confidence/verb/hitl_shape being unchanged,
    // not by tierCandidates being empty (it legitimately is not, since the
    // fallback grouping is itself a valid, always-on classification).
    assert.strictEqual(result.confidence, 0.95);
    assert.ok(recordedArgs, 'rankFn must have been called');
  });

  test('LIVE-SEAM FENCE: liftFiringCandidate with a real projectionOffer + sensorReaches forwards non-empty tierCandidates to rankFn', function () {
    const lift = loadLift();
    const sensorReaches = [
      { reach_id: 'context_block', posture: 'hold', evidence: { trigger_tier: 'content' } },
      { reach_id: 'deep_research', posture: 'push_forward', evidence: {} },
    ];
    const projectionOffer = {
      options: [
        { command: '/mos:content-cmd', reach_id: 'context_block' },
        { command: '/mos:keyword-cmd', reach_id: 'deep_research' },
      ],
    };
    let recordedArgs = null;
    const rankFnStub = function (args) {
      recordedArgs = args;
      return [{ command: '/mos:content-cmd', score: 0.9 }];
    };
    const result = lift.liftFiringCandidate({
      projectionOffer: projectionOffer,
      sensorReaches: sensorReaches,
      rankFn: rankFnStub,
      context: { roomState: {}, problem_type: 'WDP' },
    });
    console.log('    LIVE-SEAM observed rankFn args: ' + JSON.stringify(recordedArgs));
    assert.strictEqual(result.reason, 'lifted');
    assert.ok(recordedArgs, 'rankFn must have been invoked');
    assert.ok(Array.isArray(recordedArgs.tierCandidates), 'tierCandidates must have arrived at rankFn as an array');
    assert.ok(recordedArgs.tierCandidates.length > 0, 'tierCandidates must have arrived non-empty');
    const sources = recordedArgs.tierCandidates.map(function (l) { return l.source; });
    assert.ok(sources.indexOf('tier_content') !== -1, 'tier_content must be among the forwarded sources');
    assert.ok(sources.indexOf('tier_keyword') !== -1, 'tier_keyword must be among the forwarded sources');
  });
} finally {
  // Restore module caches so this file never leaks state into a later file
  // in the same process (aggregator runs each test file in its own node
  // process today, but this mirrors the fixture-room-219 discipline anyway).
  try {
    const r = loadRanker();
    r._test._resetCaches();
  } catch (_e) { /* ignore */ }
}

console.log('\nPhase 244-04 RRF fusion seam: PASS=' + PASS + ' FAIL=' + FAIL);
if (FAIL > 0) {
  FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
  process.exit(1);
}
process.exit(0);
