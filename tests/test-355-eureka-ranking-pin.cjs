#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 10 Task 1 (HIPS-01, D-47, research C1/C2, T-355-47/48/49/50).
 *
 * This test pins TODAY's eureka feasibility values and composite rank order
 * -- computed by the CURRENT, unflipped lib/core/rs-differential-scorer.cjs
 * scoreMeasured and lib/core/eureka/portfolio-dimensions.cjs feasibilityFromRs
 * -- into tests/fixtures/355/eureka-ranking-pin.json, BEFORE Task 2 flips
 * scoreMeasured onto lib/core/direction-convention.cjs and swaps the two
 * feasibility branches in portfolio-dimensions.cjs. Task 2's whole honesty
 * claim is that this same pin stays green AFTER the flip: the label meaning
 * changes, but which pairs eureka ranks highest does not.
 *
 * Two run modes:
 *
 *   node tests/test-355-eureka-ranking-pin.cjs             normal run: reads
 *     the fixture's expected_feasibility / expected_score / expected_rank and
 *     asserts today's live code still produces them. NEVER writes the fixture.
 *
 *   node tests/test-355-eureka-ranking-pin.cjs --record     generator run:
 *     computes those three fields from the CURRENT code and overwrites the
 *     fixture's pairs[] in place. Run exactly ONCE, on unflipped code, before
 *     Task 2's commit; never run again afterward (that would defeat the pin).
 *
 * For each pair, scoreMeasured runs through the SAME offline seam
 * 355-RESEARCH.md's "Driving scoreMeasured to an exact (lexical, semantic)
 * pair offline" documents: lexicalFn returns the fixture's lexical value
 * directly, encodeFn returns two vectors whose cosine similarity is EXACTLY
 * the fixture's semantic value (cosine([1,0],[c,sqrt(1-c^2)]) === c).
 * feasibility comes from portfolio-dimensions.cjs's own feasibilityFromRs
 * (via its _test export -- Canon Part 7, no re-derivation). The composite
 * score and rank are computed through the SAME two functions
 * scripts/eureka-portfolio-report.cjs's own scoring loop calls:
 * pdims.scorePairDimensions() then ahp.composeScore() with the weights
 * ahp.loadAhpConfig() resolves from the committed data/portfolio-ahp-matrix.json
 * (the all-1 matrix -> equal 1/3 weights today), then a plain
 * `sort((x,y) => y.score - x.score)` + 1-based rank -- byte-identical to
 * scripts/eureka-portfolio-report.cjs:1164-1165's own ranking step. Node's
 * Array.prototype.sort is stable (guaranteed since V8 7.0 / Node 11), so two
 * pairs with an EXACTLY equal composite keep their original fixture order --
 * the "tie order recorded as produced" requirement.
 *
 * Every fixture pair supplies its own dimsA/dimsB (strategic_fit,
 * validated_demand only -- tech_econ_feasibility is never read from dimsA/
 * dimsB, portfolio-dimensions.cjs always recomputes it from rs), so every
 * OTHER dimension is held fixed and only the rs-derived feasibility leg can
 * move when the flip lands.
 *
 * An optional per-pair `floor` field temporarily sets EUREKA_DIFF_FLOOR for
 * that one scoreMeasured call (restored immediately after), which is the only
 * way this test file can reach the FEASIBILITY.bridge branch at all: the
 * BRIDGE_BAND (0.16-0.25) sits entirely BELOW the production EUREKA_DIFF_FLOOR
 * default (0.3), so no default-floor pair can ever have both abs_diff inside
 * the band AND passes:true. This is a genuine pre-existing tension in the
 * shipped floors (not introduced or fixed by this plan -- Rule 4 territory,
 * out of this honesty pass's scope), and the floor override here is a TEST
 * SEAM only; it never touches the shipped EUREKA_DIFF_FLOOR_DEFAULT.
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard through tests/helpers/hygiene-355.cjs BEFORE requiring any
 * repo module; assert attempts() === 0 as the last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const hygiene = require('./helpers/hygiene-355.cjs');

const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');

const checker = hygiene.makeChecker('test-355-eureka-ranking-pin');
const { check } = checker;

const scorer = require(path.join(REPO, 'lib', 'core', 'rs-differential-scorer.cjs'));
const pdims = require(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-dimensions.cjs'));
const ahp = require(path.join(REPO, 'lib', 'core', 'eureka', 'ahp-weights.cjs'));

const FIXTURE_PATH = path.join(REPO, 'tests', 'fixtures', '355', 'eureka-ranking-pin.json');
const RECORD_MODE = process.argv.indexOf('--record') !== -1;

// cosine([1,0],[c, sqrt(max(0, 1-c^2))]) === c exactly (355-RESEARCH.md Code
// Examples > "Driving scoreMeasured to an exact (lexical, semantic) pair
// offline").
function vecsFor(c) {
  return [[1, 0], [c, Math.sqrt(Math.max(0, 1 - c * c))]];
}

async function computeRs(pair) {
  const savedFloor = process.env.EUREKA_DIFF_FLOOR;
  if (typeof pair.floor === 'number') {
    process.env.EUREKA_DIFF_FLOOR = String(pair.floor);
  } else {
    delete process.env.EUREKA_DIFF_FLOOR;
  }
  try {
    return await scorer.scoreMeasured('pin a', 'pin b', {
      lexicalFn: () => pair.lexical,
      encodeFn: () => vecsFor(pair.semantic),
    });
  } finally {
    if (savedFloor === undefined) delete process.env.EUREKA_DIFF_FLOOR;
    else process.env.EUREKA_DIFF_FLOOR = savedFloor;
  }
}

async function main() {
  let fixture = null;
  let fixtureLoadError = null;
  try {
    fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  } catch (e) {
    fixtureLoadError = e;
  }
  check(
    'tests/fixtures/355/eureka-ranking-pin.json loads',
    fixture !== null,
    fixtureLoadError ? String(fixtureLoadError.message) : undefined
  );
  if (fixture === null) {
    finish();
    return;
  }

  const pairs = Array.isArray(fixture.pairs) ? fixture.pairs : [];
  check('fixture.pairs.length >= 12', pairs.length >= 12, 'found ' + pairs.length);

  // Same weights source scripts/eureka-portfolio-report.cjs itself resolves
  // (data/portfolio-ahp-matrix.json, the committed all-1 matrix -> 1/3 each
  // today). No hand-derived weight literal in this test.
  const ahpConfig = ahp.loadAhpConfig();
  const weights = ahpConfig.weights;

  const computed = [];
  for (const pair of pairs) {
    let feasibility = null;
    let score = null;
    let detail;
    try {
      // eslint-disable-next-line no-await-in-loop
      const rs = await computeRs(pair);
      feasibility = pdims._test.feasibilityFromRs(rs);
      const pairDims = pdims.scorePairDimensions({ a: pair.dimsA, b: pair.dimsB, rs: rs });
      score = ahp.composeScore(pairDims, weights);
    } catch (e) {
      detail = 'threw: ' + e.message;
    }
    computed.push({ id: pair.id, feasibility: feasibility, score: score, detail: detail });
  }

  // Same ranking step scripts/eureka-portfolio-report.cjs:1164-1165 runs:
  // sort composite score descending (stable on ties), 1-based rank.
  const ranked = computed.slice().sort(function (a, b) {
    return (b.score || 0) - (a.score || 0);
  });
  const rankOf = new Map();
  for (let i = 0; i < ranked.length; i += 1) rankOf.set(ranked[i].id, i + 1);

  if (RECORD_MODE) {
    for (let i = 0; i < pairs.length; i += 1) {
      const c = computed[i];
      pairs[i].expected_feasibility = c.feasibility;
      pairs[i].expected_score = c.score;
      pairs[i].expected_rank = rankOf.get(c.id);
    }
    fixture.recorded_at = new Date().toISOString().slice(0, 10);
    fixture.recorded_note = 'Generated by `node tests/test-355-eureka-ranking-pin.cjs --record` '
      + 'against UNFLIPPED lib/core/rs-differential-scorer.cjs and '
      + 'lib/core/eureka/portfolio-dimensions.cjs (Phase 355 Plan 10 Task 1, pre-D-47). '
      + 'Never regenerate after the Task 2 flip commit -- see the ranking-pin header comment.';
    fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n');
    console.log('RECORDED ' + pairs.length + ' pairs to ' + FIXTURE_PATH);
  } else {
    for (let i = 0; i < pairs.length; i += 1) {
      const pair = pairs[i];
      const c = computed[i];
      check(
        'feasibility pair ' + pair.id,
        c.feasibility === pair.expected_feasibility,
        c.detail || ('got ' + c.feasibility + ' expected ' + pair.expected_feasibility)
      );
      const scoreOk = typeof c.score === 'number' && typeof pair.expected_score === 'number'
        && Math.abs(c.score - pair.expected_score) < 1e-9;
      check(
        'score pair ' + pair.id,
        scoreOk,
        c.detail || ('got ' + c.score + ' expected ' + pair.expected_score)
      );
      check(
        'rank pair ' + pair.id,
        rankOf.get(pair.id) === pair.expected_rank,
        'got ' + rankOf.get(pair.id) + ' expected ' + pair.expected_rank
      );
    }
  }

  finish();
}

function finish() {
  check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
  netGuard.restore();
  console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
  process.exit(checker.summary());
}

main();
