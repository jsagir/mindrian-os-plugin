#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/272-rank-agreement.test.cjs
 *
 * Phase 272, PYPORT-05 (D-03 rank-agreement gate, REDESIGNED per D-11).
 *
 * D-11 (navigator ruling, 2026-08-31, post-272-08 root-cause finding):
 * 272-08 found, via a rigorous controlled experiment, that the ORIGINAL
 * gate -- exact top-50 pair-ID SET overlap -- measures the wrong axis of
 * variance. Even Python's own TruncatedSVD(algorithm="arpack") compared
 * against ITSELF across independent process invocations only reaches
 * 0.42-0.50 top-K overlap on this fixture room's densely-tied score
 * distribution, nowhere near the inherited 0.95 gate -- yet the underlying
 * NUMBERS agree almost exactly either way (LSA-leg avg delta ~0.0016-0.0018
 * across BOTH the CJS-vs-Python and Python-vs-Python-cross-process
 * comparisons). It is specifically the "identical top-50 ID SET" check
 * that is too brittle for how closely many pairs compete near the top of
 * this fixture's ranking. Full trail: 272-08-SUMMARY.md's "Known Issue" +
 * "Resolved (D-11)" sections, 272-CONTEXT.md's D-11 entry.
 *
 * NEW PRIMARY GATE (this file, per D-11): a delta/correlation-based metric
 * on the LSA (structural) leg specifically -- Spearman rank-correlation
 * PLUS avg/max delta bounds on `lsa_score` between matched pairs (matched
 * by source/target artifact-id pair, not by rank position). Thresholds are
 * derived from 272-08's empirically measured LSA noise floor (avg
 * ~0.0016-0.0018, max ~0.02, isolated full-matrix comparison) with a
 * deliberate margin -- see the *_MAX / *_MIN constants below for the exact
 * reasoning per threshold.
 *
 * WHY THE LSA LEG, NOT abs_diff, IS THE PRIMARY GATE (a finding this file's
 * rewrite surfaced, not assumed): `abs_diff = |semantic_score - lsa_score|`
 * folds in the semantic leg, and the semantic leg uses a DIFFERENT ENCODER
 * by design (D-01: Python's `all-MiniLM-L6-v2` vs CJS's
 * `MongoDB/mdbr-leaf-ir` -- an already-locked architecture decision, not
 * something this gate should re-litigate). Measuring the real committed
 * fixtures directly: `lsa_score` matched-pair Spearman rho = 0.9965 (avg
 * delta 0.0050, max delta 0.0210) -- tight agreement, consistent with
 * 272-08's isolated LSA-only experiment. `abs_diff` matched-pair Spearman
 * rho = 0.1491 (avg delta 0.0528, max delta 0.2194) -- dominated by the
 * encoder swap, not LSA-port noise (`semantic_score` alone: rho 0.7460, avg
 * delta 0.0555). Gating hard on `abs_diff` would therefore fail a correct
 * port for a reason unrelated to whether rs-math.cjs replicates rs_math.py
 * -- it would really be testing "do two different sentence-embedding models
 * produce identical output," which was never the goal. `abs_diff` and
 * `semantic_score` agreement are retained below as SECONDARY /
 * INFORMATIONAL signals (logged, not gated), exactly as D-11 permits for
 * top-K overlap ("MAY be retained as a secondary/informational signal ...
 * if useful for debugging, but it does not gate phase completion").
 *
 * The confidence-margin "no confident signed_diff sign flip" gate (D-01a,
 * inherited unchanged from D-03) stays a PRIMARY hard gate: `direction` is
 * a pure function of sign(signed_diff) (rs-math.cjs::classifyDirection,
 * Convention A), so a `direction` mismatch on a pair where BOTH sides
 * clear the confidence margin literally IS a signed_diff sign flip. This
 * reuses the confidence-margin pattern already shipped in
 * lib/core/eureka/embedding-classifier.cjs (DEFAULT_MARGIN = 0.10, read at
 * embedding-classifier.cjs:104), per D-03's explicit instruction to reuse
 * that pattern rather than inventing a new one.
 *
 * Spearman rank-correlation is reused from scripts/huji-eval.cjs::spearman
 * (Canon Part 7, reuse before build) -- a dependency-free, tie-corrected
 * (average-rank) Pearson-over-ranks implementation already shipped and
 * exercised by Phase 229's calibration gate. No lib/core/ Spearman helper
 * existed at the time of this rewrite (checked); requiring huji-eval.cjs
 * for its `spearman` export is safe -- that module's only top-level
 * requires are `fs`/`path`/`child_process`, its heavier dependencies
 * (`pitch-feedback-schemas.cjs`, `part8-egress-guard.cjs`) are lazily
 * required inside unrelated functions, and its CLI body is guarded by
 * `require.main === module`.
 *
 * Thresholds and the informational measurements are read PROGRAMMATICALLY
 * from tests/fixtures/272/noise-floor.json (the machine-readable sibling of
 * NOISE-FLOOR.md, both updated for D-11 by this same change) -- not
 * hardcoded here -- cross-checked against NOISE-FLOOR.md's own fenced
 * threshold lines so a future drift between the two fails loudly instead
 * of silently using a stale value.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spearman } = require('../scripts/huji-eval.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', '272');
