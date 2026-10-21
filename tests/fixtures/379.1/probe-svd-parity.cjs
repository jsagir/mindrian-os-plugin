#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 Wave 0 probe: the 272 parity gate thresholds and the Jacobi time at n = 400
 * (D-379.1-14, research open question 2, assumption A6).
 *
 * Records the gate object of tests/fixtures/272/noise-floor.json verbatim (the thresholds the
 * svd-parity test of Plan 03 applies), whether the hermetic .rs-engine-cache.json of the 272 room is
 * present, and two timings of the CURRENT solver on the scout's own path (fitTfidf with the rs-math
 * defaults maxFeatures 2000 and maxDf 0.5, then truncatedSvdWithSignFlip(weights, 80)):
 *   jacobi_ms_fixture  the 272 fixture room (96 artifacts, discoverArtifacts, title + body)
 *   jacobi_ms_n400     the first 400 generated texts of the large-room fixture built under tmp
 * The solver never runs at n = 2,000 here. rs_max_artifacts_default = 400 when jacobi_ms_n400 is at
 * most 60,000 ms, else 200 (the scout cap Plan 05 ships). jacobi_sweeps_n400 is null: the solver
 * does not expose its sweep count.
 *
 * Canon Part 8: only committed fixture text and tmp fixture text are read; the result file holds
 * numbers, booleans and enum strings only. No network. The probe lowers its own priority first.
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RESULT_PATH = path.join(__dirname, 'probe-svd-parity.json');
const NOISE_FLOOR_PATH = path.join(ROOT, 'tests', 'fixtures', '272', 'noise-floor.json');
const FIXTURE_ROOM_272 = path.join(ROOT, 'tests', 'fixtures', '272', 'room');
const HERMETIC_CACHE_272 = path.join(FIXTURE_ROOM_272, '.rs-engine-cache.json');
const MAX_FEATURES = 2000;
const MAX_DF = 0.5;
const N_COMPONENTS = 80;
const N_LARGE = 400;
const JACOBI_BUDGET_MS = 60000;
const CANDIDATE_REGENERATION = 'tests/fixtures/272/generate-candidate.cjs with TOPK 2000 THRESHOLD 0';

function lowerPriority() {
  try {
    os.setPriority(0, process.platform === 'win32' ? os.constants.priority.PRIORITY_BELOW_NORMAL : 19);
  } catch (_e) { /* advisory */ }
}

function scrub(msg) {
  return String(msg || '').replace(/\/[^\s'"]+/g, '<path>').slice(0, 200);
}

function baseResult(status) {
  return {
    probe: 'svd-parity',
    probed_at: new Date().toISOString(),
    node_version: process.version,
    host_cores: os.availableParallelism(),
    platform: process.platform,
    status: status,
    params: { max_features: MAX_FEATURES, max_df: MAX_DF, n_components: N_COMPONENTS, n_large: N_LARGE, jacobi_budget_ms: JACOBI_BUDGET_MS },
  };
}

function writeResult(obj) {
  fs.writeFileSync(RESULT_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function note(line) {
  process.stderr.write('probe-svd-parity: ' + line + '\n');
}

/* The scout's own LSA input: discoverArtifacts applies extractTitle and extractBody; the engine joins title and body. */
function engineTexts(rsEngine, roomDir) {
  return rsEngine.discoverArtifacts(roomDir).map((a) => a.title + '\n' + a.text);
}

function timeSolver(fitTfidf, truncatedSvdWithSignFlip, texts) {
  const tFit = Date.now();
  const fit = fitTfidf(texts, { maxFeatures: MAX_FEATURES, maxDf: MAX_DF });
  const fit_ms = Date.now() - tFit;
  const docs = fit.weights.length;
  const terms = fit.vocabulary.length;
  const tSvd = Date.now();
  const svd = truncatedSvdWithSignFlip(fit.weights, N_COMPONENTS);
  const svd_ms = Date.now() - tSvd;
  return { docs: docs, terms: terms, gram_dim: Math.min(docs, terms), fit_ms: fit_ms, svd_ms: svd_ms, svd_ok: svd && svd.ok === true, components: svd && Array.isArray(svd.components) ? svd.components.length : 0 };
}

function main() {
  lowerPriority();
  const rsEngine = require(path.join(ROOT, 'lib', 'core', 'rs-engine.cjs'));
  const { fitTfidf } = require(path.join(ROOT, 'lib', 'core', 'numeric', 'tfidf.cjs'));
  const { truncatedSvdWithSignFlip } = require(path.join(ROOT, 'lib', 'core', 'numeric', 'svd.cjs'));
  const builder = require(path.join(ROOT, 'tests', 'fixtures', 'large-room', 'build-fixture.cjs'));

  const noiseFloor = JSON.parse(fs.readFileSync(NOISE_FLOOR_PATH, 'utf8'));
  const out = baseResult('ok');
  out.gate = noiseFloor.gate;
  out.fixture_artifact_count = noiseFloor.artifact_count;
  out.hermetic_cache_present = fs.existsSync(HERMETIC_CACHE_272);

  note('timing the 272 fixture room');
  const fixtureTexts = engineTexts(rsEngine, FIXTURE_ROOM_272);
  const fixtureRun = timeSolver(fitTfidf, truncatedSvdWithSignFlip, fixtureTexts);
  out.fixture_discovered = fixtureTexts.length;
  out.fixture_docs = fixtureRun.docs;
  out.fixture_terms = fixtureRun.terms;
  out.fixture_gram_dim = fixtureRun.gram_dim;
  out.fixture_fit_ms = fixtureRun.fit_ms;
  out.jacobi_ms_fixture = fixtureRun.svd_ms;
  out.fixture_svd_ok = fixtureRun.svd_ok;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-probe-svd-'));
  try {
    note('building the large fixture under tmp');
    const built = builder.buildLargeRoom(tmp, { slug: 'probe-svd' });
    const generated = rsEngine.discoverArtifacts(built.roomDir)
      .filter((a) => a.id.indexOf('generated-run-379') !== -1)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, N_LARGE)
      .map((a) => a.title + '\n' + a.text);
    note('timing the solver at n = ' + generated.length);
    const largeRun = timeSolver(fitTfidf, truncatedSvdWithSignFlip, generated);
    out.n400_docs = largeRun.docs;
    out.n400_terms = largeRun.terms;
    out.n400_gram_dim = largeRun.gram_dim;
    out.n400_fit_ms = largeRun.fit_ms;
    out.jacobi_ms_n400 = largeRun.svd_ms;
    out.jacobi_sweeps_n400 = null;
    out.n400_svd_ok = largeRun.svd_ok;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  out.rs_max_artifacts_default = out.jacobi_ms_n400 <= JACOBI_BUDGET_MS ? 400 : 200;
  out.candidate_regeneration = CANDIDATE_REGENERATION;
  writeResult(out);
  note('jacobi_ms_fixture ' + out.jacobi_ms_fixture + ' jacobi_ms_n400 ' + out.jacobi_ms_n400 + ' rs_max_artifacts_default ' + out.rs_max_artifacts_default);
}

if (require.main === module) {
  try {
    main();
    process.exit(0);
  } catch (e) {
    const out = baseResult('error');
    out.error = scrub(e && e.message);
    try { writeResult(out); } catch (_e) { /* nothing more to do */ }
    process.stderr.write('probe-svd-parity: error ' + out.error + '\n');
    process.exit(1);
  }
}

module.exports = { timeSolver, MAX_FEATURES, MAX_DF, N_COMPONENTS, N_LARGE, JACOBI_BUDGET_MS };
