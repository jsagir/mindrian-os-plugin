'use strict';
/*
 * Phase 244-07 -- fence the MMR diversity pass (TRIG-03).
 *
 * Pins the full <behavior> block of Task 1 of 244-07-PLAN.md, plus:
 *   - the named SC3 crowding-out regression (both orderings in one test)
 *   - the near-duplicate fixture verified by measured lexicalOverlap values
 *   - the bidirectional lambda-orientation fence (1.0 and 0.0)
 *   - the frozen-scalar fence (MAX_K, output length, the 0.70/0.15 detent)
 *   - the no-op fence (single tier_family, or the field absent entirely)
 *
 * Harness shape: PASS/FAIL/FAILURES, from tests/test-219-fts5-degrade.cjs:110-125,
 * reusing the synthetic-registry-via-_test._setRegistry priming shape from
 * tests/test-244-rrf-fusion.cjs.
 *
 * No absolute MMR-score assertions: membership and order only.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const path = require('node:path');

const RANKER_PATH = path.resolve(__dirname, '..', 'lib', 'workflow', 'f-selector-ranker.cjs');
const LEXICAL_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'eureka', 'lexical-overlap.cjs');

function loadRanker() {
  delete require.cache[require.resolve(RANKER_PATH)];
  return require(RANKER_PATH);
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

console.log('Phase 244-07 MMR diversity pass fences (TRIG-03)');

// ---------------------------------------------------------------------------
// The near-duplicate fixture. Three "family-a" rows share IDENTICAL
// jtbd_label + framework text (a genuine near-duplicate: same technique,
// different command slug), and one "family-b" row is genuinely different.
// Designed against the REAL frozen stopword list at lexical-overlap.cjs:38 --
// every distinguishing word here (stakeholder, value, chain, analysis,
// porter, five, forces, framework / wisdom, reflection, journal, practice,
// beautiful, question) is a non-stopword, non-trivial (>= 2 char) token, so
// the fixture's "near-duplicate-ness" is a MEASURED Jaccard fact below, not
// an authorial assumption.
// ---------------------------------------------------------------------------
const FAM_A_LABEL = 'stakeholder value chain analysis';
const FAM_A_FRAMEWORK = 'Porter Five Forces Framework';
const FAM_B_LABEL = 'wisdom reflection journal practice';
const FAM_B_FRAMEWORK = 'Beautiful Question Framework';

function buildCrowdingFixture() {
  return [
    { command: '/mos:fam-a1', tier_family: 'family-a', jtbd_label: FAM_A_LABEL, framework: FAM_A_FRAMEWORK, score: 1.0 },
    { command: '/mos:fam-a2', tier_family: 'family-a', jtbd_label: FAM_A_LABEL, framework: FAM_A_FRAMEWORK, score: 0.95 },
    { command: '/mos:fam-a3', tier_family: 'family-a', jtbd_label: FAM_A_LABEL, framework: FAM_A_FRAMEWORK, score: 0.90 },
    { command: '/mos:cross-b', tier_family: 'family-b', jtbd_label: FAM_B_LABEL, framework: FAM_B_FRAMEWORK, score: 0.85 },
  ];
}

// A mutually-dissimilar fixture: four rows, four distinct families, four
// disjoint vocabularies. Diversity must not fire here because there is no
// redundancy to break.
function buildDissimilarFixture() {
  return [
    { command: '/mos:x1', tier_family: 'fx1', jtbd_label: 'alpha bravo charlie', framework: 'FrameAlpha', score: 1.0 },
    { command: '/mos:x2', tier_family: 'fx2', jtbd_label: 'delta echo foxtrot', framework: 'FrameDelta', score: 0.9 },
    { command: '/mos:x3', tier_family: 'fx3', jtbd_label: 'golf hotel india', framework: 'FrameGolf', score: 0.8 },
    { command: '/mos:x4', tier_family: 'fx4', jtbd_label: 'juliet kilo lima', framework: 'FrameJuliet', score: 0.7 },
  ];
}

try {
  // -------------------------------------------------------------------------
  // Fixture validity: measured lexicalOverlap, not authorial intent.
  // -------------------------------------------------------------------------
  const lexOv = require(LEXICAL_PATH);
  const NEAR_DUP_THRESHOLD = 0.5;
  const CROSS_FAMILY_CEILING = 0.5;

  function textOfFixtureRow(row) {
    return row.command + ' ' + row.jtbd_label + ' ' + row.framework;
  }

  test('MEASURED: same-family rows (fam-a1, fam-a2, fam-a3) are genuinely near-duplicate by Jaccard', function () {
    const fx = buildCrowdingFixture();
    const a1a2 = lexOv.lexicalOverlap(textOfFixtureRow(fx[0]), textOfFixtureRow(fx[1]));
    const a1a3 = lexOv.lexicalOverlap(textOfFixtureRow(fx[0]), textOfFixtureRow(fx[2]));
    const a2a3 = lexOv.lexicalOverlap(textOfFixtureRow(fx[1]), textOfFixtureRow(fx[2]));
    console.log('    measured lexicalOverlap(fam-a1, fam-a2) = ' + a1a2);
    console.log('    measured lexicalOverlap(fam-a1, fam-a3) = ' + a1a3);
    console.log('    measured lexicalOverlap(fam-a2, fam-a3) = ' + a2a3);
    assert.ok(a1a2 > NEAR_DUP_THRESHOLD, 'fam-a1/fam-a2 must measure above the near-duplicate threshold');
    assert.ok(a1a3 > NEAR_DUP_THRESHOLD, 'fam-a1/fam-a3 must measure above the near-duplicate threshold');
    assert.ok(a2a3 > NEAR_DUP_THRESHOLD, 'fam-a2/fam-a3 must measure above the near-duplicate threshold');
  });

  test('MEASURED: a same-family row and the cross-family row measure genuinely distinct by Jaccard', function () {
    const fx = buildCrowdingFixture();
    const a1b = lexOv.lexicalOverlap(textOfFixtureRow(fx[0]), textOfFixtureRow(fx[3]));
    const a2b = lexOv.lexicalOverlap(textOfFixtureRow(fx[1]), textOfFixtureRow(fx[3]));
    console.log('    measured lexicalOverlap(fam-a1, cross-b) = ' + a1b);
    console.log('    measured lexicalOverlap(fam-a2, cross-b) = ' + a2b);
    assert.ok(a1b < CROSS_FAMILY_CEILING, 'fam-a1/cross-b must measure below the cross-family ceiling');
    assert.ok(a2b < CROSS_FAMILY_CEILING, 'fam-a2/cross-b must measure below the cross-family ceiling');
  });

  // -------------------------------------------------------------------------
  // The named SC3 crowding-out regression. Both halves in one test.
  // -------------------------------------------------------------------------
  test('SC3 crowding-out: cross-family candidate is in the top 3 WITH the MMR pass, absent WITHOUT it', function () {
    const r = loadRanker();
    const withoutMmr = buildCrowdingFixture().slice(0, 3).map(function (x) { return x.command; });
    const withMmr = r._applyMmrDiversity(buildCrowdingFixture(), 3).map(function (x) { return x.command; });

    console.log('    SC3 ordering WITHOUT MMR: ' + JSON.stringify(withoutMmr));
    console.log('    SC3 ordering WITH MMR:    ' + JSON.stringify(withMmr));

    assert.strictEqual(withoutMmr.indexOf('/mos:cross-b'), -1,
      'WITHOUT the MMR pass, the plain top-3 cut must be dominated by the three same-family near-duplicates');
    assert.ok(withMmr.indexOf('/mos:cross-b') !== -1,
      'WITH the MMR pass, the cross-family candidate must reach the top 3');
    assert.strictEqual(withMmr.length, 3, 'the diversified top-3 cut must still return exactly 3 rows');
  });

  // -------------------------------------------------------------------------
  // Behavior block, direct assertions.
  // -------------------------------------------------------------------------
  test('null list returns null untouched (same reference)', function () {
    const r = loadRanker();
    assert.strictEqual(r._applyMmrDiversity(null, 3), null);
  });

  test('non-array list returns the input untouched (same reference)', function () {
    const r = loadRanker();
    const notArr = 'not-an-array';
    assert.strictEqual(r._applyMmrDiversity(notArr, 3), notArr);
  });

  test('0-length list returns the same reference (no-op)', function () {
    const r = loadRanker();
    const empty = [];
    assert.strictEqual(r._applyMmrDiversity(empty, 3), empty);
  });

  test('1-entry list returns the same reference (no-op)', function () {
    const r = loadRanker();
    const one = [{ command: '/mos:a', tier_family: 'family-a', score: 1 }];
    assert.strictEqual(r._applyMmrDiversity(one, 3), one);
  });

  test('single-family list (all rows share one tier_family) returns the same reference (no-op)', function () {
    const r = loadRanker();
    const list = [
      { command: '/mos:a1', tier_family: 'family-a', score: 1 },
      { command: '/mos:a2', tier_family: 'family-a', score: 0.9 },
      { command: '/mos:a3', tier_family: 'family-a', score: 0.8 },
    ];
    assert.strictEqual(r._applyMmrDiversity(list, 3), list);
  });

  test('rows with NO tier_family field at all (undefined on every row) return the same reference (no-op) -- the pre-244 shape', function () {
    const r = loadRanker();
    const list = [
      { command: '/mos:a1', score: 1 },
      { command: '/mos:a2', score: 0.9 },
      { command: '/mos:a3', score: 0.8 },
    ];
    assert.strictEqual(r._applyMmrDiversity(list, 3), list);
  });

  test('the no-op fence: with no tierCandidates supplied, rankForSelector output is deep-equal to the Plan-04 baseline (single implicit tier_family)', function () {
    const r = loadRanker();
    r._test._resetCaches();
    r._test._setRegistry({
      commands: [
        { command: '/mos:solo-1', frameworks: ['SoloFw'], serves_jtbd: ['x'], jtbd_label: 'l1', jtbd_summary: 's1', teaching: 't1' },
        { command: '/mos:solo-2', frameworks: ['SoloFw2'], serves_jtbd: ['x'], jtbd_label: 'l2', jtbd_summary: 's2', teaching: 't2' },
      ],
    });
    const args = { roomState: {}, k: 3 };
    const withoutTierCandidatesArg = JSON.stringify(r.rankForSelector(args));
    const withEmptyArray = JSON.stringify(r.rankForSelector(Object.assign({}, args, { tierCandidates: [] })));
    assert.strictEqual(withEmptyArray, withoutTierCandidatesArg,
      'absent-signal rankForSelector output must be byte-identical whether tierCandidates is omitted or []');
    r._test._resetCaches();
  });

  test('mutually-dissimilar rows: the returned order is the input order truncated to k (diversity must not reorder with no redundancy)', function () {
    const r = loadRanker();
    const fx = buildDissimilarFixture();
    const out = r._applyMmrDiversity(fx, 3).map(function (x) { return x.command; });
    assert.deepStrictEqual(out, ['/mos:x1', '/mos:x2', '/mos:x3']);
  });

  test('returned length never exceeds the clamped k', function () {
    const r = loadRanker();
    const fx = buildCrowdingFixture();
    const out = r._applyMmrDiversity(fx, 2);
    assert.ok(out.length <= 2, 'MMR must never widen the row budget past the requested k');
  });

  test('MAX_K is still 3 (Canon Part 3 frozen scalar)', function () {
    const r = loadRanker();
    assert.strictEqual(r.MAX_K, 3);
  });

  test('the 0.70/0.15 detent constants (BEHAVIORAL_CHANNEL_FLOOR / MARGIN) are unchanged', function () {
    const r = loadRanker();
    assert.strictEqual(r.BEHAVIORAL_CHANNEL_FLOOR, 0.50);
    assert.strictEqual(r.BEHAVIORAL_CHANNEL_MARGIN, 0.15);
    assert.strictEqual(r.BEHAVIORAL_CHANNEL_CEILING, 0.85);
  });

  test('base rows are never mutated: returned entries are copies, and the input row objects are byte-identical to their pre-call shape', function () {
    const r = loadRanker();
    const fx = buildCrowdingFixture();
    const beforeSnapshot = fx.map(function (row) { return Object.assign({}, row); });
    const out = r._applyMmrDiversity(fx, 3);
    out.forEach(function (row) {
      const original = fx.find(function (o) { return o.command === row.command; });
      assert.notStrictEqual(row, original, 'returned entry must be a copy, never the same object reference as the input row');
    });
    fx.forEach(function (row, idx) {
      assert.deepStrictEqual(row, beforeSnapshot[idx], 'input row objects must be byte-identical to their pre-call shape (never mutated)');
    });
  });

  test('the pass never throws on rows missing command, jtbd_label or framework', function () {
    const r = loadRanker();
    const list = [
      { tier_family: 'family-a', score: 1 },
      { command: '/mos:x', tier_family: 'family-b', score: 0.9 },
      { command: '/mos:y', tier_family: 'family-a', jtbd_label: 'z', score: 0.8 },
    ];
    assert.doesNotThrow(function () {
      r._applyMmrDiversity(list, 3);
    });
  });

  test('the similarity projection uses only LOCAL handles: a poisoned jtbd_summary must not change the winner (mutation-sensitive design)', function () {
    // A dedicated, deliberately tuned fixture (a generic "long prose paragraph"
    // is NOT sensitive to this mutation, because adding the SAME text to every
    // row does not change relative ranking -- verified during authoring). This
    // fixture instead poisons ONLY row z's jtbd_summary with row x's own
    // distinguishing (label + framework) vocabulary, engineered so that:
    //   - if the projection correctly ignores jtbd_summary, z's genuinely low
    //     OWN-vocabulary overlap with x (0.143) beats y's rel deficit, so z
    //     wins the second slot: [x, z].
    //   - if the projection leaks jtbd_summary, z's poisoned overlap with x
    //     jumps to 0.714 (nearly identical to x), tanking z's MMR score below
    //     y's, flipping the second slot to y: [x, y].
    // Measured directly (not merely asserted) so the fixture's sensitivity is
    // evidence, not authorial intent.
    const r = loadRanker();
    const rows = [
      { command: '/mos:x', tier_family: 'fx', jtbd_label: 'foo bar baz', framework: 'FrameX', score: 1.0 },
      { command: '/mos:y', tier_family: 'fy', jtbd_label: 'qux quux corge', framework: 'FrameY', score: 0.80 },
      { command: '/mos:z', tier_family: 'fz', jtbd_label: 'zzz', framework: 'FrameZ', score: 0.85, jtbd_summary: 'foo bar baz FrameX' },
    ];
    const overlapZX_ownVocab = lexOv.lexicalOverlap('/mos:z zzz FrameZ', '/mos:x foo bar baz FrameX');
    const overlapZX_poisoned = lexOv.lexicalOverlap('/mos:z zzz FrameZ foo bar baz FrameX', '/mos:x foo bar baz FrameX');
    console.log('    measured lexicalOverlap(z-own-vocab, x) = ' + overlapZX_ownVocab + ' (used if the projection correctly excludes jtbd_summary)');
    console.log('    measured lexicalOverlap(z-poisoned, x)  = ' + overlapZX_poisoned + ' (would be used if jtbd_summary leaked in)');
    assert.ok(overlapZX_poisoned > overlapZX_poisoned - 0.01 && overlapZX_poisoned > overlapZX_ownVocab,
      'the poisoned overlap must measurably exceed the own-vocabulary overlap for this fixture to be mutation-sensitive');
    const out = r._applyMmrDiversity(rows, 2).map(function (x) { return x.command; });
    console.log('    second-slot winner (must be /mos:z when jtbd_summary is correctly excluded): ' + JSON.stringify(out));
    assert.deepStrictEqual(out, ['/mos:x', '/mos:z'],
      'the projection must ignore jtbd_summary entirely: row z (genuinely low own-vocabulary overlap with x) must win the second slot, not row y');
  });

  // -------------------------------------------------------------------------
  // Bidirectional lambda-orientation fence, driven through TRIG_MMR_LAMBDA.
  // The constant is resolved ONCE at module load (the TRIG_RRF_K idiom), so
  // each leg deletes the module from require.cache and re-requires -- a
  // plain re-call against the already-loaded module would silently assert
  // against a stale MMR_LAMBDA_RELEVANCE value.
  // -------------------------------------------------------------------------
  test('BIDIRECTIONAL LAMBDA FENCE: at MMR_LAMBDA_RELEVANCE=1.0, the output equals the input order truncated to k (pure relevance)', function () {
    const savedEnv = process.env.TRIG_MMR_LAMBDA;
    try {
      process.env.TRIG_MMR_LAMBDA = '1.0';
      const r = loadRanker();
      assert.strictEqual(r.MMR_LAMBDA_RELEVANCE, 1.0);
      const out = r._applyMmrDiversity(buildCrowdingFixture(), 3).map(function (x) { return x.command; });
      console.log('    lambda=1.0 order: ' + JSON.stringify(out));
      assert.deepStrictEqual(out, ['/mos:fam-a1', '/mos:fam-a2', '/mos:fam-a3'],
        'lambda=1.0 must reproduce the pure-relevance order exactly (input order truncated to k)');
    } finally {
      if (savedEnv === undefined) delete process.env.TRIG_MMR_LAMBDA;
      else process.env.TRIG_MMR_LAMBDA = savedEnv;
      loadRanker();
    }
  });

  test('BIDIRECTIONAL LAMBDA FENCE: at MMR_LAMBDA_RELEVANCE=0.0, the output maximizes diversity and differs from the input order', function () {
    const savedEnv = process.env.TRIG_MMR_LAMBDA;
    try {
      process.env.TRIG_MMR_LAMBDA = '0.0';
      const r = loadRanker();
      assert.strictEqual(r.MMR_LAMBDA_RELEVANCE, 0.0);
      const out = r._applyMmrDiversity(buildCrowdingFixture(), 3).map(function (x) { return x.command; });
      console.log('    lambda=0.0 order: ' + JSON.stringify(out));
      assert.notDeepStrictEqual(out, ['/mos:fam-a1', '/mos:fam-a2', '/mos:fam-a3'],
        'lambda=0.0 must differ from the pure-relevance input order for the near-duplicate fixture');
      assert.ok(out.indexOf('/mos:cross-b') !== -1,
        'lambda=0.0 (pure diversity) must surface the cross-family candidate');
    } finally {
      if (savedEnv === undefined) delete process.env.TRIG_MMR_LAMBDA;
      else process.env.TRIG_MMR_LAMBDA = savedEnv;
      loadRanker();
    }
  });

  test('default MMR_LAMBDA_RELEVANCE (no env override) is 0.7', function () {
    const savedEnv = process.env.TRIG_MMR_LAMBDA;
    try {
      delete process.env.TRIG_MMR_LAMBDA;
      const r = loadRanker();
      assert.strictEqual(r.MMR_LAMBDA_RELEVANCE, 0.7);
    } finally {
      if (savedEnv === undefined) delete process.env.TRIG_MMR_LAMBDA;
      else process.env.TRIG_MMR_LAMBDA = savedEnv;
      loadRanker();
    }
  });

  test('TRIG_MMR_LAMBDA outside 0..1 or non-finite falls back to the 0.7 default (T-244-29)', function () {
    const savedEnv = process.env.TRIG_MMR_LAMBDA;
    try {
      process.env.TRIG_MMR_LAMBDA = '5';
      assert.strictEqual(loadRanker().MMR_LAMBDA_RELEVANCE, 0.7, 'out-of-range high must fall back to 0.7');
      process.env.TRIG_MMR_LAMBDA = '-1';
      assert.strictEqual(loadRanker().MMR_LAMBDA_RELEVANCE, 0.7, 'out-of-range low must fall back to 0.7');
      process.env.TRIG_MMR_LAMBDA = 'not-a-number';
      assert.strictEqual(loadRanker().MMR_LAMBDA_RELEVANCE, 0.7, 'non-finite must fall back to 0.7');
    } finally {
      if (savedEnv === undefined) delete process.env.TRIG_MMR_LAMBDA;
      else process.env.TRIG_MMR_LAMBDA = savedEnv;
      loadRanker();
    }
  });
} finally {
  try {
    const r = loadRanker();
    r._test._resetCaches();
  } catch (_e) { /* ignore */ }
}

console.log('\nPhase 244-07 MMR diversity pass: PASS=' + PASS + ' FAIL=' + FAIL);
if (FAIL > 0) {
  FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
  process.exit(1);
}
process.exit(0);