const ROOM_DIR = path.join(FIXTURES_DIR, 'room');

const BASELINE_PATH = path.join(FIXTURES_DIR, 'baseline-python.fixture.json');
const CANDIDATE_PATH = path.join(FIXTURES_DIR, 'candidate-cjs.fixture.json');
const NOISE_FLOOR_JSON_PATH = path.join(FIXTURES_DIR, 'noise-floor.json');
const NOISE_FLOOR_MD_PATH = path.join(FIXTURES_DIR, 'NOISE-FLOOR.md');

// Confidence-margin threshold, reused verbatim from the shipped pattern
// (lib/core/eureka/embedding-classifier.cjs DEFAULT_MARGIN), per D-03.
const CONFIDENCE_MARGIN_THRESHOLD = 0.1;

// Informational-only top-K overlap, D-11: no longer a hard gate, kept for
// debugging visibility (it is what the ORIGINAL gate measured).
const TOP_K_FOR_OVERLAP = 50;

function pairKey(row) {
  return `${row.source_artifact_id}|${row.target_artifact_id}`;
}

// Source: shape from tests/127.1-graphrag-overlap.test.cjs:123-137
// (setOverlap), margin logic from
// lib/core/eureka/embedding-classifier.cjs:203-208. Verbatim from
// 272-RESEARCH.md's Code Examples section, "The D-03 gate, reusing the
// 127.1 shape". Unchanged by D-11 -- this is the D-01a sign-flip check, not
// the metric D-11 replaced.
function gateOnePair(pyRow, cjsRow, marginThreshold) {
  const bothConfident =
    Math.abs(pyRow.signed_diff) >= marginThreshold && Math.abs(cjsRow.signed_diff) >= marginThreshold;
  const flipped = pyRow.direction !== cjsRow.direction;
  if (flipped && bothConfident) return { verdict: 'FAIL', reason: 'confident_sign_flip' };
  if (flipped) return { verdict: 'WARN', reason: 'sign_flip_inside_margin' };
  return { verdict: 'PASS' };
}

// matchedPairStats(baselineByKey, candidateByKey, sharedKeys, field): avg/max
// abs delta plus Spearman rho between baseline[field] and candidate[field]
// across every shared pair, matched by artifact-id pair (not rank position).
function matchedPairStats(baselineByKey, candidateByKey, sharedKeys, field) {
  const baseVals = [];
  const candVals = [];
  let sum = 0;
  let max = 0;
  for (const key of sharedKeys) {
    const b = Number(baselineByKey.get(key)[field]);
    const c = Number(candidateByKey.get(key)[field]);
    baseVals.push(b);
    candVals.push(c);
    const delta = Math.abs(b - c);
    sum += delta;
    if (delta > max) max = delta;
  }
  return {
    avgDelta: sharedKeys.length ? sum / sharedKeys.length : 0,
    maxDelta: max,
    rho: spearman(baseVals, candVals),
  };
}

