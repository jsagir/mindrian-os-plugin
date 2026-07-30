'use strict';
/*
 * Phase 244-01 Task 2 -- the content trigger tier + the isFallbackTier
 * allowlist.
 *
 * Pins the <behavior> block of 244-01-PLAN.md Task 2 verbatim:
 *   - TRIGGER_TIERS has length 4 and reads exactly
 *     ['signal', 'context', 'content', 'keyword'] in that order, frozen.
 *   - isContextTier('content') is false; isContextTier('signal') and
 *     isContextTier('context') stay true. Explicit allowlist, never a
 *     negated denylist.
 *   - isFallbackTier('content') and isFallbackTier('keyword') are true;
 *     isFallbackTier('signal'), isFallbackTier('context'),
 *     isFallbackTier(null), isFallbackTier(undefined) and
 *     isFallbackTier('nonsense') are false.
 *   - isContextTier and isFallbackTier are mutually exclusive over every
 *     member of TRIGGER_TIERS, and their union covers all four members.
 *   - classifyTriggerTier NEVER returns 'content' for any turn/tuple/ctx
 *     shape, including one carrying content-looking fields. It has no db
 *     handle and no corpus access; 'content' is stamped by the sensor's
 *     evidence bag, not derived by the classifier.
 *
 * Harness shape: PASS/FAIL/FAILURES, from tests/test-219-fts5-degrade.cjs:110-125.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');

const st = require('../lib/core/sensors/sensor-types.cjs');

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

console.log('Phase 244-01 trigger-tier vocab (content tier + isFallbackTier allowlist)');

test('TRIGGER_TIERS is frozen', function () {
  assert.strictEqual(Object.isFrozen(st.TRIGGER_TIERS), true, 'TRIGGER_TIERS must be Object.frozen');
});

test('TRIGGER_TIERS is exactly the 4-element ordered array [signal, context, content, keyword]', function () {
  // Deep equality against the literal order, not indexOf presence, so a
  // reorder mutation is caught.
  assert.deepStrictEqual(
    st.TRIGGER_TIERS,
    ['signal', 'context', 'content', 'keyword'],
    'TRIGGER_TIERS order is the R3 precedence doctrine'
  );
  assert.strictEqual(st.TRIGGER_TIERS.length, 4, 'TRIGGER_TIERS has length 4');
});

test('isContextTier: signal and context stay true', function () {
  assert.strictEqual(st.isContextTier('signal'), true);
  assert.strictEqual(st.isContextTier('context'), true);
});

test('isContextTier: content returns false (R3 -- content is not problem-state)', function () {
  assert.strictEqual(st.isContextTier('content'), false);
});

test('isContextTier: keyword returns false', function () {
  assert.strictEqual(st.isContextTier('keyword'), false);
});

test('isFallbackTier: content and keyword are true', function () {
  assert.strictEqual(st.isFallbackTier('content'), true);
  assert.strictEqual(st.isFallbackTier('keyword'), true);
});

test('isFallbackTier: signal, context, null, undefined, nonsense are false', function () {
  assert.strictEqual(st.isFallbackTier('signal'), false);
  assert.strictEqual(st.isFallbackTier('context'), false);
  assert.strictEqual(st.isFallbackTier(null), false);
  assert.strictEqual(st.isFallbackTier(undefined), false);
  assert.strictEqual(st.isFallbackTier('nonsense'), false);
});

test('isContextTier and isFallbackTier are mutually exclusive over every TRIGGER_TIERS member', function () {
  st.TRIGGER_TIERS.forEach(function (tier) {
    const ctx = st.isContextTier(tier);
    const fb = st.isFallbackTier(tier);
    assert.notStrictEqual(ctx, fb, 'tier "' + tier + '" must be exactly one of context/fallback, got ctx=' + ctx + ' fb=' + fb);
  });
});

test('isContextTier union isFallbackTier covers all four TRIGGER_TIERS members', function () {
  st.TRIGGER_TIERS.forEach(function (tier) {
    const covered = st.isContextTier(tier) || st.isFallbackTier(tier);
    assert.strictEqual(covered, true, 'tier "' + tier + '" must be covered by isContextTier or isFallbackTier');
  });
});

test('classifyTriggerTier never returns content, even with content-looking fields', function () {
  const shapes = [
    {},
    { text: 'hello world' },
    { signals: [{ kind: 'problem_state_changed' }] },
    // content-looking fields: none of these are in PROBLEM_STATE_FIELDS or
    // the signal-kind allowlist, so they must not influence the classifier.
    { text: 'hello', contentHits: [{ node_id: 'n1', rank: -1.2 }], trigger_tier: 'content' },
    { text: 'hello', content: 'some lexical relevance payload' },
  ];
  const tuples = [{}, { stage: 'validate' }, { problem_type: 'well-defined' }];
  const ctxs = [{}, { jtbd: 'diagnose' }, { graph_gap: 'thin-evidence' }, { content: true, contentScore: 0.9 }];

  shapes.forEach(function (turn) {
    tuples.forEach(function (tuple) {
      ctxs.forEach(function (ctx) {
        const tier = st.classifyTriggerTier(turn, tuple, ctx);
        assert.notStrictEqual(tier, 'content', 'classifyTriggerTier must never produce content for turn=' + JSON.stringify(turn) + ' tuple=' + JSON.stringify(tuple) + ' ctx=' + JSON.stringify(ctx));
        if (tier !== null) {
          assert.ok(st.TRIGGER_TIERS.indexOf(tier) !== -1, 'classifyTriggerTier must return a member of TRIGGER_TIERS or null, got ' + tier);
        }
      });
    });
  });
});

console.log('\nPhase 244-01 trigger-tier vocab: PASS=' + PASS + ' FAIL=' + FAIL);
if (FAIL > 0) {
  FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
  process.exit(1);
}
process.exit(0);
