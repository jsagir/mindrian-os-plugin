#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/272-rank-agreement.test.cjs
 *
 * Phase 272, PYPORT-05 (D-03 rank-agreement gate). RED by design until
 * tests/fixtures/272/candidate-cjs.fixture.json exists (generated in plan
 * 272-08, once lib/core/rs-engine.cjs can run for real against
 * tests/fixtures/272/room). tests/fixtures/272/baseline-python.fixture.json
 * already exists (plan 272-02, Task 2) -- if this test is RED, it must be
 * RED for the missing CANDIDATE side specifically, never a crash on the
 * baseline fixture.
 *
 * The gate's actual meaning (D-03, RESEARCH.md Code Examples gateOnePair):
 * rank agreement PLUS zero CONFIDENT sign flips -- NOT byte-compat, NOT a
 * raw overlap percentage alone. A direction disagreement is a hard FAIL
 * only when BOTH sides' abs(signed_diff) clear the confidence-margin
 * threshold; otherwise it is a WARN (logged, does not fail the test). This
 * reuses the confidence-margin pattern already shipped in
 * lib/core/eureka/embedding-classifier.cjs (DEFAULT_MARGIN = 0.10, read at
 * embedding-classifier.cjs:104), per D-03's explicit instruction to reuse
 * that pattern rather than inventing a new one.
 *
 * The rank-agreement threshold itself is NOT hardcoded here -- it is read
 * PROGRAMMATICALLY from tests/fixtures/272/noise-floor.json (the
 * machine-readable sibling of NOISE-FLOOR.md, both written by plan 272-02
 * Task 2's tests/fixtures/272/generate-baseline.py), cross-checked against
 * NOISE-FLOOR.md's own fenced RANK_AGREEMENT_GATE_THRESHOLD line so a future
 * drift between the two fails loudly instead of silently using a stale
 * value.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

const TOP_K_FOR_OVERLAP = 50;

function pairKey(row) {
  return `${row.source_artifact_id}|${row.target_artifact_id}`;
}

// Source: shape from tests/127.1-graphrag-overlap.test.cjs:123-137
// (setOverlap), margin logic from
// lib/core/eureka/embedding-classifier.cjs:203-208. Verbatim from
// 272-RESEARCH.md's Code Examples section, "The D-03 gate, reusing the
// 127.1 shape".
function gateOnePair(pyRow, cjsRow, marginThreshold) {
  const bothConfident =
    Math.abs(pyRow.signed_diff) >= marginThreshold && Math.abs(cjsRow.signed_diff) >= marginThreshold;
  const flipped = pyRow.direction !== cjsRow.direction;
  if (flipped && bothConfident) return { verdict: 'FAIL', reason: 'confident_sign_flip' };
  if (flipped) return { verdict: 'WARN', reason: 'sign_flip_inside_margin' };
  return { verdict: 'PASS' };
}

function readGateThreshold() {
  if (!fs.existsSync(NOISE_FLOOR_JSON_PATH)) {
    throw new Error(
      `noise-floor.json missing at ${path.relative(REPO_ROOT, NOISE_FLOOR_JSON_PATH)} -- ` +
        'run tests/fixtures/272/generate-baseline.py (plan 272-02 Task 2) first'
    );
  }
  const json = JSON.parse(fs.readFileSync(NOISE_FLOOR_JSON_PATH, 'utf8'));
  const jsonThreshold = json.RANK_AGREEMENT_GATE_THRESHOLD;
  assert.equal(
    typeof jsonThreshold,
    'number',
    'noise-floor.json must have a numeric RANK_AGREEMENT_GATE_THRESHOLD field'
  );

  // Cross-check against NOISE-FLOOR.md's own fenced line -- if the two ever
  // drift, fail loudly citing the mismatch rather than silently trusting
  // whichever one was read first.
  if (fs.existsSync(NOISE_FLOOR_MD_PATH)) {
    const md = fs.readFileSync(NOISE_FLOOR_MD_PATH, 'utf8');
    const match = md.match(/RANK_AGREEMENT_GATE_THRESHOLD\s*=\s*([0-9.]+)/);
    if (match) {
      const mdThreshold = Number(match[1]);
      assert.equal(
        mdThreshold,
        jsonThreshold,
        `RANK_AGREEMENT_GATE_THRESHOLD drift detected: NOISE-FLOOR.md says ${mdThreshold}, ` +
          `noise-floor.json says ${jsonThreshold} -- regenerate both via generate-baseline.py`
      );
    }
  }

  return jsonThreshold;
}

async function main() {
  // Gate 1: baseline fixture must exist (plan 272-02 Task 2 produces it).
  // This must NOT be the reason this test is RED today.
  if (!fs.existsSync(BASELINE_PATH)) {
    console.log(
      `baseline-python.fixture.json missing -- plan 272-02 Task 2 must run first to produce ` +
        `${path.relative(REPO_ROOT, BASELINE_PATH)}`
    );
    process.exitCode = 1;
    return;
  }

  // Gate 2: candidate fixture must exist (plan 272-08 produces it, once
  // lib/core/rs-engine.cjs can run for real against the fixture room). THIS
  // is the specific, expected RED reason for Phase 272 Wave 0.
  if (!fs.existsSync(CANDIDATE_PATH)) {
    console.log(
      'candidate-cjs.fixture.json missing -- run rs-engine.cjs against the fixture room first ' +
        '(plan 272-08)'
    );
    process.exitCode = 1;
    return;
  }

  const threshold = readGateThreshold();

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const candidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));

  assert.ok(Array.isArray(baseline.pairs) && baseline.pairs.length > 0, 'baseline fixture must have pairs[]');
  assert.ok(Array.isArray(candidate.pairs) && candidate.pairs.length > 0, 'candidate fixture must have pairs[]');

  // --- Top-50-by-abs_diff pair-id-set overlap ---
  const baselineTop50 = baseline.pairs
    .slice()
    .sort((a, b) => b.abs_diff - a.abs_diff)
    .slice(0, TOP_K_FOR_OVERLAP)
    .map(pairKey);
  const candidateTop50 = candidate.pairs
    .slice()
    .sort((a, b) => b.abs_diff - a.abs_diff)
    .slice(0, TOP_K_FOR_OVERLAP)
    .map(pairKey);

  const baselineTop50Set = new Set(baselineTop50);
  let hits = 0;
  for (const key of candidateTop50) {
    if (baselineTop50Set.has(key)) hits += 1;
  }
  const overlap = hits / TOP_K_FOR_OVERLAP;

  console.log(`rank-agreement: top-${TOP_K_FOR_OVERLAP} pair overlap = ${overlap.toFixed(4)} (gate >= ${threshold})`);
  assert.ok(
    overlap >= threshold,
    `top-${TOP_K_FOR_OVERLAP} pair overlap ${overlap.toFixed(4)} is below RANK_AGREEMENT_GATE_THRESHOLD ` +
      `${threshold} (see tests/fixtures/272/NOISE-FLOOR.md for provenance)`
  );

  // --- Confidence-margin gate: zero confident sign flips across shared pairs ---
  const baselineByKey = new Map(baseline.pairs.map((p) => [pairKey(p), p]));
  const candidateByKey = new Map(candidate.pairs.map((p) => [pairKey(p), p]));

  const sharedKeys = [...baselineByKey.keys()].filter((k) => candidateByKey.has(k));
  assert.ok(sharedKeys.length > 0, 'baseline and candidate fixtures share zero pairs -- cannot gate');

  const failures = [];
  let warnCount = 0;
  for (const key of sharedKeys) {
    const pyRow = baselineByKey.get(key);
    const cjsRow = candidateByKey.get(key);
    const gate = gateOnePair(pyRow, cjsRow, CONFIDENCE_MARGIN_THRESHOLD);
    if (gate.verdict === 'FAIL') {
      failures.push({ key, reason: gate.reason, pyRow, cjsRow });
    } else if (gate.verdict === 'WARN') {
      warnCount += 1;
      // WARN pairs are logged but do NOT fail the test (D-03: only
      // confident sign flips fail; a sign flip inside the margin is
      // expected numerical-library noise).
      console.log(`rank-agreement: WARN sign_flip_inside_margin for pair ${key}`);
    }
  }

  console.log(`rank-agreement: ${sharedKeys.length} shared pairs, ${warnCount} WARN, ${failures.length} FAIL`);
  assert.equal(
    failures.length,
    0,
    `${failures.length} confident_sign_flip (FAIL) pair(s) found: ${JSON.stringify(failures.slice(0, 5))}`
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