function readGateConfig() {
  if (!fs.existsSync(NOISE_FLOOR_JSON_PATH)) {
    throw new Error(
      `noise-floor.json missing at ${path.relative(REPO_ROOT, NOISE_FLOOR_JSON_PATH)} -- ` +
        'run tests/fixtures/272/generate-baseline.py (plan 272-02 Task 2) first'
    );
  }
  const json = JSON.parse(fs.readFileSync(NOISE_FLOOR_JSON_PATH, 'utf8'));
  const gate = json.gate;
  assert.ok(gate && typeof gate === 'object', 'noise-floor.json must have a "gate" object (D-11 schema)');
  for (const key of ['LSA_SPEARMAN_MIN', 'LSA_AVG_DELTA_MAX', 'LSA_MAX_DELTA_MAX', 'CONFIDENT_SIGN_FLIP_MAX']) {
    assert.equal(typeof gate[key], 'number', `noise-floor.json gate.${key} must be numeric`);
  }

  // Cross-check against NOISE-FLOOR.md's own fenced lines -- if the two ever
  // drift, fail loudly citing the mismatch rather than silently trusting
  // whichever one was read first.
  if (fs.existsSync(NOISE_FLOOR_MD_PATH)) {
    const md = fs.readFileSync(NOISE_FLOOR_MD_PATH, 'utf8');
    for (const key of ['LSA_SPEARMAN_MIN', 'LSA_AVG_DELTA_MAX', 'LSA_MAX_DELTA_MAX']) {
      const match = md.match(new RegExp(`${key}\\s*=\\s*([0-9.]+)`));
      if (match) {
        const mdValue = Number(match[1]);
        assert.equal(
          mdValue,
          gate[key],
          `${key} drift detected: NOISE-FLOOR.md says ${mdValue}, noise-floor.json says ${gate[key]} -- ` +
            'keep both in sync (D-11 methodology)'
        );
      }
    }
  }

  return gate;
}

