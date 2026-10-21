#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 Wave 0 probe: the TF-IDF density of the large fixture and of the real room
 * (research open question 3; the solver time scales with the non-zero count).
 *
 * Builds the large-room fixture under tmp, runs fitTfidf over its 2,105 texts on the scout's own
 * path (discoverArtifacts, title + body, maxFeatures 2000, maxDf 0.5) and records docs, terms,
 * cells = docs x terms, nnz (non-zero weights), density = nnz / cells and fit_ms. When
 * ~/MindrianRooms/jhtv-oliver-kuntz exists the same numbers are recorded read-only under real_room
 * over its full discoverArtifacts set (no exclusion, the real large-room case).
 *
 * Canon Part 8: the real room is read read-only; the result file holds numbers, booleans and enum
 * strings only. No artifact id, no path, no room text is written or printed. No network. The probe
 * lowers its own priority first. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RESULT_PATH = path.join(__dirname, 'probe-tfidf-density.json');
const MAX_FEATURES = 2000;
const MAX_DF = 0.5;

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
    probe: 'tfidf-density',
    probed_at: new Date().toISOString(),
    node_version: process.version,
    host_cores: os.availableParallelism(),
    platform: process.platform,
    status: status,
    params: { max_features: MAX_FEATURES, max_df: MAX_DF },
  };
}

function writeResult(obj) {
  fs.writeFileSync(RESULT_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function note(line) {
  process.stderr.write('probe-tfidf-density: ' + line + '\n');
}

function densityOf(fitTfidf, texts) {
  const t0 = Date.now();
  const fit = fitTfidf(texts, { maxFeatures: MAX_FEATURES, maxDf: MAX_DF });
  const fit_ms = Date.now() - t0;
  const docs = fit.weights.length;
  const terms = fit.vocabulary.length;
  let nnz = 0;
  for (let d = 0; d < docs; d += 1) {
    const row = fit.weights[d];
    for (let c = 0; c < row.length; c += 1) if (row[c] !== 0) nnz += 1;
  }
  const cells = docs * terms;
  return { docs: docs, terms: terms, cells: cells, nnz: nnz, density: cells > 0 ? nnz / cells : 0, fit_ms: fit_ms };
}

function main() {
  lowerPriority();
  const rsEngine = require(path.join(ROOT, 'lib', 'core', 'rs-engine.cjs'));
  const { fitTfidf } = require(path.join(ROOT, 'lib', 'core', 'numeric', 'tfidf.cjs'));
  const builder = require(path.join(ROOT, 'tests', 'fixtures', 'large-room', 'build-fixture.cjs'));

  const out = baseResult('ok');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-probe-density-'));
  try {
    note('building the large fixture under tmp');
    const built = builder.buildLargeRoom(tmp, { slug: 'probe-density' });
    const texts = rsEngine.discoverArtifacts(built.roomDir).map((a) => a.title + '\n' + a.text);
    note('fitting TF-IDF over ' + texts.length + ' fixture texts');
    Object.assign(out, densityOf(fitTfidf, texts));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const realRoom = path.join(os.homedir(), 'MindrianRooms', 'jhtv-oliver-kuntz');
  if (fs.existsSync(realRoom) && fs.statSync(realRoom).isDirectory()) {
    const texts = rsEngine.discoverArtifacts(realRoom).map((a) => a.title + '\n' + a.text);
    note('fitting TF-IDF over ' + texts.length + ' real-room texts (read-only)');
    out.real_room = densityOf(fitTfidf, texts);
  } else {
    out.real_room = null;
    out.real_room_note = 'real room absent: the real density is unmeasured';
  }
  writeResult(out);
  note('fixture density ' + out.density + (out.real_room ? ' real density ' + out.real_room.density : ''));
}

if (require.main === module) {
  try {
    main();
    process.exit(0);
  } catch (e) {
    const out = baseResult('error');
    out.error = scrub(e && e.message);
    try { writeResult(out); } catch (_e) { /* nothing more to do */ }
    process.stderr.write('probe-tfidf-density: error ' + out.error + '\n');
    process.exit(1);
  }
}

module.exports = { densityOf, MAX_FEATURES, MAX_DF };
