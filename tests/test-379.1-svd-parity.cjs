#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: svd-parity.
 * Proves CPU379-06 and D-379.1-14: the seeded randomized truncated SVD that replaces the cyclic
 * Jacobi in lib/core/numeric/svd.cjs passes the 272 rank-agreement gate at its tolerance
 * (tests/fixtures/272/noise-floor.json: LSA_SPEARMAN_MIN 0.85, LSA_AVG_DELTA_MAX 0.02,
 * LSA_MAX_DELTA_MAX 0.05, CONFIDENT_SIGN_FLIP_MAX 0) and keeps the determinism contract.
 *
 * The gate never skips. Steps:
 *   1. copy tests/fixtures/272/room to a tmp dir (the committed fixture is never written);
 *   2. a child process runs runModeInternal on the copy with MINDRIAN_SVD_SOLVER=randomized and
 *      MINDRIAN_SVD_RANDOMIZED_MIN_SIDE=1 (the 96 artifacts then take the randomized path) and
 *      writes the pairs to a scratch candidate file;
 *   3. tests/272-rank-agreement.test.cjs runs as a child with MINDRIAN_272_CANDIDATE_PATH on that
 *      file; a non-zero exit fails this test;
 *   4. the same with MINDRIAN_SVD_SOLVER=jacobi as the control;
 *   5. timing leg: the 2,105-text large fixture, k = 80, randomized only, under 60,000 ms;
 *   6. determinism: the same solve twice gives identical singular values.
 * The test is re-runnable at any time and depends on no earlier run. Plan 05 re-runs it after the
 * rs-engine cache delegation. Hermetic: scrubVendorKey + installNetGuard first; attempts() === 0
 * last. No em-dashes.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROOM_272 = path.join(REPO_ROOT, 'tests', 'fixtures', '272', 'room');
const TEST_272 = path.join(REPO_ROOT, 'tests', '272-rank-agreement.test.cjs');
const LARGE_BUILDER = path.join(REPO_ROOT, 'tests', 'fixtures', 'large-room', 'build-fixture.cjs');
const TIMING_BUDGET_MS = 60000;
const N_COMPONENTS = 80;
const MAX_FEATURES = 2000;
const MAX_DF = 0.5;

let pass = 0;
let fail = 0;
function t(label, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}

// The child gets a scrubbed environment: no vendor key, no brain URL, the solver pinned by the caller.
function childEnv(extra) {
  const env = Object.assign({}, process.env, extra || {});
  delete env.TYPESAFE_API_KEY;
  delete env.MINDRIAN_272_CANDIDATE_PATH;
  return env;
}

const CHILD_RUN_SOURCE = [
  "const path = require('node:path');",
  "const fs = require('node:fs');",
  "const rsEngine = require(path.join(process.env.REPO_ROOT_379, 'lib', 'core', 'rs-engine.cjs'));",
  'rsEngine.runModeInternal(process.env.ROOM_379, { topk: 2000, threshold: 0 }).then((result) => {',
  "  fs.writeFileSync(process.env.OUT_379, JSON.stringify({ pairs: result.pairs }), 'utf8');",
  "  process.stdout.write('CHILD_PAIRS=' + result.pairs.length + '\\n');",
  '}).catch((e) => { process.stderr.write(String(e && e.stack ? e.stack : e) + "\\n"); process.exit(1); });',
].join('\n');