async function main() {
  // Gate 1: baseline fixture must exist (plan 272-02 Task 2 produces it).
  if (!fs.existsSync(BASELINE_PATH)) {
    console.log(
      `baseline-python.fixture.json missing -- plan 272-02 Task 2 must run first to produce ` +
        `${path.relative(REPO_ROOT, BASELINE_PATH)}`
    );
    process.exitCode = 1;
    return;
  }

  // Gate 2: candidate fixture must exist (plan 272-08 produces it).
  if (!fs.existsSync(CANDIDATE_PATH)) {
    console.log(
      'candidate-cjs.fixture.json missing -- run rs-engine.cjs against the fixture room first ' +
        '(plan 272-08)'
    );
    process.exitCode = 1;
    return;
  }

  const gate = readGateConfig();

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const candidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));

  assert.ok(Array.isArray(baseline.pairs) && baseline.pairs.length > 0, 'baseline fixture must have pairs[]');
  assert.ok(Array.isArray(candidate.pairs) && candidate.pairs.length > 0, 'candidate fixture must have pairs[]');

  const baselineByKey = new Map(baseline.pairs.map((p) => [pairKey(p), p]));
  const candidateByKey = new Map(candidate.pairs.map((p) => [pairKey(p), p]));
  const sharedKeys = [...baselineByKey.keys()].filter((k) => candidateByKey.has(k));
  assert.ok(sharedKeys.length > 0, 'baseline and candidate fixtures share zero pairs -- cannot gate');

  // --- PRIMARY GATE (D-11): LSA-leg delta/correlation agreement, matched pairs ---
  const lsaStats = matchedPairStats(baselineByKey, candidateByKey, sharedKeys, 'lsa_score');
  console.log(
    `rank-agreement (PRIMARY, D-11): lsa_score matched pairs=${sharedKeys.length}, ` +
      `spearman=${lsaStats.rho.toFixed(4)} (gate >= ${gate.LSA_SPEARMAN_MIN}), ` +
      `avgDelta=${lsaStats.avgDelta.toFixed(4)} (gate <= ${gate.LSA_AVG_DELTA_MAX}), ` +
      `maxDelta=${lsaStats.maxDelta.toFixed(4)} (gate <= ${gate.LSA_MAX_DELTA_MAX})`
  );
  assert.ok(
    lsaStats.rho >= gate.LSA_SPEARMAN_MIN,
    `lsa_score Spearman rho ${lsaStats.rho.toFixed(4)} is below LSA_SPEARMAN_MIN ${gate.LSA_SPEARMAN_MIN} ` +
      '(see tests/fixtures/272/NOISE-FLOOR.md for provenance)'
  );
  assert.ok(
    lsaStats.avgDelta <= gate.LSA_AVG_DELTA_MAX,
    `lsa_score avg delta ${lsaStats.avgDelta.toFixed(4)} exceeds LSA_AVG_DELTA_MAX ${gate.LSA_AVG_DELTA_MAX} ` +
      '(see tests/fixtures/272/NOISE-FLOOR.md for provenance)'
  );
  assert.ok(
    lsaStats.maxDelta <= gate.LSA_MAX_DELTA_MAX,
    `lsa_score max delta ${lsaStats.maxDelta.toFixed(4)} exceeds LSA_MAX_DELTA_MAX ${gate.LSA_MAX_DELTA_MAX} ` +
      '(see tests/fixtures/272/NOISE-FLOOR.md for provenance)'
  );

  // --- PRIMARY GATE (D-01a, unchanged): zero confident signed_diff sign flips ---
  const failures = [];
  let warnCount = 0;
  for (const key of sharedKeys) {
    const pyRow = baselineByKey.get(key);
    const cjsRow = candidateByKey.get(key);
    const verdict = gateOnePair(pyRow, cjsRow, CONFIDENCE_MARGIN_THRESHOLD);
    if (verdict.verdict === 'FAIL') {
      failures.push({ key, reason: verdict.reason, pyRow, cjsRow });
    } else if (verdict.verdict === 'WARN') {
      warnCount += 1;
      // WARN pairs are logged but do NOT fail the test (D-03: only
      // confident sign flips fail; a sign flip inside the margin is
      // expected numerical-library noise).
      console.log(`rank-agreement: WARN sign_flip_inside_margin for pair ${key}`);
    }
  }
  console.log(`rank-agreement (PRIMARY, D-01a): ${sharedKeys.length} shared pairs, ${warnCount} WARN, ${failures.length} FAIL`);
  assert.ok(
    failures.length <= gate.CONFIDENT_SIGN_FLIP_MAX,
    `${failures.length} confident_sign_flip (FAIL) pair(s) found, exceeds CONFIDENT_SIGN_FLIP_MAX ` +
      `${gate.CONFIDENT_SIGN_FLIP_MAX}: ${JSON.stringify(failures.slice(0, 5))}`
  );

  // --- SECONDARY / INFORMATIONAL (D-11): abs_diff + semantic_score agreement ---
  // Not gated. abs_diff folds in the semantic leg, which uses a DIFFERENT
  // encoder by design (D-01: MiniLM vs mdbr-leaf-ir) -- low agreement here
  // reflects that already-locked architecture decision, not LSA-port noise.
  // Logged so a human/navigator can see the real magnitude, never silently
  // dropped.
  const absDiffStats = matchedPairStats(baselineByKey, candidateByKey, sharedKeys, 'abs_diff');
  const semanticStats = matchedPairStats(baselineByKey, candidateByKey, sharedKeys, 'semantic_score');
  console.log(
    `rank-agreement (INFO, not gated): abs_diff spearman=${absDiffStats.rho.toFixed(4)}, ` +
      `avgDelta=${absDiffStats.avgDelta.toFixed(4)}, maxDelta=${absDiffStats.maxDelta.toFixed(4)} -- ` +
      'dominated by the D-01 encoder swap (Python all-MiniLM-L6-v2 vs CJS MongoDB/mdbr-leaf-ir), not a port defect'
  );
  console.log(
    `rank-agreement (INFO, not gated): semantic_score spearman=${semanticStats.rho.toFixed(4)}, ` +
      `avgDelta=${semanticStats.avgDelta.toFixed(4)}, maxDelta=${semanticStats.maxDelta.toFixed(4)}`
  );

  // --- SECONDARY / INFORMATIONAL (D-11): original top-K-by-abs_diff pair-ID
  // set overlap, retained only for debugging visibility per D-11's explicit
  // allowance -- NOT a gate.
  const baselineTopK = baseline.pairs
    .slice()
    .sort((a, b) => b.abs_diff - a.abs_diff)
    .slice(0, TOP_K_FOR_OVERLAP)
    .map(pairKey);
  const candidateTopK = candidate.pairs
    .slice()
    .sort((a, b) => b.abs_diff - a.abs_diff)
    .slice(0, TOP_K_FOR_OVERLAP)
    .map(pairKey);
  const baselineTopKSet = new Set(baselineTopK);
  let hits = 0;
  for (const key of candidateTopK) {
    if (baselineTopKSet.has(key)) hits += 1;
  }
  const overlap = hits / TOP_K_FOR_OVERLAP;
  console.log(
    `rank-agreement (INFO, not gated): top-${TOP_K_FOR_OVERLAP} pair-ID set overlap = ${overlap.toFixed(4)} ` +
      '-- this is the ORIGINAL D-03/272-02 metric D-11 demoted to informational; even a fresh ' +
      'Python-vs-stored-baseline cross-process comparison only reaches ~0.42-0.50 on this fixture room'
  );

  console.log('PASS 272-rank-agreement');
}

const resultsPath = path.join(ROOM_DIR, '.rs-engine-results.json');
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    // Defensive cleanup: this test does not itself invoke rs-engine.cjs, but
    // if a future revision does, do not leave stray state in the fixture
    // room's directory.
    if (fs.existsSync(resultsPath)) {
      fs.unlinkSync(resultsPath);
    }
  });
