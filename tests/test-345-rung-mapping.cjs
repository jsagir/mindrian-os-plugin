#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-01 Task 2 -- the rung-vocabulary round trip and the Part 8
 * known-tool-shape proof for all four rungs.
 *
 * Grounds every leg against the shipped organs it composes, not a
 * reimplementation of them:
 *   - lib/core/brain-client.cjs::_inferRungFromQuestion (the PERSISTED
 *     vocabulary's own classifier; brain-client.cjs:1150-1200)
 *   - lib/core/part8-egress-guard.cjs::classify (the WIRE vocabulary's own
 *     known-shape proof; part8-egress-guard.cjs:325-350, :436-447)
 *
 * STRAT-03 (taxonomy_ladder rung enum) round trip: all four rungs classify
 * as `allow` with the stable reason literal `taxonomy_ladder rung enum`
 * (already pinned at tests/test-260906-fda-known-tool-shapes.cjs:95).
 *
 * Plain-node house style: hand-rolled ok() helper, a failing assertion
 * prints and process.exit(1)s. Zero-dep: node built-ins only. CJS. NO
 * em-dashes.
 */

const path = require('path');

const ROOT = path.join(__dirname, '..');
const VOCAB_PATH = path.join(ROOT, 'lib', 'core', 'strategy', 'rung-vocabulary.cjs');
const GUARD_PATH = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const BRAIN_CLIENT_PATH = path.join(ROOT, 'lib', 'core', 'brain-client.cjs');

let checks = 0;
let failed = 0;

function ok(label, cond) {
  checks++;
  if (!cond) {
    failed++;
    console.log('FAIL: ' + label);
  } else {
    console.log('ok: ' + label);
  }
}

const vocab = require(VOCAB_PATH);
const guard = require(GUARD_PATH);
const brainClient = require(BRAIN_CLIENT_PATH);

// ---------------------------------------------------------------------------
// Leg 1: THEO_RUNGS is a frozen four-member array in fixed precedence order.
// ---------------------------------------------------------------------------
console.log('--- Leg 1: THEO_RUNGS shape ---');

ok('THEO_RUNGS is an array', Array.isArray(vocab.THEO_RUNGS));
ok('THEO_RUNGS has exactly 4 members', vocab.THEO_RUNGS.length === 4);
ok(
  'THEO_RUNGS is in fixed precedence order Wicked, UnDefined, WellDefined, IllDefined',
  vocab.THEO_RUNGS.join(',') === 'Wicked,UnDefined,WellDefined,IllDefined'
);
ok('THEO_RUNGS is frozen', Object.isFrozen(vocab.THEO_RUNGS));

// ---------------------------------------------------------------------------
// Leg 2: isTheoRung.
// ---------------------------------------------------------------------------
console.log('--- Leg 2: isTheoRung ---');

ok('isTheoRung(IllDefined) is true', vocab.isTheoRung('IllDefined') === true);
ok('isTheoRung(ill-defined) is false (wrong vocabulary)', vocab.isTheoRung('ill-defined') === false);
ok('isTheoRung(null) is false and does not throw', vocab.isTheoRung(null) === false);
ok('isTheoRung(undefined) is false and does not throw', vocab.isTheoRung(undefined) === false);
ok('isTheoRung(42) is false and does not throw', vocab.isTheoRung(42) === false);

// ---------------------------------------------------------------------------
// Leg 3: toLadderRung round trip, all four rungs, no leftovers either way.
// ---------------------------------------------------------------------------
console.log('--- Leg 3: toLadderRung round trip ---');

const EXPECTED_LADDER_MAP = {
  Wicked: 'wicked',
  UnDefined: 'undefined',
  WellDefined: 'well-defined',
  IllDefined: 'ill-defined',
};

Object.keys(EXPECTED_LADDER_MAP).forEach(function (theoRung) {
  const expected = EXPECTED_LADDER_MAP[theoRung];
  const actual = vocab.toLadderRung(theoRung);
  ok('toLadderRung(' + theoRung + ') === ' + expected, actual === expected);
});

ok(
  'toLadderRung(IllDefined) returns ill-defined',
  vocab.toLadderRung('IllDefined') === 'ill-defined'
);

const ladderValues = Object.keys(EXPECTED_LADDER_MAP).map(function (k) {
  return vocab.toLadderRung(k);
});
ok(
  'all four ladder values are distinct (no leftovers, no collision)',
  new Set(ladderValues).size === 4
);
ok(
  'ladder values are exactly the TAXONOMY_RUNGS members (no leftovers in either direction)',
  ladderValues.every(function (v) { return guard.TAXONOMY_RUNGS.has(v); }) &&
  guard.TAXONOMY_RUNGS.size === ladderValues.length
);

ok('toLadderRung(Nonsense) returns null (fail closed, never guess)', vocab.toLadderRung('Nonsense') === null);
ok('toLadderRung(null) returns null and does not throw', vocab.toLadderRung(null) === null);
ok('toLadderRung(undefined) returns null and does not throw', vocab.toLadderRung(undefined) === null);

// ---------------------------------------------------------------------------
// Leg 4: LADDER_RUNG_BY_THEO_ID is a frozen object matching the same map.
// ---------------------------------------------------------------------------
console.log('--- Leg 4: LADDER_RUNG_BY_THEO_ID ---');

ok('LADDER_RUNG_BY_THEO_ID is frozen', Object.isFrozen(vocab.LADDER_RUNG_BY_THEO_ID));
Object.keys(EXPECTED_LADDER_MAP).forEach(function (theoRung) {
  ok(
    'LADDER_RUNG_BY_THEO_ID.' + theoRung + ' === ' + EXPECTED_LADDER_MAP[theoRung],
    vocab.LADDER_RUNG_BY_THEO_ID[theoRung] === EXPECTED_LADDER_MAP[theoRung]
  );
});
ok(
  'LADDER_RUNG_BY_THEO_ID has exactly 4 own keys',
  Object.keys(vocab.LADDER_RUNG_BY_THEO_ID).length === 4
);

// ---------------------------------------------------------------------------
// Leg 5: PERSISTED_VOCABULARY is the literal string 'theo_rung_ids'.
// ---------------------------------------------------------------------------
console.log('--- Leg 5: PERSISTED_VOCABULARY ---');

ok(
  "PERSISTED_VOCABULARY === 'theo_rung_ids'",
  vocab.PERSISTED_VOCABULARY === 'theo_rung_ids'
);

// ---------------------------------------------------------------------------
// Leg 6: classify('taxonomy_ladder', { rung }) allows all four rungs with the
// stable pinned reason literal 'taxonomy_ladder rung enum'.
// classify() itself requires brainClient only via this test's own require
// above (the vocabulary module never requires brain-client.cjs).
// ---------------------------------------------------------------------------
console.log('--- Leg 6: classify() allow proof, all four rungs ---');

const TAX_TOOL_NAME = 'mcp__plugin_mos_mindrian-brain__taxonomy_ladder';

vocab.THEO_RUNGS.forEach(function (theoRung) {
  const ladderRung = vocab.toLadderRung(theoRung);
  const verdict = guard.classify({ rung: ladderRung }, { toolName: TAX_TOOL_NAME });
  ok(
    'classify() allows taxonomy_ladder for ' + theoRung + ' -> ' + ladderRung,
    verdict.verdict === 'allow'
  );
  ok(
    'classify() reason for ' + theoRung + ' is the stable literal taxonomy_ladder rung enum',
    verdict.reason === 'taxonomy_ladder rung enum'
  );
});

// ---------------------------------------------------------------------------
// Leg 7: THEO_RUNGS equals the complete return set of
// brainClient._inferRungFromQuestion, driven with one marker string per rung
// taken from the classifier's own _RUNG_MARKERS.
// ---------------------------------------------------------------------------
console.log('--- Leg 7: THEO_RUNGS equals _inferRungFromQuestion\'s return set ---');

ok(
  'brainClient exports _inferRungFromQuestion',
  typeof brainClient._inferRungFromQuestion === 'function'
);

// One marker string per rung, taken verbatim from brain-client.cjs's own
// _RUNG_MARKERS table (brain-client.cjs:1170-1175). This drives the real
// classifier rather than hand-guessing a question per rung.
const MARKER_QUESTION_BY_RUNG = {
  Wicked: 'the stakeholders disagree on values here',
  UnDefined: 'what is the future of this market',
  WellDefined: 'how do we measure this against the spec',
  IllDefined: 'which opportunity should we pursue',
};

const inferredRungs = new Set();
Object.keys(MARKER_QUESTION_BY_RUNG).forEach(function (expectedRung) {
  const question = MARKER_QUESTION_BY_RUNG[expectedRung];
  const inferred = brainClient._inferRungFromQuestion(question);
  ok(
    '_inferRungFromQuestion classifies "' + question + '" as ' + expectedRung,
    inferred === expectedRung
  );
  inferredRungs.add(inferred);
});

ok(
  'THEO_RUNGS is exactly the classifier\'s observed return set (no leftovers either way)',
  vocab.THEO_RUNGS.every(function (r) { return inferredRungs.has(r); }) &&
  inferredRungs.size === vocab.THEO_RUNGS.length
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log('======================================');
console.log('Checks: ' + checks + '  Failed: ' + failed);
console.log('======================================');

if (failed > 0) {
  process.exit(1);
}