function runGateLeg(solver, tmp, semanticLeg) {
  const room = path.join(tmp, 'room-' + solver);
  fs.cpSync(ROOM_272, room, { recursive: true });
  const cachePresent = fs.existsSync(path.join(room, '.rs-engine-cache.json'));
  semanticLeg.value = cachePresent ? 'cached' : 'identity_fallback';
  const out = path.join(tmp, 'candidate-' + solver + '.json');
  const env = childEnv({
    MINDRIAN_SVD_SOLVER: solver,
    MINDRIAN_SVD_RANDOMIZED_MIN_SIDE: '1',
    REPO_ROOT_379: REPO_ROOT,
    ROOM_379: room,
    OUT_379: out,
  });
  const gen = spawnSync(process.execPath, ['-e', CHILD_RUN_SOURCE], { env, encoding: 'utf8', timeout: 300000 });
  assert.equal(gen.status, 0, 'candidate generation failed (' + solver + '): ' + String(gen.stderr || '').slice(0, 400));
  assert.ok(fs.existsSync(out), 'candidate file written (' + solver + ')');
  const gate = spawnSync(process.execPath, [TEST_272], {
    env: childEnv({ MINDRIAN_272_CANDIDATE_PATH: out }),
    encoding: 'utf8',
    timeout: 300000,
  });
  const lines = String(gate.stdout || '').split('\n').filter((l) => /rank-agreement \(PRIMARY|PASS|FAIL/.test(l));
  console.log('GATE_RAN=1 solver=' + solver + ' semantic_leg=' + semanticLeg.value);
  lines.forEach((l) => console.log('    ' + l));
  assert.equal(gate.status, 0, '272 rank-agreement failed with solver ' + solver + ': ' + String(gate.stderr || gate.stdout || '').slice(0, 600));
}

function main() {
  console.log('test-379.1-svd-parity (CPU379-06, D-379.1-14)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-svd-parity-'));
  try {
    const semanticLeg = { value: 'unknown' };
    t('272 gate with the randomized solver forced (the LSA leg stays inside its noise floor)', () => {
      runGateLeg('randomized', tmp, semanticLeg);
    });
    t('272 gate with the jacobi control', () => {
      runGateLeg('jacobi', tmp, semanticLeg);
    });

    const { fitTfidf } = require(path.join(REPO_ROOT, 'lib', 'core', 'numeric', 'tfidf.cjs'));
    const { truncatedSvdWithSignFlip } = require(path.join(REPO_ROOT, 'lib', 'core', 'numeric', 'svd.cjs'));
    const rsEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-engine.cjs'));
    const builder = require(LARGE_BUILDER);
    let weights = null;
    t('large fixture: fitTfidf over 2,105 texts', () => {
      const built = builder.buildLargeRoom(tmp, { slug: 'svd-parity-large' });
      const texts = rsEngine.discoverArtifacts(built.roomDir).map((a) => a.title + '\n' + a.text);
      assert.ok(texts.length >= 2100, 'large fixture text count ' + texts.length);
      weights = fitTfidf(texts, { maxFeatures: MAX_FEATURES, maxDf: MAX_DF }).weights;
      assert.ok(Array.isArray(weights) && weights.length === texts.length, 'weights rows');
    });

    let first = null;
    t('large matrix at k = 80 solves under 60 seconds through the randomized path', () => {
      assert.ok(weights, 'weights available');
      const start = Date.now();
      first = truncatedSvdWithSignFlip(weights, N_COMPONENTS, { solver: 'randomized' });
      const elapsed = Date.now() - start;
      console.log('  timing: ' + elapsed + ' ms for ' + weights.length + ' x ' + weights[0].length + ' at k = ' + N_COMPONENTS);
      assert.equal(first.ok, true, 'svd ok');
      assert.equal(first.solver, 'randomized', 'randomized path ran');
      assert.equal(first.components.length, N_COMPONENTS, 'component count');
      assert.ok(elapsed < TIMING_BUDGET_MS, 'elapsed ' + elapsed + ' ms is not under ' + TIMING_BUDGET_MS);
    });

    t('determinism: the same solve twice gives identical singular values', () => {
      assert.ok(first, 'first solve available');
      const second = truncatedSvdWithSignFlip(weights, N_COMPONENTS, { solver: 'randomized' });
      assert.deepEqual(second.singularValues, first.singularValues);
    });

    t('auto: a matrix with a smaller side at most 300 takes the jacobi path', () => {
      const small = [];
      for (let i = 0; i < 20; i += 1) {
        const row = [];
        for (let j = 0; j < 15; j += 1) row.push(Math.sin((i + 1) * (j + 2) * 0.37) + (i === j ? 1 : 0));
        small.push(row);
      }
      const saved = process.env.MINDRIAN_SVD_SOLVER;
      delete process.env.MINDRIAN_SVD_SOLVER;
      try {
        const r = truncatedSvdWithSignFlip(small, 4);
        assert.equal(r.ok, true);
        assert.equal(r.solver, 'jacobi');
      } finally {
        if (saved !== undefined) process.env.MINDRIAN_SVD_SOLVER = saved;
      }
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

main();
